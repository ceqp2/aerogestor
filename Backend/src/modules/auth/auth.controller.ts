import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { gravarCookiesSessao, limparCookiesSessao } from '../../common/cookies';
import { Publico, ReqAuth, SessaoParcial } from '../../common/contexto';
import { AceitarConviteDto, CodigoMfaDto, LoginDto, SelecionarUnidadeDto, TrocarSenhaDto } from './auth.dto';
import { AuthService, MetaReq } from './auth.service';

function meta(req: ReqAuth): MetaReq {
  return { ip: req.ip, userAgent: req.header('user-agent') ?? undefined, correlationId: req.correlationId };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Publico()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: ReqAuth, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.login(dto.email, dto.senha, meta(req));
    gravarCookiesSessao(res, r.token, r.csrf);
    return { mfaPendente: r.mfaPendente };
  }

  @SessaoParcial()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('mfa/verificar')
  @HttpCode(200)
  async verificarMfa(@Body() dto: CodigoMfaDto, @Req() req: ReqAuth, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.verificarMfa(req.sessaoParcial!.id, dto.codigo, meta(req));
    gravarCookiesSessao(res, r.token, r.csrf);
    return { ok: true };
  }

  @SessaoParcial()
  @Get('me')
  me(@Req() req: ReqAuth) {
    return this.auth.me(req.sessaoParcial!.id);
  }

  @SessaoParcial()
  @Post('unidade')
  @HttpCode(200)
  async unidade(@Body() dto: SelecionarUnidadeDto, @Req() req: ReqAuth) {
    await this.auth.selecionarUnidade(req.sessaoParcial!.id, dto.unidadeId, meta(req));
    return this.auth.me(req.sessaoParcial!.id);
  }

  @SessaoParcial()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: ReqAuth, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.sessaoParcial!.id);
    limparCookiesSessao(res);
    return { ok: true };
  }

  @Publico()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('convite/:token')
  consultarConvite(@Param('token') token: string) {
    return this.auth.consultarConvite(token);
  }

  @Publico()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('convite/aceitar')
  @HttpCode(200)
  async aceitar(@Body() dto: AceitarConviteDto, @Req() req: ReqAuth) {
    await this.auth.aceitarConvite(dto.token, dto.senha, meta(req));
    return { ok: true };
  }

  @SessaoParcial()
  @Post('senha')
  @HttpCode(200)
  async senha(@Body() dto: TrocarSenhaDto, @Req() req: ReqAuth) {
    await this.auth.trocarSenha(req.sessaoParcial!.usuarioId, req.sessaoParcial!.id, dto.senhaAtual, dto.novaSenha, meta(req));
    return { ok: true };
  }

  @SessaoParcial()
  @Post('mfa/configurar')
  @HttpCode(200)
  configurarMfa(@Req() req: ReqAuth) {
    return this.auth.configurarMfa(req.sessaoParcial!.usuarioId);
  }

  @SessaoParcial()
  @Post('mfa/ativar')
  @HttpCode(200)
  async ativarMfa(@Body() dto: CodigoMfaDto, @Req() req: ReqAuth) {
    await this.auth.ativarMfa(req.sessaoParcial!.usuarioId, dto.codigo, meta(req));
    return { ok: true };
  }

  @SessaoParcial()
  @Get('sessoes')
  sessoes(@Req() req: ReqAuth) {
    return this.auth.sessoes(req.sessaoParcial!.usuarioId);
  }

  @SessaoParcial()
  @Delete('sessoes/:id')
  async revogar(@Param('id', ParseUUIDPipe) id: string, @Req() req: ReqAuth) {
    await this.auth.revogarSessao(req.sessaoParcial!.usuarioId, id);
    return { ok: true };
  }
}
