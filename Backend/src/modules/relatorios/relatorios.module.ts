import { BadRequestException, Controller, Get, Injectable, Module, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { AuditoriaService } from '../../common/auditoria.service';
import { C, Ctx, LEITURA_UNIDADE, Perfis } from '../../common/contexto';
import { diffDias, hojeCivil, isoData } from '../../common/datas';
import { DashboardModule, DashboardService } from '../dashboard/dashboard.module';
import { FinanceiroModule } from '../financeiro/financeiro.module';
import { FinanceiroService } from '../financeiro/financeiro.service';
import { RiscosModule, RiscosService } from '../riscos/riscos.module';
import { cumprimento } from '../processos/processos.regras';

class RelatorioQuery {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) exercicio: number;
  @IsOptional() @IsIn(['json', 'csv']) formato?: 'json' | 'csv';
}

type Linha = Record<string, string | number | boolean | null | undefined>;

/** CSV pt-BR (separador ;, BOM UTF-8) com neutralização de injeção de fórmulas. */
export function paraCsv(linhas: Linha[]): string {
  if (!linhas.length) return '﻿';
  const cols = Object.keys(linhas[0]);
  const esc = (v: unknown) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cols.join(';'), ...linhas.map((l) => cols.map((c) => esc(l[c])).join(';'))].join('\r\n');
}

@Injectable()
class RelatoriosService {
  constructor(
    private prisma: PrismaService,
    private financeiro: FinanceiroService,
    private dashboard: DashboardService,
    private riscos: RiscosService,
  ) {}

  /** Reutiliza exatamente os mesmos serviços do dashboard → reconciliação garantida sob os mesmos filtros. */
  async executivo(ctx: Ctx, exercicio: number) {
    const [fin, proc, riscos] = await Promise.all([
      this.financeiro.resumo(ctx.unidadeId, exercicio),
      this.dashboard.indicadoresProcessos(ctx.unidadeId, exercicio),
      this.riscos.listar(ctx, { pagina: 1, tamanho: 200 } as never),
    ]);
    const porNivel = ['critico', 'alto', 'moderado', 'baixo'].map((n) => ({ nivel: n, total: riscos.itens.filter((r) => r.nivel === n).length }));
    const linhas: Linha[] = [
      ...Object.entries(fin.totais).map(([k, v]) => ({ grupo: 'Financeiro', indicador: k, valor: v })),
      { grupo: 'Processos', indicador: 'a_iniciar', valor: proc.aIniciar },
      { grupo: 'Processos', indicador: 'iniciados', valor: proc.iniciados },
      { grupo: 'Processos', indicador: 'finalizados', valor: proc.finalizados },
      { grupo: 'Processos', indicador: 'atrasados', valor: proc.atrasados },
      ...porNivel.map((p) => ({ grupo: 'Riscos', indicador: p.nivel, valor: p.total })),
    ];
    return { titulo: `Relatório executivo — exercício ${exercicio}`, linhas, financeiro: fin, processos: proc, riscosPorNivel: porNivel };
  }

  async execucaoOrcamentaria(ctx: Ctx, exercicio: number) {
    const fin = await this.financeiro.resumo(ctx.unidadeId, exercicio);
    const linhas: Linha[] = fin.creditos.map((c) => {
      const cl = c.classificacao as Record<string, string | null>;
      return {
        ptres: cl.ptres, fonte: cl.fonte, natureza: cl.naturezaDespesa, pi: cl.planoInterno,
        credito_atualizado: c.creditoAtualizado as string, empenhado_liquido: c.empenhadoLiquido as string, empenhado_a_liquidar: c.empenhadoALiquidar as string,
        liquidado_liquido: c.liquidadoLiquido as string, liquidado_a_pagar: c.liquidadoAPagar as string, pago_liquido: c.pagoLiquido as string,
        disponivel_para_empenhar: c.disponivelParaEmpenhar as string, ultima_conciliacao: c.ultimaConciliacao ? (c.ultimaConciliacao as Date).toISOString() : '',
      };
    });
    return { titulo: `Execução orçamentária — exercício ${exercicio}`, linhas, totais: fin.totais, restosAPagar: fin.restosAPagar, observacao: fin.observacao };
  }

  async processos(ctx: Ctx, exercicio: number) {
    const ps = await this.prisma.processo.findMany({
      where: { unidadeId: ctx.unidadeId, exercicio },
      include: { checklist: true, responsavel: { select: { nome: true } } },
      orderBy: { numeroInterno: 'asc' },
    });
    const hoje = hojeCivil();
    const linhas: Linha[] = ps.map((p) => ({
      numero: p.numeroInterno, nup: p.nup, objeto: p.objeto, forma: p.formaContratacao, modalidade: p.modalidade, hipotese: p.hipoteseDireta,
      etapa: p.etapa, situacao: p.situacao, responsavel: p.responsavel?.nome, valor_estimado: p.valorEstimado.toFixed(2),
      conclusao_prevista: isoData(p.dataConclusaoPrevista), atrasado: !!p.dataConclusaoPrevista && p.dataConclusaoPrevista < hoje && p.etapa !== 'FINALIZADO' && p.situacao === 'ATIVO',
      checklist_percentual: cumprimento(p.checklist).percentual,
    }));
    return { titulo: `Processos — exercício ${exercicio}`, linhas };
  }

  async riscosRel(ctx: Ctx) {
    const r = await this.riscos.listar(ctx, { pagina: 1, tamanho: 200 } as never);
    const linhas: Linha[] = r.itens.map((x) => ({
      evento: x.evento, categoria: x.categoria, fase: x.fase, vinculo: x.processo?.numeroInterno ?? x.contrato?.numero ?? '',
      probabilidade: x.probabilidade, impacto: x.impacto, score: x.score, nivel: x.nivel, score_residual: x.scoreResidual, nivel_residual: x.nivelResidual,
      status: x.status, proxima_revisao: isoData(x.proximaRevisao),
    }));
    return { titulo: 'Registro de riscos', linhas, aviso: r.avisoFaixas };
  }

  async vigencias(ctx: Ctx) {
    const hoje = hojeCivil();
    const [cs, as] = await Promise.all([
      this.prisma.contratoInstrumento.findMany({ where: { unidadeId: ctx.unidadeId, situacao: { in: ['VIGENTE', 'SUSPENSO', 'EM_FORMALIZACAO'] } }, orderBy: { vigenciaFim: 'asc' } }),
      this.prisma.ata.findMany({ where: { unidadeId: ctx.unidadeId, cancelada: false }, orderBy: { vigenciaFim: 'asc' } }),
    ]);
    const linhas: Linha[] = [
      ...cs.map((c) => ({ tipo: 'Contrato', numero: c.numero, objeto: c.objeto, inicio: isoData(c.vigenciaInicio), fim: isoData(c.vigenciaFim), dias_para_vencer: diffDias(c.vigenciaFim, hoje), situacao: c.situacao })),
      ...as.map((a) => ({ tipo: 'Ata', numero: a.numero, objeto: a.objeto, inicio: isoData(a.vigenciaInicio), fim: isoData(a.vigenciaFim), dias_para_vencer: diffDias(a.vigenciaFim, hoje), situacao: a.tipoVinculo })),
    ].sort((x, y) => Number(x.dias_para_vencer) - Number(y.dias_para_vencer));
    return { titulo: 'Vigências de contratos e atas', linhas };
  }
}

@ApiTags('relatorios')
@Controller('relatorios')
class RelatoriosController {
  constructor(
    private s: RelatoriosService,
    private auditoria: AuditoriaService,
    private prisma: PrismaService,
  ) {}

  @Perfis(...LEITURA_UNIDADE) @Get(':tipo')
  async gerar(@C() ctx: Ctx, @Param('tipo') tipo: string, @Query() q: RelatorioQuery, @Res({ passthrough: true }) res: Response) {
    const geradores: Record<string, () => Promise<{ titulo: string; linhas: Linha[] }>> = {
      executivo: () => this.s.executivo(ctx, q.exercicio),
      'execucao-orcamentaria': () => this.s.execucaoOrcamentaria(ctx, q.exercicio),
      processos: () => this.s.processos(ctx, q.exercicio),
      riscos: () => this.s.riscosRel(ctx),
      vigencias: () => this.s.vigencias(ctx),
    };
    const g = geradores[tipo];
    if (!g) throw new BadRequestException('Relatório inexistente');
    const r = await g();
    if (q.formato === 'csv') {
      await this.auditoria.registrar(this.prisma, ctx, { acao: 'RELATORIO_EXPORTADO', entidade: 'Relatorio', entidadeId: tipo, depois: { exercicio: q.exercicio } });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="aerogest-${tipo}-${q.exercicio}.csv"`);
      res.setHeader('Cache-Control', 'private, no-store');
      return paraCsv(r.linhas);
    }
    return r;
  }
}

@Module({ imports: [FinanceiroModule, DashboardModule, RiscosModule], controllers: [RelatoriosController], providers: [RelatoriosService] })
export class RelatoriosModule {}
