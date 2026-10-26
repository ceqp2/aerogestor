import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Vazio } from './feedback';

export interface Coluna<T> {
  titulo: string;
  render: (l: T) => ReactNode;
  className?: string;
  /** destaque no cartão mobile */
  principal?: boolean;
  ocultarMobile?: boolean;
  alinhar?: 'direita';
}

/** Tabela em telas largas; cartões empilhados em telas estreitas (sem rolagem horizontal escondendo ações). */
export function Tabela<T>({ dados, colunas, chave, linkPara, vazio, rotulo }: { dados: T[]; colunas: Coluna<T>[]; chave: (l: T) => string; linkPara?: (l: T) => string; vazio?: ReactNode; rotulo: string }) {
  const navegar = useNavigate();
  if (!dados.length) return <>{vazio ?? <Vazio />}</>;
  const principal = colunas.find((c) => c.principal) ?? colunas[0];
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm" aria-label={rotulo}>
          <thead>
            <tr className="border-b border-borda text-xs uppercase tracking-wide text-tinta-suave">
              {colunas.map((c) => (
                <th key={c.titulo} scope="col" className={clsx('px-3 py-2 font-medium', c.alinhar === 'direita' && 'text-right', c.className)}>
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.map((l) => (
              <tr
                key={chave(l)}
                className={clsx('border-b border-borda/70 last:border-0', linkPara && 'cursor-pointer hover:bg-azul-claro-2/50')}
                onClick={linkPara ? (e) => !(e.target as HTMLElement).closest('a,button,input,select') && navegar(linkPara(l)) : undefined}
              >
                {colunas.map((c) => (
                  <td key={c.titulo} className={clsx('px-3 py-2.5 align-top', c.alinhar === 'direita' && 'tabular text-right', c.className)}>
                    {c.render(l)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden" aria-label={rotulo}>
        {dados.map((l) => (
          <li key={chave(l)} className="rounded-lg border border-borda bg-white p-3">
            <div className="mb-2 font-medium text-tinta">{principal.render(l)}</div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              {colunas
                .filter((c) => c !== principal && !c.ocultarMobile)
                .map((c) => (
                  <div key={c.titulo} className="min-w-0">
                    <dt className="text-xs text-tinta-suave">{c.titulo}</dt>
                    <dd className="break-words">{c.render(l)}</dd>
                  </div>
                ))}
            </dl>
            {linkPara && (
              <button onClick={() => navegar(linkPara(l))} className="mt-2 min-h-10 w-full rounded-lg bg-azul-claro-2 text-sm font-medium text-acao">
                Abrir
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function Paginacao({ pagina, paginas, total, aoMudar }: { pagina: number; paginas: number; total: number; aoMudar: (p: number) => void }) {
  if (paginas <= 1) return <p className="mt-3 text-xs text-tinta-suave">{total} registro(s)</p>;
  return (
    <nav className="mt-3 flex items-center justify-between gap-2 text-sm" aria-label="Paginação">
      <span className="text-tinta-suave">
        {total} registro(s) — página {pagina} de {paginas}
      </span>
      <div className="flex gap-1">
        <button className="min-h-10 rounded-lg border border-borda px-3 disabled:opacity-40" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)} aria-label="Página anterior">
          <ChevronLeft className="size-4" />
        </button>
        <button className="min-h-10 rounded-lg border border-borda px-3 disabled:opacity-40" disabled={pagina >= paginas} onClick={() => aoMudar(pagina + 1)} aria-label="Próxima página">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}

export function Abas<K extends string>({ abas, ativa, aoMudar }: { abas: Array<{ chave: K; rotulo: string; contador?: number }>; ativa: K; aoMudar: (k: K) => void }) {
  return (
    <div role="tablist" aria-label="Seções" className="-mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-borda px-1">
      {abas.map((a) => (
        <button
          key={a.chave}
          role="tab"
          aria-selected={a.chave === ativa}
          onClick={() => aoMudar(a.chave)}
          className={clsx(
            'min-h-11 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors',
            a.chave === ativa ? 'border-acao text-acao' : 'border-transparent text-tinta-suave hover:text-tinta',
          )}
        >
          {a.rotulo}
          {a.contador !== undefined && <span className="ml-1.5 rounded-full bg-fundo px-1.5 text-xs">{a.contador}</span>}
        </button>
      ))}
    </div>
  );
}

export function BarraFiltros({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">{children}</div>;
}

export function FiltroTexto({ valor, aoMudar, rotulo = 'Buscar', placeholder }: { valor: string; aoMudar: (v: string) => void; rotulo?: string; placeholder?: string }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col text-xs font-medium text-tinta-suave sm:max-w-sm">
      {rotulo}
      <input type="search" value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder={placeholder} className="mt-1 min-h-11 rounded-lg border border-borda bg-white px-3 text-sm text-tinta" />
    </label>
  );
}

export function FiltroSelect({ valor, aoMudar, rotulo, opcoes, todos = 'Todos' }: { valor: string; aoMudar: (v: string) => void; rotulo: string; opcoes: Array<{ value: string; label: string }>; todos?: string }) {
  return (
    <label className="flex flex-col text-xs font-medium text-tinta-suave">
      {rotulo}
      <select value={valor} onChange={(e) => aoMudar(e.target.value)} className="mt-1 min-h-11 rounded-lg border border-borda bg-white px-3 text-sm text-tinta">
        <option value="">{todos}</option>
        {opcoes.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
