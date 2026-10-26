import { useQueries } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Carregando, Vazio } from '@/components/feedback';
import { Botao, CabecalhoPagina, Cartao } from '@/components/ui';
import { api, Paginado } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function BuscaPage() {
  const [sp, setSp] = useSearchParams();
  const termo = sp.get('q') ?? '';
  const [texto, setTexto] = useState(termo);
  const { pode } = useAuth();
  const fontes = [
    { chave: 'processos', titulo: 'Processos', url: '/processos', link: (x: any) => `/processos/${x.id}`, rotulo: (x: any) => `${x.numeroInterno} — ${x.objeto}`, ativo: true },
    { chave: 'contratos', titulo: 'Contratos', url: '/contratos', link: (x: any) => `/contratos/${x.id}`, rotulo: (x: any) => `${x.numero} — ${x.objeto}`, ativo: true },
    { chave: 'atas', titulo: 'Atas', url: '/atas', link: (x: any) => `/atas/${x.id}`, rotulo: (x: any) => `${x.numero} — ${x.objeto}`, ativo: pode.lerUnidade },
    { chave: 'solicitacoes', titulo: 'Solicitações', url: '/solicitacoes', link: (x: any) => `/solicitacoes/${x.id}`, rotulo: (x: any) => x.titulo, ativo: true },
  ].filter((f) => f.ativo);
  const qs = useQueries({
    queries: fontes.map((f) => ({
      queryKey: ['busca', f.chave, termo],
      queryFn: () => api.get<Paginado<any>>(`${f.url}?busca=${encodeURIComponent(termo)}&tamanho=10`),
      enabled: termo.length >= 2,
    })),
  });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setSp({ q: texto.trim() });
  };

  return (
    <>
      <CabecalhoPagina titulo="Busca" subtitulo="Resultados respeitam seu escopo de acesso." />
      <form onSubmit={enviar} className="mb-4 flex gap-2" role="search">
        <label htmlFor="busca-pagina" className="sr-only">Termo</label>
        <input id="busca-pagina" value={texto} onChange={(e) => setTexto(e.target.value)} className="min-h-11 flex-1 rounded-lg border border-borda bg-white px-3" placeholder="Processo, NUP, contrato, ata…" />
        <Botao type="submit">Buscar</Botao>
      </form>
      {termo.length < 2 ? (
        <Vazio titulo="Digite ao menos 2 caracteres" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {fontes.map((f, i) => (
            <Cartao key={f.chave} titulo={f.titulo}>
              {qs[i].isLoading ? (
                <Carregando linhas={2} />
              ) : !qs[i].data?.itens.length ? (
                <p className="text-sm text-tinta-suave">Nenhum resultado</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {qs[i].data!.itens.map((x: any) => (
                    <li key={x.id}>
                      <Link to={f.link(x)} className="line-clamp-1 text-acao hover:underline">
                        {f.rotulo(x)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          ))}
        </div>
      )}
    </>
  );
}
