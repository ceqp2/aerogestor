import { Controller, Get, HttpCode, Injectable, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { C, Ctx, Perfis, TODOS } from '../../common/contexto';

export interface NovaNotificacao {
  unidadeId: string;
  usuarioId: string;
  chave: string;
  nivel: 'INFO' | 'ATENCAO' | 'CRITICO';
  titulo: string;
  mensagem: string;
  regra: string;
  link?: string;
}

@Injectable()
export class NotificacoesService {
  constructor(private prisma: PrismaService) {}

  /** Idempotente: a chave única impede duplicação mesmo após reinício do job. */
  async emitir(n: NovaNotificacao): Promise<boolean> {
    try {
      await this.prisma.notificacao.create({ data: n });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false;
      throw e;
    }
  }

  listar(ctx: Ctx, somenteNaoLidas: boolean) {
    return this.prisma.notificacao.findMany({
      where: { usuarioId: ctx.usuarioId, unidadeId: ctx.unidadeId, lidaEm: somenteNaoLidas ? null : undefined },
      orderBy: { criadaEm: 'desc' },
      take: 100,
    });
  }

  contar(ctx: Ctx) {
    return this.prisma.notificacao.count({ where: { usuarioId: ctx.usuarioId, unidadeId: ctx.unidadeId, lidaEm: null } });
  }

  async marcarLida(ctx: Ctx, id: string) {
    await this.prisma.notificacao.updateMany({ where: { id, usuarioId: ctx.usuarioId, lidaEm: null }, data: { lidaEm: new Date() } });
  }

  async marcarTodas(ctx: Ctx) {
    await this.prisma.notificacao.updateMany({ where: { usuarioId: ctx.usuarioId, unidadeId: ctx.unidadeId, lidaEm: null }, data: { lidaEm: new Date() } });
  }
}

@ApiTags('notificacoes')
@Controller('notificacoes')
class NotificacoesController {
  constructor(private s: NotificacoesService) {}

  @Perfis(...TODOS) @Get()
  listar(@C() ctx: Ctx, @Query('naoLidas') naoLidas?: string) {
    return this.s.listar(ctx, naoLidas === 'true');
  }

  @Perfis(...TODOS) @Get('contagem')
  async contagem(@C() ctx: Ctx) {
    return { naoLidas: await this.s.contar(ctx) };
  }

  @Perfis(...TODOS) @Post(':id/lida') @HttpCode(200)
  async lida(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    await this.s.marcarLida(ctx, id);
    return { ok: true };
  }

  @Perfis(...TODOS) @Post('todas-lidas') @HttpCode(200)
  async todas(@C() ctx: Ctx) {
    await this.s.marcarTodas(ctx);
    return { ok: true };
  }
}

@Module({ controllers: [NotificacoesController], providers: [NotificacoesService], exports: [NotificacoesService] })
export class NotificacoesModule {}
