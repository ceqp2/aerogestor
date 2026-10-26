/** Faixas PROPOSTAS (parâmetro gerencial, não imposição legal): 1–4 baixo, 5–9 moderado, 10–16 alto, 17–25 crítico. */
export type Faixas = Record<'baixo' | 'moderado' | 'alto' | 'critico', [number, number]>;
export type Nivel = keyof Faixas;

export const FAIXAS_PADRAO: Faixas = { baixo: [1, 4], moderado: [5, 9], alto: [10, 16], critico: [17, 25] };

export function score(probabilidade: number, impacto: number) {
  if (![probabilidade, impacto].every((n) => Number.isInteger(n) && n >= 1 && n <= 5)) throw new Error('Escala 1–5');
  return probabilidade * impacto;
}

export function nivel(s: number, faixas: Faixas = FAIXAS_PADRAO): Nivel {
  for (const k of ['critico', 'alto', 'moderado', 'baixo'] as Nivel[]) {
    const [min, max] = faixas[k];
    if (s >= min && s <= max) return k;
  }
  return 'baixo';
}

export function faixaScore(n: Nivel, faixas: Faixas = FAIXAS_PADRAO) {
  return faixas[n];
}
