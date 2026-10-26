import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type Dec = Prisma.Decimal;
export const D = (v: Prisma.Decimal.Value | null | undefined): Prisma.Decimal => new Prisma.Decimal(v ?? 0);
export const ZERO = new Prisma.Decimal(0);

export function soma(valores: Array<Prisma.Decimal.Value | null | undefined>): Prisma.Decimal {
  return valores.reduce<Prisma.Decimal>((acc, v) => acc.plus(D(v)), ZERO);
}

/** Valida string monetária (até 2 casas) e converte; rejeita negativos e notação científica. */
export function valorMonetario(v: string | number, campo = 'valor', permitirZero = false): Prisma.Decimal {
  const s = String(v).trim().replace(',', '.');
  if (!/^\d{1,16}(\.\d{1,2})?$/.test(s)) throw new BadRequestException(`${campo}: valor monetário inválido`);
  const d = new Prisma.Decimal(s);
  if (!permitirZero && d.lte(0)) throw new BadRequestException(`${campo}: deve ser maior que zero`);
  return d;
}

export function quantidade(v: string | number, campo = 'quantidade'): Prisma.Decimal {
  const s = String(v).trim().replace(',', '.');
  if (!/^\d{1,14}(\.\d{1,4})?$/.test(s)) throw new BadRequestException(`${campo}: quantidade inválida`);
  return new Prisma.Decimal(s);
}
