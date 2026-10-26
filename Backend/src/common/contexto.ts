import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Perfil } from '@prisma/client';
import type { Request } from 'express';

/** Contexto autenticado da requisição, resolvido pelo AuthGuard a partir da sessão. */
export interface Ctx {
  usuarioId: string;
  nome: string;
  email: string;
  sessaoId: string;
  unidadeId: string;
  perfil: Perfil;
  mfaAtivo: boolean;
  suporte: boolean; // acesso via concessão de suporte entre unidades
  correlationId: string;
  ip?: string;
}

export type ReqAuth = Request & {
  ctx?: Ctx;
  correlationId?: string;
  sessaoParcial?: { id: string; usuarioId: string };
};

export const PUBLICO = 'publico';
export const Publico = () => SetMetadata(PUBLICO, true);

/** Rotas acessíveis com sessão sem unidade selecionada ou com MFA pendente. */
export const SESSAO_PARCIAL = 'sessaoParcial';
export const SessaoParcial = () => SetMetadata(SESSAO_PARCIAL, true);

export const PERFIS = 'perfis';
/** Restringe a rota aos perfis informados (verificação no servidor, em toda requisição). */
export const Perfis = (...perfis: Perfil[]) => SetMetadata(PERFIS, perfis);

export const C = createParamDecorator((_: unknown, ctx: ExecutionContext): Ctx => {
  const req = ctx.switchToHttp().getRequest<ReqAuth>();
  return req.ctx as Ctx;
});

export const LEITURA_UNIDADE: Perfil[] = ['COMANDANTE', 'ADMIN', 'CHEFE', 'AUXILIAR'];
export const SECRETARIA: Perfil[] = ['ADMIN', 'CHEFE', 'AUXILIAR'];
export const TODOS: Perfil[] = ['COMANDANTE', 'ADMIN', 'CHEFE', 'AUXILIAR', 'GESTOR'];
export const GESTAO: Perfil[] = ['ADMIN', 'CHEFE'];
export const PRIVILEGIADOS: Perfil[] = ['ADMIN', 'CHEFE', 'COMANDANTE'];

export const ehSecretaria = (c: Ctx) => SECRETARIA.includes(c.perfil);
export const ehLeituraUnidade = (c: Ctx) => LEITURA_UNIDADE.includes(c.perfil);
