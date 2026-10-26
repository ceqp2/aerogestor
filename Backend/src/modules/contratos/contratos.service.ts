import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditoriaService } from '../../common/auditoria.service';
import { Ctx, ehLeituraUnidade } from '../../common/contexto';
import { dataCivil, dataCivilOpc, hojeCivil, isoData, somarDias } from '../../common/datas';
import { quantidade, valorMonetario } from '../../common/dinheiro';
import { EscopoService } from '../../common/escopo.service';
import { paginar, resultado } from '../../common/paginacao';
import { impedimentosUtilizacao } from '../atas/atas.regras';
import {
  AditivoDto, AtualizarContratoDto, ConfirmarDesignacaoDto, ContratosQuery, CorrecaoContratoDto, CriarContratoDto, EncerrarDesignacaoDto,
  FornecedorDto, IndicarDesignacaoDto, ItemContratoDto, SituacaoContratoDto,
} from './contratos.dto';
import { documentoFiscalValido, somenteDigitos } from './documento-fiscal';

@Injectable()
export class ContratosService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService,
    private escopo: EscopoService,
  ) {}

  // ───── Fornecedores ─────

  listarFornecedores(ctx: Ctx, busca?: string) {
    return this.prisma.fornecedor.findMany({
      where: {
        unidadeId: ctx.unidadeId,
        OR: busca ? [{ razaoSocial: { contains: busca, mode: 'insensitive' } }, { documento: { contains: somenteDigitos(busca) || busca } }] : undefined,
      },
      orderBy: { razaoSocial: 'asc' },
      take: 200,
    });
  }

  async criarFornecedor(ctx: Ctx, dto: FornecedorDto) {
    const documento = somenteDigitos(dto.documento);
    if (!documentoFiscalValido(documento)) throw new BadRequestException('CPF/CNPJ inválido');
    const f = await this.prisma.fornecedor.create({
      data: { unidadeId: ctx.unidadeId, documento, razaoSocial: dto.razaoSocial.trim(), email: dto.email, telefone: dto.telefone },
    });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'FORNECEDOR_CRIADO', entidade: 'Fornecedor', entidadeId: f.id, depois: f });
    return f;
  }

  async atualizarFornecedor(ctx: Ctx, id: string, dto: Partial<FornecedorDto>) {
    const antes = await this.escopo.daUnidade(this.prisma.fornecedor.findFirst({ where: { id, unidadeId: ctx.unidadeId } }), 'Fornecedor');
    const documento = dto.documento ? somenteDigitos(dto.documento) : undefined;
    if (documento && !documentoFiscalValido(documento)) throw new BadRequestException('CPF/CNPJ inválido');
    const depois = await this.prisma.fornecedor.update({ where: { id }, data: { ...dto, documento } });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'FORNECEDOR_ATUALIZADO', entidade: 'Fornecedor', entidadeId: id, antes, depois });
    return depois;
  }

  // ───── Contratos ─────

  async listar(ctx: Ctx, q: ContratosQuery) {
    const { skip, take, pagina, tamanho } = paginar(q);
    const hoje = hojeCivil();
    const where: Prisma.ContratoInstrumentoWhereInput = {
      AND: [
        await this.escopo.filtroContratos(ctx),
        {
          situacao: q.situacao,
          natureza: q.natureza,
          vigenciaFim: q.vencendoEmDias !== undefined ? { gte: hoje, lte: somarDias(hoje, q.vencendoEmDias) } : undefined,
        },
        q.semDesignacao === 'true' ? { situacao: 'VIGENTE', designacoes: { none: { status: 'ATIVA', funcao: { in: ['GESTOR', 'GESTOR_SUBSTITUTO'] } } } } : {},
        q.busca
          ? { OR: [{ numero: { contains: q.busca, mode: 'insensitive' } }, { objeto: { contains: q.busca, mode: 'insensitive' } }] }
          : {},
      ],
    };
    const [itens, total] = await Promise.all([
      this.prisma.contratoInstrumento.findMany({
        where, skip, take, orderBy: { vigenciaFim: 'asc' },
        include: {
          designacoes: { where: { status: { in: ['ATIVA', 'PENDENTE'] } }, include: { usuario: { select: { id: true, nome: true } } } },
        },
      }),
      this.prisma.contratoInstrumento.count({ where }),
    ]);
    const fornecedores = await this.prisma.fornecedor.findMany({ where: { id: { in: itens.map((i) => i.fornecedorId) } } });
    return resultado(
      itens.map((c) => ({
        ...c,
        fornecedor: fornecedores.find((f) => f.id === c.fornecedorId),
        diasParaVencer: Math.round((c.vigenciaFim.getTime() - hoje.getTime()) / 86400000),
        vigenciaExpirada: c.vigenciaFim < hoje,
      })),
      total, pagina, tamanho,
    );
  }

  async detalhe(ctx: Ctx, id: string) {
    await this.escopo.assertContrato(ctx, id);
    const c = await this.prisma.contratoInstrumento.findUniqueOrThrow({
      where: { id },
      include: {
        itens: { orderBy: { numero: 'asc' } },
        designacoes: { orderBy: { criadoEm: 'desc' }, include: { usuario: { select: { id: true, nome: true, postoGraduacao: true } } } },
        aditivos: { orderBy: { dataAssinatura: 'asc' } },
        processo: { select: { id: true, numeroInterno: true, nup: true, objeto: true } },
        ata: { select: { id: true, numero: true, orgaoGerenciador: true, vigenciaFim: true } },
      },
    });
    const fornecedor = await this.prisma.fornecedor.findUnique({ where: { id: c.fornecedorId } });
    const hoje = hojeCivil();
    return {
      ...c,
      fornecedor,
      diasParaVencer: Math.round((c.vigenciaFim.getTime() - hoje.getTime()) / 86400000),
      vigenciaExpirada: c.vigenciaFim < hoje,
      // vigência expirada NÃO significa execução encerrada
      execucaoEncerrada: c.situacao === 'EXECUCAO_ENCERRADA',
      podeEditar: ehLeituraUnidade(ctx) && ctx.perfil !== 'COMANDANTE',
      minhasFuncoes: c.designacoes.filter((d) => d.usuarioId === ctx.usuarioId && d.status !== 'ENCERRADA').map((d) => ({ funcao: d.funcao, status: d.status })),
    };
  }

  private async validarRefs(ctx: Ctx, dto: { processoId?: string; ataId?: string; fornecedorId?: string }) {
    if (dto.fornecedorId) {
      await this.escopo.daUnidade(this.prisma.fornecedor.findFirst({ where: { id: dto.fornecedorId, unidadeId: ctx.unidadeId } }), 'Fornecedor');
    }
    if (dto.processoId) {
      await this.escopo.daUnidade(this.prisma.processo.findFirst({ where: { id: dto.processoId, unidadeId: ctx.unidadeId } }), 'Processo');
    }
    if (dto.ataId) {
      const ata = await this.escopo.daUnidade(this.prisma.ata.findFirst({ where: { id: dto.ataId, unidadeId: ctx.unidadeId } }), 'Ata');
      const imp = impedimentosUtilizacao(ata, hojeCivil());
      if (imp.length) throw new UnprocessableEntityException(`Ata não pode originar nova contratação: ${imp.join('; ')}`);
    }
  }

  async criar(ctx: Ctx, dto: CriarContratoDto) {
    await this.validarRefs(ctx, dto);
    const vi = dataCivil(dto.vigenciaInicio);
    const vf = dataCivil(dto.vigenciaFim);
    if (vf < vi) throw new BadRequestException('Fim da vigência anterior ao início');
    const valor = valorMonetario(dto.valorInicial, 'valorInicial');
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.contratoInstrumento.create({
        data: {
          unidadeId: ctx.unidadeId, numero: dto.numero.trim(), tipo: dto.tipo, natureza: dto.natureza, processoId: dto.processoId, ataId: dto.ataId,
          fornecedorId: dto.fornecedorId, objeto: dto.objeto, valorInicial: valor, valorAtualizado: valor, dataAssinatura: dataCivilOpc(dto.dataAssinatura),
          vigenciaInicio: vi, vigenciaFim: vf, prazoExecucaoDias: dto.prazoExecucaoDias, inicioPrevisto: dataCivilOpc(dto.inicioPrevisto),
          reajusteIndice: dto.reajusteIndice, garantiaTipo: dto.garantiaTipo,
          garantiaValor: dto.garantiaValor ? valorMonetario(dto.garantiaValor, 'garantiaValor') : null,
          garantiaValidade: dataCivilOpc(dto.garantiaValidade), obrigacoes: dto.obrigacoes, criadoPor: ctx.usuarioId,
        },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'CONTRATO_CRIADO', entidade: 'ContratoInstrumento', entidadeId: c.id, depois: c });
      return c;
    });
  }

  async atualizar(ctx: Ctx, id: string, dto: AtualizarContratoDto) {
    const antes = await this.escopo.assertContrato(ctx, id);
    if (dto.ataId && dto.ataId !== antes.ataId) await this.validarRefs(ctx, { ataId: dto.ataId });
    if (dto.processoId) await this.validarRefs(ctx, { processoId: dto.processoId });
    return this.prisma.$transaction(async (tx) => {
      const depois = await tx.contratoInstrumento.update({
        where: { id },
        data: {
          tipo: dto.tipo, natureza: dto.natureza, processoId: dto.processoId, ataId: dto.ataId, objeto: dto.objeto,
          dataAssinatura: dataCivilOpc(dto.dataAssinatura), prazoExecucaoDias: dto.prazoExecucaoDias, inicioPrevisto: dataCivilOpc(dto.inicioPrevisto),
          inicioReal: dataCivilOpc(dto.inicioReal), reajusteIndice: dto.reajusteIndice, garantiaTipo: dto.garantiaTipo,
          garantiaValor: dto.garantiaValor ? valorMonetario(dto.garantiaValor, 'garantiaValor') : undefined,
          garantiaValidade: dataCivilOpc(dto.garantiaValidade), obrigacoes: dto.obrigacoes,
        },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'CONTRATO_ATUALIZADO', entidade: 'ContratoInstrumento', entidadeId: id, antes, depois });
      return depois;
    });
  }

  /** Correção administrativa (admin): exige motivo e preserva o estado anterior na auditoria. */
  async correcao(ctx: Ctx, id: string, dto: CorrecaoContratoDto) {
    const antes = await this.escopo.assertContrato(ctx, id);
    const data: Prisma.ContratoInstrumentoUpdateInput = {
      numero: dto.numero,
      valorInicial: dto.valorInicial ? valorMonetario(dto.valorInicial) : undefined,
      valorAtualizado: dto.valorAtualizado ? valorMonetario(dto.valorAtualizado) : undefined,
      vigenciaInicio: dataCivilOpc(dto.vigenciaInicio) ?? undefined,
      vigenciaFim: dataCivilOpc(dto.vigenciaFim) ?? undefined,
    };
    return this.prisma.$transaction(async (tx) => {
      const depois = await tx.contratoInstrumento.update({ where: { id }, data });
      if (depois.vigenciaFim < depois.vigenciaInicio) throw new BadRequestException('Vigência inconsistente');
      await this.auditoria.registrar(tx, ctx, { acao: 'CONTRATO_CORRECAO_ADMINISTRATIVA', entidade: 'ContratoInstrumento', entidadeId: id, antes, depois, motivo: dto.motivo });
      return depois;
    });
  }

  async situacao(ctx: Ctx, id: string, dto: SituacaoContratoDto) {
    const antes = await this.escopo.assertContrato(ctx, id);
    const encerra = dto.situacao === 'EXECUCAO_ENCERRADA';
    return this.prisma.$transaction(async (tx) => {
      const depois = await tx.contratoInstrumento.update({
        where: { id },
        data: { situacao: dto.situacao, execucaoEncerradaEm: encerra ? (dataCivilOpc(dto.data) ?? hojeCivil()) : null },
      });
      await this.auditoria.registrar(tx, ctx, {
        acao: 'CONTRATO_SITUACAO', entidade: 'ContratoInstrumento', entidadeId: id, antes: { situacao: antes.situacao }, depois: { situacao: dto.situacao }, motivo: dto.motivo,
      });
      return depois;
    });
  }

  async adicionarItem(ctx: Ctx, id: string, dto: ItemContratoDto) {
    await this.escopo.assertContrato(ctx, id);
    if (dto.itemAtaId) {
      const it = await this.prisma.itemAta.findFirst({ where: { id: dto.itemAtaId, ata: { unidadeId: ctx.unidadeId } } });
      if (!it) throw new BadRequestException('Item de ata não encontrado');
    }
    return this.prisma.$transaction(async (tx) => {
      const max = await tx.itemContrato.aggregate({ where: { contratoId: id }, _max: { numero: true } });
      const item = await tx.itemContrato.create({
        data: {
          contratoId: id, numero: (max._max.numero ?? 0) + 1, descricao: dto.descricao, unidadeMedida: dto.unidadeMedida,
          quantidade: quantidade(dto.quantidade), valorUnitario: valorMonetario(dto.valorUnitario), itemAtaId: dto.itemAtaId,
        },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'CONTRATO_ITEM_ADICIONADO', entidade: 'ContratoInstrumento', entidadeId: id, depois: item });
      return item;
    });
  }

  // ───── Designações ─────

  /** Indicação no sistema fica PENDENTE até o registro do documento de designação competente. */
  async indicar(ctx: Ctx, contratoId: string, dto: IndicarDesignacaoDto) {
    await this.escopo.assertContrato(ctx, contratoId);
    const v = await this.prisma.vinculoUnidadePerfil.findFirst({
      where: { usuarioId: dto.usuarioId, unidadeId: ctx.unidadeId, ativo: true, usuario: { ativo: true } },
    });
    if (!v) throw new BadRequestException('Usuário sem vínculo ativo na unidade');
    const inicio = dataCivil(dto.inicio);
    const fim = dataCivilOpc(dto.fim) ?? null;
    if (fim && fim < inicio) throw new BadRequestException('Fim anterior ao início');
    return this.prisma.$transaction(async (tx) => {
      const d = await tx.designacao.create({
        data: { unidadeId: ctx.unidadeId, contratoId, usuarioId: dto.usuarioId, funcao: dto.funcao, inicio, fim, escopo: dto.escopo, indicadoPor: ctx.usuarioId },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'DESIGNACAO_INDICADA', entidade: 'ContratoInstrumento', entidadeId: contratoId, depois: d });
      return d;
    });
  }

  private async designacaoDaUnidade(ctx: Ctx, id: string) {
    const d = await this.prisma.designacao.findFirst({ where: { id, unidadeId: ctx.unidadeId } });
    if (!d) throw new NotFoundException('Designação não encontrada');
    return d;
  }

  async confirmar(ctx: Ctx, id: string, dto: ConfirmarDesignacaoDto) {
    const d = await this.designacaoDaUnidade(ctx, id);
    if (d.status !== 'PENDENTE') throw new UnprocessableEntityException('Somente designação pendente pode ser confirmada');
    return this.prisma.$transaction(async (tx) => {
      const depois = await tx.designacao.update({
        where: { id },
        data: {
          status: 'ATIVA', documentoDesignacao: dto.documentoDesignacao, dataDocumento: dataCivil(dto.dataDocumento),
          confirmadoPor: ctx.usuarioId, confirmadoEm: new Date(),
        },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'DESIGNACAO_CONFIRMADA', entidade: 'ContratoInstrumento', entidadeId: d.contratoId, antes: d, depois });
      return depois;
    });
  }

  async encerrarDesignacao(ctx: Ctx, id: string, dto: EncerrarDesignacaoDto) {
    const d = await this.designacaoDaUnidade(ctx, id);
    if (d.status === 'ENCERRADA') throw new UnprocessableEntityException('Designação já encerrada');
    return this.prisma.$transaction(async (tx) => {
      const depois = await tx.designacao.update({ where: { id }, data: { status: 'ENCERRADA', fim: dataCivil(dto.fim), encerradoMotivo: dto.motivo } });
      await this.auditoria.registrar(tx, ctx, { acao: 'DESIGNACAO_ENCERRADA', entidade: 'ContratoInstrumento', entidadeId: d.contratoId, antes: d, depois, motivo: dto.motivo });
      return depois;
    });
  }

  // ───── Aditivos ─────

  /** Aditivo guarda valor e vigência antes/depois e o fundamento; prorrogação nunca é automática. */
  async aditivo(ctx: Ctx, contratoId: string, dto: AditivoDto) {
    await this.escopo.assertContrato(ctx, contratoId);
    if (!dto.novoValor && !dto.novaVigenciaFim && !['OUTRO', 'REEQUILIBRIO'].includes(dto.tipo)) {
      throw new BadRequestException('Informe novo valor e/ou nova vigência');
    }
    if (dto.tipo === 'PRORROGACAO' && !dto.novaVigenciaFim) throw new BadRequestException('Prorrogação exige nova data de vigência');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ContratoInstrumento" WHERE id = ${contratoId}::uuid FOR UPDATE`;
      const c = await tx.contratoInstrumento.findUniqueOrThrow({ where: { id: contratoId } });
      const novoValor = dto.novoValor ? valorMonetario(dto.novoValor, 'novoValor') : c.valorAtualizado;
      const novaVig = dto.novaVigenciaFim ? dataCivil(dto.novaVigenciaFim) : c.vigenciaFim;
      if (novaVig < c.vigenciaInicio) throw new BadRequestException('Nova vigência anterior ao início');
      const a = await tx.aditivo.create({
        data: {
          contratoId, numero: dto.numero, tipo: dto.tipo, fundamento: dto.fundamento, documento: dto.documento, dataAssinatura: dataCivil(dto.dataAssinatura),
          valorAntes: c.valorAtualizado, valorDepois: novoValor, vigenciaFimAntes: c.vigenciaFim, vigenciaFimDepois: novaVig, criadoPor: ctx.usuarioId,
        },
      });
      await tx.contratoInstrumento.update({ where: { id: contratoId }, data: { valorAtualizado: novoValor, vigenciaFim: novaVig } });
      await this.auditoria.registrar(tx, ctx, {
        acao: 'CONTRATO_ADITIVO', entidade: 'ContratoInstrumento', entidadeId: contratoId,
        antes: { valorAtualizado: c.valorAtualizado, vigenciaFim: isoData(c.vigenciaFim) },
        depois: { valorAtualizado: novoValor, vigenciaFim: isoData(novaVig), aditivo: a.numero }, motivo: dto.fundamento,
      });
      return a;
    });
  }

  async historico(ctx: Ctx, id: string) {
    await this.escopo.assertContrato(ctx, id);
    const r = await this.auditoria.historico(ctx.unidadeId, 'ContratoInstrumento', id);
    return r.map((x) => ({ ...x, id: x.id.toString() }));
  }
}
