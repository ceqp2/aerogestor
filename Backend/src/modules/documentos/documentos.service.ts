import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma, TipoVinculoDoc } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditoriaService } from '../../common/auditoria.service';
import { Ctx, ehLeituraUnidade, ehSecretaria } from '../../common/contexto';
import { sha256 } from '../../common/crypto';
import { EscopoService } from '../../common/escopo.service';
import { StorageService } from './storage';
import { detectarTipo, nomeSeguro } from './tipo-arquivo';

export interface ArquivoRecebido {
  originalname: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class DocumentosService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService,
    private escopo: EscopoService,
    private storage: StorageService,
  ) {}

  /** Confirma que a entidade vinculada existe na unidade e resolve o contrato (para escopo de gestor). */
  async resolverVinculo(ctx: Ctx, tipo: TipoVinculoDoc, entidadeId: string): Promise<{ contratoId: string | null; atribuidoGestorId?: string | null }> {
    const u = ctx.unidadeId;
    const nf = <T>(p: Promise<T | null>) => this.escopo.daUnidade(p, 'Registro vinculado');
    switch (tipo) {
      case 'CONTRATO':
        await nf(this.prisma.contratoInstrumento.findFirst({ where: { id: entidadeId, unidadeId: u } }));
        return { contratoId: entidadeId };
      case 'ENTREGA':
        return { contratoId: (await nf(this.prisma.entrega.findFirst({ where: { id: entidadeId, unidadeId: u } }))).contratoId };
      case 'MEDICAO':
        return { contratoId: (await nf(this.prisma.medicao.findFirst({ where: { id: entidadeId, unidadeId: u } }))).contratoId };
      case 'NOTA_FISCAL':
        return { contratoId: (await nf(this.prisma.notaFiscal.findFirst({ where: { id: entidadeId, unidadeId: u } }))).contratoId };
      case 'SOLICITACAO':
        return { contratoId: (await nf(this.prisma.solicitacao.findFirst({ where: { id: entidadeId, unidadeId: u } }))).contratoId };
      case 'RISCO':
        return { contratoId: (await nf(this.prisma.risco.findFirst({ where: { id: entidadeId, unidadeId: u } }))).contratoId };
      case 'CHECKLIST_ITEM': {
        const i = await nf(this.prisma.checklistItem.findFirst({ where: { id: entidadeId, processo: { unidadeId: u } } }));
        return { contratoId: null, atribuidoGestorId: i.atribuidoGestorId };
      }
      case 'PROCESSO':
        await nf(this.prisma.processo.findFirst({ where: { id: entidadeId, unidadeId: u } }));
        return { contratoId: null };
      case 'ATA':
        await nf(this.prisma.ata.findFirst({ where: { id: entidadeId, unidadeId: u } }));
        return { contratoId: null };
      case 'EMPENHO':
        await nf(this.prisma.empenho.findFirst({ where: { id: entidadeId, unidadeId: u } }));
        return { contratoId: null };
      case 'GERAL':
        if (entidadeId !== u) throw new BadRequestException('Vínculo geral usa o id da unidade');
        return { contratoId: null };
    }
  }

  /** Gestor só envia para contratos atribuídos ou tarefas de checklist expressamente atribuídas. */
  private async assertPodeEnviar(ctx: Ctx, tipo: TipoVinculoDoc, entidadeId: string) {
    if (ctx.perfil === 'COMANDANTE') throw new ForbiddenException('Perfil somente leitura');
    const v = await this.resolverVinculo(ctx, tipo, entidadeId);
    if (ehSecretaria(ctx)) return v;
    if (tipo === 'CHECKLIST_ITEM' && v.atribuidoGestorId === ctx.usuarioId) return v;
    if (v.contratoId) {
      await this.escopo.assertContrato(ctx, v.contratoId);
      return v;
    }
    throw new ForbiddenException('Sem permissão para anexar documentos a este registro');
  }

  /** Filtro de documentos visíveis: unidade toda (leitura) ou, para gestor, liberados no escopo dos seus contratos. */
  private async filtroVisiveis(ctx: Ctx): Promise<Prisma.DocumentoWhereInput> {
    if (ehLeituraUnidade(ctx)) return { unidadeId: ctx.unidadeId };
    const contratos = (await this.escopo.contratosPermitidos(ctx)) ?? [];
    const tarefas = await this.prisma.checklistItem.findMany({ where: { atribuidoGestorId: ctx.usuarioId, processo: { unidadeId: ctx.unidadeId } }, select: { id: true } });
    return {
      unidadeId: ctx.unidadeId,
      OR: [
        { criadoPor: ctx.usuarioId },
        { liberadoGestor: true, vinculos: { some: { contratoId: { in: contratos } } } },
        { vinculos: { some: { tipo: 'CHECKLIST_ITEM', entidadeId: { in: tarefas.map((t) => t.id) } } } },
      ],
    };
  }

  private validarArquivo(arq: ArquivoRecebido | undefined) {
    if (!arq || !arq.buffer?.length) throw new BadRequestException('Arquivo obrigatório');
    const tipo = detectarTipo(arq.buffer, arq.originalname);
    if (!tipo) throw new BadRequestException('Tipo de arquivo não permitido ou conteúdo incompatível com a extensão (aceitos: PDF, PNG, JPG, WEBP, DOCX, XLSX, PPTX, ODT, ODS, TXT, CSV)');
    return tipo;
  }

  private async gravar(arq: ArquivoRecebido, mime: string) {
    const chave = randomBytes(32).toString('hex');
    await this.storage.salvar(chave, arq.buffer, mime);
    return { chave, hash: sha256(arq.buffer) };
  }

  async enviar(
    ctx: Ctx,
    arq: ArquivoRecebido | undefined,
    meta: { titulo: string; categoria: string; vinculoTipo: TipoVinculoDoc; vinculoId: string; liberadoGestor?: boolean },
  ) {
    const v = await this.assertPodeEnviar(ctx, meta.vinculoTipo, meta.vinculoId);
    const tipo = this.validarArquivo(arq);
    const { chave, hash } = await this.gravar(arq!, tipo.mime);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const doc = await tx.documento.create({
          data: {
            unidadeId: ctx.unidadeId, titulo: meta.titulo, categoria: meta.categoria,
            liberadoGestor: ehSecretaria(ctx) ? !!meta.liberadoGestor : true, criadoPor: ctx.usuarioId,
          },
        });
        await tx.versaoDocumento.create({
          data: { documentoId: doc.id, versao: 1, nomeOriginal: nomeSeguro(arq!.originalname), chaveStorage: chave, mime: tipo.mime, tamanho: arq!.size, sha256: hash, criadoPor: ctx.usuarioId },
        });
        await tx.vinculoDocumento.create({ data: { documentoId: doc.id, tipo: meta.vinculoTipo, entidadeId: meta.vinculoId, contratoId: v.contratoId } });
        await this.auditoria.registrar(tx, ctx, {
          acao: 'DOCUMENTO_ENVIADO', entidade: 'Documento', entidadeId: doc.id,
          depois: { titulo: doc.titulo, categoria: doc.categoria, vinculo: `${meta.vinculoTipo}:${meta.vinculoId}`, sha256: hash, tamanho: arq!.size },
        });
        if (meta.vinculoTipo === 'PROCESSO' || meta.vinculoTipo === 'CHECKLIST_ITEM') {
          const processoId = meta.vinculoTipo === 'PROCESSO' ? meta.vinculoId : (await tx.checklistItem.findUniqueOrThrow({ where: { id: meta.vinculoId } })).processoId;
          await this.auditoria.registrar(tx, ctx, { acao: 'DOCUMENTO_ANEXADO', entidade: 'Processo', entidadeId: processoId, depois: { titulo: doc.titulo } });
        }
        if (v.contratoId) {
          await this.auditoria.registrar(tx, ctx, { acao: 'DOCUMENTO_ANEXADO', entidade: 'ContratoInstrumento', entidadeId: v.contratoId, depois: { titulo: doc.titulo } });
        }
        return doc;
      });
    } catch (e) {
      await this.storage.remover(chave).catch(() => undefined);
      throw e;
    }
  }

  async novaVersao(ctx: Ctx, documentoId: string, arq: ArquivoRecebido | undefined) {
    const doc = await this.obterVisivel(ctx, documentoId);
    if (!ehSecretaria(ctx) && doc.criadoPor !== ctx.usuarioId) throw new ForbiddenException('Somente a secretaria ou o autor versiona este documento');
    if (doc.arquivadoEm) throw new BadRequestException('Documento arquivado');
    const tipo = this.validarArquivo(arq);
    const { chave, hash } = await this.gravar(arq!, tipo.mime);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const ult = await tx.versaoDocumento.aggregate({ where: { documentoId }, _max: { versao: true } });
        const v = await tx.versaoDocumento.create({
          data: { documentoId, versao: (ult._max.versao ?? 0) + 1, nomeOriginal: nomeSeguro(arq!.originalname), chaveStorage: chave, mime: tipo.mime, tamanho: arq!.size, sha256: hash, criadoPor: ctx.usuarioId },
        });
        await this.auditoria.registrar(tx, ctx, { acao: 'DOCUMENTO_VERSIONADO', entidade: 'Documento', entidadeId: documentoId, depois: { versao: v.versao, sha256: hash } });
        return v;
      });
    } catch (e) {
      await this.storage.remover(chave).catch(() => undefined);
      throw e;
    }
  }

  async listar(ctx: Ctx, q: { vinculoTipo?: TipoVinculoDoc; vinculoId?: string; busca?: string; categoria?: string }) {
    if (q.vinculoTipo && q.vinculoId && !ehLeituraUnidade(ctx)) {
      // gestor: garante escopo antes de listar por vínculo
      const v = await this.resolverVinculo(ctx, q.vinculoTipo, q.vinculoId);
      if (v.contratoId) await this.escopo.assertContrato(ctx, v.contratoId);
    }
    const docs = await this.prisma.documento.findMany({
      where: {
        AND: [
          await this.filtroVisiveis(ctx),
          { arquivadoEm: null, categoria: q.categoria || undefined },
          q.vinculoTipo && q.vinculoId ? { vinculos: { some: { tipo: q.vinculoTipo, entidadeId: q.vinculoId } } } : {},
          q.busca ? { titulo: { contains: q.busca, mode: 'insensitive' } } : {},
        ],
      },
      include: {
        versoes: { orderBy: { versao: 'desc' }, select: { id: true, versao: true, nomeOriginal: true, mime: true, tamanho: true, sha256: true, criadoEm: true, criadoPor: true } },
        vinculos: true,
      },
      orderBy: { criadoEm: 'desc' },
      take: 300,
    });
    return docs;
  }

  private async obterVisivel(ctx: Ctx, id: string) {
    const d = await this.prisma.documento.findFirst({ where: { AND: [{ id }, await this.filtroVisiveis(ctx)] } });
    if (!d) throw new NotFoundException('Documento não encontrado');
    return d;
  }

  /** Download autorizado a cada requisição; integridade conferida pelo hash. */
  async baixar(ctx: Ctx, id: string, versao?: number) {
    const doc = await this.obterVisivel(ctx, id);
    const v = await this.prisma.versaoDocumento.findFirst({
      where: { documentoId: doc.id, ...(versao ? { versao } : {}) },
      orderBy: { versao: 'desc' },
    });
    if (!v) throw new NotFoundException('Versão não encontrada');
    const dados = await this.storage.ler(v.chaveStorage);
    if (sha256(dados) !== v.sha256) throw new InternalServerErrorException('Falha de integridade do arquivo armazenado');
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'DOCUMENTO_BAIXADO', entidade: 'Documento', entidadeId: id, depois: { versao: v.versao } });
    return { dados, mime: v.mime, nome: v.nomeOriginal };
  }

  async atualizar(ctx: Ctx, id: string, dto: { titulo?: string; categoria?: string; liberadoGestor?: boolean }) {
    const antes = await this.obterVisivel(ctx, id);
    const depois = await this.prisma.documento.update({ where: { id }, data: dto });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'DOCUMENTO_ATUALIZADO', entidade: 'Documento', entidadeId: id, antes, depois });
    return depois;
  }

  /** Arquivamento lógico (retenção/descarte seguem política institucional, não exclusão pela aplicação). */
  async arquivar(ctx: Ctx, id: string, motivo: string) {
    await this.obterVisivel(ctx, id);
    await this.prisma.documento.update({ where: { id }, data: { arquivadoEm: new Date() } });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'DOCUMENTO_ARQUIVADO', entidade: 'Documento', entidadeId: id, motivo });
  }

  async vincular(ctx: Ctx, id: string, tipo: TipoVinculoDoc, entidadeId: string) {
    await this.obterVisivel(ctx, id);
    const v = await this.resolverVinculo(ctx, tipo, entidadeId);
    const r = await this.prisma.vinculoDocumento.create({ data: { documentoId: id, tipo, entidadeId, contratoId: v.contratoId } });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'DOCUMENTO_VINCULADO', entidade: 'Documento', entidadeId: id, depois: r });
    return r;
  }
}
