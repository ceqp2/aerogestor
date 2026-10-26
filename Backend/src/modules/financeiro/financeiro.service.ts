import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditoriaService } from '../../common/auditoria.service';
import { Ctx } from '../../common/contexto';
import { dataCivil, isoData } from '../../common/datas';
import { D, soma, valorMonetario, ZERO } from '../../common/dinheiro';
import { EscopoService } from '../../common/escopo.service';
import {
  AlocacaoDto, CriarCreditoDto, CriarEmpenhoDto, InscricaoRapDto, MovimentoCreditoDto, MovimentoEmpenhoDto, MovimentoRapDto, RateioDto,
} from './financeiro.dto';
import {
  creditoAtualizado, demandaAEmpenhar, saldosEmpenho, saldosRap, sugestaoInscricaoRap, validarMovimentoEmpenho, validarMovimentoRap,
} from './financeiro.regras';

type Tx = Prisma.TransactionClient;
const str = (d: Prisma.Decimal) => d.toFixed(2);

@Injectable()
export class FinanceiroService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService,
    private escopo: EscopoService,
  ) {}

  // ───── Resumo (compartilhado por dashboard e relatórios para garantir reconciliação) ─────

  async resumo(unidadeId: string, exercicio: number) {
    const creditos = await this.prisma.credito.findMany({
      where: { unidadeId, exercicio },
      include: { movimentos: true, empenhos: { include: { movimentos: true } } },
      orderBy: [{ naturezaDespesa: 'asc' }, { ptres: 'asc' }],
    });
    const linhas = creditos.map((c) => {
      const atualizado = creditoAtualizado(c.movimentos);
      const saldos = c.empenhos.map((e) => saldosEmpenho(e.movimentos));
      const empenhado = soma(saldos.map((s) => s.empenhadoLiquido));
      const liquidado = soma(saldos.map((s) => s.liquidadoLiquido));
      const pago = soma(saldos.map((s) => s.pagoLiquido));
      return {
        creditoId: c.id,
        classificacao: { ptres: c.ptres, fonte: c.fonte, naturezaDespesa: c.naturezaDespesa, planoInterno: c.planoInterno, ugr: c.ugr },
        descricao: c.descricao,
        creditoAtualizado: atualizado,
        empenhadoLiquido: empenhado,
        liquidadoLiquido: liquidado,
        pagoLiquido: pago,
        empenhadoALiquidar: empenhado.minus(liquidado),
        liquidadoAPagar: liquidado.minus(pago),
        disponivelParaEmpenhar: atualizado.minus(empenhado),
        ultimaConciliacao: c.ultimaConciliacao,
        fonteConciliacao: c.fonteConciliacao,
      };
    });
    const tot = (k: keyof (typeof linhas)[number]) => soma(linhas.map((l) => l[k] as Prisma.Decimal));
    const demanda = await this.demandaAEmpenhar(unidadeId, exercicio);
    const rap = await this.resumoRap(unidadeId);
    const fmt = <T extends Record<string, unknown>>(o: T) =>
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v instanceof Prisma.Decimal ? str(v) : v]));
    return {
      exercicio,
      totais: {
        creditoAtualizado: str(tot('creditoAtualizado')),
        empenhadoLiquido: str(tot('empenhadoLiquido')),
        empenhadoALiquidar: str(tot('empenhadoALiquidar')),
        liquidadoLiquido: str(tot('liquidadoLiquido')),
        liquidadoAPagar: str(tot('liquidadoAPagar')),
        pagoLiquido: str(tot('pagoLiquido')),
        disponivelParaEmpenhar: str(tot('disponivelParaEmpenhar')),
        demandaAEmpenhar: str(demanda.total),
      },
      creditos: linhas.map(fmt),
      demandaAEmpenhar: demanda.itens,
      restosAPagar: rap,
      observacao:
        'Acompanhamento gerencial conciliável com as fontes oficiais. O sistema não emite atos no SIAFI. ' +
        'Restos a pagar só existem com inscrição registrada.',
    };
  }

  private async demandaAEmpenhar(unidadeId: string, exercicio: number) {
    const alocs = await this.prisma.alocacaoOrcamentaria.findMany({
      where: { unidadeId, exercicio },
      include: { demanda: { select: { id: true, titulo: true, processoId: true } }, processo: { select: { id: true, numeroInterno: true, objeto: true } } },
    });
    // Agrupa por processo (ou demanda sem processo) para comparar com empenhos vinculados.
    const grupos = new Map<string, { chave: string; descricao: string; processoId: string | null; alocado: Prisma.Decimal }>();
    for (const a of alocs) {
      const processoId = a.processoId ?? a.demanda?.processoId ?? null;
      const chave = processoId ? `P:${processoId}` : `D:${a.demandaId}`;
      const descricao = a.processo ? `${a.processo.numeroInterno} — ${a.processo.objeto}` : (a.demanda?.titulo ?? 'Alocação');
      const g = grupos.get(chave) ?? { chave, descricao, processoId, alocado: ZERO };
      g.alocado = g.alocado.plus(a.valor);
      grupos.set(chave, g);
    }
    const processoIds = [...grupos.values()].map((g) => g.processoId).filter((x): x is string => !!x);
    const empenhos = await this.prisma.empenho.findMany({ where: { unidadeId, processoId: { in: processoIds } }, include: { movimentos: true } });
    const itens = [...grupos.values()].map((g) => {
      const vinculado = soma(empenhos.filter((e) => e.processoId === g.processoId).map((e) => saldosEmpenho(e.movimentos).empenhadoLiquido));
      const pend = demandaAEmpenhar(g.alocado, vinculado);
      return { descricao: g.descricao, processoId: g.processoId, alocado: str(g.alocado), empenhadoVinculado: str(vinculado), aEmpenhar: str(pend) };
    });
    return { itens, total: soma(itens.map((i) => i.aEmpenhar)) };
  }

  private async resumoRap(unidadeId: string) {
    const ins = await this.prisma.inscricaoRestosAPagar.findMany({ where: { unidadeId }, include: { movimentos: true } });
    const agrega = (tipo: 'PROCESSADO' | 'NAO_PROCESSADO') => {
      const ss = ins.filter((i) => i.tipo === tipo).map((i) => saldosRap(i.tipo, i.saldoAbertura, i.movimentos));
      return {
        inscricoes: ss.length,
        abertura: str(soma(ss.map((s) => s.abertura))),
        pago: str(soma(ss.map((s) => s.pago))),
        cancelado: str(soma(ss.map((s) => s.cancelado))),
        saldo: str(soma(ss.map((s) => s.saldo))),
      };
    };
    return { processados: agrega('PROCESSADO'), naoProcessados: agrega('NAO_PROCESSADO') };
  }

  // ───── Créditos ─────

  async listarCreditos(ctx: Ctx, exercicio: number) {
    const r = await this.resumo(ctx.unidadeId, exercicio);
    return r.creditos;
  }

  async criarCredito(ctx: Ctx, dto: CriarCreditoDto) {
    const valor = valorMonetario(dto.valorInicial, 'valorInicial');
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.credito.create({
        data: {
          unidadeId: ctx.unidadeId, exercicio: dto.exercicio, ptres: dto.ptres, fonte: dto.fonte, naturezaDespesa: dto.naturezaDespesa,
          planoInterno: dto.planoInterno ?? '', ugr: dto.ugr, descricao: dto.descricao,
        },
      });
      await tx.movimentoCredito.create({
        data: { creditoId: c.id, tipo: 'INICIAL', valor, dataMovimento: dataCivil(dto.dataMovimento), documento: dto.documento, autorId: ctx.usuarioId },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'CREDITO_CRIADO', entidade: 'Credito', entidadeId: c.id, depois: { ...c, valorInicial: valor } });
      return c;
    });
  }

  async detalheCredito(ctx: Ctx, id: string) {
    const c = await this.prisma.credito.findFirst({
      where: { id, unidadeId: ctx.unidadeId },
      include: { movimentos: { orderBy: { dataMovimento: 'asc' } }, empenhos: { include: { movimentos: true } } },
    });
    if (!c) throw new NotFoundException('Crédito não encontrado');
    return {
      ...c,
      empenhos: c.empenhos.map(({ movimentos, ...e }) => ({ ...e, saldos: this.fmtSaldos(saldosEmpenho(movimentos)) })),
      creditoAtualizado: str(creditoAtualizado(c.movimentos)),
    };
  }

  private async lockCredito(tx: Tx, creditoId: string) {
    await tx.$queryRaw`SELECT id FROM "Credito" WHERE id = ${creditoId}::uuid FOR UPDATE`;
    const c = await tx.credito.findUniqueOrThrow({ where: { id: creditoId }, include: { movimentos: true, empenhos: { include: { movimentos: true } } } });
    const empenhado = soma(c.empenhos.map((e) => saldosEmpenho(e.movimentos).empenhadoLiquido));
    return { credito: c, disponivel: creditoAtualizado(c.movimentos).minus(empenhado) };
  }

  async movimentarCredito(ctx: Ctx, creditoId: string, dto: MovimentoCreditoDto) {
    await this.escopo.daUnidade(this.prisma.credito.findFirst({ where: { id: creditoId, unidadeId: ctx.unidadeId } }), 'Crédito');
    const valor = valorMonetario(dto.valor);
    return this.prisma.$transaction(async (tx) => {
      const { disponivel } = await this.lockCredito(tx, creditoId);
      if (dto.tipo === 'REDUCAO' && valor.gt(disponivel)) {
        throw new UnprocessableEntityException(`Redução superior ao crédito disponível para empenhar (${str(disponivel)})`);
      }
      const m = await tx.movimentoCredito.create({
        data: { creditoId, tipo: dto.tipo, valor, dataMovimento: dataCivil(dto.dataMovimento), documento: dto.documento, observacao: dto.observacao, autorId: ctx.usuarioId },
      });
      await this.auditoria.registrar(tx, ctx, { acao: `CREDITO_${dto.tipo}`, entidade: 'Credito', entidadeId: creditoId, depois: m });
      return m;
    });
  }

  // ───── Empenhos ─────

  private fmtSaldos(s: ReturnType<typeof saldosEmpenho>) {
    return {
      empenhadoLiquido: str(s.empenhadoLiquido),
      liquidadoLiquido: str(s.liquidadoLiquido),
      pagoLiquido: str(s.pagoLiquido),
      aLiquidar: str(s.aLiquidar),
      liquidadoAPagar: str(s.liquidadoAPagar),
    };
  }

  async listarEmpenhos(ctx: Ctx, exercicio?: number) {
    const es = await this.prisma.empenho.findMany({
      where: { unidadeId: ctx.unidadeId, exercicio },
      include: { movimentos: true, credito: true, rateios: true, inscricoes: { select: { id: true, tipo: true } } },
      orderBy: { dataEmissao: 'desc' },
    });
    const forn = await this.prisma.fornecedor.findMany({ where: { id: { in: es.map((e) => e.fornecedorId) } } });
    return es.map(({ movimentos, ...e }) => ({
      ...e,
      fornecedor: forn.find((f) => f.id === e.fornecedorId),
      saldos: this.fmtSaldos(saldosEmpenho(movimentos)),
      inscritoEmRap: e.inscricoes.length > 0,
    }));
  }

  async detalheEmpenho(ctx: Ctx, id: string) {
    const e = await this.prisma.empenho.findFirst({
      where: { id, unidadeId: ctx.unidadeId },
      include: {
        movimentos: { orderBy: [{ dataMovimento: 'asc' }, { criadoEm: 'asc' }] },
        credito: true,
        rateios: { include: { contrato: { select: { id: true, numero: true } } } },
        inscricoes: { include: { movimentos: { orderBy: { criadoEm: 'asc' } } } },
      },
    });
    if (!e) throw new NotFoundException('Empenho não encontrado');
    const fornecedor = await this.prisma.fornecedor.findUnique({ where: { id: e.fornecedorId } });
    return {
      ...e,
      fornecedor,
      saldos: this.fmtSaldos(saldosEmpenho(e.movimentos)),
      sugestaoRap: (() => {
        const s = sugestaoInscricaoRap(e.movimentos);
        return { processado: str(s.processado), naoProcessado: str(s.naoProcessado) };
      })(),
      inscricoes: e.inscricoes.map((i) => {
        const s = saldosRap(i.tipo, i.saldoAbertura, i.movimentos);
        return { ...i, saldos: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, str(v)])) };
      }),
    };
  }

  async criarEmpenho(ctx: Ctx, dto: CriarEmpenhoDto) {
    const credito = await this.escopo.daUnidade(this.prisma.credito.findFirst({ where: { id: dto.creditoId, unidadeId: ctx.unidadeId } }), 'Crédito');
    await this.escopo.daUnidade(this.prisma.fornecedor.findFirst({ where: { id: dto.fornecedorId, unidadeId: ctx.unidadeId } }), 'Fornecedor');
    if (dto.processoId) await this.escopo.daUnidade(this.prisma.processo.findFirst({ where: { id: dto.processoId, unidadeId: ctx.unidadeId } }), 'Processo');
    if (dto.contratoId) await this.escopo.daUnidade(this.prisma.contratoInstrumento.findFirst({ where: { id: dto.contratoId, unidadeId: ctx.unidadeId } }), 'Contrato');
    const emissao = dataCivil(dto.dataEmissao);
    const exercicio = emissao.getUTCFullYear();
    if (credito.exercicio !== exercicio) throw new UnprocessableEntityException('Exercício do empenho difere do exercício do crédito');
    const valor = valorMonetario(dto.valor);
    return this.prisma.$transaction(async (tx) => {
      const { disponivel } = await this.lockCredito(tx, credito.id);
      if (valor.gt(disponivel)) throw new UnprocessableEntityException(`Empenho superior ao crédito disponível (${str(disponivel)})`);
      const e = await tx.empenho.create({
        data: {
          unidadeId: ctx.unidadeId, numero: dto.numero.trim().toUpperCase(), exercicio, creditoId: credito.id, fornecedorId: dto.fornecedorId,
          processoId: dto.processoId, tipo: dto.tipo ?? 'ORDINARIO', dataEmissao: emissao, descricao: dto.descricao,
        },
      });
      await tx.movimentoEmpenho.create({
        data: { empenhoId: e.id, tipo: 'EMISSAO', valor, dataMovimento: emissao, documento: e.numero, autorId: ctx.usuarioId },
      });
      if (dto.contratoId) await tx.rateioEmpenho.create({ data: { empenhoId: e.id, contratoId: dto.contratoId, valor } });
      await this.auditoria.registrar(tx, ctx, { acao: 'EMPENHO_EMITIDO', entidade: 'Empenho', entidadeId: e.id, depois: { ...e, valor } });
      return e;
    });
  }

  /** Comando de movimento — nunca PATCH de saldo. Bloqueia a linha do empenho para concorrência. */
  async movimentarEmpenho(ctx: Ctx, empenhoId: string, dto: MovimentoEmpenhoDto) {
    const e = await this.escopo.daUnidade(this.prisma.empenho.findFirst({ where: { id: empenhoId, unidadeId: ctx.unidadeId } }), 'Empenho');
    const valor = valorMonetario(dto.valor);
    const data = dataCivil(dto.dataMovimento);
    if (data < e.dataEmissao) throw new BadRequestException('Data do movimento anterior à emissão do empenho');

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Empenho" WHERE id = ${empenhoId}::uuid FOR UPDATE`;
      const inscrito = await tx.inscricaoRestosAPagar.count({ where: { empenhoId } });
      if (inscrito) throw new UnprocessableEntityException('Empenho inscrito em restos a pagar: registre os movimentos na inscrição de RAP');

      const movs = await tx.movimentoEmpenho.findMany({ where: { empenhoId } });
      const erros = validarMovimentoEmpenho(movs, { tipo: dto.tipo, valor, estornoDeId: dto.estornoDeId });
      if (erros.length) throw new UnprocessableEntityException(erros);

      if (dto.tipo === 'REFORCO') {
        const { disponivel } = await this.lockCredito(tx, e.creditoId);
        if (valor.gt(disponivel)) throw new UnprocessableEntityException(`Reforço superior ao crédito disponível (${str(disponivel)})`);
      }

      let contratoId = dto.contratoId ?? null;
      let notaFiscalId = dto.notaFiscalId ?? null;
      const original = dto.estornoDeId ? movs.find((m) => m.id === dto.estornoDeId) : undefined;
      if (original) {
        contratoId = original.contratoId;
        notaFiscalId = original.notaFiscalId;
      }

      if (dto.tipo === 'LIQUIDACAO' || dto.tipo === 'PAGAMENTO') {
        if (notaFiscalId) {
          const nf = await tx.notaFiscal.findFirst({ where: { id: notaFiscalId, unidadeId: ctx.unidadeId } });
          if (!nf) throw new BadRequestException('Nota fiscal não encontrada');
          if (contratoId && nf.contratoId !== contratoId) throw new BadRequestException('Nota fiscal de outro contrato');
          contratoId = nf.contratoId;
          if (dto.tipo === 'LIQUIDACAO') {
            // Nota recebida ≠ liquidação: exige atesto.
            if (nf.status !== 'ATESTADA') throw new UnprocessableEntityException('Liquidação exige nota fiscal atestada');
            const liqNf = await this.liquidadoPorNota(tx, nf.id);
            if (liqNf.plus(valor).gt(nf.valor)) {
              throw new UnprocessableEntityException(`Liquidações da nota (${str(liqNf.plus(valor))}) excederiam seu valor (${str(nf.valor)})`);
            }
          }
        } else if (dto.tipo === 'LIQUIDACAO') {
          throw new BadRequestException('Liquidação deve referenciar a nota fiscal atestada');
        }
        if (contratoId) {
          const rateio = await tx.rateioEmpenho.findUnique({ where: { empenhoId_contratoId: { empenhoId, contratoId } } });
          if (!rateio) throw new UnprocessableEntityException('Empenho não possui rateio para este contrato');
          if (dto.tipo === 'LIQUIDACAO') {
            const liqContrato = saldosEmpenho(movs.filter((m) => m.contratoId === contratoId)).liquidadoLiquido;
            if (liqContrato.plus(valor).gt(rateio.valor)) throw new UnprocessableEntityException('Liquidação excede o valor rateado ao contrato');
          }
        }
      }

      const mov = await tx.movimentoEmpenho.create({
        data: {
          empenhoId, tipo: dto.tipo, valor, dataMovimento: data, documento: dto.documento, notaFiscalId, contratoId,
          estornoDeId: dto.estornoDeId ?? null, observacao: dto.observacao, autorId: ctx.usuarioId,
        },
      });
      // Rateios não podem ficar acima do empenhado líquido após anulação.
      if (dto.tipo === 'ANULACAO') {
        const s = saldosEmpenho([...movs, mov]);
        const rateado = soma((await tx.rateioEmpenho.findMany({ where: { empenhoId } })).map((r) => r.valor));
        if (rateado.gt(s.empenhadoLiquido)) throw new UnprocessableEntityException('Anulação deixaria rateios acima do empenhado líquido; ajuste os rateios antes');
      }
      await this.auditoria.registrar(tx, ctx, { acao: `EMPENHO_${dto.tipo}`, entidade: 'Empenho', entidadeId: empenhoId, depois: mov });
      return mov;
    });
  }

  private async liquidadoPorNota(tx: Tx, notaFiscalId: string) {
    const ms = await tx.movimentoEmpenho.findMany({ where: { notaFiscalId, tipo: { in: ['LIQUIDACAO', 'ESTORNO_LIQUIDACAO'] } } });
    return saldosEmpenho(ms).liquidadoLiquido;
  }

  async definirRateio(ctx: Ctx, empenhoId: string, dto: RateioDto) {
    await this.escopo.daUnidade(this.prisma.empenho.findFirst({ where: { id: empenhoId, unidadeId: ctx.unidadeId } }), 'Empenho');
    await this.escopo.daUnidade(this.prisma.contratoInstrumento.findFirst({ where: { id: dto.contratoId, unidadeId: ctx.unidadeId } }), 'Contrato');
    const valor = valorMonetario(dto.valor);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Empenho" WHERE id = ${empenhoId}::uuid FOR UPDATE`;
      const movs = await tx.movimentoEmpenho.findMany({ where: { empenhoId } });
      const s = saldosEmpenho(movs);
      const outros = soma((await tx.rateioEmpenho.findMany({ where: { empenhoId, NOT: { contratoId: dto.contratoId } } })).map((r) => r.valor));
      if (outros.plus(valor).gt(s.empenhadoLiquido)) throw new UnprocessableEntityException('Soma dos rateios excede o empenhado líquido');
      const liqContrato = saldosEmpenho(movs.filter((m) => m.contratoId === dto.contratoId)).liquidadoLiquido;
      if (valor.lt(liqContrato)) throw new UnprocessableEntityException('Rateio menor que o já liquidado para o contrato');
      const antes = await tx.rateioEmpenho.findUnique({ where: { empenhoId_contratoId: { empenhoId, contratoId: dto.contratoId } } });
      const r = await tx.rateioEmpenho.upsert({
        where: { empenhoId_contratoId: { empenhoId, contratoId: dto.contratoId } },
        create: { empenhoId, contratoId: dto.contratoId, valor },
        update: { valor },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'EMPENHO_RATEIO', entidade: 'Empenho', entidadeId: empenhoId, antes, depois: r });
      return r;
    });
  }

  async conciliar(ctx: Ctx, tipo: 'empenho' | 'credito', id: string, fonte: string) {
    const agora = new Date();
    if (tipo === 'empenho') {
      await this.escopo.daUnidade(this.prisma.empenho.findFirst({ where: { id, unidadeId: ctx.unidadeId } }), 'Empenho');
      await this.prisma.empenho.update({ where: { id }, data: { ultimaConciliacao: agora, fonteConciliacao: fonte } });
    } else {
      await this.escopo.daUnidade(this.prisma.credito.findFirst({ where: { id, unidadeId: ctx.unidadeId } }), 'Crédito');
      await this.prisma.credito.update({ where: { id }, data: { ultimaConciliacao: agora, fonteConciliacao: fonte } });
    }
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'CONCILIACAO_REGISTRADA', entidade: tipo === 'empenho' ? 'Empenho' : 'Credito', entidadeId: id, depois: { fonte, em: agora } });
    return { ultimaConciliacao: agora, fonte };
  }

  // ───── Alocações ─────

  async criarAlocacao(ctx: Ctx, dto: AlocacaoDto) {
    if (!dto.demandaId && !dto.processoId) throw new BadRequestException('Vincule a alocação a uma demanda ou processo');
    if (dto.demandaId) {
      const d = await this.escopo.daUnidade(this.prisma.demanda.findFirst({ where: { id: dto.demandaId, unidadeId: ctx.unidadeId } }), 'Demanda');
      if (d.status !== 'APROVADA' && d.status !== 'ATENDIDA') throw new UnprocessableEntityException('Somente necessidade aprovada pode receber alocação');
    }
    if (dto.processoId) await this.escopo.daUnidade(this.prisma.processo.findFirst({ where: { id: dto.processoId, unidadeId: ctx.unidadeId } }), 'Processo');
    if (dto.creditoId) await this.escopo.daUnidade(this.prisma.credito.findFirst({ where: { id: dto.creditoId, unidadeId: ctx.unidadeId } }), 'Crédito');
    const a = await this.prisma.alocacaoOrcamentaria.create({
      data: {
        unidadeId: ctx.unidadeId, creditoId: dto.creditoId, demandaId: dto.demandaId, processoId: dto.processoId, exercicio: dto.exercicio,
        valor: valorMonetario(dto.valor), aprovadaEm: dataCivil(dto.aprovadaEm), documento: dto.documento, autorId: ctx.usuarioId,
      },
    });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'ALOCACAO_CRIADA', entidade: 'AlocacaoOrcamentaria', entidadeId: a.id, depois: a });
    return a;
  }

  listarAlocacoes(ctx: Ctx, exercicio: number) {
    return this.prisma.alocacaoOrcamentaria.findMany({
      where: { unidadeId: ctx.unidadeId, exercicio },
      include: { demanda: { select: { titulo: true } }, processo: { select: { numeroInterno: true, objeto: true } }, credito: true },
      orderBy: { aprovadaEm: 'desc' },
    });
  }

  // ───── Restos a pagar ─────

  /** Inscrição explícita ao encerramento do exercício; nunca automática. */
  async inscreverRap(ctx: Ctx, empenhoId: string, dto: InscricaoRapDto) {
    const e = await this.escopo.daUnidade(this.prisma.empenho.findFirst({ where: { id: empenhoId, unidadeId: ctx.unidadeId } }), 'Empenho');
    const data = dataCivil(dto.dataInscricao);
    if (data.getUTCFullYear() <= e.exercicio) throw new UnprocessableEntityException('Inscrição em RAP ocorre após o encerramento do exercício do empenho');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Empenho" WHERE id = ${empenhoId}::uuid FOR UPDATE`;
      const ja = await tx.inscricaoRestosAPagar.count({ where: { empenhoId } });
      if (ja) throw new UnprocessableEntityException('Empenho já inscrito');
      const movs = await tx.movimentoEmpenho.findMany({ where: { empenhoId } });
      const s = sugestaoInscricaoRap(movs);
      const criadas = [];
      for (const [tipo, valor] of [['PROCESSADO', s.processado], ['NAO_PROCESSADO', s.naoProcessado]] as const) {
        if (valor.gt(0)) {
          criadas.push(
            await tx.inscricaoRestosAPagar.create({
              data: { unidadeId: ctx.unidadeId, empenhoId, exercicioOrigem: e.exercicio, tipo, saldoAbertura: valor, dataInscricao: data, documento: dto.documento, autorId: ctx.usuarioId },
            }),
          );
        }
      }
      if (!criadas.length) throw new UnprocessableEntityException('Empenho sem saldo a inscrever');
      await this.auditoria.registrar(tx, ctx, { acao: 'RAP_INSCRITO', entidade: 'Empenho', entidadeId: empenhoId, depois: criadas });
      return criadas;
    });
  }

  async movimentarRap(ctx: Ctx, inscricaoId: string, dto: MovimentoRapDto) {
    const ins = await this.escopo.daUnidade(this.prisma.inscricaoRestosAPagar.findFirst({ where: { id: inscricaoId, unidadeId: ctx.unidadeId } }), 'Inscrição');
    const valor = valorMonetario(dto.valor);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "InscricaoRestosAPagar" WHERE id = ${inscricaoId}::uuid FOR UPDATE`;
      const movs = await tx.movimentoRestosAPagar.findMany({ where: { inscricaoId } });
      const erros = validarMovimentoRap(ins.tipo, ins.saldoAbertura, movs, { tipo: dto.tipo, valor, estornoDeId: dto.estornoDeId });
      if (erros.length) throw new UnprocessableEntityException(erros);
      const m = await tx.movimentoRestosAPagar.create({
        data: { inscricaoId, tipo: dto.tipo, valor, dataMovimento: dataCivil(dto.dataMovimento), documento: dto.documento, estornoDeId: dto.estornoDeId, autorId: ctx.usuarioId },
      });
      await this.auditoria.registrar(tx, ctx, { acao: `RAP_${dto.tipo}`, entidade: 'Empenho', entidadeId: ins.empenhoId, depois: m });
      return m;
    });
  }

  // ───── Visão por contrato (gestor vê apenas os seus) ─────

  async porContrato(ctx: Ctx, contratoId: string) {
    const contrato = await this.escopo.assertContrato(ctx, contratoId);
    const rateios = await this.prisma.rateioEmpenho.findMany({
      where: { contratoId },
      include: { empenho: { include: { movimentos: true } } },
    });
    const empenhos = rateios.map((r) => {
      const movsContrato = r.empenho.movimentos.filter((m) => m.contratoId === contratoId);
      const sc = saldosEmpenho(movsContrato);
      return {
        empenhoId: r.empenhoId,
        numero: r.empenho.numero,
        exercicio: r.empenho.exercicio,
        rateado: str(r.valor),
        liquidadoContrato: str(sc.liquidadoLiquido),
        pagoContrato: str(sc.pagoLiquido),
        aLiquidarContrato: str(D(r.valor).minus(sc.liquidadoLiquido)),
        ultimaConciliacao: r.empenho.ultimaConciliacao,
      };
    });
    const notas = await this.prisma.notaFiscal.findMany({ where: { contratoId }, orderBy: { dataEmissao: 'desc' }, include: { atestos: true } });
    const movsNotas = await this.prisma.movimentoEmpenho.findMany({ where: { notaFiscalId: { in: notas.map((n) => n.id) } } });
    return {
      contrato: { id: contrato.id, numero: contrato.numero, valorAtualizado: str(contrato.valorAtualizado) },
      totais: {
        empenhado: str(soma(rateios.map((r) => r.valor))),
        liquidado: str(soma(empenhos.map((e) => e.liquidadoContrato))),
        pago: str(soma(empenhos.map((e) => e.pagoContrato))),
      },
      empenhos,
      notas: notas.map((n) => {
        const s = saldosEmpenho(movsNotas.filter((m) => m.notaFiscalId === n.id));
        return {
          ...n,
          dataEmissao: isoData(n.dataEmissao),
          dataRecebimento: isoData(n.dataRecebimento),
          liquidado: str(s.liquidadoLiquido),
          pago: str(s.pagoLiquido),
          situacaoFinanceira: s.pagoLiquido.gte(n.valor) ? 'PAGA' : s.liquidadoLiquido.gt(0) ? 'LIQUIDADA' : n.status,
        };
      }),
      aviso: 'Valor contratual não é crédito orçamentário. Saldos refletem lançamentos gerenciais conciliáveis.',
    };
  }
}
