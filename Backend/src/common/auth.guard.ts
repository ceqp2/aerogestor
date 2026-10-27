import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Perfil } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { env } from '../config/env';
import { COOKIE_SESSAO, HEADER_CSRF } from './cookies';
import { hashToken, igualSeguro } from './crypto';
import { PERFIS, PUBLICO, PRIVILEGIADOS, ReqAuth, SESSAO_PARCIAL } from './contexto';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Guard global: autentica a sessão (cookie HttpOnly), valida CSRF em métodos de escrita,
 * resolve unidade/perfil ativos e aplica a restrição de perfis da rota.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const alvo = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, alvo)) return true;

    const req = context.switchToHttp().getRequest<ReqAuth>();
    const cookieToken: string | undefined = req.cookies?.[COOKIE_SESSAO];
    const bearerToken = (req.header('authorization') ?? '').replace(/^Bearer\s+/i, '').trim() || undefined;
    const token = cookieToken || bearerToken;
    if (!token || token.length > 500) throw new UnauthorizedException('Sessão ausente');

    const sessao = await this.prisma.sessao.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { usuario: true },
    });
    const agora = new Date();
    if (!sessao || sessao.revogadaEm || sessao.expiraEm < agora || !sessao.usuario.ativo) {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }

    // CSRF só é verificado quando a sessão vem via cookie (cross-origin cookie attack).
    // Quando o cliente usa Authorization: Bearer, o token já prova a identidade.
    if (!METODOS_SEGUROS.has(req.method) && !bearerToken) {
      const csrf = req.header(HEADER_CSRF);
      if (!csrf || !igualSeguro(hashToken(csrf), sessao.csrfHash)) {
        throw new ForbiddenException('Token CSRF inválido');
      }
    }

    // Atualiza último uso no máximo a cada minuto (reduz escrita).
    if (agora.getTime() - sessao.ultimoUso.getTime() > 60000) {
      await this.prisma.sessao.update({ where: { id: sessao.id }, data: { ultimoUso: agora } });
    }

    const parcialPermitida = this.reflector.getAllAndOverride<boolean>(SESSAO_PARCIAL, alvo);
    req.sessaoParcial = { id: sessao.id, usuarioId: sessao.usuarioId };

    if (sessao.mfaPendente) {
      if (parcialPermitida) return true;
      throw new UnauthorizedException('Verificação MFA pendente');
    }

    let perfil: Perfil | null = null;
    let suporte = false;
    if (sessao.unidadeId) {
      const vinculo = await this.prisma.vinculoUnidadePerfil.findUnique({
        where: { usuarioId_unidadeId: { usuarioId: sessao.usuarioId, unidadeId: sessao.unidadeId } },
      });
      if (vinculo?.ativo) perfil = vinculo.perfil;
      else {
        const concessao = await this.prisma.concessaoSuporte.findFirst({
          where: {
            usuarioId: sessao.usuarioId,
            unidadeId: sessao.unidadeId,
            revogadoEm: null,
            inicio: { lte: agora },
            fim: { gt: agora },
          },
        });
        if (concessao) {
          perfil = 'ADMIN';
          suporte = true;
        }
      }
    }

    if (!perfil || !sessao.unidadeId) {
      if (parcialPermitida) return true;
      throw new ForbiddenException('Selecione uma unidade com vínculo ativo');
    }

    req.ctx = {
      usuarioId: sessao.usuarioId,
      nome: sessao.usuario.nome,
      email: sessao.usuario.email,
      sessaoId: sessao.id,
      unidadeId: sessao.unidadeId,
      perfil,
      mfaAtivo: sessao.usuario.mfaAtivo,
      suporte,
      correlationId: req.correlationId ?? '',
      ip: req.ip,
    };

    if (env().mfaEnforcePrivileged && PRIVILEGIADOS.includes(perfil) && !sessao.usuario.mfaAtivo && !parcialPermitida) {
      throw new ForbiddenException('MFA obrigatório para este perfil. Ative-o em Minha conta.');
    }

    const perfis = this.reflector.getAllAndOverride<Perfil[]>(PERFIS, alvo);
    if (perfis && !perfis.includes(perfil)) {
      throw new ForbiddenException('Perfil sem permissão para esta ação');
    }
    return true;
  }
}
