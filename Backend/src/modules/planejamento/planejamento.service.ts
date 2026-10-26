import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditoriaService } from '../../common/auditoria.service';
import { Ctx } from '../../common/contexto';
import { dataCivilOpc } from '../../common/datas';
import { D, soma, valorMonetario } from '../../common/dinheiro';
import { paginar, resultado } from '../../common/paginacao';
import { AtualizarDemandaDto, CriarDemandaDto, CriarPropostaDto, DemandasQuery, NovaVersaoPropostaDto, StatusDemandaDto } from './planejamento.dto';

@Injectable()
export class PlanejamentoService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService,
  ) {}

  async listarDemandas(ctx: Ctx, q: DemandasQuery) {
    const { skip, take, pagina, tamanho } = paginar(q);
    const where: Prisma.DemandaWhereInput = {
      unidadeId: ctx.unidadeId,
      exercicio: q.exercicio,
      status: q.status,
      OR: q.busca
        ? [{ titulo: { contains: q.busca, mode: 'insensitive' } }, { setorRequisitante: { contains: q.busca, mode: 'insensitive' } }]
        : undefined,
    };
    const [itens, total] = await Promise.all([
      this.prisma.demanda.findMany({
        where, skip, take, orderBy: { criadoEm: 'desc' },
        include: { processo: { select: { id: true, numeroInterno: true } }, alocacoes: { select: { valor: true } } },
      }),
      this.prisma.demanda.count({ where }),
    ]);
    return resultado(
      itens.map(({ alocacoes, ...d }) => ({ ...d, valorAlocado: soma(alocacoes.map((a) => a.valor)).toFixed(2) })),
      total, pagina, tamanho,
    );
  }

  async obterDemanda(ctx: Ctx, id: string) {
    const d = await this.prisma.demanda.findFirst({ where: { id, unidadeId: ctx.unidadeId }, include: { processo: true, alocacoes: true } });
    if (!d) throw new NotFoundException('Demanda não encontrada');
    return d;
  }

  async criarDemanda(ctx: Ctx, dto: CriarDemandaDto) {
    return this.prisma.$transaction(async (tx) => {
      const d = await tx.demanda.create({
        data: {
          unidadeId: ctx.unidadeId, exercicio: dto.exercicio, titulo: dto.titulo, descricao: dto.descricao, setorRequisitante: dto.setorRequisitante,
          prioridade: dto.prioridade, valorEstimado: dto.valorEstimado ? valorMonetario(dto.valorEstimado, 'valorEstimado', true) : D(0),
          numeroDfd: dto.numeroDfd, itemPca: dto.itemPca, dataNecessidade: dataCivilOpc(dto.dataNecessidade), criadoPor: ctx.usuarioId,
        },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'DEMANDA_CRIADA', entidade: 'Demanda', entidadeId: d.id, depois: d });
      return d;
    });
  }

  async atualizarDemanda(ctx: Ctx, id: string, dto: AtualizarDemandaDto) {
    const antes = await this.obterDemanda(ctx, id);
    if (antes.status === 'ATENDIDA') throw new UnprocessableEntityException('Demanda atendida não pode ser alterada');
    return this.prisma.$transaction(async (tx) => {
      const depois = await tx.demanda.update({
        where: { id },
        data: {
          ...dto,
          valorEstimado: dto.valorEstimado !== undefined ? valorMonetario(dto.valorEstimado, 'valorEstimado', true) : undefined,
          dataNecessidade: dataCivilOpc(dto.dataNecessidade),
        },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'DEMANDA_ATUALIZADA', entidade: 'Demanda', entidadeId: id, antes, depois });
      return depois;
    });
  }

  async statusDemanda(ctx: Ctx, id: string, dto: StatusDemandaDto) {
    const antes = await this.obterDemanda(ctx, id);
    if ((dto.status === 'APROVADA' || dto.status === 'REJEITADA') && ctx.perfil !== 'CHEFE' && ctx.perfil !== 'ADMIN') {
      throw new UnprocessableEntityException('Aprovação/rejeição de demanda cabe ao chefe');
    }
    return this.prisma.$transaction(async (tx) => {
      const depois = await tx.demanda.update({ where: { id }, data: { status: dto.status } });
      await this.auditoria.registrar(tx, ctx, {
        acao: 'DEMANDA_STATUS', entidade: 'Demanda', entidadeId: id, antes: { status: antes.status }, depois: { status: dto.status }, motivo: dto.motivo,
      });
      return depois;
    });
  }

  listarPropostas(ctx: Ctx) {
    return this.prisma.propostaOrcamentaria.findMany({
      where: { unidadeId: ctx.unidadeId },
      include: { versoes: { orderBy: { versao: 'desc' } } },
      orderBy: [{ exercicio: 'desc' }, { titulo: 'asc' }],
    });
  }

  async criarProposta(ctx: Ctx, dto: CriarPropostaDto) {
    const p = await this.prisma.propostaOrcamentaria.create({ data: { unidadeId: ctx.unidadeId, exercicio: dto.exercicio, titulo: dto.titulo } });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'PROPOSTA_CRIADA', entidade: 'PropostaOrcamentaria', entidadeId: p.id, depois: p });
    return p;
  }

  /** Cada alteração gera nova versão; a anterior é marcada como substituída (nunca editada). */
  async novaVersao(ctx: Ctx, propostaId: string, dto: NovaVersaoPropostaDto) {
    const p = await this.prisma.propostaOrcamentaria.findFirst({ where: { id: propostaId, unidadeId: ctx.unidadeId } });
    if (!p) throw new NotFoundException('Proposta não encontrada');
    const itens = dto.itens.map((i) => ({ ...i, valor: valorMonetario(i.valor).toFixed(2) }));
    const total = soma(itens.map((i) => i.valor));
    return this.prisma.$transaction(async (tx) => {
      const ultima = await tx.versaoProposta.findFirst({ where: { propostaId }, orderBy: { versao: 'desc' } });
      if (ultima) await tx.versaoProposta.update({ where: { id: ultima.id }, data: { status: 'SUBSTITUIDA' } });
      const v = await tx.versaoProposta.create({
        data: { propostaId, versao: (ultima?.versao ?? 0) + 1, itens, total, observacao: dto.observacao, criadoPor: ctx.usuarioId },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'PROPOSTA_VERSIONADA', entidade: 'PropostaOrcamentaria', entidadeId: propostaId, depois: v });
      return v;
    });
  }

  async marcarEnviada(ctx: Ctx, propostaId: string, versaoId: string) {
    const v = await this.prisma.versaoProposta.findFirst({ where: { id: versaoId, propostaId, proposta: { unidadeId: ctx.unidadeId } } });
    if (!v) throw new NotFoundException('Versão não encontrada');
    if (v.status !== 'RASCUNHO') throw new UnprocessableEntityException('Somente versão em rascunho pode ser marcada como enviada');
    const r = await this.prisma.versaoProposta.update({ where: { id: versaoId }, data: { status: 'ENVIADA' } });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'PROPOSTA_ENVIADA', entidade: 'PropostaOrcamentaria', entidadeId: propostaId, depois: { versao: v.versao } });
    return r;
  }
}
