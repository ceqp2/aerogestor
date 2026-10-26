/**
 * Cliente HTTP. Sessão em cookie HttpOnly (nunca em localStorage);
 * requisições de escrita enviam o token CSRF lido do cookie aerogest_csrf (double submit).
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public correlationId?: string,
    public detalhes?: string[],
  ) {
    super(message);
  }
}

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '') + '/api/v1';

function lerCookie(nome: string) {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${nome}=`))
    ?.split('=')[1];
}

let aoNaoAutenticado: (() => void) | null = null;
export function registrarNaoAutenticado(fn: () => void) {
  aoNaoAutenticado = fn;
}

type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function requisicao<T>(metodo: Metodo, caminho: string, corpo?: unknown, opcoes: { formData?: FormData; bruto?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (metodo !== 'GET') {
    const csrf = lerCookie('aerogest_csrf');
    if (csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf);
  }
  let body: BodyInit | undefined;
  if (opcoes.formData) body = opcoes.formData;
  else if (corpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(corpo);
  }
  let r: Response;
  try {
    r = await fetch(BASE + caminho, { method: metodo, headers, body, credentials: 'include' });
  } catch {
    throw new ApiError(0, 'Não foi possível contactar o servidor. Verifique sua conexão.');
  }
  if (opcoes.bruto && r.ok) return r as unknown as T;
  const texto = await r.text();
  let dados: unknown = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = texto;
  }
  if (!r.ok) {
    const d = (dados ?? {}) as { message?: string | string[]; correlationId?: string };
    const msgs = Array.isArray(d.message) ? d.message : d.message ? [d.message] : [];
    const err = new ApiError(r.status, msgs[0] ?? `Erro ${r.status}`, d.correlationId, msgs);
    if (r.status === 401 && !caminho.startsWith('/auth/login') && !caminho.startsWith('/auth/mfa')) aoNaoAutenticado?.();
    throw err;
  }
  return dados as T;
}

export const api = {
  get: <T>(c: string) => requisicao<T>('GET', c),
  post: <T>(c: string, corpo?: unknown) => requisicao<T>('POST', c, corpo ?? {}),
  patch: <T>(c: string, corpo?: unknown) => requisicao<T>('PATCH', c, corpo ?? {}),
  delete: <T>(c: string) => requisicao<T>('DELETE', c),
  upload: <T>(c: string, fd: FormData) => requisicao<T>('POST', c, undefined, { formData: fd }),
  /** Download autenticado: o servidor autoriza cada requisição. */
  async baixar(c: string, nomePadrao = 'arquivo') {
    const r = await requisicao<Response>('GET', c, undefined, { bruto: true });
    const disp = r.headers.get('Content-Disposition') ?? '';
    const m = /filename\*=UTF-8''([^;]+)/.exec(disp) ?? /filename="([^"]+)"/.exec(disp);
    const nome = m ? decodeURIComponent(m[1]) : nomePadrao;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
};

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export interface Paginado<T> {
  itens: T[];
  total: number;
  pagina: number;
  tamanho: number;
  paginas: number;
}
