import { Inbox, RefreshCw, XCircle } from 'lucide-react';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { ApiError } from '@/lib/api';
import { Botao } from './ui';

export function Carregando({ texto = 'Carregando…', linhas = 3 }: { texto?: string; linhas?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 py-2">
      <span className="sr-only">{texto}</span>
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="h-4 animate-pulse rounded bg-azul-claro-2" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function Vazio({ titulo = 'Nada por aqui', texto, acao }: { titulo?: string; texto?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Inbox className="size-8 text-tinta-suave/60" aria-hidden />
      <p className="font-medium text-tinta">{titulo}</p>
      {texto && <p className="max-w-md text-sm text-tinta-suave">{texto}</p>}
      {acao}
    </div>
  );
}

export function mensagemErro(e: unknown) {
  if (e instanceof ApiError) {
    if (e.status === 403) return e.message || 'Seu perfil não tem permissão para esta ação.';
    if (e.status === 404) return 'Registro não encontrado ou fora do seu escopo de acesso.';
    return e.detalhes && e.detalhes.length > 1 ? e.detalhes.join(' • ') : e.message;
  }
  return 'Ocorreu um erro inesperado.';
}

export function ErroCarga({ erro, tentarNovamente }: { erro: unknown; tentarNovamente?: () => void }) {
  const cid = erro instanceof ApiError ? erro.correlationId : undefined;
  return (
    <div role="alert" className="flex flex-col items-center gap-2 py-8 text-center">
      <XCircle className="size-8 text-perigo" aria-hidden />
      <p className="font-medium text-tinta">Não foi possível carregar</p>
      <p className="max-w-md text-sm text-tinta-suave">{mensagemErro(erro)}</p>
      {cid && <p className="text-xs text-tinta-suave">Código: {cid}</p>}
      {tentarNovamente && (
        <Botao variante="secundario" pequeno onClick={tentarNovamente} icone={<RefreshCw className="size-4" />}>
          Tentar novamente
        </Botao>
      )}
    </div>
  );
}

// ───── Toasts ─────
type Toast = { id: number; tom: 'ok' | 'perigo' | 'info'; texto: string };
const ToastCtx = createContext<(tom: Toast['tom'], texto: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const mostrar = useCallback((tom: Toast['tom'], texto: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tom, texto }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tom === 'perigo' ? 8000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tom === 'perigo' ? 'alert' : 'status'}
            className={`pointer-events-auto w-full max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${
              t.tom === 'ok' ? 'border-ok/30 bg-ok-fundo text-ok' : t.tom === 'perigo' ? 'border-perigo/30 bg-perigo-fundo text-perigo' : 'border-acao/30 bg-azul-claro-2 text-tinta'
            }`}
          >
            {t.texto}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const mostrar = useContext(ToastCtx);
  return {
    sucesso: (t: string) => mostrar('ok', t),
    erro: (e: unknown) => mostrar('perigo', typeof e === 'string' ? e : mensagemErro(e)),
    info: (t: string) => mostrar('info', t),
  };
}
