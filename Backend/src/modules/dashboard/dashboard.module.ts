import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { C, Ctx, ehLeituraUnidade, ehSecretaria, Perfis, TODOS } from '../../common/contexto';
import { diffDias, hojeCivil, somarDias } from '../../common/datas';
import { EscopoService } from '../../common/escopo.service';
import { CalendarioModule, CalendarioService } from '../calendario/calendario.module';
import { FinanceiroModule } from '../financeiro/financeiro.module';
import { FinanceiroService } from '../financeiro/financeiro.service';
import { RiscosModule, RiscosService } from '../riscos/riscos.module';
import { AlertasService } from './alertas.service';

class DashboardQuery {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  exercicio: number;
}

/** Definições dos indicadores de processos (exibidas na interface). */
export const DEFINICOES = {
  a_iniciar: 'Processos ativos do exercício na etapa "A iniciar"',
  iniciados: 'Processos ativos do exercício entre Planejamento e Formalização',
  finalizados: 'Processos do exercício na etapa "Finalizado"',
  atrasados: 'Processos ativos não finalizados com conclusão prevista anterior a hoje',
};

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private escopo: EscopoService,
    private financeiro: FinanceiroService,
    private alertas: AlertasService,
    private riscos: RiscosService,
    private calendario: CalendarioService,
  ) {}

  async indicadoresProcessos(unidadeId: string, exercicio: number) {
    const hoje = hojeCivil();
    const base = { unidadeId, exercicio };
    const [aIniciar, iniciados, finalizados, atrasados] = await Promise.all([
      this.prisma.processo.count({ where: { ...base, situacao: 'ATIVO', etapa: 'A_INICIAR' } }),
      this.prisma.processo.count({ where: { ...base, situacao: 'ATIVO', etapa: { notIn: ['A_INICIAR', 'FINALIZADO'] } } }),
      this.prisma.processo.count({ where: { ...base, etapa: 'FINALIZADO' } }),
      this.prisma.processo.count({ where: { ...base, situacao: 'ATIVO', etapa: { not: 'FINALIZADO' }, dataConclusaoPrevista: { lt: hoje } } }),
    ]);
    const porEtapa = await this.prisma.processo.groupBy({ by: ['etapa'], where: { ...base, situacao: 'ATIVO' }, _count: true });
    return { aIniciar, iniciados, finalizados, atrasados, porEtapa: porEtapa.map((e) => ({ etapa: e.etapa, total: e._count })), definicoes: DEFINICOES };
  }

  async painel(ctx: Ctx, exercicio: number) {
    const hoje = hojeCivil();
    const permitidos = await this.escopo.contratosPermitidos(ctx);
    const fc = await this.escopo.filtroContratos(ctx);
    const proximos = (await this.calendario.agenda(ctx, hoje.toISOString(), somarDias(hoje, 21).toISOString()))
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 8);
    const alertas = await this.alertas.calcular(ctx.unidadeId, permitidos);
    const vencendo = await this.prisma.contratoInstrumento.findMany({
      where: { AND: [fc, { situacao: { in: ['VIGENTE', 'SUSPENSO'] }, vigenciaFim: { lte: somarDias(hoje, 90) } }] },
      orderBy: { vigenciaFim: 'asc' },
      take: 10,
      select: { id: true, numero: true, objeto: true, vigenciaFim: true, situacao: true },
    });
    const base = {
      perfil: ctx.perfil,
      exercicio,
      alertas: alertas.slice(0, 30),
      totalAlertas: { CRITICO: alertas.filter((a) => a.nivel === 'CRITICO').length, ATENCAO: alertas.filter((a) => a.nivel === 'ATENCAO').length, INFO: alertas.filter((a) => a.nivel === 'INFO').length },
      proximosEventos: proximos,
      contratosVencendo: vencendo.map((c) => ({ ...c, dias: diffDias(c.vigenciaFim, hoje) })),
      entregasAtrasadas: alertas.filter((a) => a.regra === 'ENTREGA_ATRASADA').length,
    };

    if (!ehLeituraUnidade(ctx)) {
      // Gestor: carteira própria
      const contratos = await this.prisma.contratoInstrumento.findMany({
        where: fc,
        include: { designacoes: { where: { usuarioId: ctx.usuarioId, status: { not: 'ENCERRADA' } } } },
        orderBy: { vigenciaFim: 'asc' },
      });
      const solicitacoes = await this.prisma.solicitacao.count({ where: { unidadeId: ctx.unidadeId, autorId: ctx.usuarioId, status: { notIn: ['RESOLVIDA', 'CANCELADA'] } } });
      const notasPendentes = await this.prisma.notaFiscal.count({ where: { contrato: fc, status: 'RECEBIDA' } });
      const tarefas = await this.prisma.checklistItem.findMany({
        where: { atribuidoGestorId: ctx.usuarioId, estado: { in: ['PENDENTE', 'EM_ANDAMENTO', 'DEVOLVIDO'] }, processo: { unidadeId: ctx.unidadeId } },
        include: { processo: { select: { id: true, numeroInterno: true } } },
      });
      return {
        ...base,
        carteira: contratos.map((c) => ({
          id: c.id, numero: c.numero, objeto: c.objeto, vigenciaFim: c.vigenciaFim, situacao: c.situacao, dias: diffDias(c.vigenciaFim, hoje),
          funcoes: c.designacoes.map((d) => ({ funcao: d.funcao, status: d.status })),
        })),
        solicitacoesAbertas: solicitacoes,
        notasAguardandoAtesto: notasPendentes,
        tarefas,
      };
    }

    const [fin, processos, riscos, atasVencendo] = await Promise.all([
      this.financeiro.resumo(ctx.unidadeId, exercicio),
      this.indicadoresProcessos(ctx.unidadeId, exercicio),
      this.riscos.listar(ctx, { nivel: 'critico', pagina: 1, tamanho: 5 } as never),
      this.prisma.ata.findMany({
        where: { unidadeId: ctx.unidadeId, cancelada: false, vigenciaFim: { gte: hoje, lte: somarDias(hoje, 90) } },
        orderBy: { vigenciaFim: 'asc' }, take: 10, select: { id: true, numero: true, objeto: true, vigenciaFim: true, tipoVinculo: true },
      }),
    ]);
    const extra = ehSecretaria(ctx)
      ? {
          minhasTarefas: await this.prisma.checklistItem.findMany({
            where: { responsavelId: ctx.usuarioId, estado: { in: ['PENDENTE', 'EM_ANDAMENTO', 'DEVOLVIDO'] }, processo: { unidadeId: ctx.unidadeId, situacao: 'ATIVO' } },
            include: { processo: { select: { id: true, numeroInterno: true } } },
            orderBy: { prazo: { sort: 'asc', nulls: 'last' } },
            take: 15,
          }),
          solicitacoesAbertas: await this.prisma.solicitacao.count({ where: { unidadeId: ctx.unidadeId, status: { in: ['ABERTA', 'EM_TRIAGEM'] } } }),
          naRevisao: await this.prisma.checklistItem.count({ where: { estado: 'NAO_APLICAVEL', exigeRevisaoNA: true, naRevisadoEm: null, processo: { unidadeId: ctx.unidadeId } } }),
          designacoesPendentes: await this.prisma.designacao.count({ where: { unidadeId: ctx.unidadeId, status: 'PENDENTE' } }),
        }
      : {};
    return {
      ...base,
      financeiro: fin.totais,
      ultimaConciliacao: fin.creditos.map((c) => c.ultimaConciliacao as Date | null).filter(Boolean).sort().at(0) ?? null,
      processos,
      riscosCriticos: { total: riscos.total, itens: riscos.itens },
      atasVencendo: atasVencendo.map((a) => ({ ...a, dias: diffDias(a.vigenciaFim, hoje) })),
      ...extra,
    };
  }
}

@ApiTags('dashboard')
@Controller('dashboard')
class DashboardController {
  constructor(private s: DashboardService) {}

  @Perfis(...TODOS) @Get()
  painel(@C() ctx: Ctx, @Query() q: DashboardQuery) {
    return this.s.painel(ctx, q.exercicio);
  }
}

@Module({
  imports: [FinanceiroModule, RiscosModule, CalendarioModule],
  controllers: [DashboardController],
  providers: [DashboardService, AlertasService],
  exports: [DashboardService, AlertasService],
})
export class DashboardModule {}
