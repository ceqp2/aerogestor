import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { C, Ctx, LEITURA_UNIDADE, Perfis, SECRETARIA } from '../../common/contexto';
import { AlterarPerfilDto, ConcessaoSuporteDto, CriarUsuarioDto, MotivoDto } from './usuarios.dto';
import { UsuariosService } from './usuarios.service';

@ApiTags('usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private s: UsuariosService) {}

  @Perfis(...LEITURA_UNIDADE)
  @Get()
  listar(@C() ctx: Ctx) {
    return this.s.listar(ctx);
  }

  @Perfis(...LEITURA_UNIDADE)
  @Get('opcoes')
  opcoes(@C() ctx: Ctx) {
    return this.s.opcoes(ctx);
  }

  @Perfis(...SECRETARIA)
  @Post()
  criar(@C() ctx: Ctx, @Body() dto: CriarUsuarioDto) {
    return this.s.criar(ctx, dto);
  }

  @Perfis(...SECRETARIA)
  @Post(':id/desativar')
  @HttpCode(200)
  async desativar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MotivoDto) {
    await this.s.desativar(ctx, id, dto.motivo);
    return { ok: true };
  }

  @Perfis(...SECRETARIA)
  @Post(':id/reativar')
  @HttpCode(200)
  async reativar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MotivoDto) {
    await this.s.reativar(ctx, id, dto.motivo);
    return { ok: true };
  }

  @Perfis('ADMIN', 'CHEFE')
  @Post(':id/perfil')
  @HttpCode(200)
  async perfil(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AlterarPerfilDto) {
    await this.s.alterarPerfil(ctx, id, dto.perfil, dto.motivo);
    return { ok: true };
  }

  @Perfis(...SECRETARIA)
  @Post(':id/link-acesso')
  @HttpCode(200)
  link(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.linkRedefinicao(ctx, id);
  }

  @Perfis(...SECRETARIA)
  @Post(':id/revogar-sessoes')
  @HttpCode(200)
  revogar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    return this.s.revogarSessoes(ctx, id);
  }

  @Perfis('ADMIN')
  @Post(':id/resetar-mfa')
  @HttpCode(200)
  async resetarMfa(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MotivoDto) {
    await this.s.resetarMfa(ctx, id, dto.motivo);
    return { ok: true };
  }

  @Perfis('ADMIN')
  @Get('suporte/concessoes')
  suporte(@C() ctx: Ctx) {
    return this.s.listarSuporte(ctx);
  }

  @Perfis('ADMIN')
  @Post('suporte/concessoes')
  conceder(@C() ctx: Ctx, @Body() dto: ConcessaoSuporteDto) {
    return this.s.concederSuporte(ctx, dto.usuarioId, dto.horas, dto.motivo);
  }

  @Perfis('ADMIN')
  @Delete('suporte/concessoes/:id')
  async revogarSuporte(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    await this.s.revogarSuporte(ctx, id);
    return { ok: true };
  }
}
