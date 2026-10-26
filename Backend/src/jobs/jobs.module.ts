import { Injectable, Logger, Module, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Perfil, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { diffDias, hojeCivil, isoData, somarDias } from '../common/datas';
import { ParametrosService } from '../common/parametros.service';
import { env } from '../config/env';
import { NotificacoesModule, NotificacoesService, NovaNotificacao } from '../modules/notificacoes/notificacoes.module';

const NOME_JOB = 'lembretes-diarios';
const MAX_TENTATIVAS = 3;

/** Marco a notificar: o menor marco >= dias restantes (permite recuperar marcos perdidos se o job ficou parado). */
export function marcoAtual(diasRestantes: number, marcos: number[]): number | null {
  if (diasRestantes < 0) return -1; // atraso
  const candidatos = marcos.filter((m) => m >= diasRestantes).sort((a, b) => a - b);
  return candidatos.length ? candidatos[0] : null;
}

/**
 * Job diário persistente e idempotente:
 *  - execução registrada em JobExecucao com chave única (nome, data) — não duplica após restart;
 *  - cada notificação tem chave única (regra:entidade:id:data-alvo:marco:usuário);
 *  - mudança de vigência gera novas chaves (a data-alvo integra a chave) e invalida lembretes antigos;
 *  - retentativa até 3 vezes; pendências críticas escalam ao chefe.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private log = new Logger('Jobs');
  private timer?: NodeJS.Timeout;
  private rodando = false;

  constructor(
    private prisma: PrismaService,
    private notif: NotificacoesService,
    private params: ParametrosService,
  ) {}

  onApplicationBootstrap() {
    if (!env().jobsEnabled) return;
    setTimeout(() => void this.tick(), 5000);
    this.timer = setInterval(() => void this.tick(), 30 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.rodando) return;
    this.rodando = true;
    try {
      await this.executar(hojeCivil());
    } catch (e) {
      this.log.error(`Falha no job: ${(e as Error).message}`);
    } finally {
      this.rodando = false;
    }
  }

  /** Reivindica a execução do dia. Retorna false se já concluída/em curso ou tentativas esgotadas. */
  private async reivindicar(data: Date): Promise<string | null> {
    try {
      const j = await this.prisma.jobExecucao.create({ data: { nome: NOME_JOB, dataReferencia: data, status: 'EXECUTANDO' } });
      return j.id;
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    }
    const j = await this.prisma.jobExecucao.findUniqueOrThrow({ where: { nome_dataReferencia: { nome: NOME_JOB, dataReferencia: data } } });
    const travado = j.status === 'EXECUTANDO' && Date.now() - j.iniciadoEm.getTime() > 60 * 60 * 1000;
    if ((j.status === 'FALHOU' || travado) && j.tentativas < MAX_TENTATIVAS) {
      const r = await this.prisma.jobExecucao.updateMany({
        where: { id: j.id, status: j.status, tentativas: j.tentativas },
        data: { status: 'EXECUTANDO', tentativas: { increment: 1 }, iniciadoEm: new Date() },
      });
      return r.count ? j.id : null;
    }
    return null;
  }

  async executar(hoje: Date) {
    const jobId = await this.reivindicar(hoje);
    if (!jobId) return { executado: false };
    const log: string[] = [];
    try {
      const unidades = await this.prisma.unidade.findMany({ where: { ativo: true } });
      for (const u of unidades) {
        const n = await this.processarUnidade(u.id, hoje);
        log.push(`${u.sigla}: ${n} notificação(ões) emitida(s)`);
      }
      await this.prisma.jobExecucao.update({ where: { id: jobId }, data: { status: 'CONCLUIDO', finalizadoEm: new Date(), log: log.join('\n') } });
      this.log.log(`Job ${NOME_JOB} ${isoData(hoje)} concluído — ${log.join('; ')}`);
      return { executado: true, log };
    } catch (e) {
      await this.prisma.jobExecucao.update({ where: { id: jobId }, data: { status: 'FALHOU', finalizadoEm: new Date(), log: `${log.join('\n')}\nERRO: ${(e as Error).message}` } });
      throw e;
    }
  }

  private async usuariosPorPerfil(unidadeId: string, perfis: Perfil[]) {
    const vs = await this.prisma.vinculoUnidadePerfil.findMany({ where: { unidadeId, ativo: true, perfil: { in: perfis }, usuario: { ativo: true } } });
    return vs.map((v) => v.usuarioId);
  }

  private async processarUnidade(unidadeId: string, hoje: Date): Promise<number> {
    const marcos = await this.params.valor<number[]>('lembretes.vigencia.dias', unidadeId);
    const horizonte = Math.max(...marcos, 0);
    const chefes = await this.usuariosPorPerfil(unidadeId, ['CHEFE']);
    const secretaria = await this.usuariosPorPerfil(unidadeId, ['CHEFE', 'AUXILIAR']);
    let emitidas = 0;
    const emitir = async (usuarios: string[], base: Omit<NovaNotificacao, 'usuarioId' | 'chave' | 'unidadeId'>, chave: string) => {
      for (const u of new Set(usuarios)) {
        if (await this.notif.emitir({ ...base, unidadeId, usuarioId: u, chave: `${chave}:${u}` })) emitidas++;
      }
    };

    // Vigência de contratos
    const contratos = await this.prisma.contratoInstrumento.findMany({
      where: { unidadeId, situacao: { in: ['VIGENTE', 'SUSPENSO'] }, vigenciaFim: { lte: somarDias(hoje, horizonte) } },
      include: { designacoes: { where: { status: { in: ['ATIVA', 'PENDENTE'] } } } },
    });
    for (const c of contratos) {
      const dias = diffDias(c.vigenciaFim, hoje);
      const m = marcoAtual(dias, marcos);
      if (m === null) continue;
      const critico = dias <= 7;
      const gestores = c.designacoes.map((d) => d.usuarioId);
      await emitir(
        [...gestores, ...secretaria],
        {
          nivel: critico ? 'CRITICO' : dias <= 30 ? 'ATENCAO' : 'INFO',
          titulo: dias < 0 ? `Contrato ${c.numero}: vigência expirada` : `Contrato ${c.numero} vence em ${dias} dia(s)`,
          mensagem: `Fim de vigência em ${isoData(c.vigenciaFim)}. Prorrogação exige registro documental (não é automática).`,
          regra: `Lembrete de vigência (marcos: ${marcos.join(', ')} dias, vencimento e atraso)`,
          link: `/contratos/${c.id}`,
        },
        `vigencia:contrato:${c.id}:${isoData(c.vigenciaFim)}:${m}`,
      );
    }

    // Vigência de atas com utilização autorizada
    const atas = await this.prisma.ata.findMany({
      where: { unidadeId, cancelada: false, tipoVinculo: { not: 'CONSULTA' }, vigenciaFim: { gte: somarDias(hoje, -1), lte: somarDias(hoje, horizonte) } },
    });
    for (const a of atas) {
      const dias = diffDias(a.vigenciaFim, hoje);
      const m = marcoAtual(dias, marcos);
      if (m === null) continue;
      await emitir(
        secretaria,
        {
          nivel: dias <= 7 ? 'CRITICO' : dias <= 30 ? 'ATENCAO' : 'INFO',
          titulo: dias < 0 ? `Ata ${a.numero} expirada` : `Ata ${a.numero} vence em ${dias} dia(s)`,
          mensagem: `Fim de vigência em ${isoData(a.vigenciaFim)}. Após o vencimento, a ata não admite nova utilização.`,
          regra: 'Lembrete de vigência de ata',
          link: `/atas/${a.id}`,
        },
        `vigencia:ata:${a.id}:${isoData(a.vigenciaFim)}:${m}`,
      );
    }

    // Entregas em atraso → gestores/fiscais do contrato + escalonamento ao chefe após 7 dias
    const entregas = await this.prisma.entrega.findMany({
      where: { unidadeId, status: { notIn: ['RECEBIDA_DEFINITIVA', 'CANCELADA', 'RECEBIDA_PROVISORIA'] }, prazo: { lt: hoje } },
      include: { contrato: { include: { designacoes: { where: { status: 'ATIVA' } } } } },
    });
    for (const e of entregas) {
      const atraso = diffDias(hoje, e.prazo);
      const destino = [...e.contrato.designacoes.map((d) => d.usuarioId), ...(atraso >= 7 ? chefes : [])];
      await emitir(
        destino,
        {
          nivel: atraso >= 7 ? 'CRITICO' : 'ATENCAO', titulo: `Entrega em atraso — contrato ${e.contrato.numero}`,
          mensagem: `${e.descricao}: prazo ${isoData(e.prazo)} (${atraso} dia(s) de atraso).`, regra: 'Entrega com prazo vencido sem recebimento integral; escala ao chefe após 7 dias',
          link: `/contratos/${e.contratoId}?aba=execucao`,
        },
        `entrega:${e.id}:${isoData(e.prazo)}:${atraso >= 7 ? 'escalada' : 'atraso'}`,
      );
    }

    // Contratos vigentes sem gestor designado → chefe (uma vez por semana)
    const semana = Math.floor(hoje.getTime() / (7 * 86400000));
    const semGestor = await this.prisma.contratoInstrumento.findMany({
      where: { unidadeId, situacao: 'VIGENTE', designacoes: { none: { status: 'ATIVA', funcao: { in: ['GESTOR', 'GESTOR_SUBSTITUTO'] } } } },
    });
    for (const c of semGestor) {
      await emitir(chefes, {
        nivel: 'CRITICO', titulo: `Contrato ${c.numero} sem gestor designado`, mensagem: 'Registre a designação competente (documento) para ativar o gestor.',
        regra: 'Contrato vigente sem designação ATIVA de gestor', link: `/contratos/${c.id}?aba=designacoes`,
      }, `semdesignacao:${c.id}:${semana}`);
    }

    // Itens de checklist vencidos → responsável; críticos escalam ao chefe
    const itens = await this.prisma.checklistItem.findMany({
      where: { processo: { unidadeId, situacao: 'ATIVO' }, estado: { in: ['PENDENTE', 'EM_ANDAMENTO', 'DEVOLVIDO'] }, prazo: { lt: hoje } },
      include: { processo: { select: { numeroInterno: true } } },
    });
    for (const i of itens) {
      const destino = [...(i.responsavelId ? [i.responsavelId] : []), ...(i.atribuidoGestorId ? [i.atribuidoGestorId] : []), ...(i.critico ? chefes : [])];
      await emitir(destino, {
        nivel: i.critico ? 'CRITICO' : 'ATENCAO', titulo: `Prazo vencido: ${i.titulo}`, mensagem: `${i.processo.numeroInterno} — prazo ${isoData(i.prazo)}.`,
        regra: 'Item de checklist com prazo vencido (críticos escalam ao chefe)', link: `/processos/${i.processoId}?aba=checklist`,
      }, `checklist:${i.id}:${isoData(i.prazo)}`);
    }

    // Revisões de risco vencidas → responsável
    const riscos = await this.prisma.risco.findMany({ where: { unidadeId, status: { not: 'ENCERRADO' }, proximaRevisao: { lt: hoje } } });
    for (const r of riscos) {
      await emitir(r.responsavelId ? [r.responsavelId] : chefes, {
        nivel: 'ATENCAO', titulo: `Revisão de risco vencida`, mensagem: `${r.evento} — revisão prevista em ${isoData(r.proximaRevisao)}.`,
        regra: 'Risco não encerrado com revisão vencida', link: `/riscos/${r.id}`,
      }, `risco:${r.id}:${isoData(r.proximaRevisao)}`);
    }

    // Lembretes de eventos manuais
    const eventos = await this.prisma.evento.findMany({ where: { unidadeId, concluido: false, inicio: { gte: hoje, lte: somarDias(hoje, 31) } } });
    for (const ev of eventos) {
      const dataEv = new Date(Date.UTC(ev.inicio.getUTCFullYear(), ev.inicio.getUTCMonth(), ev.inicio.getUTCDate()));
      const dias = diffDias(dataEv, hoje);
      const m = marcoAtual(dias, ev.lembreteDias.length ? ev.lembreteDias : [1]);
      if (m === null || m < 0) continue;
      await emitir([...(ev.responsavelId ? [ev.responsavelId] : []), ...ev.participantes], {
        nivel: ev.prioridade === 'URGENTE' ? 'CRITICO' : 'INFO', titulo: dias === 0 ? `Hoje: ${ev.titulo}` : `Em ${dias} dia(s): ${ev.titulo}`,
        mensagem: ev.descricao ?? '', regra: `Lembrete de evento (${ev.lembreteDias.join(', ')} dia(s) antes)`, link: '/calendario',
      }, `evento:${ev.id}:${ev.inicio.toISOString()}:${m}`);
    }

    return emitidas;
  }
}

@Module({ imports: [NotificacoesModule], providers: [JobsService], exports: [JobsService] })
export class JobsModule {}
