import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, PartialType } from '@nestjs/swagger';
import { C, Ctx, GESTAO, LEITURA_UNIDADE, Perfis, SECRETARIA, TODOS } from '../../common/contexto';
import {
  AditivoDto, AtualizarContratoDto, ConfirmarDesignacaoDto, ContratosQuery, CorrecaoContratoDto, CriarContratoDto, EncerrarDesignacaoDto,
  FornecedorDto, IndicarDesignacaoDto, ItemContratoDto, SituacaoContratoDto,
} from './contratos.dto';
import { ContratosService } from './contratos.service';

class AtualizarFornecedorDto extends PartialType(FornecedorDto) {}

@ApiTags('fornecedores')
@Controller('fornecedores')
class FornecedoresController {
  constructor(private s: ContratosService) {}

  @Perfis(...LEITURA_UNIDADE)
  @Get()
  listar(@C() ctx: Ctx, @Query('busca') busca?: string) {
    return this.s.listarFornecedores(ctx, busca?.slice(0, 100));
  }

  @Perfis(...SECRETARIA)
  @Post()
  criar(@C() ctx: Ctx, @Body() dto: FornecedorDto) {
    return this.s.criarFornecedor(ctx, dto);
  }

  @Perfis(...SECRETARIA)
  @Patch(':id')
  atualizar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarFornecedorDto) {
    return this.s.atualizarFornecedor(ctx, id, dto);
  }
}

@ApiTags('contratos')
@Controller('contratos')
class ContratosController {
  constructor(private s: ContratosService) {}

  @Perfis(...TODOS)
  @Get()
  listar(@C() ctx: Ctx, @Query() q: ContratosQuery) {
    return this.s.listar(ctx, q);
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
  criar(@C() ctx: Ctx, @Body() dto: CriarContratoDto) {
    return this.s.criar(ctx, dto);
  }

  @Perfis(...SECRETARIA)
  @Patch(':id')
  atualizar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarContratoDto) {
    return this.s.atualizar(ctx, id, dto);
  }

  @Perfis('ADMIN')
  @Post(':id/correcao')
  @HttpCode(200)
  correcao(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CorrecaoContratoDto) {
    return this.s.correcao(ctx, id, dto);
  }

  @Perfis(...GESTAO)
  @Post(':id/situacao')
  @HttpCode(200)
  situacao(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SituacaoContratoDto) {
    return this.s.situacao(ctx, id, dto);
  }

  @Perfis(...SECRETARIA)
  @Post(':id/itens')
  item(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ItemContratoDto) {
    return this.s.adicionarItem(ctx, id, dto);
  }

  @Perfis(...SECRETARIA)
  @Post(':id/designacoes')
  indicar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: IndicarDesignacaoDto) {
    return this.s.indicar(ctx, id, dto);
  }

  @Perfis(...GESTAO)
  @Post('designacoes/:id/confirmar')
  @HttpCode(200)
  confirmar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmarDesignacaoDto) {
    return this.s.confirmar(ctx, id, dto);
  }

  @Perfis(...GESTAO)
  @Post('designacoes/:id/encerrar')
  @HttpCode(200)
  encerrar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EncerrarDesignacaoDto) {
    return this.s.encerrarDesignacao(ctx, id, dto);
  }

  @Perfis(...GESTAO)
  @Post(':id/aditivos')
  aditivo(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AditivoDto) {
    return this.s.aditivo(ctx, id, dto);
  }
}

@Module({ controllers: [FornecedoresController, ContratosController], providers: [ContratosService], exports: [ContratosService] })
export class ContratosModule {}
