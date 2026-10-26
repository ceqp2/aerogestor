import { Injectable } from '@nestjs/common';
import { env } from '../../config/env';
import { HttpExternoService } from '../http-externo';

/**
 * Compras.gov.br — API de Dados Abertos (https://dadosabertos.compras.gov.br, OpenAPI em /v3/api-docs).
 * Endpoints verificados em 08/10/2026:
 *  - CATMAT: GET /modulo-material/4_consultarItemMaterial  (codigoItem, descricaoItem, codigoGrupo, codigoClasse, codigoPdm, statusItem, pagina, tamanhoPagina)
 *  - CATSER: GET /modulo-servico/6_consultarItemServico    (codigoServico, codigoGrupo, codigoClasse, codigoSubclasse, statusServico, pagina, tamanhoPagina)
 *  Resposta: { resultado[], totalRegistros, totalPaginas, paginasRestantes }
 * Observação (verificada): em CATMAT, descricaoItem é correspondência EXATA na fonte; com classe informada,
 * o texto é aplicado como filtro local sobre a página da classe. O endpoint de serviços NÃO aceita filtro por descrição; a busca textual de CATSER
 * é feita localmente somente sobre a página retornada de uma classe/grupo informado.
 */
export interface ItemCatalogo {
  tipo: 'CATMAT' | 'CATSER';
  codigo: string;
  descricao: string;
  grupo?: string | null;
  classe?: string | null;
  pdm?: string | null;
  ativo: boolean;
  sustentavel?: boolean | null;
  atualizadoEm?: string | null;
  original: Record<string, unknown>;
}

interface PaginaCompras<T> {
  resultado: T[];
  totalRegistros: number;
  totalPaginas: number;
  paginasRestantes: number;
}

type Raw = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? null : String(v));

@Injectable()
export class ComprasCatalogoClient {
  constructor(private http: HttpExternoService) {}

  async materiais(f: { codigo?: string; descricao?: string; codigoClasse?: string; pagina: number; tamanhoPagina: number }) {
    const p = new URLSearchParams({ pagina: String(f.pagina), tamanhoPagina: String(f.tamanhoPagina) });
    if (f.codigo) p.set('codigoItem', f.codigo);
    const filtroLocal = !!(f.descricao && f.codigoClasse);
    if (f.descricao && !filtroLocal) p.set('descricaoItem', f.descricao);
    if (f.codigoClasse) p.set('codigoClasse', f.codigoClasse);
    const url = `${env().comprasBaseUrl}/modulo-material/4_consultarItemMaterial?${p}`;
    const r = await this.http.getJson<PaginaCompras<Raw>>('CATMAT', url);
    let itens = (r.dados.resultado ?? []).map<ItemCatalogo>((x) => ({
        tipo: 'CATMAT', codigo: String(x.codigoItem), descricao: String(x.descricaoItem ?? ''), grupo: s(x.nomeGrupo), classe: s(x.nomeClasse),
        pdm: s(x.nomePdm), ativo: x.statusItem === true, sustentavel: (x.itemSustentavel as boolean) ?? null, atualizadoEm: s(x.dataHoraAtualizacao), original: x,
    }));
    if (filtroLocal) {
      const t = f.descricao!.toLowerCase();
      itens = itens.filter((i) => i.descricao.toLowerCase().includes(t));
    }
    return { ...r, itens, total: r.dados.totalRegistros ?? 0, paginas: r.dados.totalPaginas ?? 0, filtroLocalAplicado: filtroLocal, descricaoExata: !!f.descricao && !filtroLocal };
  }

  async servicos(f: { codigo?: string; codigoClasse?: string; codigoGrupo?: string; filtroLocal?: string; pagina: number; tamanhoPagina: number }) {
    const p = new URLSearchParams({ pagina: String(f.pagina), tamanhoPagina: String(f.tamanhoPagina) });
    if (f.codigo) p.set('codigoServico', f.codigo);
    if (f.codigoClasse) p.set('codigoClasse', f.codigoClasse);
    if (f.codigoGrupo) p.set('codigoGrupo', f.codigoGrupo);
    const url = `${env().comprasBaseUrl}/modulo-servico/6_consultarItemServico?${p}`;
    const r = await this.http.getJson<PaginaCompras<Raw>>('CATSER', url);
    let itens = (r.dados.resultado ?? []).map<ItemCatalogo>((x) => ({
      tipo: 'CATSER', codigo: String(x.codigoServico), descricao: String(x.nomeServico ?? ''), grupo: s(x.nomeGrupo), classe: s(x.nomeClasse),
      ativo: x.statusServico === true, atualizadoEm: s(x.dataHoraAtualizacao), original: x,
    }));
    if (f.filtroLocal) {
      const t = f.filtroLocal.toLowerCase();
      itens = itens.filter((i) => i.descricao.toLowerCase().includes(t));
    }
    return { ...r, itens, total: r.dados.totalRegistros ?? 0, paginas: r.dados.totalPaginas ?? 0, filtroLocalAplicado: !!f.filtroLocal };
  }
}
