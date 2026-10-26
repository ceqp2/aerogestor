import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EstadoChecklist, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditoriaService } from '../../common/auditoria.service';
import { Ctx, ehLeituraUnidade, ehSecretaria } from '../../common/contexto';
import { dataCivilOpc, hojeCivil } from '../../common/datas';
import { D, quantidade, valorMonetario } from '../../common/dinheiro';
import { EscopoService } from '../../common/escopo.service';
import { paginar, resultado } from '../../common/paginacao';
import {
  AtualizarChecklistItemDto, AtualizarProcessoDto, CriarModeloDto, CriarProcessoDto, ItemProcessoDto, MudarEtapaDto, MudarSituacaoDto,
  NovoChecklistItemDto, ProcessosQuery, RevisarNaDto,
} from './processos.dto';
import { bloqueiosParaAvancar, cumprimento, indiceEtapa, validarClassificacao } from './processos.regras';

type Tx = Prisma.TransactionClient;

@Injectable()
export class ProcessosService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService,
    private escopo: EscopoService,
  ) {}

  /** Para gestor: processos ligados aos seus contratos ou com tarefa expressamente atribuída. */
  private async filtroAcesso(ctx: Ctx): Promise<Prisma.ProcessoWhereInput> {
    if (ehLeituraUnidade(ctx)) return { unidadeId: ctx.unidadeId };
    const contratos = (await this.escopo.contratosPermitidos(ctx)) ?? [];
    return {
      unidadeId: ctx.unidadeId,
      OR: [{ contratos: { some: { id: { in: contratos } } } }, { checklist: { some: { atribuidoGestorId: ctx.usuarioId } } }],
    };
  }

  private async obterAutorizado(ctx: Ctx, id: string) {
    const p = await this.prisma.processo.findFirst({ where: { AND: [{ id }, await this.filtroAcesso(ctx)] } });
    if (!p) throw new NotFoundException('Processo não encontrado');
    return p;
  }

  private async validarRefs(ctx: Ctx, dto: Partial<CriarProcessoDto>) {
    if (dto.responsavelId) {
      const v = await this.prisma.vinculoUnidadePerfil.findFirst({ where: { usuarioId: dto.responsavelId, unidadeId: ctx.unidadeId, ativo: true } });
      if (!v) throw new BadRequestException('Responsável não pertence à unidade');
    }
    if (dto.ataId) {
      const a = await this.prisma.ata.findFirst({ where: { id: dto.ataId, unidadeId: ctx.unidadeId } });
      if (!a) throw new BadRequestException('Ata não encontrada na unidade');
    }
  }

  async listar(ctx: Ctx, q: ProcessosQuery) {
    const { skip, take, pagina, tamanho } = paginar(q);
    const hoje = hojeCivil();
    const indicador: Prisma.ProcessoWhereInput =
      q.indicador === 'a_iniciar'
        ? { etapa: 'A_INICIAR', situacao: 'ATIVO' }
        : q.indicador === 'iniciados'
          ? { etapa: { notIn: ['A_INICIAR', 'FINALIZADO'] }, situacao: 'ATIVO' }
          : q.indicador === 'finalizados'
            ? { etapa: 'FINALIZADO' }
            : q.indicador === 'atrasados'
              ? { etapa: { not: 'FINALIZADO' }, situacao: 'ATIVO', dataConclusaoPrevista: { lt: hoje } }
              : {};
    const where: Prisma.ProcessoWhereInput = {
      AND: [
        await this.filtroAcesso(ctx),
        indicador,
        {
          etapa: q.etapa,
          situacao: q.situacao,
          formaContratacao: q.forma,
          exercicio: q.exercicio,
        },
        q.busca
          ? {
              OR: [
                { objeto: { contains: q.busca, mode: 'insensitive' } },
                { nup: { contains: q.busca, mode: 'insensitive' } },
                { numeroInterno: { contains: q.busca, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    };
    const [itens, total] = await Promise.all([
      this.prisma.processo.findMany({
        where,
        include: {
          responsavel: { select: { id: true, nome: true } },
          checklist: { select: { etapa: true, estado: true, critico: true, exigeRevisaoNA: true, naRevisadoEm: true, titulo: true } },
        },
        orderBy: [{ atualizadoEm: 'desc' }],
        skip,
        take,
      }),
      this.prisma.processo.count({ where }),
    ]);
    return resultado(
      itens.map(({ checklist, ...p }) => ({
        ...p,
        cumprimento: cumprimento(checklist),
        atrasado: !!p.dataConclusaoPrevista && p.dataConclusaoPrevista < hoje && p.etapa !== 'FINALIZADO' && p.situacao === 'ATIVO',
      })),
      total,
      pagina,
      tamanho,
    );
  }

  async detalhe(ctx: Ctx, id: string) {
    await this.obterAutorizado(ctx, id);
    const gestor = !ehLeituraUnidade(ctx);
    const p = await this.prisma.processo.findUniqueOrThrow({
      where: { id },
      include: {
        responsavel: { select: { id: true, nome: true } },
        ata: { select: { id: true, numero: true, vigenciaFim: true, orgaoGerenciador: true } },
        itens: { orderBy: { numero: 'asc' } },
        checklist: {
          orderBy: [{ ordem: 'asc' }],
          where: gestor ? { atribuidoGestorId: ctx.usuarioId } : undefined,
        },
        contratos: { select: { id: true, numero: true, situacao: true, vigenciaFim: true, valorAtualizado: true } },
        riscos: gestor ? false : { select: { id: true, evento: true, probabilidade: true, impacto: true, status: true } },
        alocacoes: gestor ? false : true,
        demandas: { select: { id: true, titulo: true, numeroDfd: true } },
      },
    });
    const evid = await this.prisma.vinculoDocumento.groupBy({
      by: ['entidadeId'],
      where: { tipo: 'CHECKLIST_ITEM', entidadeId: { in: p.checklist.map((c) => c.id) } },
      _count: true,
    });
    const mapaEvid = new Map(evid.map((e) => [e.entidadeId, e._count]));
    const bloqueios = bloqueiosParaAvancar(p.checklist, p.etapa);
    return {
      ...p,
      checklist: p.checklist.map((c) => ({ ...c, evidencias: mapaEvid.get(c.id) ?? 0 })),
      cumprimento: cumprimento(p.checklist),
      bloqueiosEtapa: bloqueios.map((b) => b.titulo),
      somenteTarefasAtribuidas: gestor,
    };
  }

  private async proximoNumero(tx: Tx, unidadeId: string, exercicio: number) {
    const n = await tx.processo.count({ where: { unidadeId, exercicio } });
    return `PROC-${exercicio}-${String(n + 1).padStart(4, '0')}`;
  }

  async criar(ctx: Ctx, dto: CriarProcessoDto) {
    const erros = validarClassificacao(dto);
    if (erros.length) throw new BadRequestException(erros);
    await this.validarRefs(ctx, dto);
    return this.prisma.$transaction(async (tx) => {
      const numeroInterno = await this.proximoNumero(tx, ctx.unidadeId, dto.exercicio);
      const p = await tx.processo.create({
        data: {
          unidadeId: ctx.unidadeId,
          numeroInterno,
          nup: dto.nup?.trim() || null,
          exercicio: dto.exercicio,
          objeto: dto.objeto.trim(),
          tipoObjeto: dto.tipoObjeto,
          origemDemanda: dto.origemDemanda,
          setorRequisitante: dto.setorRequisitante,
          prioridade: dto.prioridade,
          valorEstimado: dto.valorEstimado ? valorMonetario(dto.valorEstimado, 'valorEstimado', true) : D(0),
          formaContratacao: dto.formaContratacao,
          modalidade: dto.modalidade ?? null,
          hipoteseDireta: dto.hipoteseDireta ?? null,
          procedimentoAuxiliar: dto.procedimentoAuxiliar,
          fundamentoLegal: dto.fundamentoLegal,
          responsavelId: dto.responsavelId ?? null,
          ataId: dto.ataId ?? null,
          dataInicioPrevista: dataCivilOpc(dto.dataInicioPrevista),
          dataConclusaoPrevista: dataCivilOpc(dto.dataConclusaoPrevista),
          criadoPor: ctx.usuarioId,
        },
      });
      if (dto.demandaId) {
        const d = await tx.demanda.findFirst({ where: { id: dto.demandaId, unidadeId: ctx.unidadeId } });
        if (!d) throw new BadRequestException('Demanda não encontrada');
        await tx.demanda.update({ where: { id: d.id }, data: { processoId: p.id } });
      }
      const modeloId = dto.modeloChecklistId ?? (await this.modeloSugerido(tx, ctx, p.formaContratacao, p.tipoObjeto))?.id;
      if (modeloId) await this.aplicarModeloTx(tx, ctx, p.id, modeloId);
      await this.auditoria.registrar(tx, ctx, { acao: 'PROCESSO_CRIADO', entidade: 'Processo', entidadeId: p.id, depois: p });
      return p;
    });
  }

  private modeloSugerido(tx: Tx, ctx: Ctx, forma: CriarProcessoDto['formaContratacao'], tipo: CriarProcessoDto['tipoObjeto']) {
    return tx.modeloChecklist.findFirst({
      where: {
        ativo: true,
        formaContratacao: forma,
        OR: [{ unidadeId: ctx.unidadeId }, { unidadeId: null }],
        AND: [{ OR: [{ tipoObjeto: tipo }, { tipoObjeto: null }] }],
      },
      orderBy: [{ tipoObjeto: { sort: 'asc', nulls: 'last' } }, { versao: 'desc' }],
    });
  }

  async atualizar(ctx: Ctx, id: string, dto: AtualizarProcessoDto) {
    const antes = await this.obterAutorizado(ctx, id);
    const merged = { ...antes, ...dto };
    const erros = validarClassificacao(merged);
    if (erros.length) throw new BadRequestException(erros);
    await this.validarRefs(ctx, dto);
    return this.prisma.$transaction(async (tx) => {
      const depois = await tx.processo.update({
        where: { id },
        data: {
          nup: dto.nup,
          exercicio: dto.exercicio,
          objeto: dto.objeto,
          tipoObjeto: dto.tipoObjeto,
          origemDemanda: dto.origemDemanda,
          setorRequisitante: dto.setorRequisitante,
          prioridade: dto.prioridade,
          valorEstimado: dto.valorEstimado !== undefined ? valorMonetario(dto.valorEstimado, 'valorEstimado', true) : undefined,
          formaContratacao: dto.formaContratacao,
          modalidade: dto.modalidade,
          hipoteseDireta: dto.hipoteseDireta,
          procedimentoAuxiliar: dto.procedimentoAuxiliar,
          fundamentoLegal: dto.fundamentoLegal,
          responsavelId: dto.responsavelId,
          ataId: dto.ataId,
          dataInicioPrevista: dataCivilOpc(dto.dataInicioPrevista),
          dataConclusaoPrevista: dataCivilOpc(dto.dataConclusaoPrevista),
          dataInicioReal: dataCivilOpc(dto.dataInicioReal),
          dataConclusaoReal: dataCivilOpc(dto.dataConclusaoReal),
        },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'PROCESSO_ATUALIZADO', entidade: 'Processo', entidadeId: id, antes, depois });
      return depois;
    });
  }

  async mudarEtapa(ctx: Ctx, id: string, dto: MudarEtapaDto) {
    const p = await this.obterAutorizado(ctx, id);
    if (p.situacao !== 'ATIVO') throw new UnprocessableEntityException('Processo suspenso ou cancelado não muda de etapa');
    const de = indiceEtapa(p.etapa);
    const para = indiceEtapa(dto.etapa);
    if (para === de) return p;
    if (para < de) {
      if (!dto.motivo || dto.motivo.trim().length < 5) throw new BadRequestException('Retorno de etapa exige motivo');
    } else {
      if (para > de + 1) throw new UnprocessableEntityException('Avance uma etapa por vez para registrar a conclusão de cada uma');
      const checklist = await this.prisma.checklistItem.findMany({ where: { processoId: id } });
      const bloqueios = bloqueiosParaAvancar(checklist, p.etapa);
      if (bloqueios.length) {
        throw new UnprocessableEntityException(
          `Itens críticos pendentes impedem concluir a etapa: ${bloqueios.map((b) => b.titulo).join('; ')}`,
        );
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const hoje = hojeCivil();
      const depois = await tx.processo.update({
        where: { id },
        data: {
          etapa: dto.etapa,
          dataInicioReal: p.dataInicioReal ?? (dto.etapa !== 'A_INICIAR' ? hoje : undefined),
          dataConclusaoReal: dto.etapa === 'FINALIZADO' ? hoje : null,
        },
      });
      await this.auditoria.registrar(tx, ctx, {
        acao: para < de ? 'PROCESSO_ETAPA_RETORNADA' : 'PROCESSO_ETAPA_AVANCADA',
        entidade: 'Processo', entidadeId: id, antes: { etapa: p.etapa }, depois: { etapa: dto.etapa }, motivo: dto.motivo,
      });
      return depois;
    });
  }

  async mudarSituacao(ctx: Ctx, id: string, dto: MudarSituacaoDto) {
    const p = await this.obterAutorizado(ctx, id);
    if (p.situacao === 'CANCELADO' && ctx.perfil !== 'ADMIN' && ctx.perfil !== 'CHEFE') {
      throw new ForbiddenException('Reverter cancelamento exige chefe ou administrador');
    }
    return this.prisma.$transaction(async (tx) => {
      const depois = await tx.processo.update({ where: { id }, data: { situacao: dto.situacao, justificativaSituacao: dto.justificativa } });
      await this.auditoria.registrar(tx, ctx, {
        acao: 'PROCESSO_SITUACAO', entidade: 'Processo', entidadeId: id, antes: { situacao: p.situacao }, depois: { situacao: dto.situacao }, motivo: dto.justificativa,
      });
      return depois;
    });
  }

  // ───── Checklist ─────

  private async aplicarModeloTx(tx: Tx, ctx: Ctx, processoId: string, modeloId: string) {
    const modelo = await tx.modeloChecklist.findFirst({
      where: { id: modeloId, ativo: true, OR: [{ unidadeId: ctx.unidadeId }, { unidadeId: null }] },
      include: { itens: { orderBy: { ordem: 'asc' } } },
    });
    if (!modelo) throw new BadRequestException('Modelo de checklist não encontrado');
    const ja = await tx.checklistItem.findMany({ where: { processoId }, select: { modeloItemId: true, ordem: true } });
    const usados = new Set(ja.map((j) => j.modeloItemId));
    let ordem = ja.reduce((m, j) => Math.max(m, j.ordem), 0);
    const novos = modelo.itens.filter((i) => !usados.has(i.id));
    await tx.checklistItem.createMany({
      data: novos.map((i) => ({
        processoId,
        modeloItemId: i.id,
        ordem: ++ordem,
        titulo: i.titulo,
        etapa: i.etapa,
        critico: i.critico,
        exigeEvidencia: i.exigeEvidencia,
        exigeRevisaoNA: i.exigeRevisaoNA,
        referenciaNormativa: i.referenciaNormativa,
      })),
    });
    await tx.processo.update({ where: { id: processoId }, data: { modeloChecklistId: modelo.id } });
    return novos.length;
  }

  async aplicarModelo(ctx: Ctx, processoId: string, modeloId: string) {
    await this.obterAutorizado(ctx, processoId);
    return this.prisma.$transaction(async (tx) => {
      const n = await this.aplicarModeloTx(tx, ctx, processoId, modeloId);
      await this.auditoria.registrar(tx, ctx, { acao: 'CHECKLIST_MODELO_APLICADO', entidade: 'Processo', entidadeId: processoId, depois: { modeloId, itensAdicionados: n } });
      return { itensAdicionados: n };
    });
  }

  async novoItem(ctx: Ctx, processoId: string, dto: NovoChecklistItemDto) {
    await this.obterAutorizado(ctx, processoId);
    return this.prisma.$transaction(async (tx) => {
      const max = await tx.checklistItem.aggregate({ where: { processoId }, _max: { ordem: true } });
      const item = await tx.checklistItem.create({
        data: { processoId, ordem: (max._max.ordem ?? 0) + 1, titulo: dto.titulo, etapa: dto.etapa, critico: !!dto.critico, exigeEvidencia: !!dto.exigeEvidencia, referenciaNormativa: dto.referenciaNormativa },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'CHECKLIST_ITEM_CRIADO', entidade: 'ChecklistItem', entidadeId: item.id, depois: item });
      await this.auditoria.registrar(tx, ctx, { acao: 'CHECKLIST_ITEM_CRIADO', entidade: 'Processo', entidadeId: processoId, depois: { titulo: item.titulo } });
      return item;
    });
  }

  async atualizarItem(ctx: Ctx, processoId: string, itemId: string, dto: AtualizarChecklistItemDto) {
    await this.obterAutorizado(ctx, processoId);
    const item = await this.prisma.checklistItem.findFirst({ where: { id: itemId, processoId } });
    if (!item) throw new NotFoundException('Item não encontrado');

    const gestor = !ehSecretaria(ctx);
    if (ctx.perfil === 'COMANDANTE') throw new ForbiddenException('Perfil somente leitura');
    if (gestor) {
      if (item.atribuidoGestorId !== ctx.usuarioId) throw new ForbiddenException('Tarefa não atribuída a você');
      const permitido = dto.estado === undefined || dto.estado === 'EM_ANDAMENTO' || dto.estado === 'CONCLUIDO';
      if (!permitido || dto.responsavelId !== undefined || dto.atribuidoGestorId !== undefined || dto.prazo !== undefined) {
        throw new ForbiddenException('Gestor pode apenas atualizar andamento/conclusão das tarefas atribuídas');
      }
    }
    if (dto.atribuidoGestorId) {
      const v = await this.prisma.vinculoUnidadePerfil.findFirst({ where: { usuarioId: dto.atribuidoGestorId, unidadeId: ctx.unidadeId, ativo: true } });
      if (!v) throw new BadRequestException('Usuário atribuído não pertence à unidade');
    }
    if (dto.responsavelId) {
      const v = await this.prisma.vinculoUnidadePerfil.findFirst({ where: { usuarioId: dto.responsavelId, unidadeId: ctx.unidadeId, ativo: true } });
      if (!v) throw new BadRequestException('Responsável não pertence à unidade');
    }

    const data: Prisma.ChecklistItemUpdateInput = {
      observacao: dto.observacao,
      responsavelId: dto.responsavelId,
      atribuidoGestorId: dto.atribuidoGestorId,
      prazo: dataCivilOpc(dto.prazo ?? undefined),
    };
    let motivo: string | undefined;
    const novo: EstadoChecklist | undefined = dto.estado;
    if (novo && novo !== item.estado) {
      const fechado = item.estado === 'CONCLUIDO' || item.estado === 'NAO_APLICAVEL';
      if (fechado) {
        if (!dto.motivoReabertura || dto.motivoReabertura.trim().length < 5) throw new BadRequestException('Reabertura exige motivo');
        motivo = dto.motivoReabertura;
      }
      if (novo === 'CONCLUIDO' && item.exigeEvidencia) {
        const n = await this.prisma.vinculoDocumento.count({ where: { tipo: 'CHECKLIST_ITEM', entidadeId: item.id } });
        if (!n) throw new UnprocessableEntityException('Item exige evidência anexada antes da conclusão');
      }
      if (novo === 'NAO_APLICAVEL') {
        if (!dto.justificativaNA || dto.justificativaNA.trim().length < 10) throw new BadRequestException('"Não aplicável" exige justificativa (mín. 10 caracteres)');
        data.justificativaNA = dto.justificativaNA;
        data.naRevisadoEm = null;
        data.naRevisadoPor = null;
      }
      if (novo === 'DEVOLVIDO') {
        if (ctx.perfil !== 'CHEFE' && ctx.perfil !== 'ADMIN') throw new ForbiddenException('Devolução é ato de revisão (chefe/admin)');
        if (!dto.observacao) throw new BadRequestException('Devolução exige observação');
      }
      data.estado = novo;
      data.concluidoEm = novo === 'CONCLUIDO' ? new Date() : null;
      data.concluidoPor = novo === 'CONCLUIDO' ? ctx.usuarioId : null;
    }
    return this.prisma.$transaction(async (tx) => {
      const depois = await tx.checklistItem.update({ where: { id: itemId }, data });
      await this.auditoria.registrar(tx, ctx, { acao: 'CHECKLIST_ITEM_ATUALIZADO', entidade: 'ChecklistItem', entidadeId: itemId, antes: item, depois, motivo });
      if (novo && novo !== item.estado) {
        await this.auditoria.registrar(tx, ctx, {
          acao: 'CHECKLIST_ESTADO', entidade: 'Processo', entidadeId: processoId,
          antes: { item: item.titulo, estado: item.estado }, depois: { item: item.titulo, estado: novo }, motivo,
        });
      }
      return depois;
    });
  }

  async revisarNa(ctx: Ctx, processoId: string, itemId: string, dto: RevisarNaDto) {
    await this.obterAutorizado(ctx, processoId);
    const item = await this.prisma.checklistItem.findFirst({ where: { id: itemId, processoId } });
    if (!item || item.estado !== 'NAO_APLICAVEL') throw new UnprocessableEntityException('Item não está como "não aplicável"');
    return this.prisma.$transaction(async (tx) => {
      const depois = await tx.checklistItem.update({
        where: { id: itemId },
        data: dto.aprovado
          ? { naRevisadoEm: new Date(), naRevisadoPor: ctx.usuarioId }
          : { estado: 'DEVOLVIDO', observacao: dto.comentario ?? 'Não aplicabilidade não aceita', naRevisadoEm: null, naRevisadoPor: null },
      });
      await this.auditoria.registrar(tx, ctx, {
        acao: dto.aprovado ? 'CHECKLIST_NA_APROVADO' : 'CHECKLIST_NA_DEVOLVIDO', entidade: 'Processo', entidadeId: processoId,
        depois: { item: item.titulo }, motivo: dto.comentario,
      });
      return depois;
    });
  }

  // ───── Itens ─────

  async adicionarItemProcesso(ctx: Ctx, processoId: string, dto: ItemProcessoDto) {
    await this.obterAutorizado(ctx, processoId);
    return this.prisma.$transaction(async (tx) => {
      const max = await tx.itemProcesso.aggregate({ where: { processoId }, _max: { numero: true } });
      const item = await tx.itemProcesso.create({
        data: {
          processoId,
          numero: (max._max.numero ?? 0) + 1,
          descricao: dto.descricao,
          codigoCatalogo: dto.codigoCatalogo,
          tipoCatalogo: dto.tipoCatalogo,
          unidadeMedida: dto.unidadeMedida,
          quantidade: quantidade(dto.quantidade),
          valorUnitarioEstimado: dto.valorUnitarioEstimado ? valorMonetario(dto.valorUnitarioEstimado, 'valorUnitarioEstimado', true) : D(0),
        },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'PROCESSO_ITEM_ADICIONADO', entidade: 'Processo', entidadeId: processoId, depois: item });
      return item;
    });
  }

  async removerItemProcesso(ctx: Ctx, processoId: string, itemId: string) {
    await this.obterAutorizado(ctx, processoId);
    const item = await this.prisma.itemProcesso.findFirst({ where: { id: itemId, processoId } });
    if (!item) throw new NotFoundException('Item não encontrado');
    await this.prisma.$transaction(async (tx) => {
      await tx.itemProcesso.delete({ where: { id: itemId } });
      await this.auditoria.registrar(tx, ctx, { acao: 'PROCESSO_ITEM_REMOVIDO', entidade: 'Processo', entidadeId: processoId, antes: item });
    });
  }

  async historico(ctx: Ctx, id: string) {
    await this.obterAutorizado(ctx, id);
    this.escopo.assertLeituraUnidade(ctx);
    const r = await this.auditoria.historico(ctx.unidadeId, 'Processo', id);
    return r.map((x) => ({ ...x, id: x.id.toString() }));
  }

  // ───── Modelos ─────

  modelos(ctx: Ctx) {
    return this.prisma.modeloChecklist.findMany({
      where: { OR: [{ unidadeId: ctx.unidadeId }, { unidadeId: null }] },
      include: { itens: { orderBy: { ordem: 'asc' } } },
      orderBy: [{ nome: 'asc' }, { versao: 'desc' }],
    });
  }

  /** Cria nova versão (mesmo nome + forma); versões anteriores são desativadas, nunca apagadas. */
  async criarModelo(ctx: Ctx, dto: CriarModeloDto) {
    if (!dto.itens.length) throw new BadRequestException('Modelo precisa de ao menos um item');
    return this.prisma.$transaction(async (tx) => {
      const anterior = await tx.modeloChecklist.findFirst({
        where: { nome: dto.nome, formaContratacao: dto.formaContratacao, unidadeId: ctx.unidadeId },
        orderBy: { versao: 'desc' },
      });
      if (anterior) await tx.modeloChecklist.updateMany({ where: { nome: dto.nome, formaContratacao: dto.formaContratacao, unidadeId: ctx.unidadeId }, data: { ativo: false } });
      const m = await tx.modeloChecklist.create({
        data: {
          unidadeId: ctx.unidadeId,
          nome: dto.nome,
          formaContratacao: dto.formaContratacao,
          tipoObjeto: dto.tipoObjeto ?? null,
          versao: (anterior?.versao ?? 0) + 1,
          fonte: dto.fonte,
          itens: {
            create: dto.itens.map((i, idx) => ({
              ordem: idx + 1, titulo: i.titulo, descricao: i.descricao, etapa: i.etapa, critico: i.critico, exigeEvidencia: i.exigeEvidencia,
              exigeRevisaoNA: i.exigeRevisaoNA ?? true, referenciaNormativa: i.referenciaNormativa, aplicabilidade: i.aplicabilidade,
            })),
          },
        },
        include: { itens: true },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'MODELO_CHECKLIST_VERSIONADO', entidade: 'ModeloChecklist', entidadeId: m.id, depois: m });
      return m;
    });
  }

  async desativarModelo(ctx: Ctx, id: string) {
    const m = await this.prisma.modeloChecklist.findFirst({ where: { id, OR: [{ unidadeId: ctx.unidadeId }, { unidadeId: null }] } });
    if (!m) throw new NotFoundException('Modelo não encontrado');
    if (m.unidadeId === null && ctx.suporte) throw new ForbiddenException('Suporte não altera modelos globais');
    await this.prisma.modeloChecklist.update({ where: { id }, data: { ativo: false } });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'MODELO_CHECKLIST_DESATIVADO', entidade: 'ModeloChecklist', entidadeId: id });
  }
}
