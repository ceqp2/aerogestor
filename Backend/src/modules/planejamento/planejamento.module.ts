import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { C, Ctx, LEITURA_UNIDADE, Perfis, SECRETARIA } from '../../common/contexto';
import { AtualizarDemandaDto, CriarDemandaDto, CriarPropostaDto, DemandasQuery, NovaVersaoPropostaDto, StatusDemandaDto } from './planejamento.dto';
import { PlanejamentoService } from './planejamento.service';

@ApiTags('planejamento')
@Controller('planejamento')
class PlanejamentoController {
  constructor(private s: PlanejamentoService) {}

  @Perfis(...LEITURA_UNIDADE)
  @Get('demandas')
  demandas(@C() ctx: Ctx, @Query() q: DemandasQuery) {
    return this.s.listarDemandas(ctx, q);
  }

  @Perfis(...LEITURA_UNIDADE)
  @Get('demandas/:id')
  demanda(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.obterDemanda(ctx, id);
  }

  @Perfis(...SECRETARIA)
  @Post('demandas')
  criar(@C() ctx: Ctx, @Body() dto: CriarDemandaDto) {
    return this.s.criarDemanda(ctx, dto);
  }

  @Perfis(...SECRETARIA)
  @Patch('demandas/:id')
  atualizar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarDemandaDto) {
    return this.s.atualizarDemanda(ctx, id, dto);
  }

  @Perfis(...SECRETARIA)
  @Post('demandas/:id/status')
  @HttpCode(200)
  status(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDemandaDto) {
    return this.s.statusDemanda(ctx, id, dto);
  }

  @Perfis(...LEITURA_UNIDADE)
  @Get('propostas')
  propostas(@C() ctx: Ctx) {
    return this.s.listarPropostas(ctx);
  }

  @Perfis(...SECRETARIA)
  @Post('propostas')
  criarProposta(@C() ctx: Ctx, @Body() dto: CriarPropostaDto) {
    return this.s.criarProposta(ctx, dto);
  }

  @Perfis(...SECRETARIA)
  @Post('propostas/:id/versoes')
  versao(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NovaVersaoPropostaDto) {
    return this.s.novaVersao(ctx, id, dto);
  }

  @Perfis('ADMIN', 'CHEFE')
  @Post('propostas/:id/versoes/:versaoId/enviada')
  @HttpCode(200)
  enviada(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Param('versaoId', ParseUUIDPipe) versaoId: string) {
    return this.s.marcarEnviada(ctx, id, versaoId);
  }
}

@Module({ controllers: [PlanejamentoController], providers: [PlanejamentoService] })
export class PlanejamentoModule {}
