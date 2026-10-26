import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FuncaoDesignacao, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { Ctx, ehLeituraUnidade } from './contexto';
import { hojeCivil } from './datas';

/**
 * Autorização por objeto. Toda consulta de entidade de negócio passa por aqui:
 *  - isolamento por unidade (registros de outra unidade retornam 404, sem revelar existência);
 *  - gestores/fiscais só alcançam contratos com designação vigente (pendente ou ativa).
 */
@Injectable()
export class EscopoService {
  constructor(private prisma: PrismaService) {}

  /** IDs de contratos acessíveis ao usuário, ou null quando o perfil lê toda a unidade. */
  async contratosPermitidos(ctx: Ctx): Promise<string[] | null> {
    if (ehLeituraUnidade(ctx)) return null;
    const hoje = hojeCivil();
    const ds = await this.prisma.designacao.findMany({
      where: {
        usuarioId: ctx.usuarioId,
        unidadeId: ctx.unidadeId,
        status: { in: ['PENDENTE', 'ATIVA'] },
        OR: [{ fim: null }, { fim: { gte: hoje } }],
      },
      select: { contratoId: true },
    });
    return [...new Set(ds.map((d) => d.contratoId))];
  }

  /** Filtro Prisma para contratos visíveis. */
  async filtroContratos(ctx: Ctx): Promise<Prisma.ContratoInstrumentoWhereInput> {
    const ids = await this.contratosPermitidos(ctx);
    return ids === null ? { unidadeId: ctx.unidadeId } : { unidadeId: ctx.unidadeId, id: { in: ids } };
  }

  async assertContrato(ctx: Ctx, contratoId: string) {
    const contrato = await this.prisma.contratoInstrumento.findFirst({ where: { id: contratoId, unidadeId: ctx.unidadeId } });
    if (!contrato) throw new NotFoundException('Contrato não encontrado');
    const ids = await this.contratosPermitidos(ctx);
    if (ids !== null && !ids.includes(contratoId)) throw new NotFoundException('Contrato não encontrado');
    return contrato;
  }

  /** Exige que o perfil leia toda a unidade (não-gestor). */
  assertLeituraUnidade(ctx: Ctx) {
    if (!ehLeituraUnidade(ctx)) throw new ForbiddenException('Acesso restrito aos contratos atribuídos');
  }

  /**
   * Designação ATIVA e vigente do usuário no contrato, com uma das funções exigidas.
   * Competência formal (atesto, recebimento) depende disso — não apenas do perfil.
   */
  async designacaoCompetente(ctx: Ctx, contratoId: string, funcoes: FuncaoDesignacao[]) {
    const hoje = hojeCivil();
    const d = await this.prisma.designacao.findFirst({
      where: {
        contratoId,
        usuarioId: ctx.usuarioId,
        unidadeId: ctx.unidadeId,
        status: 'ATIVA',
        funcao: { in: funcoes },
        inicio: { lte: hoje },
        OR: [{ fim: null }, { fim: { gte: hoje } }],
      },
    });
    if (!d) {
      throw new ForbiddenException(
        `Ato exige designação ATIVA e vigente neste contrato em uma das funções: ${funcoes.join(', ')}`,
      );
    }
    return d;
  }

  /** Busca genérica por id restrita à unidade. */
  async daUnidade<T>(finder: Promise<T | null>, nome = 'Registro'): Promise<T> {
    const r = await finder;
    if (!r) throw new NotFoundException(`${nome} não encontrado`);
    return r;
  }
}
