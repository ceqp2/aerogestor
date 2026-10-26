import type { CookieOptions, Response } from 'express';
import { env } from '../config/env';

export const COOKIE_SESSAO = 'aerogest_sid';
export const COOKIE_CSRF = 'aerogest_csrf';
export const HEADER_CSRF = 'x-csrf-token';

function base(maxAgeMs: number): CookieOptions {
  const cfg = env();
  return { secure: cfg.cookieSecure, sameSite: cfg.cookieSecure ? ('none' as const) : ('strict' as const), path: '/', maxAge: maxAgeMs };
}

export function gravarCookiesSessao(res: Response, token: string, csrf: string) {
  const ms = env().sessionTtlHours * 3600 * 1000;
  // Sessão: HttpOnly — inacessível ao JavaScript. CSRF: legível pelo frontend (double submit).
  res.cookie(COOKIE_SESSAO, token, { ...base(ms), httpOnly: true });
  res.cookie(COOKIE_CSRF, csrf, { ...base(ms), httpOnly: false });
}

export function limparCookiesSessao(res: Response) {
  res.clearCookie(COOKIE_SESSAO, { path: '/' });
  res.clearCookie(COOKIE_CSRF, { path: '/' });
}
