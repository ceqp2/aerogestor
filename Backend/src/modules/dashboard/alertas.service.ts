import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { diffDias, hojeCivil, isoData, somarDias } from '../../common/datas';
import { D } from '../../common/dinheiro';
import { ParametrosService } from '../../common/parametros.service';

export type NivelAlerta = 'INFO' | 'ATENCAO' | 'CRITICO';

/** Cada alerta expõe a regra e os dados que o acionaram (transparência). */
export interface Alerta {
  regra: string;
  descricaoRegra: string;
  nivel: NivelAlerta;
  titulo: string;
  dados: Record<string, unknown>;
  link: string;
  entidade: string;
  entidadeId: string;
}

@Injectable()
export class AlertasService {
  constructor(
    private prisma: PrismaService,
    private params: ParametrosService,
  ) {}

  async calcular(unidadeId: string, contratosPermitidos: string[] | null): Promise<Alerta[]> {
    const hoje = hojeCivil();
    const lembretes = await this.params.valor<number[]>('lembretes.vigencia.dias', unidadeId);
    const horizonte = Math.max(...lembretes, 0);
    const diasSemRelatorio = await this.params.valor<number>('alertas.servico.diasSemRelatorio', unidadeId);
    const fc: Prisma.ContratoInstrumentoWhereInput =
      contratosPermitidos === null ? { unidadeId } : { unidadeId, id: { in: contratosPermitidos } };
    const gestor = contratosPermitidos !== null;
    const alertas: Alerta[] = [];

    const [processos, contratos, atas, entregas, notasSemLiq, riscos] = await Promise.all([
      gestor ? [] : this.prisma.processo.findMany({ where: { unidadeId, situacao: 'ATIVO', etapa: { not: 'FINALIZADO' }, dataConclusaoPrevista: { lt: hoje } } }),
      this.prisma.contratoInstrumento.findMany({
        where: { ...fc, situacao: { in: ['VIGENTE', 'SUSPENSO'] } },
        include: {
          designacoes: { where: { status: 'ATIVA' } },
          registros: { orderBy: { data: 'desc' }, take: 1 },
          medicoes: { orderBy: { criadoEm: 'desc' }, take: 1 },
        },
      }),
      gestor ? [] : this.prisma.ata.findMany({ where: { unidadeId, cancelada: false, tipoVinculo: { not: 'CONSULTA' }, vigenciaFim: { lte: somarDias(hoje, horizonte) } } }),
      this.prisma.entrega.findMany({
        where: { contrato: fc, status: { notIn: ['RECEBIDA_DEFINITIVA', 'CANCELADA'] }, prazo: { lt: hoje } },
        include: { contrato: { select: { numero: true } } },
      }),
      this.prisma.notaFiscal.findMany({ where: { contrato: fc, status: 'ATESTADA' }, include: { contrato: { select: { numero: true } }, atestos: true } }),
      gestor ? [] : this.prisma.risco.findMany({ where: { unidadeId, status: { not: 'ENCERRADO' }, proximaRevisao: { lt: hoje } } }),
    ]);

    for (const p of processos) {
      const atraso = diffDias(hoje, p.dataConclusaoPrevista!);
      alertas.push({
        regra: 'CONTRATACAO_ATRASADA', descricaoRegra: 'Processo ativo e não finalizado com data prevista de conclusão anterior a hoje',
        nivel: atraso > 30 ? 'CRITICO' : 'ATENCAO', titulo: `Processo ${p.numeroInterno} atrasado ${atraso} dia(s)`,
        dados: { etapa: p.etapa, dataConclusaoPrevista: isoData(p.dataConclusaoPrevista), diasAtraso: atraso }, link: `/processos/${p.id}`, entidade: 'Processo', entidadeId: p.id,
      });
    }

    for (const c of contratos) {
      const dias = diffDias(c.vigenciaFim, hoje);
      if (dias <= horizonte) {
        alertas.push({
          regra: dias < 0 ? 'VIGENCIA_EXPIRADA' : 'VENCIMENTO_PROXIMO',
          descricaoRegra: dias < 0
            ? 'Contrato com situação vigente/suspenso e fim de vigência anterior a hoje (vigência expirada não encerra a execução automaticamente)'
            : `Fim de vigência dentro do horizonte de lembretes (${horizonte} dias)`,
          nivel: dias <= 15 ? 'CRITICO' : dias <= 30 ? 'ATENCAO' : 'INFO',
          titulo: dias < 0 ? `Contrato ${c.numero}: vigência expirada há ${-dias} dia(s)` : `Contrato ${c.numero} vence em ${dias} dia(s)`,
          dados: { vigenciaFim: isoData(c.vigenciaFim), dias }, link: `/contratos/${c.id}`, entidade: 'ContratoInstrumento', entidadeId: c.id,
        });
      }
      if (c.situacao === 'VIGENTE' && !c.designacoes.some((d) => d.funcao === 'GESTOR' || d.funcao === 'GESTOR_SUBSTITUTO')) {
        alertas.push({
          regra: 'SEM_DESIGNACAO', descricaoRegra: 'Contrato vigente sem designação ATIVA de gestor (indicações pendentes não contam)',
          nivel: 'CRITICO', titulo: `Contrato ${c.numero} sem gestor designado`, dados: { designacoesAtivas: c.designacoes.length },
          link: `/contratos/${c.id}?aba=designacoes`, entidade: 'ContratoInstrumento', entidadeId: c.id,
        });
      }
      if (c.situacao === 'VIGENTE' && c.natureza !== 'MATERIAL' && c.vigenciaInicio <= hoje) {
        const ultimo = [c.registros[0]?.data, c.medicoes[0]?.criadoEm].filter((x): x is Date => !!x).sort((a, b) => b.getTime() - a.getTime())[0];
        const desde = ultimo ? diffDias(hoje, ultimo) : diffDias(hoje, c.vigenciaInicio);
        if (desde > diasSemRelatorio) {
          alertas.push({
            regra: 'SERVICO_SEM_ACOMPANHAMENTO', descricaoRegra: `Contrato de serviço sem relatório/medição há mais de ${diasSemRelatorio} dias`,
            nivel: 'ATENCAO', titulo: `Contrato ${c.numero} sem registro de acompanhamento há ${desde} dia(s)`,
            dados: { ultimoRegistro: ultimo ? isoData(ultimo) ?? ultimo.toISOString() : null, dias: desde, limite: diasSemRelatorio },
            link: `/contratos/${c.id}?aba=execucao`, entidade: 'ContratoInstrumento', entidadeId: c.id,
          });
        }
      }
    }

    for (const a of atas) {
      const dias = diffDias(a.vigenciaFim, hoje);
      if (dias < -30) continue;
      alertas.push({
        regra: dias < 0 ? 'ATA_EXPIRADA' : 'VENCIMENTO_PROXIMO', descricaoRegra: 'Ata com utilização autorizada próxima do fim (ou após o fim) da vigência',
        nivel: dias <= 15 ? 'CRITICO' : dias <= 30 ? 'ATENCAO' : 'INFO',
        titulo: dias < 0 ? `Ata ${a.numero} expirada há ${-dias} dia(s)` : `Ata ${a.numero} vence em ${dias} dia(s)`,
        dados: { vigenciaFim: isoData(a.vigenciaFim), dias }, link: `/atas/${a.id}`, entidade: 'Ata', entidadeId: a.id,
      });
    }

    for (const e of entregas) {
      if (D(e.quantidadeEntregue).gte(e.quantidadePrevista) && e.status === 'RECEBIDA_PROVISORIA') continue;
      const atraso = diffDias(hoje, e.prazo);
      alertas.push({
        regra: 'ENTREGA_ATRASADA', descricaoRegra: 'Entrega com prazo vencido sem recebimento integral',
        nivel: atraso > 15 ? 'CRITICO' : 'ATENCAO', titulo: `Entrega atrasada (${e.contrato.numero}): ${e.descricao}`,
        dados: { prazo: isoData(e.prazo), diasAtraso: atraso, prevista: e.quantidadePrevista.toString(), entregue: e.quantidadeEntregue.toString() },
        link: `/contratos/${e.contratoId}?aba=execucao`, entidade: 'Entrega', entidadeId: e.id,
      });
    }

    const liquidadas = await this.prisma.movimentoEmpenho.findMany({
      where: { notaFiscalId: { in: notasSemLiq.map((n) => n.id) }, tipo: 'LIQUIDACAO' },
      select: { notaFiscalId: true },
    });
    const comLiq = new Set(liquidadas.map((l) => l.notaFiscalId));
    for (const n of notasSemLiq) {
      const atestoData = n.atestos[0]?.data;
      if (comLiq.has(n.id) || !atestoData) continue;
      const dias = diffDias(hoje, atestoData);
      if (dias <= 10) continue;
      alertas.push({
        regra: 'DIVERGENCIA_FINANCEIRA', descricaoRegra: 'Nota fiscal atestada há mais de 10 dias sem liquidação registrada (conferir com a fonte oficial)',
        nivel: dias > 30 ? 'CRITICO' : 'ATENCAO', titulo: `NF ${n.numero} (${n.contrato.numero}) atestada sem liquidação`,
        dados: { valor: n.valor.toFixed(2), atestadaEm: isoData(atestoData), dias }, link: `/contratos/${n.contratoId}?aba=financeiro`, entidade: 'NotaFiscal', entidadeId: n.id,
      });
    }

    if (!gestor) {
      const pend = await this.prisma.checklistItem.findMany({
        where: { processo: { unidadeId, situacao: 'ATIVO' }, estado: { in: ['PENDENTE', 'EM_ANDAMENTO', 'DEVOLVIDO'] }, prazo: { lt: hoje } },
        include: { processo: { select: { numeroInterno: true } } },
      });
      for (const i of pend) {
        alertas.push({
          regra: 'PENDENCIA_DOCUMENTAL', descricaoRegra: 'Item de checklist com prazo vencido e não concluído',
          nivel: i.critico ? 'CRITICO' : 'ATENCAO', titulo: `${i.processo.numeroInterno}: "${i.titulo}" vencido`,
          dados: { prazo: isoData(i.prazo), estado: i.estado, critico: i.critico }, link: `/processos/${i.processoId}?aba=checklist`, entidade: 'ChecklistItem', entidadeId: i.id,
        });
      }
      for (const r of riscos) {
        alertas.push({
          regra: 'REVISAO_RISCO_VENCIDA', descricaoRegra: 'Risco não encerrado com data de revisão anterior a hoje',
          nivel: 'ATENCAO', titulo: `Revisão de risco vencida: ${r.evento}`, dados: { proximaRevisao: isoData(r.proximaRevisao) },
          link: `/riscos/${r.id}`, entidade: 'Risco', entidadeId: r.id,
        });
      }
    }

    const ordem: Record<NivelAlerta, number> = { CRITICO: 0, ATENCAO: 1, INFO: 2 };
    return alertas.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
  }
}
