import { Body, Controller, Get, HttpCode, Module, Param, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { C, Ctx, LEITURA_UNIDADE, Perfis, SECRETARIA, TODOS } from '../../common/contexto';
import {
  AlocacaoDto, ConciliacaoDto, CriarCreditoDto, CriarEmpenhoDto, FinanceiroQuery, InscricaoRapDto, MovimentoCreditoDto, MovimentoEmpenhoDto,
  MovimentoRapDto, RateioDto,
} from './financeiro.dto';
import { FinanceiroService } from './financeiro.service';

@ApiTags('financeiro')
@Controller('financeiro')
class FinanceiroController {
  constructor(private s: FinanceiroService) {}

  @Perfis(...LEITURA_UNIDADE)
  @Get('resumo')
  resumo(@C() ctx: Ctx, @Query() q: FinanceiroQuery) {
    return this.s.resumo(ctx.unidadeId, q.exercicio);
  }

  @Perfis(...LEITURA_UNIDADE)
  @Get('creditos')
  creditos(@C() ctx: Ctx, @Query() q: FinanceiroQuery) {
    return this.s.listarCreditos(ctx, q.exercicio);
  }

  @Perfis(...LEITURA_UNIDADE)
  @Get('creditos/:id')
  credito(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.detalheCredito(ctx, id);
  }

  @Perfis(...SECRETARIA)
  @Post('creditos')
  criarCredito(@C() ctx: Ctx, @Body() dto: CriarCreditoDto) {
    return this.s.criarCredito(ctx, dto);
  }

  @Perfis(...SECRETARIA)
  @Post('creditos/:id/movimentos')
  movCredito(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MovimentoCreditoDto) {
    return this.s.movimentarCredito(ctx, id, dto);
  }

  @Perfis(...SECRETARIA)
  @Post('creditos/:id/conciliacao')
  @HttpCode(200)
  conciliarCredito(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConciliacaoDto) {
    return this.s.conciliar(ctx, 'credito', id, dto.fonte);
  }

  @Perfis(...LEITURA_UNIDADE)
  @Get('empenhos')
  empenhos(@C() ctx: Ctx, @Query('exercicio', new ParseIntPipe({ optional: true })) exercicio?: number) {
    return this.s.listarEmpenhos(ctx, exercicio);
  }

  @Perfis(...LEITURA_UNIDADE)
  @Get('empenhos/:id')
  empenho(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.detalheEmpenho(ctx, id);
  }

  @Perfis(...SECRETARIA)
  @Post('empenhos')
  criarEmpenho(@C() ctx: Ctx, @Body() dto: CriarEmpenhoDto) {
    return this.s.criarEmpenho(ctx, dto);
  }

  @Perfis(...SECRETARIA)
  @Post('empenhos/:id/movimentos')
  movEmpenho(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MovimentoEmpenhoDto) {
    return this.s.movimentarEmpenho(ctx, id, dto);
  }

  @Perfis(...SECRETARIA)
  @Post('empenhos/:id/rateios')
  rateio(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RateioDto) {
    return this.s.definirRateio(ctx, id, dto);
  }

  @Perfis(...SECRETARIA)
  @Post('empenhos/:id/conciliacao')
  @HttpCode(200)
  conciliarEmpenho(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConciliacaoDto) {
    return this.s.conciliar(ctx, 'empenho', id, dto.fonte);
  }

  @Perfis('ADMIN', 'CHEFE')
  @Post('empenhos/:id/inscricao-rap')
  inscrever(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: InscricaoRapDto) {
    return this.s.inscreverRap(ctx, id, dto);
  }

  @Perfis(...SECRETARIA)
  @Post('restos-a-pagar/:id/movimentos')
  movRap(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MovimentoRapDto) {
    return this.s.movimentarRap(ctx, id, dto);
  }

  @Perfis(...LEITURA_UNIDADE)
  @Get('alocacoes')
  alocacoes(@C() ctx: Ctx, @Query() q: FinanceiroQuery) {
    return this.s.listarAlocacoes(ctx, q.exercicio);
  }

  @Perfis(...SECRETARIA)
  @Post('alocacoes')
  alocar(@C() ctx: Ctx, @Body() dto: AlocacaoDto) {
    return this.s.criarAlocacao(ctx, dto);
  }

  @Perfis(...TODOS)
  @Get('contratos/:id')
  porContrato(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.porContrato(ctx, id);
  }
}

@Module({ controllers: [FinanceiroController], providers: [FinanceiroService], exports: [FinanceiroService] })
export class FinanceiroModule {}
