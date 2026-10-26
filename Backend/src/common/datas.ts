import { BadRequestException } from '@nestjs/common';
/**
 * Datas civis (vigências, prazos) são armazenadas como DATE, sem fuso.
 * Internamente são representadas como Date à meia-noite UTC; nunca converter com fuso local.
 */
const RE = /^\d{4}-\d{2}-\d{2}$/;

export function dataCivil(s: string): Date {
  if (!RE.test(s)) throw new BadRequestException(`Data inválida (esperado AAAA-MM-DD): ${s}`);
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new BadRequestException(`Data inválida: ${s}`);
  return d;
}

export function dataCivilOpc(s?: string | null): Date | null | undefined {
  if (s === undefined) return undefined;
  if (s === null || s === '') return null;
  return dataCivil(s);
}

export function isoData(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** "Hoje" no fuso da aplicação (America/Sao_Paulo), como data civil. */
export function hojeCivil(tz = process.env.TZ_APP || 'America/Sao_Paulo', agora = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
  return dataCivil(parts);
}

export function somarDias(d: Date, dias: number): Date {
  return new Date(d.getTime() + dias * 86400000);
}

export function diffDias(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
