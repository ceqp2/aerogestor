import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { C, Ctx, Perfis, SECRETARIA, TODOS } from '../../common/contexto';
import {
  AplicarModeloDto, AtualizarChecklistItemDto, AtualizarProcessoDto, CriarModeloDto, CriarProcessoDto, ItemProcessoDto, MudarEtapaDto,
  MudarSituacaoDto, NovoChecklistItemDto, ProcessosQuery, RevisarNaDto,
} from './processos.dto';
import { ProcessosService } from './processos.service';

@ApiTags('processos')
@Controller('processos')
export class ProcessosController {
  constructor(private s: ProcessosService) {}

  @Perfis(...TODOS)
  @Get()
  listar(@C() ctx: Ctx, @Query() q: ProcessosQuery) {
    return this.s.listar(ctx, q);
  }

  @Perfis(...TODOS)
  @Get('modelos-checklist')
  modelos(@C() ctx: Ctx) {
    return this.s.modelos(ctx);
  }

  @Perfis('ADMIN')
  @Post('modelos-checklist')
  criarModelo(@C() ctx: Ctx, @Body() dto: CriarModeloDto) {
    return this.s.criarModelo(ctx, dto);
  }

  @Perfis('ADMIN')
  @Post('modelos-checklist/:id/desativar')
  @HttpCode(200)
  async desativarModelo(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    await this.s.desativarModelo(ctx, id);
    return { ok: true };
  }

  @Perfis(...TODOS)
  @Get(':id')
  detalhe(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.detalhe(ctx, id);
  }

  @Perfis(...TODOS)
  @Get(':id/historico')
  historico(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.historico(ctx, id);
  }

  @Perfis(...SECRETARIA)
  @Post()
  criar(@C() ctx: Ctx, @Body() dto: CriarProcessoDto) {
    return this.s.criar(ctx, dto);
  }

  @Perfis(...SECRETARIA)
  @Patch(':id')
  atualizar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarProcessoDto) {
    return this.s.atualizar(ctx, id, dto);
  }

  @Perfis(...SECRETARIA)
  @Post(':id/etapa')
  @HttpCode(200)
  etapa(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MudarEtapaDto) {
    return this.s.mudarEtapa(ctx, id, dto);
  }

  @Perfis(...SECRETARIA)
  @Post(':id/situacao')
  @HttpCode(200)
  situacao(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MudarSituacaoDto) {
    return this.s.mudarSituacao(ctx, id, dto);
  }

  @Perfis(...SECRETARIA)
  @Post(':id/checklist/aplicar-modelo')
  @HttpCode(200)
  aplicarModelo(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AplicarModeloDto) {
    return this.s.aplicarModelo(ctx, id, dto.modeloId);
  }

  @Perfis(...SECRETARIA)
  @Post(':id/checklist')
  novoItem(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NovoChecklistItemDto) {
    return this.s.novoItem(ctx, id, dto);
  }

  @Perfis('ADMIN', 'CHEFE', 'AUXILIAR', 'GESTOR')
  @Patch(':id/checklist/:itemId')
  atualizarItem(
    @C() ctx: Ctx,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: AtualizarChecklistItemDto,
  ) {
    return this.s.atualizarItem(ctx, id, itemId, dto);
  }

  @Perfis('ADMIN', 'CHEFE')
  @Post(':id/checklist/:itemId/revisar-na')
  @HttpCode(200)
  revisarNa(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: RevisarNaDto) {
    return this.s.revisarNa(ctx, id, itemId, dto);
  }

  @Perfis(...SECRETARIA)
  @Post(':id/itens')
  adicionarItem(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ItemProcessoDto) {
    return this.s.adicionarItemProcesso(ctx, id, dto);
  }

  @Perfis(...SECRETARIA)
  @Delete(':id/itens/:itemId')
  async removerItem(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    await this.s.removerItemProcesso(ctx, id, itemId);
    return { ok: true };
  }
}
