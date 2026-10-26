import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { C, Ctx, Perfis } from '../../common/contexto';
import { PaginacaoQuery, paginar, resultado } from '../../common/paginacao';

class AuditoriaQuery extends PaginacaoQuery {
  @IsOptional() @IsString() @MaxLength(60)
  entidade?: string;
  @IsOptional() @IsString() @MaxLength(60)
  entidadeId?: string;
  @IsOptional() @IsString() @MaxLength(60)
  acao?: string;
}

@Injectable()
class AuditoriaConsultaService {
  constructor(private prisma: PrismaService) {}

  async listar(ctx: Ctx, q: AuditoriaQuery) {
    const { skip, take, pagina, tamanho } = paginar(q);
    const where: Prisma.RegistroAuditoriaWhereInput = {
      unidadeId: ctx.unidadeId,
      entidade: q.entidade || undefined,
      entidadeId: q.entidadeId || undefined,
      acao: q.acao ? { contains: q.acao, mode: 'insensitive' } : undefined,
      usuarioNome: q.busca ? { contains: q.busca, mode: 'insensitive' } : undefined,
    };
    const [itens, total] = await Promise.all([
      this.prisma.registroAuditoria.findMany({ where, orderBy: { criadoEm: 'desc' }, skip, take }),
      this.prisma.registroAuditoria.count({ where }),
    ]);
    return resultado(itens.map((i) => ({ ...i, id: i.id.toString() })), total, pagina, tamanho);
  }
}

@ApiTags('auditoria')
@Controller('auditoria')
class AuditoriaController {
  constructor(private s: AuditoriaConsultaService) {}

  @Perfis('ADMIN', 'CHEFE', 'COMANDANTE')
  @Get()
  listar(@C() ctx: Ctx, @Query() q: AuditoriaQuery) {
    return this.s.listar(ctx, q);
  }
}

@Module({ controllers: [AuditoriaController], providers: [AuditoriaConsultaService] })
export class AuditoriaModule {}
