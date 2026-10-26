import { Injectable } from '@nestjs/common';
import { env } from '../../config/env';
import { HttpExternoService } from '../http-externo';

/**
 * PNCP — API pública de CONSULTA (https://pncp.gov.br/api/consulta/swagger-ui/index.html).
 * Endpoint verificado em 08/10/2026: GET /v1/atas (atas de registro de preço por período de vigência)
 *   parâmetros: dataInicial*, dataFinal* (AAAAMMDD), cnpj, codigoUnidadeAdministrativa, idUsuario, pagina*, tamanhoPagina
 *   resposta: { data[], totalRegistros, totalPaginas, numeroPagina, paginasRestantes, empty }
 * A API de consulta NÃO fornece itens, quantidades ou saldos da ata; esses dados são cadastrados manualmente.
 * A API de publicação/manutenção do PNCP não é utilizada.
 */
export interface AtaPncp {
  numeroControlePNCPAta: string;
  numeroAtaRegistroPreco: string;
  anoAta: number;
  numeroControlePNCPCompra: string;
  cancelado: boolean;
  dataCancelamento: string | null;
  dataAssinatura: string | null;
  vigenciaInicio: string;
  vigenciaFim: string;
  dataPublicacaoPncp: string | null;
  dataAtualizacao: string | null;
  objetoContratacao: string;
  cnpjOrgao: string;
  nomeOrgao: string;
  codigoUnidadeOrgao: string | null;
  nomeUnidadeOrgao: string | null;
  possibilidadeAdesao?: boolean | null;
}

export interface PaginaPncp<T> {
  data: T[];
  totalRegistros: number;
  totalPaginas: number;
  numeroPagina: number;
  paginasRestantes: number;
  empty: boolean;
}

export interface FiltroAtas {
  dataInicial: string; // AAAA-MM-DD
  dataFinal: string;
  cnpj?: string;
  codigoUnidadeAdministrativa?: string;
  pagina: number;
  tamanhoPagina: number;
}

@Injectable()
export class PncpClient {
  constructor(private http: HttpExternoService) {}

  async buscarAtas(f: FiltroAtas) {
    const p = new URLSearchParams({
      dataInicial: f.dataInicial.replace(/-/g, ''),
      dataFinal: f.dataFinal.replace(/-/g, ''),
      pagina: String(f.pagina),
      tamanhoPagina: String(f.tamanhoPagina),
    });
    if (f.cnpj) p.set('cnpj', f.cnpj);
    if (f.codigoUnidadeAdministrativa) p.set('codigoUnidadeAdministrativa', f.codigoUnidadeAdministrativa);
    const url = `${env().pncpBaseUrl}/v1/atas?${p.toString()}`;
    const r = await this.http.getJson<PaginaPncp<AtaPncp> | { vazio: true }>('PNCP_ATAS', url);
    const pagina: PaginaPncp<AtaPncp> =
      'vazio' in r.dados ? { data: [], totalRegistros: 0, totalPaginas: 0, numeroPagina: f.pagina, paginasRestantes: 0, empty: true } : r.dados;
    return { ...r, dados: pagina };
  }
}
