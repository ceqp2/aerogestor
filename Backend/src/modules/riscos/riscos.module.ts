import { BadRequestException, Body, Controller, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, OmitType, PartialType } from '@nestjs/swagger';
import { Prisma, StatusRisco } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { AuditoriaService } from '../../common/auditoria.service';
import { C, Ctx, ehLeituraUnidade, Perfis, SECRETARIA, TODOS } from '../../common/contexto';
import { dataCivilOpc, hojeCivil } from '../../common/datas';
import { EscopoService } from '../../common/escopo.service';
import { PaginacaoQuery, paginar, resultado } from '../../common/paginacao';
import { ParametrosService } from '../../common/parametros.service';
import { IsDataCivil } from '../../common/validadores';
import { Faixas, FAIXAS_PADRAO, nivel, score } from './riscos.regras';

const Escala = () => (target: object, key: string) => {
  Type(() => Number)(target, key);
  IsInt()(target, key);
  Min(1)(target, key);
  Max(5)(target, key);
};

class CriarRiscoDto {
  @IsOptional() @IsUUID() processoId?: string;
  @IsOptional() @IsUUID() contratoId?: string;
  @IsString() @IsNotEmpty() @MaxLength(500) evento: string;
  @IsString() @IsNotEmpty() @MaxLength(1000) causa: string;
  @IsString() @IsNotEmpty() @MaxLength(1000) consequencia: string;
  @IsString() @IsNotEmpty() @MaxLength(100) fase: string;
  @IsString() @IsNotEmpty() @MaxLength(100) categoria: string;
  @Escala() probabilidade: number;
  @Escala() impacto: number;
  @IsOptional() @Escala() probResidual?: number;
  @IsOptional() @Escala() impactoResidual?: number;
  @IsOptional() @IsString() @MaxLength(2000) controles?: string;
  @IsOptional() @IsString() @MaxLength(2000) acaoPreventiva?: string;
  @IsOptional() @IsString() @MaxLength(2000) contingencia?: string;
  @IsOptional() @IsUUID() responsavelId?: string;
  @IsOptional() @IsDataCivil() proximaRevisao?: string;
}

class AtualizarRiscoDto extends PartialType(OmitType(CriarRiscoDto, ['probabilidade', 'impacto', 'probResidual', 'impactoResidual'] as const)) {}

class ReavaliarDto {
  @Escala() probabilidade: number;
  @Escala() impacto: number;
  @IsOptional() @Escala() probResidual?: number;
  @IsOptional() @Escala() impactoResidual?: number;
  @IsOptional() @IsString() @MaxLength(2000) comentario?: string;
  @IsOptional() @IsDataCivil() proximaRevisao?: string;
}

class StatusRiscoDto {
  @IsEnum(StatusRisco) status: StatusRisco;
  @IsString() @IsNotEmpty() @MaxLength(1000) motivo: string;
}

class RiscosQuery extends PaginacaoQuery {
  @IsOptional() @IsIn(['baixo', 'moderado', 'alto', 'critico']) nivel?: string;
  @IsOptional() @IsEnum(StatusRisco) status?: StatusRisco;
  @IsOptional() @IsUUID() processoId?: string;
  @IsOptional() @IsUUID() contratoId?: string;
  @IsOptional() @IsIn(['true']) revisaoVencida?: string;
}

@Injectable()
export class RiscosService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService,
    private escopo: EscopoService,
    private params: ParametrosService,
  ) {}

  async faixas(unidadeId: string) {
    return (await this.params.valor<Faixas>('riscos.faixas', unidadeId)) ?? FAIXAS_PADRAO;
  }

  enriquecer<T extends { probabilidade: number; impacto: number; probResidual: number | null; impactoResidual: number | null }>(r: T, f: Faixas) {
    const s = score(r.probabilidade, r.impacto);
    const sr = r.probResidual && r.impactoResidual ? score(r.probResidual, r.impactoResidual) : null;
    return { ...r, score: s, nivel: nivel(s, f), scoreResidual: sr, nivelResidual: sr ? nivel(sr, f) : null };
  }

  private async filtro(ctx: Ctx): Promise<Prisma.RiscoWhereInput> {
    if (ehLeituraUnidade(ctx)) return { unidadeId: ctx.unidadeId };
    const ids = (await this.escopo.contratosPermitidos(ctx)) ?? [];
    return { unidadeId: ctx.unidadeId, contratoId: { in: ids } };
  }

  async listar(ctx: Ctx, q: RiscosQuery) {
    const f = await this.faixas(ctx.unidadeId);
    const where: Prisma.RiscoWhereInput = {
      AND: [
        await this.filtro(ctx),
        { status: q.status, processoId: q.processoId, contratoId: q.contratoId },
        q.revisaoVencida ? { proximaRevisao: { lt: hojeCivil() }, status: { not: 'ENCERRADO' } } : {},
        q.busca ? { OR: [{ evento: { contains: q.busca, mode: 'insensitive' } }, { categoria: { contains: q.busca, mode: 'insensitive' } }] } : {},
      ],
    };
    // O nível depende de score calculado; filtra-se em memória sobre o recorte (volume por unidade é pequeno).
    const todos = await this.prisma.risco.findMany({
      where, orderBy: { atualizadoEm: 'desc' },
      include: { processo: { select: { id: true, numeroInterno: true } }, contrato: { select: { id: true, numero: true } } },
    });
    const enr = todos.map((r) => this.enriquecer(r, f)).filter((r) => !q.nivel || r.nivel === q.nivel);
    enr.sort((a, b) => b.score - a.score);
    const { skip, take, pagina, tamanho } = paginar(q);
    return { ...resultado(enr.slice(skip, skip + take), enr.length, pagina, tamanho), faixas: f, avisoFaixas: 'Faixas gerenciais propostas, não impostas pela lei.' };
  }

  async detalhe(ctx: Ctx, id: string) {
    const r = await this.prisma.risco.findFirst({
      where: { AND: [{ id }, await this.filtro(ctx)] },
      include: { avaliacoes: { orderBy: { criadoEm: 'desc' } }, processo: { select: { id: true, numeroInterno: true } }, contrato: { select: { id: true, numero: true } } },
    });
    if (!r) throw new NotFoundException('Risco não encontrado');
    const f = await this.faixas(ctx.unidadeId);
    return { ...this.enriquecer(r, f), avaliacoes: r.avaliacoes.map((a) => this.enriquecer(a, f)) };
  }

  private async validarVinculo(ctx: Ctx, dto: { processoId?: string; contratoId?: string; responsavelId?: string }) {
    if (dto.processoId) await this.escopo.daUnidade(this.prisma.processo.findFirst({ where: { id: dto.processoId, unidadeId: ctx.unidadeId } }), 'Processo');
    if (dto.contratoId) await this.escopo.daUnidade(this.prisma.contratoInstrumento.findFirst({ where: { id: dto.contratoId, unidadeId: ctx.unidadeId } }), 'Contrato');
    if (dto.responsavelId) {
      const v = await this.prisma.vinculoUnidadePerfil.findFirst({ where: { usuarioId: dto.responsavelId, unidadeId: ctx.unidadeId, ativo: true } });
      if (!v) throw new BadRequestException('Responsável não pertence à unidade');
    }
  }

  async criar(ctx: Ctx, dto: CriarRiscoDto) {
    await this.validarVinculo(ctx, dto);
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.risco.create({
        data: { ...dto, unidadeId: ctx.unidadeId, proximaRevisao: dataCivilOpc(dto.proximaRevisao), criadoPor: ctx.usuarioId },
      });
      await tx.avaliacaoRisco.create({
        data: { riscoId: r.id, probabilidade: r.probabilidade, impacto: r.impacto, probResidual: r.probResidual, impactoResidual: r.impactoResidual, comentario: 'Avaliação inicial', autorId: ctx.usuarioId },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'RISCO_CRIADO', entidade: 'Risco', entidadeId: r.id, depois: r });
      return r;
    });
  }

  async atualizar(ctx: Ctx, id: string, dto: AtualizarRiscoDto) {
    const antes = await this.escopo.daUnidade(this.prisma.risco.findFirst({ where: { id, unidadeId: ctx.unidadeId } }), 'Risco');
    await this.validarVinculo(ctx, dto);
    const depois = await this.prisma.risco.update({ where: { id }, data: { ...dto, proximaRevisao: dataCivilOpc(dto.proximaRevisao) } });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'RISCO_ATUALIZADO', entidade: 'Risco', entidadeId: id, antes, depois });
    return depois;
  }

  /** Reavaliação preserva a evolução (histórico append-only de avaliações). */
  async reavaliar(ctx: Ctx, id: string, dto: ReavaliarDto) {
    const antes = await this.escopo.daUnidade(this.prisma.risco.findFirst({ where: { id, unidadeId: ctx.unidadeId } }), 'Risco');
    return this.prisma.$transaction(async (tx) => {
      await tx.avaliacaoRisco.create({
        data: { riscoId: id, probabilidade: dto.probabilidade, impacto: dto.impacto, probResidual: dto.probResidual, impactoResidual: dto.impactoResidual, comentario: dto.comentario, autorId: ctx.usuarioId },
      });
      const depois = await tx.risco.update({
        where: { id },
        data: {
          probabilidade: dto.probabilidade, impacto: dto.impacto, probResidual: dto.probResidual ?? null, impactoResidual: dto.impactoResidual ?? null,
          proximaRevisao: dataCivilOpc(dto.proximaRevisao) ?? undefined,
        },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'RISCO_REAVALIADO', entidade: 'Risco', entidadeId: id, antes, depois, motivo: dto.comentario });
      return depois;
    });
  }

  async status(ctx: Ctx, id: string, dto: StatusRiscoDto) {
    const antes = await this.escopo.daUnidade(this.prisma.risco.findFirst({ where: { id, unidadeId: ctx.unidadeId } }), 'Risco');
    const depois = await this.prisma.risco.update({ where: { id }, data: { status: dto.status } });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'RISCO_STATUS', entidade: 'Risco', entidadeId: id, antes: { status: antes.status }, depois: { status: dto.status }, motivo: dto.motivo });
    return depois;
  }
}

@ApiTags('riscos')
@Controller('riscos')
class RiscosController {
  constructor(private s: RiscosService) {}

  @Perfis(...TODOS) @Get()
  listar(@C() ctx: Ctx, @Query() q: RiscosQuery) {
    return this.s.listar(ctx, q);
  }

  @Perfis(...TODOS) @Get(':id')
  detalhe(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.detalhe(ctx, id);
  }

  @Perfis(...SECRETARIA) @Post()
  criar(@C() ctx: Ctx, @Body() dto: CriarRiscoDto) {
    return this.s.criar(ctx, dto);
  }

  @Perfis(...SECRETARIA) @Patch(':id')
  atualizar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarRiscoDto) {
    return this.s.atualizar(ctx, id, dto);
  }

  @Perfis(...SECRETARIA) @Post(':id/avaliacoes')
  reavaliar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReavaliarDto) {
    return this.s.reavaliar(ctx, id, dto);
  }

  @Perfis(...SECRETARIA) @Post(':id/status') @HttpCode(200)
  status(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusRiscoDto) {
    return this.s.status(ctx, id, dto);
  }
}

@Module({ controllers: [RiscosController], providers: [RiscosService], exports: [RiscosService] })
export class RiscosModule {}
