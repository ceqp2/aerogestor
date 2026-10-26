import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditoriaService } from '../../common/auditoria.service';
import { Ctx } from '../../common/contexto';
import { dataCivil, hojeCivil, isoData, somarDias } from '../../common/datas';
import { quantidade, valorMonetario } from '../../common/dinheiro';
import { paginar, resultado } from '../../common/paginacao';
import { bloqueiosParaAvancar } from '../processos/processos.regras';
import {
  AlterarDestinadaDto, AlterarVigenciaAtaDto, AtasQuery, AtualizarAtaDto, AutorizarUtilizacaoDto, CriarAtaDto, ItemAtaDto, MovimentoAtaDto,
} from './atas.dto';
import { impedimentosUtilizacao, saldoItemAta } from './atas.regras';

@Injectable()
export class AtasService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService,
  ) {}

  async listar(ctx: Ctx, q: AtasQuery) {
    const { skip, take, pagina, tamanho } = paginar(q);
    const hoje = hojeCivil();
    const where: Prisma.AtaWhereInput = {
      unidadeId: ctx.unidadeId,
      tipoVinculo: q.tipoVinculo,
      vigenciaFim:
        q.vencendoEmDias !== undefined
          ? { gte: hoje, lte: somarDias(hoje, q.vencendoEmDias) }
          : q.vigencia === 'vigentes'
            ? { gte: hoje }
            : q.vigencia === 'expiradas'
              ? { lt: hoje }
              : undefined,
      OR: q.busca
        ? [
            { numero: { contains: q.busca, mode: 'insensitive' } },
            { objeto: { contains: q.busca, mode: 'insensitive' } },
            { orgaoGerenciador: { contains: q.busca, mode: 'insensitive' } },
            { idPncp: { contains: q.busca, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [itens, total] = await Promise.all([
      this.prisma.ata.findMany({ where, skip, take, orderBy: { vigenciaFim: 'asc' }, include: { _count: { select: { itens: true } } } }),
      this.prisma.ata.count({ where }),
    ]);
    return resultado(
      itens.map((a) => ({ ...a, impedimentos: impedimentosUtilizacao(a, hoje), expirada: hoje > a.vigenciaFim })),
      total, pagina, tamanho,
    );
  }

  private async obter(ctx: Ctx, id: string) {
    const a = await this.prisma.ata.findFirst({ where: { id, unidadeId: ctx.unidadeId } });
    if (!a) throw new NotFoundException('Ata não encontrada');
    return a;
  }

  async detalhe(ctx: Ctx, id: string) {
    await this.obter(ctx, id);
    const a = await this.prisma.ata.findUniqueOrThrow({
      where: { id },
      include: {
        itens: { orderBy: { numeroItem: 'asc' }, include: { movimentos: { orderBy: { criadoEm: 'desc' } } } },
        processos: { select: { id: true, numeroInterno: true, objeto: true, formaContratacao: true } },
        contratos: { select: { id: true, numero: true, situacao: true } },
      },
    });
    const fornecedores = await this.prisma.fornecedor.findMany({
      where: { id: { in: a.itens.map((i) => i.fornecedorId).filter((x): x is string => !!x) }, unidadeId: ctx.unidadeId },
    });
    const hoje = hojeCivil();
    return {
      ...a,
      impedimentos: impedimentosUtilizacao(a, hoje),
      expirada: hoje > a.vigenciaFim,
      itens: a.itens.map((i) => {
        const s = saldoItemAta(i.quantidadeDestinada, i.movimentos);
        return {
          ...i,
          fornecedor: fornecedores.find((f) => f.id === i.fornecedorId) ?? null,
          quantidadeRegistradaInformada: i.quantidadeRegistrada !== null,
          consumo: s.consumo.toString(),
          reservas: s.reservas.toString(),
          saldoInterno: s.saldo.toString(),
        };
      }),
      avisoSaldo: 'Saldo interno da unidade calculado a partir dos registros locais; não corresponde ao saldo nacional oficial.',
    };
  }

  async criar(ctx: Ctx, dto: CriarAtaDto, importacaoId?: string) {
    const vi = dataCivil(dto.vigenciaInicio);
    const vf = dataCivil(dto.vigenciaFim);
    if (vf < vi) throw new BadRequestException('Fim da vigência anterior ao início');
    return this.prisma.$transaction(async (tx) => {
      const a = await tx.ata.create({
        data: {
          unidadeId: ctx.unidadeId, numero: dto.numero, ano: dto.ano, idPncp: dto.idPncp || null, orgaoGerenciador: dto.orgaoGerenciador,
          cnpjGerenciador: dto.cnpjGerenciador, uasg: dto.uasg, objeto: dto.objeto, processoOrigem: dto.processoOrigem,
          vigenciaInicio: vi, vigenciaFim: vf, tipoVinculo: 'CONSULTA', importacaoId: importacaoId ?? null, criadoPor: ctx.usuarioId,
        },
      });
      await this.auditoria.registrar(tx, ctx, { acao: importacaoId ? 'ATA_IMPORTADA' : 'ATA_CRIADA', entidade: 'Ata', entidadeId: a.id, depois: a });
      return a;
    });
  }

  async atualizar(ctx: Ctx, id: string, dto: AtualizarAtaDto) {
    const antes = await this.obter(ctx, id);
    return this.prisma.$transaction(async (tx) => {
      const depois = await tx.ata.update({ where: { id }, data: { ...dto, idPncp: dto.idPncp === '' ? null : dto.idPncp } });
      await this.auditoria.registrar(tx, ctx, { acao: 'ATA_ATUALIZADA', entidade: 'Ata', entidadeId: id, antes, depois });
      return depois;
    });
  }

  /** Alteração de vigência: somente com documento e fundamento; nunca automática. */
  async alterarVigencia(ctx: Ctx, id: string, dto: AlterarVigenciaAtaDto) {
    const antes = await this.obter(ctx, id);
    const vf = dataCivil(dto.vigenciaFim);
    if (vf < antes.vigenciaInicio) throw new BadRequestException('Fim anterior ao início da vigência');
    return this.prisma.$transaction(async (tx) => {
      const depois = await tx.ata.update({ where: { id }, data: { vigenciaFim: vf } });
      await this.auditoria.registrar(tx, ctx, {
        acao: 'ATA_VIGENCIA_ALTERADA', entidade: 'Ata', entidadeId: id,
        antes: { vigenciaFim: isoData(antes.vigenciaFim) }, depois: { vigenciaFim: dto.vigenciaFim, documento: dto.documento },
        motivo: dto.fundamento,
      });
      return depois;
    });
  }

  async autorizarUtilizacao(ctx: Ctx, id: string, dto: AutorizarUtilizacaoDto) {
    const ata = await this.obter(ctx, id);
    if (dto.tipoVinculo === 'ADESAO') {
      if (!dto.processoAdesaoId) throw new BadRequestException('Adesão exige processo com dossiê (forma ADESAO_ATA)');
      const p = await this.prisma.processo.findFirst({
        where: { id: dto.processoAdesaoId, unidadeId: ctx.unidadeId, formaContratacao: 'ADESAO_ATA', ataId: id },
        include: { checklist: true },
      });
      if (!p) throw new UnprocessableEntityException('Processo de adesão não encontrado ou não vinculado a esta ata');
      if (!p.checklist.length) throw new UnprocessableEntityException('Processo de adesão sem checklist de justificativas/verificações');
      const pend = bloqueiosParaAvancar(p.checklist, 'SELECAO_FORNECEDOR');
      if (pend.length) throw new UnprocessableEntityException(`Dossiê de adesão incompleto: ${pend.map((x) => x.titulo).join('; ')}`);
    }
    const hoje = hojeCivil();
    if (hoje > ata.vigenciaFim || ata.cancelada) throw new UnprocessableEntityException('Ata expirada ou cancelada não pode ter utilização autorizada');
    return this.prisma.$transaction(async (tx) => {
      const depois = await tx.ata.update({
        where: { id },
        data: { tipoVinculo: dto.tipoVinculo, autorizacaoUtilizacao: dto.documento, autorizadaEm: new Date(), autorizadaPor: ctx.usuarioId },
      });
      await this.auditoria.registrar(tx, ctx, {
        acao: 'ATA_UTILIZACAO_AUTORIZADA', entidade: 'Ata', entidadeId: id,
        antes: { tipoVinculo: ata.tipoVinculo }, depois: { tipoVinculo: dto.tipoVinculo, documento: dto.documento, processoAdesaoId: dto.processoAdesaoId },
      });
      return depois;
    });
  }

  async adicionarItem(ctx: Ctx, ataId: string, dto: ItemAtaDto) {
    await this.obter(ctx, ataId);
    if (dto.fornecedorId) {
      const f = await this.prisma.fornecedor.findFirst({ where: { id: dto.fornecedorId, unidadeId: ctx.unidadeId } });
      if (!f) throw new BadRequestException('Fornecedor não encontrado');
    }
    const destinada = quantidade(dto.quantidadeDestinada, 'quantidadeDestinada');
    const registrada = dto.quantidadeRegistrada ? quantidade(dto.quantidadeRegistrada, 'quantidadeRegistrada') : null;
    if (registrada && destinada.gt(registrada)) throw new BadRequestException('Quantidade destinada não pode exceder a registrada');
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.itemAta.create({
        data: {
          ataId, numeroItem: dto.numeroItem, descricao: dto.descricao, fornecedorId: dto.fornecedorId, unidadeMedida: dto.unidadeMedida,
          codigoCatalogo: dto.codigoCatalogo, quantidadeRegistrada: registrada, quantidadeDestinada: destinada, precoUnitario: valorMonetario(dto.precoUnitario, 'precoUnitario'),
        },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'ATA_ITEM_ADICIONADO', entidade: 'Ata', entidadeId: ataId, depois: item });
      return item;
    });
  }

  async alterarDestinada(ctx: Ctx, ataId: string, itemId: string, dto: AlterarDestinadaDto) {
    await this.obter(ctx, ataId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ItemAta" WHERE id = ${itemId}::uuid FOR UPDATE`;
      const item = await tx.itemAta.findFirst({ where: { id: itemId, ataId }, include: { movimentos: true } });
      if (!item) throw new NotFoundException('Item não encontrado');
      const nova = quantidade(dto.quantidadeDestinada);
      const s = saldoItemAta(nova, item.movimentos);
      if (s.saldo.lt(0)) throw new UnprocessableEntityException('Nova quantidade menor que o já consumido/reservado');
      if (item.quantidadeRegistrada && nova.gt(item.quantidadeRegistrada)) throw new UnprocessableEntityException('Excede a quantidade registrada');
      const depois = await tx.itemAta.update({ where: { id: itemId }, data: { quantidadeDestinada: nova } });
      await this.auditoria.registrar(tx, ctx, {
        acao: 'ATA_ITEM_DESTINADA_ALTERADA', entidade: 'Ata', entidadeId: ataId,
        antes: { item: item.numeroItem, quantidadeDestinada: item.quantidadeDestinada }, depois: { item: item.numeroItem, quantidadeDestinada: nova }, motivo: dto.motivo,
      });
      return depois;
    });
  }

  /** Movimentos de quantidade com bloqueio de linha (evita consumo concorrente acima do saldo). */
  async movimentar(ctx: Ctx, ataId: string, itemId: string, dto: MovimentoAtaDto) {
    const ata = await this.obter(ctx, ataId);
    const q = quantidade(dto.quantidade);
    if (q.lte(0)) throw new BadRequestException('Quantidade deve ser positiva');
    if (dto.processoId) {
      const p = await this.prisma.processo.findFirst({ where: { id: dto.processoId, unidadeId: ctx.unidadeId } });
      if (!p) throw new BadRequestException('Processo não encontrado');
    }
    if (dto.contratoId) {
      const c = await this.prisma.contratoInstrumento.findFirst({ where: { id: dto.contratoId, unidadeId: ctx.unidadeId } });
      if (!c) throw new BadRequestException('Contrato não encontrado');
    }
    if ((dto.tipo === 'CONSUMO' || dto.tipo === 'RESERVA')) {
      const imp = impedimentosUtilizacao(ata, hojeCivil());
      if (imp.length) throw new UnprocessableEntityException(`Utilização bloqueada: ${imp.join('; ')}`);
      if (dto.tipo === 'CONSUMO' && !dto.documento) throw new BadRequestException('Consumo formalizado exige documento');
    }
    if ((dto.tipo === 'CANCELAMENTO_CONSUMO' || dto.tipo === 'LIBERACAO_RESERVA') && (!dto.motivo || dto.motivo.length < 5)) {
      throw new BadRequestException('Informe o motivo');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ItemAta" WHERE id = ${itemId}::uuid FOR UPDATE`;
      const item = await tx.itemAta.findFirst({ where: { id: itemId, ataId }, include: { movimentos: true } });
      if (!item) throw new NotFoundException('Item não encontrado');
      const s = saldoItemAta(item.quantidadeDestinada, item.movimentos);
      if ((dto.tipo === 'CONSUMO' || dto.tipo === 'RESERVA') && q.gt(s.saldo)) {
        throw new UnprocessableEntityException(`Quantidade superior ao saldo interno (${s.saldo.toString()})`);
      }
      if (dto.tipo === 'LIBERACAO_RESERVA' && q.gt(s.reservas)) throw new UnprocessableEntityException('Liberação maior que as reservas ativas');
      if (dto.tipo === 'CANCELAMENTO_CONSUMO' && q.gt(s.consumo)) throw new UnprocessableEntityException('Cancelamento maior que o consumo');
      const mov = await tx.movimentoQuantidadeAta.create({
        data: { itemAtaId: itemId, tipo: dto.tipo, quantidade: q, processoId: dto.processoId, contratoId: dto.contratoId, documento: dto.documento, motivo: dto.motivo, autorId: ctx.usuarioId },
      });
      await this.auditoria.registrar(tx, ctx, { acao: `ATA_${dto.tipo}`, entidade: 'Ata', entidadeId: ataId, depois: { item: item.numeroItem, ...mov }, motivo: dto.motivo });
      return mov;
    });
  }

  async historico(ctx: Ctx, id: string) {
    await this.obter(ctx, id);
    const r = await this.auditoria.historico(ctx.unidadeId, 'Ata', id);
    return r.map((x) => ({ ...x, id: x.id.toString() }));
  }
}
