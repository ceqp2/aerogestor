import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { dataHora } from '@/lib/formato';
import { Carregando, ErroCarga, Vazio } from './feedback';

export interface RegistroAuditoria {
  id: string;
  criadoEm: string;
  usuarioNome?: string | null;
  acao: string;
  entidade: string;
  antes?: unknown;
  depois?: unknown;
  motivo?: string | null;
  correlationId?: string | null;
}

const legivel = (acao: string) => acao.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export function ListaAuditoria({ itens }: { itens: RegistroAuditoria[] }) {
  const [aberto, setAberto] = useState<string | null>(null);
  if (!itens.length) return <Vazio titulo="Sem registros" />;
  return (
    <ol className="relative space-y-3 border-l-2 border-azul-claro pl-4">
      {itens.map((h) => (
        <li key={h.id} className="relative">
          <span className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-acao" aria-hidden />
          <p className="text-sm font-medium text-tinta">{legivel(h.acao)}</p>
          <p className="text-xs text-tinta-suave">
            {dataHora(h.criadoEm)} • {h.usuarioNome ?? 'Sistema'}
          </p>
          {h.motivo && <p className="mt-1 text-sm">Motivo: {h.motivo}</p>}
          {(h.antes !== null && h.antes !== undefined) || (h.depois !== null && h.depois !== undefined) ? (
            <>
              <button className="mt-1 text-xs text-acao hover:underline" onClick={() => setAberto(aberto === h.id ? null : h.id)} aria-expanded={aberto === h.id}>
                {aberto === h.id ? 'Ocultar detalhes' : 'Ver antes/depois'}
              </button>
              {aberto === h.id && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <pre className="max-h-60 overflow-auto rounded bg-fundo p-2 text-[0.7rem]">{JSON.stringify(h.antes ?? null, null, 2)}</pre>
                  <pre className="max-h-60 overflow-auto rounded bg-azul-claro-2 p-2 text-[0.7rem]">{JSON.stringify(h.depois ?? null, null, 2)}</pre>
                </div>
              )}
            </>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function HistoricoPainel({ caminho }: { caminho: string }) {
  const q = useQuery({ queryKey: ['historico', caminho], queryFn: () => api.get<RegistroAuditoria[]>(caminho) });
  if (q.isLoading) return <Carregando />;
  if (q.isError) return <ErroCarga erro={q.error} tentarNovamente={() => q.refetch()} />;
  return (
    <div>
      <p className="mb-3 text-xs text-tinta-suave">Trilha append-only: registros não podem ser alterados ou excluídos pela aplicação.</p>
      <ListaAuditoria itens={q.data ?? []} />
    </div>
  );
}
