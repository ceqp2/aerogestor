import { Prisma, TipoMovCredito, TipoMovEmpenho, TipoMovRap, TipoRestosAPagar } from '@prisma/client';

/**
 * Fórmulas gerenciais (seção 5 da especificação). Funções puras sobre os ledgers,
 * sempre com Decimal — nunca ponto flutuante.
 */
type V = Prisma.Decimal.Value;
const D = (v: V) => new Prisma.Decimal(v);

export interface MovEmp {
  id?: string;
  tipo: TipoMovEmpenho;
  valor: V;
  estornoDeId?: string | null;
}

export interface SaldosEmpenho {
  emitido: Prisma.Decimal;
  reforcos: Prisma.Decimal;
  anulacoes: Prisma.Decimal;
  empenhadoLiquido: Prisma.Decimal;
  liquidadoLiquido: Prisma.Decimal;
  pagoLiquido: Prisma.Decimal;
  aLiquidar: Prisma.Decimal;
  liquidadoAPagar: Prisma.Decimal;
}

export function saldosEmpenho(movs: MovEmp[]): SaldosEmpenho {
  const t: Record<TipoMovEmpenho, Prisma.Decimal> = {
    EMISSAO: D(0), REFORCO: D(0), ANULACAO: D(0), LIQUIDACAO: D(0), ESTORNO_LIQUIDACAO: D(0), PAGAMENTO: D(0), ESTORNO_PAGAMENTO: D(0),
  };
  for (const m of movs) t[m.tipo] = t[m.tipo].plus(D(m.valor));
  // Empenhado líquido = emissão + reforços − anulações
  const empenhadoLiquido = t.EMISSAO.plus(t.REFORCO).minus(t.ANULACAO);
  // Liquidado líquido = liquidações − estornos de liquidação
  const liquidadoLiquido = t.LIQUIDACAO.minus(t.ESTORNO_LIQUIDACAO);
  // Pago líquido = pagamentos − estornos de pagamento
  const pagoLiquido = t.PAGAMENTO.minus(t.ESTORNO_PAGAMENTO);
  return {
    emitido: t.EMISSAO,
    reforcos: t.REFORCO,
    anulacoes: t.ANULACAO,
    empenhadoLiquido,
    liquidadoLiquido,
    pagoLiquido,
    aLiquidar: empenhadoLiquido.minus(liquidadoLiquido),
    liquidadoAPagar: liquidadoLiquido.minus(pagoLiquido),
  };
}

const ESTORNAVEL: Partial<Record<TipoMovEmpenho, TipoMovEmpenho>> = {
  ESTORNO_LIQUIDACAO: 'LIQUIDACAO',
  ESTORNO_PAGAMENTO: 'PAGAMENTO',
};

/**
 * Valida um novo movimento contra o ledger. Retorna lista de erros (vazia = válido).
 * Impede liquidação acima do empenhado, pagamento acima do liquidado etc.
 */
export function validarMovimentoEmpenho(
  movs: MovEmp[],
  novo: { tipo: TipoMovEmpenho; valor: V; estornoDeId?: string | null },
): string[] {
  const v = D(novo.valor);
  const erros: string[] = [];
  if (v.lte(0)) return ['Valor deve ser positivo'];
  const s = saldosEmpenho(movs);
  switch (novo.tipo) {
    case 'EMISSAO':
      if (movs.some((m) => m.tipo === 'EMISSAO')) erros.push('Empenho já possui emissão registrada');
      break;
    case 'REFORCO':
      if (!movs.some((m) => m.tipo === 'EMISSAO')) erros.push('Reforço exige emissão prévia');
      break;
    case 'ANULACAO':
      if (v.gt(s.aLiquidar)) erros.push(`Anulação (${v.toFixed(2)}) superior ao saldo a liquidar (${s.aLiquidar.toFixed(2)})`);
      break;
    case 'LIQUIDACAO':
      if (v.gt(s.aLiquidar)) erros.push(`Liquidação (${v.toFixed(2)}) superior ao saldo empenhado a liquidar (${s.aLiquidar.toFixed(2)})`);
      break;
    case 'PAGAMENTO':
      if (v.gt(s.liquidadoAPagar)) erros.push(`Pagamento (${v.toFixed(2)}) superior ao saldo liquidado a pagar (${s.liquidadoAPagar.toFixed(2)})`);
      break;
    case 'ESTORNO_LIQUIDACAO':
    case 'ESTORNO_PAGAMENTO': {
      const original = movs.find((m) => m.id && m.id === novo.estornoDeId);
      if (!original || original.tipo !== ESTORNAVEL[novo.tipo]) {
        erros.push('Estorno deve referenciar o movimento original correspondente');
        break;
      }
      if (movs.some((m) => m.estornoDeId === original.id)) erros.push('Movimento já estornado');
      if (v.gt(D(original.valor))) erros.push('Estorno superior ao movimento original');
      if (novo.tipo === 'ESTORNO_LIQUIDACAO' && v.gt(s.liquidadoAPagar)) {
        erros.push('Não é possível estornar liquidação já paga; estorne o pagamento antes');
      }
      break;
    }
  }
  return erros;
}

export interface MovCred {
  tipo: TipoMovCredito;
  valor: V;
}

/** Crédito atualizado = inicial + acréscimos − reduções. */
export function creditoAtualizado(movs: MovCred[]) {
  return movs.reduce((acc, m) => (m.tipo === 'REDUCAO' ? acc.minus(D(m.valor)) : acc.plus(D(m.valor))), D(0));
}

/** Disponível para empenhar = crédito atualizado − empenhado líquido (mesma classificação e exercício). */
export function disponivelParaEmpenhar(movsCredito: MovCred[], empenhadoLiquido: V) {
  return creditoAtualizado(movsCredito).minus(D(empenhadoLiquido));
}

/** Demanda a empenhar = necessidade aprovada/alocada ainda não coberta por empenhos vinculados (mínimo zero). */
export function demandaAEmpenhar(alocado: V, empenhadoVinculado: V) {
  const r = D(alocado).minus(D(empenhadoVinculado));
  return r.lt(0) ? D(0) : r;
}

// ───── Restos a pagar ─────

export interface MovRap {
  id?: string;
  tipo: TipoMovRap;
  valor: V;
  estornoDeId?: string | null;
}

/**
 * Saldos de uma inscrição em RAP. Estorno reverte o movimento referenciado.
 * A classificação original (processado/não processado) nunca é reescrita.
 */
export function saldosRap(tipo: TipoRestosAPagar, abertura: V, movs: MovRap[]) {
  const porId = new Map(movs.filter((m) => m.id).map((m) => [m.id as string, m]));
  let liq = D(0);
  let pag = D(0);
  let canc = D(0);
  for (const m of movs) {
    let alvo = m.tipo;
    let sinal = 1;
    if (m.tipo === 'ESTORNO') {
      const orig = m.estornoDeId ? porId.get(m.estornoDeId) : undefined;
      if (!orig) continue;
      alvo = orig.tipo;
      sinal = -1;
    }
    const v = D(m.valor).times(sinal);
    if (alvo === 'LIQUIDACAO') liq = liq.plus(v);
    if (alvo === 'PAGAMENTO') pag = pag.plus(v);
    if (alvo === 'CANCELAMENTO') canc = canc.plus(v);
  }
  const ab = D(abertura);
  if (tipo === 'NAO_PROCESSADO') {
    return {
      abertura: ab, liquidado: liq, pago: pag, cancelado: canc,
      aLiquidar: ab.minus(liq).minus(canc),
      liquidadoAPagar: liq.minus(pag),
      saldo: ab.minus(pag).minus(canc),
    };
  }
  return { abertura: ab, liquidado: ab, pago: pag, cancelado: canc, aLiquidar: D(0), liquidadoAPagar: ab.minus(pag).minus(canc), saldo: ab.minus(pag).minus(canc) };
}

export function validarMovimentoRap(tipo: TipoRestosAPagar, abertura: V, movs: MovRap[], novo: MovRap): string[] {
  const v = D(novo.valor);
  if (v.lte(0)) return ['Valor deve ser positivo'];
  const s = saldosRap(tipo, abertura, movs);
  const erros: string[] = [];
  switch (novo.tipo) {
    case 'LIQUIDACAO':
      if (tipo === 'PROCESSADO') erros.push('RAP processado já está liquidado');
      else if (v.gt(s.aLiquidar)) erros.push('Liquidação superior ao saldo a liquidar do RPNP');
      break;
    case 'PAGAMENTO':
      if (v.gt(s.liquidadoAPagar)) erros.push('Pagamento superior ao saldo liquidado a pagar');
      break;
    case 'CANCELAMENTO':
      if (tipo === 'NAO_PROCESSADO' ? v.gt(s.aLiquidar) : v.gt(s.liquidadoAPagar)) erros.push('Cancelamento superior ao saldo cancelável');
      break;
    case 'ESTORNO': {
      const orig = movs.find((m) => m.id && m.id === novo.estornoDeId);
      if (!orig || orig.tipo === 'ESTORNO') erros.push('Estorno deve referenciar movimento original');
      else if (movs.some((m) => m.estornoDeId === orig.id)) erros.push('Movimento já estornado');
      else if (v.gt(D(orig.valor))) erros.push('Estorno superior ao original');
      else if (orig.tipo === 'LIQUIDACAO' && v.gt(s.liquidadoAPagar)) erros.push('Estorne o pagamento antes da liquidação');
      break;
    }
  }
  return erros;
}

/** Valores sugeridos para inscrição ao fim do exercício (a inscrição é sempre ato explícito). */
export function sugestaoInscricaoRap(movs: MovEmp[]) {
  const s = saldosEmpenho(movs);
  return { processado: s.liquidadoAPagar, naoProcessado: s.aLiquidar };
}
