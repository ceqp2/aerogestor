import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { env } from '../config/env';
import { sha256 } from '../common/crypto';

export interface RespostaExterna<T> {
  dados: T;
  fonte: string;
  url: string;
  consultadoEm: Date;
  deCache: boolean;
  chaveCache: string;
  avisoCache?: string;
}

interface StatusFonte {
  ultimaTentativa?: Date;
  ultimoSucesso?: Date;
  ultimaFalha?: Date;
  ultimoErro?: string;
}

const CACHE_TTL_MS = 6 * 3600 * 1000;

/**
 * Cliente HTTP para APIs públicas oficiais: timeout, retentativa moderada (2x em falha de rede/5xx/429),
 * cache persistente com data da consulta e fallback IDENTIFICADO para o último cache.
 * Nunca fabrica resultados.
 */
@Injectable()
export class HttpExternoService {
  private log = new Logger('Integracoes');
  readonly status = new Map<string, StatusFonte>();

  constructor(private prisma: PrismaService) {}

  async getJson<T>(fonte: string, url: string, opcoes: { usarCache?: boolean } = {}): Promise<RespostaExterna<T>> {
    const chaveCache = sha256(`${fonte}|${url}`);
    const st = this.status.get(fonte) ?? {};
    this.status.set(fonte, st);

    if (opcoes.usarCache !== false) {
      const c = await this.prisma.cacheConsulta.findUnique({ where: { chave: chaveCache } });
      if (c && Date.now() - c.consultadoEm.getTime() < CACHE_TTL_MS) {
        return { dados: c.resposta as T, fonte, url, consultadoEm: c.consultadoEm, deCache: true, chaveCache };
      }
    }

    st.ultimaTentativa = new Date();
    let ultimoErro = '';
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      if (tentativa > 0) await new Promise((r) => setTimeout(r, 500 * 2 ** tentativa));
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), env().integrationTimeoutMs);
      try {
        const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'AEROGEST-GSD/1.0' }, signal: ctrl.signal });
        if (r.status === 204) {
          return this.salvar(fonte, url, chaveCache, { vazio: true } as T, st);
        }
        if (r.status >= 500 || r.status === 429) {
          ultimoErro = `HTTP ${r.status}`;
          continue;
        }
        if (!r.ok) {
          ultimoErro = `HTTP ${r.status}`;
          break;
        }
        const texto = await r.text();
        if (texto.length > 10 * 1024 * 1024) throw new Error('Resposta excede 10 MB');
        const json = JSON.parse(texto) as T;
        return this.salvar(fonte, url, chaveCache, json, st);
      } catch (e) {
        ultimoErro = (e as Error).name === 'AbortError' ? `timeout de ${env().integrationTimeoutMs} ms` : (e as Error).message;
      } finally {
        clearTimeout(t);
      }
    }

    st.ultimaFalha = new Date();
    st.ultimoErro = ultimoErro;
    this.log.warn(`${fonte} indisponível: ${ultimoErro} (${url})`);

    const antigo = await this.prisma.cacheConsulta.findUnique({ where: { chave: chaveCache } });
    if (antigo) {
      return {
        dados: antigo.resposta as T, fonte, url, consultadoEm: antigo.consultadoEm, deCache: true, chaveCache,
        avisoCache: `Fonte indisponível (${ultimoErro}). Exibindo último resultado em cache, consultado em ${antigo.consultadoEm.toISOString()}.`,
      };
    }
    throw new ServiceUnavailableException(
      `Fonte externa ${fonte} indisponível (${ultimoErro}). Nenhum dado foi gerado; utilize o cadastro manual ou tente mais tarde.`,
    );
  }

  private async salvar<T>(fonte: string, url: string, chave: string, dados: T, st: StatusFonte): Promise<RespostaExterna<T>> {
    const agora = new Date();
    await this.prisma.cacheConsulta.upsert({
      where: { chave },
      create: { chave, fonte, resposta: dados as Prisma.InputJsonValue, consultadoEm: agora },
      update: { resposta: dados as Prisma.InputJsonValue, consultadoEm: agora },
    });
    st.ultimoSucesso = agora;
    return { dados, fonte, url, consultadoEm: agora, deCache: false, chaveCache: chave };
  }

  async lerCache<T>(chave: string) {
    const c = await this.prisma.cacheConsulta.findUnique({ where: { chave } });
    return c ? { dados: c.resposta as T, consultadoEm: c.consultadoEm, fonte: c.fonte } : null;
  }
}
