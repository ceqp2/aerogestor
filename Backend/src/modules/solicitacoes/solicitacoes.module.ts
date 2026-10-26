import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Query, UnprocessableEntityException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CategoriaSolicitacao, Prioridade, Prisma, StatusSolicitacao } from '@prisma/client';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { AuditoriaService } from '../../common/auditoria.service';
import { C, Ctx, ehSecretaria, Perfis, SECRETARIA, TODOS } from '../../common/contexto';
import { dataCivilOpc, isoData } from '../../common/datas';
import { EscopoService } from '../../common/escopo.service';
import { PaginacaoQuery, paginar, resultado } from '../../common/paginacao';
import { IsDataCivil } from '../../common/validadores';
import { NotificacoesModule, NotificacoesService } from '../notificacoes/notificacoes.module';

class CriarSolicitacaoDto {
  @IsUUID() contratoId: string;
  @IsEnum(CategoriaSolicitacao) categoria: CategoriaSolicitacao;
  @IsString() @IsNotEmpty() @MaxLength(300) titulo: string;
  @IsString() @IsNotEmpty() @MaxLength(5000) descricao: string;
  @IsOptional() @IsEnum(Prioridade) prioridade?: Prioridade;
  @IsOptional() @IsDataCivil() prazo?: string;
}

class TriagemDto {
  @IsOptional() @IsUUID() responsavelId?: string;
  @IsOptional() @IsEnum(Prioridade) prioridade?: Prioridade;
  @IsOptional() @IsDataCivil() prazo?: string;
}

class StatusSolicitacaoDto {
  @IsEnum(StatusSolicitacao) status: StatusSolicitacao;
  @IsOptional() @IsString() @MaxLength(2000) motivo?: string;
}

class InteracaoDto {
  @IsIn(['COMENTARIO', 'COMUNICACAO_EXTERNA']) tipo: 'COMENTARIO' | 'COMUNICACAO_EXTERNA';
  @IsString() @MinLength(2) @MaxLength(5000) texto: string;
}

class SolicitacoesQuery extends PaginacaoQuery {
  @IsOptional() @IsEnum(StatusSolicitacao) status?: StatusSolicitacao;
  @IsOptional() @IsUUID() contratoId?: string;
  @IsOptional() @IsIn(['abertas', 'minhas']) filtro?: string;
}

/** Transições permitidas. Cancelamento exige motivo; nada aqui gera sanção automática. */
const TRANSICOES: Record<StatusSolicitacao, StatusSolicitacao[]> = {
  ABERTA: ['EM_TRIAGEM', 'EM_ATENDIMENTO', 'CANCELADA'],
  EM_TRIAGEM: ['EM_ATENDIMENTO', 'AGUARDANDO_EMPRESA', 'RESOLVIDA', 'CANCELADA'],
  EM_ATENDIMENTO: ['AGUARDANDO_EMPRESA', 'RESOLVIDA', 'CANCELADA'],
  AGUARDANDO_EMPRESA: ['EM_ATENDIMENTO', 'RESOLVIDA', 'CANCELADA'],
  RESOLVIDA: ['EM_ATENDIMENTO'],
  CANCELADA: [],
};

@Injectable()
class SolicitacoesService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService,
    private escopo: EscopoService,
    private notif: NotificacoesService,
  ) {}

  private async filtro(ctx: Ctx): Promise<Prisma.SolicitacaoWhereInput> {
    if (ehSecretaria(ctx) || ctx.perfil === 'COMANDANTE') return { unidadeId: ctx.unidadeId };
    const ids = (await this.escopo.contratosPermitidos(ctx)) ?? [];
    return { unidadeId: ctx.unidadeId, contratoId: { in: ids } };
  }

  async listar(ctx: Ctx, q: SolicitacoesQuery) {
    const { skip, take, pagina, tamanho } = paginar(q);
    const where: Prisma.SolicitacaoWhereInput = {
      AND: [
        await this.filtro(ctx),
        { status: q.status, contratoId: q.contratoId },
        q.filtro === 'abertas' ? { status: { notIn: ['RESOLVIDA', 'CANCELADA'] } } : {},
        q.filtro === 'minhas' ? { OR: [{ responsavelId: ctx.usuarioId }, { autorId: ctx.usuarioId }] } : {},
        q.busca ? { OR: [{ titulo: { contains: q.busca, mode: 'insensitive' } }, { descricao: { contains: q.busca, mode: 'insensitive' } }] } : {},
      ],
    };
    const [itens, total] = await Promise.all([
      this.prisma.solicitacao.findMany({ where, skip, take, orderBy: [{ status: 'asc' }, { criadoEm: 'desc' }], include: { contrato: { select: { id: true, numero: true } } } }),
      this.prisma.solicitacao.count({ where }),
    ]);
    return resultado(itens, total, pagina, tamanho);
  }

  async detalhe(ctx: Ctx, id: string) {
    const s = await this.prisma.solicitacao.findFirst({
      where: { AND: [{ id }, await this.filtro(ctx)] },
      include: { interacoes: { orderBy: { criadoEm: 'asc' } }, contrato: { select: { id: true, numero: true, objeto: true, fornecedorId: true } } },
    });
    if (!s) throw new NotFoundException('Solicitação não encontrada');
    const autores = await this.prisma.usuario.findMany({
      where: { id: { in: [...new Set([s.autorId, ...(s.responsavelId ? [s.responsavelId] : []), ...s.interacoes.map((i) => i.autorId)])] } },
      select: { id: true, nome: true },
    });
    return { ...s, pessoas: autores };
  }

  async criar(ctx: Ctx, dto: CriarSolicitacaoDto) {
    if (ctx.perfil === 'COMANDANTE') throw new ForbiddenException('Perfil somente leitura');
    await this.escopo.assertContrato(ctx, dto.contratoId);
    const s = await this.prisma.$transaction(async (tx) => {
      const s = await tx.solicitacao.create({
        data: {
          unidadeId: ctx.unidadeId, contratoId: dto.contratoId, categoria: dto.categoria, titulo: dto.titulo, descricao: dto.descricao,
          prioridade: dto.prioridade, prazo: dataCivilOpc(dto.prazo), autorId: ctx.usuarioId,
        },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'SOLICITACAO_ABERTA', entidade: 'Solicitacao', entidadeId: s.id, depois: s });
      return s;
    });
    // Avisa chefes e auxiliares da secretaria.
    const destinatarios = await this.prisma.vinculoUnidadePerfil.findMany({ where: { unidadeId: ctx.unidadeId, ativo: true, perfil: { in: ['CHEFE', 'AUXILIAR'] } } });
    for (const d of destinatarios) {
      if (d.usuarioId === ctx.usuarioId) continue;
      await this.notif.emitir({
        unidadeId: ctx.unidadeId, usuarioId: d.usuarioId, chave: `solicitacao:${s.id}:aberta:${d.usuarioId}`, nivel: s.prioridade === 'URGENTE' ? 'CRITICO' : 'INFO',
        titulo: 'Nova solicitação de gestor', mensagem: s.titulo, regra: 'Solicitação aberta por gestor/fiscal', link: `/solicitacoes/${s.id}`,
      });
    }
    return s;
  }

  async triagem(ctx: Ctx, id: string, dto: TriagemDto) {
    const antes = await this.detalhe(ctx, id);
    if (dto.responsavelId) {
      const v = await this.prisma.vinculoUnidadePerfil.findFirst({ where: { usuarioId: dto.responsavelId, unidadeId: ctx.unidadeId, ativo: true, perfil: { in: ['CHEFE', 'AUXILIAR', 'ADMIN'] } } });
      if (!v) throw new BadRequestException('Responsável deve ser da secretaria');
    }
    const depois = await this.prisma.solicitacao.update({
      where: { id },
      data: {
        responsavelId: dto.responsavelId, prioridade: dto.prioridade, prazo: dataCivilOpc(dto.prazo),
        status: antes.status === 'ABERTA' ? 'EM_TRIAGEM' : undefined,
      },
    });
    await this.auditoria.registrar(this.prisma, ctx, {
      acao: 'SOLICITACAO_TRIAGEM', entidade: 'Solicitacao', entidadeId: id,
      antes: { responsavelId: antes.responsavelId, prioridade: antes.prioridade, prazo: isoData(antes.prazo) }, depois: dto,
    });
    return depois;
  }

  async status(ctx: Ctx, id: string, dto: StatusSolicitacaoDto) {
    const s = await this.detalhe(ctx, id);
    const gestor = !ehSecretaria(ctx);
    if (gestor && !(dto.status === 'CANCELADA' && s.autorId === ctx.usuarioId)) throw new ForbiddenException('Gestor pode apenas cancelar as próprias solicitações');
    if (!TRANSICOES[s.status].includes(dto.status)) throw new UnprocessableEntityException(`Transição ${s.status} → ${dto.status} não permitida`);
    if (dto.status === 'CANCELADA' && (!dto.motivo || dto.motivo.length < 5)) throw new BadRequestException('Cancelamento exige motivo');
    return this.prisma.$transaction(async (tx) => {
      const depois = await tx.solicitacao.update({ where: { id }, data: { status: dto.status, motivoCancelamento: dto.status === 'CANCELADA' ? dto.motivo : undefined } });
      await tx.interacaoSolicitacao.create({
        data: { solicitacaoId: id, tipo: 'MUDANCA_STATUS', texto: `${s.status} → ${dto.status}${dto.motivo ? `: ${dto.motivo}` : ''}`, autorId: ctx.usuarioId },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'SOLICITACAO_STATUS', entidade: 'Solicitacao', entidadeId: id, antes: { status: s.status }, depois: { status: dto.status }, motivo: dto.motivo });
      if (s.autorId !== ctx.usuarioId) {
        await this.notif.emitir({
          unidadeId: ctx.unidadeId, usuarioId: s.autorId, chave: `solicitacao:${id}:status:${dto.status}:${Date.now()}`, nivel: 'INFO',
          titulo: 'Solicitação atualizada', mensagem: `${s.titulo}: ${dto.status}`, regra: 'Mudança de status de solicitação', link: `/solicitacoes/${id}`,
        });
      }
      return depois;
    });
  }

  /** Comunicação externa é apenas REGISTRADA (com comprovação anexada); o envio é ato explícito fora do sistema. */
  async interagir(ctx: Ctx, id: string, dto: InteracaoDto) {
    if (ctx.perfil === 'COMANDANTE') throw new ForbiddenException('Perfil somente leitura');
    const s = await this.detalhe(ctx, id);
    if (dto.tipo === 'COMUNICACAO_EXTERNA' && !ehSecretaria(ctx)) throw new ForbiddenException('Registro de comunicação com a empresa cabe à secretaria');
    if (s.status === 'CANCELADA') throw new UnprocessableEntityException('Solicitação cancelada');
    const i = await this.prisma.interacaoSolicitacao.create({ data: { solicitacaoId: id, tipo: dto.tipo, texto: dto.texto, autorId: ctx.usuarioId } });
    await this.auditoria.registrar(this.prisma, ctx, { acao: `SOLICITACAO_${dto.tipo}`, entidade: 'Solicitacao', entidadeId: id, depois: { tipo: dto.tipo } });
    return i;
  }

  /** Minuta de comunicação para revisão humana — não é enviada automaticamente. */
  async minuta(ctx: Ctx, id: string) {
    const s = await this.detalhe(ctx, id);
    const forn = await this.prisma.fornecedor.findUnique({ where: { id: s.contrato.fornecedorId } });
    const unidade = await this.prisma.unidade.findUnique({ where: { id: ctx.unidadeId } });
    const texto = [
      `MINUTA — ${s.categoria === 'NOTIFICACAO' ? 'Notificação' : 'Comunicação'} (rascunho para revisão; não constitui ato formal)`,
      '',
      `À empresa ${forn?.razaoSocial ?? '[fornecedor]'} — CNPJ/CPF ${forn?.documento ?? '[documento]'}`,
      `Referência: Contrato/instrumento nº ${s.contrato.numero} — ${s.contrato.objeto}`,
      '',
      `Assunto: ${s.titulo}`,
      '',
      s.descricao,
      '',
      'Solicitamos manifestação no prazo [definir prazo conforme instrumento e norma aplicável].',
      '',
      `${unidade?.nomeSecao ?? 'Secretaria'} — ${unidade?.nome ?? ''}`,
      '[Nome, posto/graduação e função do signatário competente]',
    ].join('\n');
    await this.prisma.interacaoSolicitacao.create({ data: { solicitacaoId: id, tipo: 'MINUTA', texto, autorId: ctx.usuarioId } });
    return { texto };
  }
}

@ApiTags('solicitacoes')
@Controller('solicitacoes')
class SolicitacoesController {
  constructor(private s: SolicitacoesService) {}

  @Perfis(...TODOS) @Get()
  listar(@C() ctx: Ctx, @Query() q: SolicitacoesQuery) {
    return this.s.listar(ctx, q);
  }

  @Perfis(...TODOS) @Get(':id')
  detalhe(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.detalhe(ctx, id);
  }

  @Perfis(...TODOS) @Post()
  criar(@C() ctx: Ctx, @Body() dto: CriarSolicitacaoDto) {
    return this.s.criar(ctx, dto);
  }

  @Perfis(...SECRETARIA) @Post(':id/triagem') @HttpCode(200)
  triagem(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TriagemDto) {
    return this.s.triagem(ctx, id, dto);
  }

  @Perfis(...TODOS) @Post(':id/status') @HttpCode(200)
  status(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusSolicitacaoDto) {
    return this.s.status(ctx, id, dto);
  }

  @Perfis(...TODOS) @Post(':id/interacoes')
  interagir(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: InteracaoDto) {
    return this.s.interagir(ctx, id, dto);
  }

  @Perfis(...SECRETARIA) @Post(':id/minuta') @HttpCode(200)
  minuta(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.minuta(ctx, id);
  }
}

@Module({ imports: [NotificacoesModule], controllers: [SolicitacoesController], providers: [SolicitacoesService] })
export class SolicitacoesModule {}
