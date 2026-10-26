import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, PartialType } from '@nestjs/swagger';
import { Prioridade, Prisma, TipoEvento } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min,
} from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { AuditoriaService } from '../../common/auditoria.service';
import { C, Ctx, ehLeituraUnidade, ehSecretaria, Perfis, TODOS } from '../../common/contexto';
import { dataCivil, isoData } from '../../common/datas';
import { EscopoService } from '../../common/escopo.service';

class EventoDto {
  @IsString() @IsNotEmpty() @MaxLength(300) titulo: string;
  @IsOptional() @IsString() @MaxLength(3000) descricao?: string;
  @IsEnum(TipoEvento) tipo: TipoEvento;
  @IsOptional() @IsUUID() responsavelId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsUUID('all', { each: true }) participantes?: string[];
  @IsOptional() @IsUUID() processoId?: string;
  @IsOptional() @IsUUID() contratoId?: string;
  @IsOptional() @IsUUID() ataId?: string;
  /** Instante ISO 8601 com fuso, ou AAAA-MM-DD quando diaInteiro */
  @IsISO8601() inicio: string;
  @IsOptional() @IsISO8601() fim?: string;
  @IsOptional() @IsBoolean() diaInteiro?: boolean;
  @IsOptional() @IsEnum(Prioridade) prioridade?: Prioridade;
  @IsOptional() @IsIn(['NENHUMA', 'SEMANAL', 'MENSAL', 'ANUAL']) recorrencia?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @Type(() => Number) @IsInt({ each: true }) @Min(0, { each: true }) @Max(365, { each: true }) lembreteDias?: number[];
}

class AtualizarEventoDto extends PartialType(EventoDto) {
  @IsOptional() @IsBoolean() concluido?: boolean;
}

class AgendaQuery {
  @IsISO8601() de: string;
  @IsISO8601() ate: string;
}

export interface ItemAgenda {
  id: string;
  titulo: string;
  tipo: string;
  start: string;
  end?: string | null;
  allDay: boolean;
  automatico: boolean;
  prioridade?: string;
  concluido?: boolean;
  link?: string;
  regra?: string;
}

function instante(s: string, diaInteiro: boolean) {
  if (diaInteiro) return dataCivil(s.slice(0, 10));
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Data/hora inválida');
  return d;
}

@Injectable()
export class CalendarioService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService,
    private escopo: EscopoService,
  ) {}

  private async filtroEventos(ctx: Ctx): Promise<Prisma.EventoWhereInput> {
    if (ehLeituraUnidade(ctx)) return { unidadeId: ctx.unidadeId };
    const ids = (await this.escopo.contratosPermitidos(ctx)) ?? [];
    return {
      unidadeId: ctx.unidadeId,
      OR: [{ contratoId: { in: ids } }, { responsavelId: ctx.usuarioId }, { participantes: { has: ctx.usuarioId } }, { criadoPor: ctx.usuarioId }],
    };
  }

  async agenda(ctx: Ctx, deS: string, ateS: string) {
    const de = new Date(deS);
    const ate = new Date(ateS);
    if (!(de < ate) || ate.getTime() - de.getTime() > 400 * 86400000) throw new BadRequestException('Intervalo inválido (máx. 400 dias)');
    const deC = dataCivil(de.toISOString().slice(0, 10));
    const ateC = dataCivil(ate.toISOString().slice(0, 10));
    const itens: ItemAgenda[] = [];

    // Eventos manuais (com expansão de recorrência)
    const evs = await this.prisma.evento.findMany({
      where: { AND: [await this.filtroEventos(ctx), { OR: [{ inicio: { lte: ate }, recorrencia: { not: 'NENHUMA' } }, { inicio: { gte: de, lte: ate } }] }] },
      take: 2000,
    });
    for (const e of evs) {
      const dur = e.fim ? e.fim.getTime() - e.inicio.getTime() : 0;
      let atual = new Date(e.inicio);
      for (let n = 0; n < 500 && atual <= ate; n++) {
        if (atual >= de) {
          itens.push({
            id: n === 0 ? e.id : `${e.id}:${n}`,
            titulo: e.titulo,
            tipo: e.tipo,
            start: e.diaInteiro ? isoData(atual)! : atual.toISOString(),
            end: e.fim ? (e.diaInteiro ? isoData(new Date(atual.getTime() + dur)) : new Date(atual.getTime() + dur).toISOString()) : null,
            allDay: e.diaInteiro,
            automatico: false,
            prioridade: e.prioridade,
            concluido: e.concluido,
          });
        }
        if (e.recorrencia === 'NENHUMA') break;
        const p = new Date(atual);
        if (e.recorrencia === 'SEMANAL') p.setUTCDate(p.getUTCDate() + 7);
        if (e.recorrencia === 'MENSAL') p.setUTCMonth(p.getUTCMonth() + 1);
        if (e.recorrencia === 'ANUAL') p.setUTCFullYear(p.getUTCFullYear() + 1);
        atual = p;
      }
    }

    // Marcos automáticos derivados dos registros (sempre consistentes com a origem)
    const contratosFiltro = await this.escopo.filtroContratos(ctx);
    const gestor = !ehLeituraUnidade(ctx);
    const [contratos, atas, entregas, riscos, checklist, processos, solicitacoes] = await Promise.all([
      this.prisma.contratoInstrumento.findMany({ where: { AND: [contratosFiltro, { situacao: { in: ['VIGENTE', 'SUSPENSO'] }, vigenciaFim: { gte: deC, lte: ateC } }] } }),
      gestor ? [] : this.prisma.ata.findMany({ where: { unidadeId: ctx.unidadeId, cancelada: false, vigenciaFim: { gte: deC, lte: ateC } } }),
      this.prisma.entrega.findMany({
        where: { unidadeId: ctx.unidadeId, contrato: contratosFiltro, status: { notIn: ['RECEBIDA_DEFINITIVA', 'CANCELADA'] }, prazo: { gte: deC, lte: ateC } },
        include: { contrato: { select: { numero: true } } },
      }),
      gestor ? [] : this.prisma.risco.findMany({ where: { unidadeId: ctx.unidadeId, status: { not: 'ENCERRADO' }, proximaRevisao: { gte: deC, lte: ateC } } }),
      this.prisma.checklistItem.findMany({
        where: {
          processo: { unidadeId: ctx.unidadeId }, estado: { in: ['PENDENTE', 'EM_ANDAMENTO', 'DEVOLVIDO'] }, prazo: { gte: deC, lte: ateC },
          ...(gestor ? { atribuidoGestorId: ctx.usuarioId } : {}),
        },
        include: { processo: { select: { numeroInterno: true } } },
      }),
      gestor ? [] : this.prisma.processo.findMany({ where: { unidadeId: ctx.unidadeId, situacao: 'ATIVO', etapa: { not: 'FINALIZADO' }, dataConclusaoPrevista: { gte: deC, lte: ateC } } }),
      this.prisma.solicitacao.findMany({
        where: { unidadeId: ctx.unidadeId, contrato: contratosFiltro, status: { notIn: ['RESOLVIDA', 'CANCELADA'] }, prazo: { gte: deC, lte: ateC } },
      }),
    ]);
    const marco = (id: string, titulo: string, tipo: string, data: Date, link: string, regra: string) =>
      itens.push({ id, titulo, tipo, start: isoData(data)!, allDay: true, automatico: true, link, regra });
    contratos.forEach((c) => marco(`vig-c-${c.id}`, `Fim de vigência — contrato ${c.numero}`, 'VIGENCIA', c.vigenciaFim, `/contratos/${c.id}`, 'Data de fim de vigência do contrato'));
    atas.forEach((a) => marco(`vig-a-${a.id}`, `Fim de vigência — ata ${a.numero}`, 'VIGENCIA', a.vigenciaFim, `/atas/${a.id}`, 'Data de fim de vigência da ata'));
    entregas.forEach((e) => marco(`ent-${e.id}`, `Entrega: ${e.descricao} (${e.contrato.numero})`, 'ENTREGA', e.prazo, `/contratos/${e.contratoId}?aba=execucao`, 'Prazo de entrega não recebida'));
    riscos.forEach((r) => marco(`ris-${r.id}`, `Revisão de risco: ${r.evento}`, 'REVISAO_RISCO', r.proximaRevisao!, `/riscos/${r.id}`, 'Próxima revisão do risco'));
    checklist.forEach((i) => marco(`chk-${i.id}`, `${i.processo.numeroInterno}: ${i.titulo}`, 'OUTRO', i.prazo!, `/processos/${i.processoId}?aba=checklist`, 'Prazo de item de checklist pendente'));
    processos.forEach((p) => marco(`proc-${p.id}`, `Conclusão prevista: ${p.numeroInterno}`, 'OUTRO', p.dataConclusaoPrevista!, `/processos/${p.id}`, 'Data prevista de conclusão do processo'));
    solicitacoes.forEach((s) => marco(`sol-${s.id}`, `Solicitação: ${s.titulo}`, 'CONTATO_EMPRESA', s.prazo!, `/solicitacoes/${s.id}`, 'Prazo de solicitação em aberto'));
    return itens;
  }

  private async validar(ctx: Ctx, dto: Partial<EventoDto>) {
    if (dto.contratoId) await this.escopo.assertContrato(ctx, dto.contratoId);
    if (dto.processoId) await this.escopo.daUnidade(this.prisma.processo.findFirst({ where: { id: dto.processoId, unidadeId: ctx.unidadeId } }), 'Processo');
    if (dto.ataId) await this.escopo.daUnidade(this.prisma.ata.findFirst({ where: { id: dto.ataId, unidadeId: ctx.unidadeId } }), 'Ata');
    const pessoas = [...(dto.participantes ?? []), ...(dto.responsavelId ? [dto.responsavelId] : [])];
    if (pessoas.length) {
      const n = await this.prisma.vinculoUnidadePerfil.count({ where: { unidadeId: ctx.unidadeId, usuarioId: { in: pessoas } } });
      if (n !== new Set(pessoas).size) throw new BadRequestException('Participantes/responsável devem pertencer à unidade');
    }
  }

  async criar(ctx: Ctx, dto: EventoDto) {
    if (ctx.perfil === 'COMANDANTE') throw new ForbiddenException('Perfil somente leitura');
    await this.validar(ctx, dto);
    const diaInteiro = !!dto.diaInteiro;
    const e = await this.prisma.evento.create({
      data: {
        unidadeId: ctx.unidadeId, titulo: dto.titulo, descricao: dto.descricao, tipo: dto.tipo, responsavelId: dto.responsavelId ?? ctx.usuarioId,
        participantes: dto.participantes ?? [], processoId: dto.processoId, contratoId: dto.contratoId, ataId: dto.ataId,
        inicio: instante(dto.inicio, diaInteiro), fim: dto.fim ? instante(dto.fim, diaInteiro) : null, diaInteiro, prioridade: dto.prioridade,
        recorrencia: dto.recorrencia ?? 'NENHUMA', lembreteDias: dto.lembreteDias ?? [1], criadoPor: ctx.usuarioId,
      },
    });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'EVENTO_CRIADO', entidade: 'Evento', entidadeId: e.id, depois: e });
    return e;
  }

  private async obterEditavel(ctx: Ctx, id: string) {
    const e = await this.prisma.evento.findFirst({ where: { AND: [{ id }, await this.filtroEventos(ctx)] } });
    if (!e) throw new NotFoundException('Evento não encontrado');
    if (!ehSecretaria(ctx) && e.criadoPor !== ctx.usuarioId) throw new ForbiddenException('Somente o autor ou a secretaria altera este evento');
    return e;
  }

  async obter(ctx: Ctx, id: string) {
    const e = await this.prisma.evento.findFirst({ where: { AND: [{ id }, await this.filtroEventos(ctx)] } });
    if (!e) throw new NotFoundException('Evento não encontrado');
    return e;
  }

  async atualizar(ctx: Ctx, id: string, dto: AtualizarEventoDto) {
    const antes = await this.obterEditavel(ctx, id);
    await this.validar(ctx, dto);
    const diaInteiro = dto.diaInteiro ?? antes.diaInteiro;
    const depois = await this.prisma.evento.update({
      where: { id },
      data: {
        ...dto,
        inicio: dto.inicio ? instante(dto.inicio, diaInteiro) : undefined,
        fim: dto.fim ? instante(dto.fim, diaInteiro) : undefined,
      },
    });
    // Alteração de data invalida lembretes antigos: a chave de idempotência inclui a data do evento.
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'EVENTO_ATUALIZADO', entidade: 'Evento', entidadeId: id, antes, depois });
    return depois;
  }

  async remover(ctx: Ctx, id: string) {
    const antes = await this.obterEditavel(ctx, id);
    await this.prisma.evento.delete({ where: { id } });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'EVENTO_REMOVIDO', entidade: 'Evento', entidadeId: id, antes });
  }
}

@ApiTags('calendario')
@Controller('calendario')
class CalendarioController {
  constructor(private s: CalendarioService) {}

  @Perfis(...TODOS) @Get('agenda')
  agenda(@C() ctx: Ctx, @Query() q: AgendaQuery) {
    return this.s.agenda(ctx, q.de, q.ate);
  }

  @Perfis(...TODOS) @Get('eventos/:id')
  obter(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.obter(ctx, id);
  }

  @Perfis(...TODOS) @Post('eventos')
  criar(@C() ctx: Ctx, @Body() dto: EventoDto) {
    return this.s.criar(ctx, dto);
  }

  @Perfis(...TODOS) @Patch('eventos/:id')
  atualizar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarEventoDto) {
    return this.s.atualizar(ctx, id, dto);
  }

  @Perfis(...TODOS) @Delete('eventos/:id')
  async remover(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    await this.s.remover(ctx, id);
    return { ok: true };
  }
}

@Module({ controllers: [CalendarioController], providers: [CalendarioService], exports: [CalendarioService] })
export class CalendarioModule {}
