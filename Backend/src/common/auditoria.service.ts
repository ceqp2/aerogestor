import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { Ctx } from './contexto';

type Tx = Prisma.TransactionClient | PrismaService;

const SENSIVEIS = new Set(['senhaHash', 'mfaSecretEnc', 'tokenHash', 'csrfHash', 'chaveStorage']);

/** Converte valores para JSON seguro (Decimal, Date, BigInt) e remove campos sensíveis. */
export function serializar(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  return JSON.parse(
    JSON.stringify(v, (k, val) => {
      if (SENSIVEIS.has(k)) return '[omitido]';
      if (typeof val === 'bigint') return val.toString();
      if (val instanceof Prisma.Decimal) return val.toString();
      return val;
    }),
  );
}

export interface EntradaAuditoria {
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  antes?: unknown;
  depois?: unknown;
  motivo?: string | null;
  unidadeId?: string | null;
}

/** Trilha append-only. Deve ser chamada dentro da mesma transação da alteração. */
@Injectable()
export class AuditoriaService {
  constructor(private prisma: PrismaService) {}

  async registrar(tx: Tx, ctx: Partial<Ctx> | null, e: EntradaAuditoria) {
    await tx.registroAuditoria.create({
      data: {
        unidadeId: e.unidadeId ?? ctx?.unidadeId ?? null,
        usuarioId: ctx?.usuarioId ?? null,
        usuarioNome: ctx?.nome ?? null,
        acao: e.acao,
        entidade: e.entidade,
        entidadeId: e.entidadeId ?? null,
        antes: serializar(e.antes),
        depois: serializar(e.depois),
        motivo: e.motivo ?? null,
        correlationId: ctx?.correlationId ?? null,
        ip: ctx?.ip ?? null,
      },
    });
  }

  historico(unidadeId: string, entidade: string, entidadeId: string) {
    return this.prisma.registroAuditoria.findMany({
      where: { unidadeId, entidade, entidadeId },
      orderBy: { criadoEm: 'desc' },
      take: 200,
    });
  }
}
