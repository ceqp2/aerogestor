import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { hojeCivil } from './datas';

/**
 * Parâmetros normativos/gerenciais versionados. O valor vigente é o de maior vigenciaInicio <= hoje,
 * preferindo o parâmetro da unidade ao global. Defaults abaixo são PROPOSTAS gerenciais,
 * não valores legais — devem ser validados e cadastrados com fonte e aprovador.
 */
export const DEFAULTS: Record<string, unknown> = {
  'lembretes.vigencia.dias': [90, 60, 30, 15, 7, 0],
  'riscos.faixas': { baixo: [1, 4], moderado: [5, 9], alto: [10, 16], critico: [17, 25] },
  'competencia.atesto': ['GESTOR', 'GESTOR_SUBSTITUTO', 'FISCAL_TECNICO', 'FISCAL_ADMINISTRATIVO', 'FISCAL_REQUISITANTE'],
  'competencia.recebimento.provisorio': ['FISCAL_TECNICO', 'FISCAL_ADMINISTRATIVO', 'FISCAL_REQUISITANTE', 'FISCAL_SUBSTITUTO'],
  'competencia.recebimento.definitivo': ['GESTOR', 'GESTOR_SUBSTITUTO'],
  'alertas.servico.diasSemRelatorio': 30,
  'alertas.processo.diasAtraso': 0,
};

@Injectable()
export class ParametrosService {
  constructor(private prisma: PrismaService) {}

  async valor<T>(chave: string, unidadeId?: string): Promise<T> {
    const hoje = hojeCivil();
    const ps = await this.prisma.parametroNormativo.findMany({
      where: {
        chave,
        OR: [{ unidadeId: unidadeId ?? null }, { unidadeId: null }],
        vigenciaInicio: { lte: hoje },
        AND: [{ OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: hoje } }] }],
      },
      orderBy: { vigenciaInicio: 'desc' },
    });
    const daUnidade = ps.find((p) => p.unidadeId === unidadeId);
    const escolhido = daUnidade ?? ps.find((p) => p.unidadeId === null);
    return (escolhido?.valor ?? DEFAULTS[chave]) as T;
  }
}
