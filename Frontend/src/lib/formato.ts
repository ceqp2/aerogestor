/** Formatação pt-BR. Datas civis (AAAA-MM-DD) são formatadas sem conversão de fuso. */
const moedaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });
const dataHoraFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

export function moeda(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? moedaFmt.format(n) : '—';
}

export function numero(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === '') return '—';
  return numFmt.format(Number(v));
}

/** "2026-10-09" ou "2026-10-09T00:00:00.000Z" → "09/10/2026" (sem deslocamento de fuso). */
export function data(v: string | null | undefined) {
  if (!v) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

export function dataHora(v: string | null | undefined) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : dataHoraFmt.format(d);
}

/** Data civil de hoje no fuso de Brasília, AAAA-MM-DD. */
export function hojeISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

export function isoData(v: string | null | undefined) {
  return v ? v.slice(0, 10) : '';
}

/** Converte "1.234,56" ou "1234.56" para "1234.56" (string decimal; nunca float). */
export function normalizarValor(v: string) {
  const s = v.trim().replace(/\s|R\$/g, '');
  if (s.includes(',')) return s.replace(/\./g, '').replace(',', '.');
  return s;
}

export function diasTexto(d: number) {
  if (d < 0) return `vencido há ${-d} dia${d === -1 ? '' : 's'}`;
  if (d === 0) return 'vence hoje';
  return `em ${d} dia${d === 1 ? '' : 's'}`;
}

export function tamanhoArquivo(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
