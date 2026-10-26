import { Body, Controller, ForbiddenException, Get, Injectable, Module, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { AuditoriaService } from '../../common/auditoria.service';
import { C, Ctx, Perfis, TODOS } from '../../common/contexto';
import { dataCivil, dataCivilOpc } from '../../common/datas';
import { DEFAULTS } from '../../common/parametros.service';

class CriarUnidadeDto {
  @IsString() @Matches(/^[A-Z0-9-]{2,20}$/, { message: 'Sigla: 2–20 caracteres maiúsculos, números ou hífen' })
  sigla: string;
  @IsString() @IsNotEmpty() @MaxLength(200)
  nome: string;
  @IsOptional() @IsString() @MaxLength(120)
  nomeSecao?: string;
  @IsOptional() @IsString() @MaxLength(120)
  cidade?: string;
}

class AtualizarUnidadeDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200)
  nome?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120)
  nomeSecao?: string;
  @IsOptional() @IsString() @MaxLength(120)
  cidade?: string;
}

class CriarParametroDto {
  @IsString() @Matches(/^[a-z0-9.]{3,80}$/)
  chave: string;
  @IsString() @IsNotEmpty() @MaxLength(500)
  descricao: string;
  /** JSON do valor */
  @IsString() @MaxLength(5000)
  valorJson: string;
  @IsString() @IsNotEmpty() @MaxLength(500)
  fonte: string;
  @IsDateString({ strict: true })
  vigenciaInicio: string;
  @IsOptional() @IsDateString({ strict: true })
  vigenciaFim?: string;
  @IsOptional() @IsString() @MaxLength(200)
  aprovador?: string;
  @IsBoolean()
  global: boolean;
}

/** Chaves que o chefe pode ajustar para a própria unidade (parâmetros operacionais). */
const CHAVES_OPERACIONAIS = /^(lembretes|alertas)\./;

@Injectable()
class UnidadesService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService,
  ) {}

  listar(ctx: Ctx) {
    return ctx.perfil === 'ADMIN' && !ctx.suporte
      ? this.prisma.unidade.findMany({ orderBy: { sigla: 'asc' } })
      : this.prisma.unidade.findMany({ where: { id: ctx.unidadeId } });
  }

  async criar(ctx: Ctx, dto: CriarUnidadeDto) {
    return this.prisma.$transaction(async (tx) => {
      const u = await tx.unidade.create({ data: { sigla: dto.sigla, nome: dto.nome, nomeSecao: dto.nomeSecao, cidade: dto.cidade } });
      // O administrador criador recebe vínculo ADMIN para poder configurar a nova unidade.
      await tx.vinculoUnidadePerfil.create({ data: { usuarioId: ctx.usuarioId, unidadeId: u.id, perfil: 'ADMIN', criadoPor: ctx.usuarioId } });
      await this.auditoria.registrar(tx, ctx, { acao: 'UNIDADE_CRIADA', entidade: 'Unidade', entidadeId: u.id, depois: u, unidadeId: u.id });
      return u;
    });
  }

  async atualizar(ctx: Ctx, dto: AtualizarUnidadeDto) {
    const antes = await this.prisma.unidade.findUniqueOrThrow({ where: { id: ctx.unidadeId } });
    const depois = await this.prisma.unidade.update({ where: { id: ctx.unidadeId }, data: dto });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'UNIDADE_ATUALIZADA', entidade: 'Unidade', entidadeId: ctx.unidadeId, antes, depois });
    return depois;
  }

  async parametros(ctx: Ctx) {
    const lista = await this.prisma.parametroNormativo.findMany({
      where: { OR: [{ unidadeId: ctx.unidadeId }, { unidadeId: null }] },
      orderBy: [{ chave: 'asc' }, { vigenciaInicio: 'desc' }],
    });
    return { cadastrados: lista, padroesPropostos: DEFAULTS };
  }

  async criarParametro(ctx: Ctx, dto: CriarParametroDto) {
    if (ctx.perfil !== 'ADMIN' && (dto.global || !CHAVES_OPERACIONAIS.test(dto.chave))) {
      throw new ForbiddenException('Chefe pode ajustar somente parâmetros operacionais (lembretes/alertas) da unidade');
    }
    let valor: Prisma.InputJsonValue;
    try {
      valor = JSON.parse(dto.valorJson);
    } catch {
      throw new ForbiddenException('valorJson inválido');
    }
    const p = await this.prisma.parametroNormativo.create({
      data: {
        unidadeId: dto.global ? null : ctx.unidadeId,
        chave: dto.chave,
        descricao: dto.descricao,
        valor,
        fonte: dto.fonte,
        vigenciaInicio: dataCivil(dto.vigenciaInicio),
        vigenciaFim: dataCivilOpc(dto.vigenciaFim) ?? null,
        aprovador: dto.aprovador,
        pendenteValidacao: !dto.aprovador,
      },
    });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'PARAMETRO_VERSIONADO', entidade: 'ParametroNormativo', entidadeId: p.id, depois: p });
    return p;
  }
}

@ApiTags('unidades')
@Controller('unidades')
class UnidadesController {
  constructor(private s: UnidadesService) {}

  @Perfis(...TODOS)
  @Get()
  listar(@C() ctx: Ctx) {
    return this.s.listar(ctx);
  }

  @Perfis('ADMIN')
  @Post()
  criar(@C() ctx: Ctx, @Body() dto: CriarUnidadeDto) {
    if (ctx.suporte) throw new ForbiddenException('Acesso de suporte não cria unidades');
    return this.s.criar(ctx, dto);
  }

  @Perfis('ADMIN', 'CHEFE')
  @Patch('atual')
  atualizar(@C() ctx: Ctx, @Body() dto: AtualizarUnidadeDto) {
    return this.s.atualizar(ctx, dto);
  }

  @Perfis('ADMIN', 'CHEFE')
  @Get('parametros')
  parametros(@C() ctx: Ctx) {
    return this.s.parametros(ctx);
  }

  @Perfis('ADMIN', 'CHEFE')
  @Post('parametros')
  criarParametro(@C() ctx: Ctx, @Body() dto: CriarParametroDto) {
    return this.s.criarParametro(ctx, dto);
  }
}

@Module({ controllers: [UnidadesController], providers: [UnidadesService] })
export class UnidadesModule {}
