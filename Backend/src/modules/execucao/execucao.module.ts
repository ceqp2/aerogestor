import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { C, Ctx, Perfis, SECRETARIA, TODOS } from '../../common/contexto';
import { AtestoDto, EntregaDto, MedicaoDto, MotivoExecDto, NotaFiscalDto, RecebimentoDto, RegistroExecucaoDto } from './execucao.dto';
import { ExecucaoService } from './execucao.service';

const OPERACAO = [...SECRETARIA, 'GESTOR' as const];

@ApiTags('execucao')
@Controller('execucao')
class ExecucaoController {
  constructor(private s: ExecucaoService) {}

  @Perfis(...TODOS)
  @Get('contratos/:id')
  painel(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.painel(ctx, id);
  }

  @Perfis(...OPERACAO)
  @Post('contratos/:id/entregas')
  entrega(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EntregaDto) {
    return this.s.criarEntrega(ctx, id, dto);
  }

  @Perfis(...OPERACAO)
  @Post('entregas/:id/recebimentos')
  receberEntrega(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RecebimentoDto) {
    return this.s.receberEntrega(ctx, id, dto);
  }

  @Perfis(...OPERACAO)
  @Post('contratos/:id/medicoes')
  medicao(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MedicaoDto) {
    return this.s.criarMedicao(ctx, id, dto);
  }

  @Perfis(...OPERACAO)
  @Post('medicoes/:id/recebimentos')
  receberMedicao(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RecebimentoDto) {
    return this.s.receberMedicao(ctx, id, dto);
  }

  @Perfis(...OPERACAO)
  @Post('contratos/:id/registros')
  registro(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RegistroExecucaoDto) {
    return this.s.registrar(ctx, id, dto);
  }

  @Perfis(...OPERACAO)
  @Post('contratos/:id/notas')
  nota(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NotaFiscalDto) {
    return this.s.registrarNota(ctx, id, dto);
  }

  @Perfis(...OPERACAO)
  @Post('notas/:id/atesto')
  atesto(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AtestoDto) {
    return this.s.atestar(ctx, id, dto);
  }

  @Perfis(...OPERACAO)
  @Post('notas/:id/rejeitar')
  @HttpCode(200)
  rejeitar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MotivoExecDto) {
    return this.s.rejeitarNota(ctx, id, dto);
  }

  @Perfis(...SECRETARIA)
  @Post('notas/:id/cancelar')
  @HttpCode(200)
  cancelar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MotivoExecDto) {
    return this.s.rejeitarNota(ctx, id, dto, true);
  }
}

@Module({ controllers: [ExecucaoController], providers: [ExecucaoService] })
export class ExecucaoModule {}
