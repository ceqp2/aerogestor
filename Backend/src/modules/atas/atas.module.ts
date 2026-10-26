import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { C, Ctx, GESTAO, LEITURA_UNIDADE, Perfis, SECRETARIA } from '../../common/contexto';
import {
  AlterarDestinadaDto, AlterarVigenciaAtaDto, AtasQuery, AtualizarAtaDto, AutorizarUtilizacaoDto, CriarAtaDto, ItemAtaDto, MovimentoAtaDto,
} from './atas.dto';
import { AtasService } from './atas.service';

@ApiTags('atas')
@Controller('atas')
class AtasController {
  constructor(private s: AtasService) {}

  @Perfis(...LEITURA_UNIDADE)
  @Get()
  listar(@C() ctx: Ctx, @Query() q: AtasQuery) {
    return this.s.listar(ctx, q);
  }

  @Perfis(...LEITURA_UNIDADE)
  @Get(':id')
  detalhe(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.detalhe(ctx, id);
  }

  @Perfis(...LEITURA_UNIDADE)
  @Get(':id/historico')
  historico(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.historico(ctx, id);
  }

  @Perfis(...SECRETARIA)
  @Post()
  criar(@C() ctx: Ctx, @Body() dto: CriarAtaDto) {
    return this.s.criar(ctx, dto);
  }

  @Perfis(...SECRETARIA)
  @Patch(':id')
  atualizar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarAtaDto) {
    return this.s.atualizar(ctx, id, dto);
  }

  @Perfis(...GESTAO)
  @Post(':id/vigencia')
  @HttpCode(200)
  vigencia(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AlterarVigenciaAtaDto) {
    return this.s.alterarVigencia(ctx, id, dto);
  }

  @Perfis(...GESTAO)
  @Post(':id/autorizar-utilizacao')
  @HttpCode(200)
  autorizar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AutorizarUtilizacaoDto) {
    return this.s.autorizarUtilizacao(ctx, id, dto);
  }

  @Perfis(...SECRETARIA)
  @Post(':id/itens')
  item(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ItemAtaDto) {
    return this.s.adicionarItem(ctx, id, dto);
  }

  @Perfis(...GESTAO)
  @Post(':id/itens/:itemId/destinada')
  @HttpCode(200)
  destinada(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: AlterarDestinadaDto) {
    return this.s.alterarDestinada(ctx, id, itemId, dto);
  }

  @Perfis(...SECRETARIA)
  @Post(':id/itens/:itemId/movimentos')
  movimento(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: MovimentoAtaDto) {
    return this.s.movimentar(ctx, id, itemId, dto);
  }
}

@Module({ controllers: [AtasController], providers: [AtasService], exports: [AtasService] })
export class AtasModule {}
