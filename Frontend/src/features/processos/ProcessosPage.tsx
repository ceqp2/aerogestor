import { useQuery } from '@tanstack/react-query';
import { Columns3, Download, List, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Carregando, ErroCarga, Vazio } from '@/components/feedback';
import { FormularioModal } from '@/components/Formulario';
import { BarraFiltros, FiltroSelect, FiltroTexto, Paginacao, Tabela } from '@/components/Tabela';
import { Botao, CabecalhoPagina, Cartao, Selo } from '@/components/ui';
import { api, Paginado, qs } from '@/lib/api';
import { exportarXlsx } from '@/lib/exportar';
import { data, moeda } from '@/lib/formato';
import { ETAPAS, FORMAS, HIPOTESES, MODALIDADES, opcoes, ORDEM_ETAPAS, rotulo, SITUACOES_PROCESSO } from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';
import { useExercicio } from '@/hooks/useExercicio';
import { useUsuariosOpcoes } from '@/hooks/useOpcoes';
import { camposProcesso } from './processoCampos';

export interface ProcessoLista {
  id: string;
  numeroInterno: string;
  nup?: string;
  objeto: string;
  exercicio: number;
  formaContratacao: string;
  modalidade?: string;
  hipoteseDireta?: string;
  etapa: string;
  situacao: string;
  valorEstimado: string;
  dataConclusaoPrevista?: string;
  responsavel?: { nome: string };
  cumprimento: { percentual: number; aplicaveis: number; concluidos: number };
  atrasado: boolean;
}

const INDICADORES: Record<string, string> = { a_iniciar: 'A iniciar', iniciados: 'Iniciados', finalizados: 'Finalizados', atrasados: 'Atrasados' };

export function SeloSituacao({ p }: { p: Pick<ProcessoLista, 'situacao' | 'atrasado'> }) {
  if (p.situacao === 'CANCELADO') return <Selo tom="perigo">Cancelado</Selo>;
  if (p.situacao === 'SUSPENSO') return <Selo tom="atencao">Suspenso</Selo>;
  return p.atrasado ? <Selo tom="perigo">Atrasado</Selo> : <Selo tom="ok">Ativo</Selo>;
}

export function classificacao(p: Pick<ProcessoLista, 'formaContratacao' | 'modalidade' | 'hipoteseDireta'>) {
  return [FORMAS[p.formaContratacao], p.modalidade && MODALIDADES[p.modalidade], p.hipoteseDireta && HIPOTESES[p.hipoteseDireta]].filter(Boolean).join(' — ');
}

export default function ProcessosPage() {
  const { pode } = useAuth();
  const { exercicio } = useExercicio();
  const [sp, setSp] = useSearchParams();
  const [modo, setModo] = useState<'lista' | 'kanban'>('lista');
  const [criar, setCriar] = useState(false);
  const navegar = useNavigate();
  const usuarios = useUsuariosOpcoes();
  const atas = useQuery({ queryKey: ['atas', 'opcoes'], queryFn: () => api.get<Paginado<{ id: string; numero: string; objeto: string }>>('/atas?tamanho=200&vigencia=vigentes'), enabled: pode.escrever });

  const filtros = {
    busca: sp.get('busca') ?? '',
    etapa: sp.get('etapa') ?? '',
    situacao: sp.get('situacao') ?? '',
    forma: sp.get('forma') ?? '',
    indicador: sp.get('indicador') ?? '',
    pagina: Number(sp.get('pagina') ?? 1),
  };
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'pagina') n.delete('pagina');
    setSp(n, { replace: true });
  };
  const tamanho = modo === 'kanban' ? 200 : 25;
  const q = useQuery({
    queryKey: ['processos', exercicio, filtros, tamanho],
    queryFn: () => api.get<Paginado<ProcessoLista>>(`/processos${qs({ ...filtros, exercicio: pode.lerUnidade ? exercicio : undefined, tamanho })}`),
  });

  const campos = useMemo(() => camposProcesso(usuarios, (atas.data?.itens ?? []).map((a) => ({ value: a.id, label: `${a.numero} — ${a.objeto.slice(0, 60)}` })), exercicio), [usuarios, atas.data, exercicio]);

  return (
    <>
      <CabecalhoPagina
        titulo="Processos de contratação"
        subtitulo={pode.gestor ? 'Processos relacionados aos seus contratos ou com tarefas atribuídas a você' : `Exercício ${exercicio}`}
        acoes={
          <>
            <div className="flex rounded-lg border border-borda bg-white p-0.5" role="group" aria-label="Modo de exibição">
              <button onClick={() => setModo('lista')} aria-pressed={modo === 'lista'} className={`flex min-h-10 items-center gap-1 rounded-md px-3 text-sm ${modo === 'lista' ? 'bg-azul-claro' : ''}`}>
                <List className="size-4" /> Lista
              </button>
              <button onClick={() => setModo('kanban')} aria-pressed={modo === 'kanban'} className={`flex min-h-10 items-center gap-1 rounded-md px-3 text-sm ${modo === 'kanban' ? 'bg-azul-claro' : ''}`}>
                <Columns3 className="size-4" /> Kanban
              </button>
            </div>
            {q.data?.itens.length ? (
              <Botao variante="secundario" pequeno icone={<Download className="size-4" />} onClick={() => exportarXlsx(
                q.data!.itens.map(p => ({
                  'Número': p.numeroInterno,
                  'NUP': p.nup ?? '',
                  'Objeto': p.objeto,
                  'Classificação': classificacao(p),
                  'Etapa': rotulo(ETAPAS, p.etapa),
                  'Situação': p.situacao,
                  'Valor estimado': p.valorEstimado,
                  'Conclusão prevista': p.dataConclusaoPrevista ?? '',
                  'Responsável': p.responsavel?.nome ?? '',
                })),
                'processos'
              )}>
                Exportar XLSX
              </Botao>
            ) : null}
            {pode.escrever && (
              <Botao icone={<Plus className="size-4" />} onClick={() => setCriar(true)}>
                Novo processo
              </Botao>
            )}
          </>
        }
      />
      {filtros.indicador && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          Filtro do painel: <Selo tom="info">{INDICADORES[filtros.indicador]}</Selo>
          <button className="text-acao hover:underline" onClick={() => set('indicador', '')}>
            limpar
          </button>
        </div>
      )}
      <BarraFiltros>
        <FiltroTexto valor={filtros.busca} aoMudar={(v) => set('busca', v)} placeholder="Objeto, NUP ou número" />
        <FiltroSelect rotulo="Etapa" valor={filtros.etapa} aoMudar={(v) => set('etapa', v)} opcoes={opcoes(ETAPAS)} todos="Todas" />
        <FiltroSelect rotulo="Situação" valor={filtros.situacao} aoMudar={(v) => set('situacao', v)} opcoes={opcoes(SITUACOES_PROCESSO)} todos="Todas" />
        <FiltroSelect rotulo="Forma" valor={filtros.forma} aoMudar={(v) => set('forma', v)} opcoes={opcoes(FORMAS)} todos="Todas" />
      </BarraFiltros>

      {q.isLoading ? (
        <Carregando />
      ) : q.isError ? (
        <ErroCarga erro={q.error} tentarNovamente={() => q.refetch()} />
      ) : modo === 'lista' ? (
        <Cartao>
          <Tabela
            rotulo="Processos"
            dados={q.data!.itens}
            chave={(p) => p.id}
            linkPara={(p) => `/processos/${p.id}`}
            vazio={<Vazio titulo="Nenhum processo encontrado" texto="Ajuste os filtros ou cadastre um novo processo." />}
            colunas={[
              {
                titulo: 'Processo', principal: true,
                render: (p) => (
                  <div>
                    <Link to={`/processos/${p.id}`} className="font-medium text-acao hover:underline">
                      {p.numeroInterno}
                    </Link>
                    <p className="line-clamp-2 text-xs text-tinta-suave">{p.objeto}</p>
                  </div>
                ),
              },
              { titulo: 'NUP', render: (p) => <span className="text-xs">{p.nup ?? '—'}</span>, ocultarMobile: true },
              { titulo: 'Classificação', render: (p) => <span className="text-xs">{classificacao(p)}</span> },
              { titulo: 'Etapa', render: (p) => rotulo(ETAPAS, p.etapa) },
              { titulo: 'Situação', render: (p) => <SeloSituacao p={p} /> },
              {
                titulo: 'Checklist',
                render: (p) => (
                  <div className="w-24" title={`${p.cumprimento.concluidos}/${p.cumprimento.aplicaveis} itens aplicáveis`}>
                    <div className="h-2 rounded-full bg-fundo">
                      <div className="h-2 rounded-full bg-acao" style={{ width: `${p.cumprimento.percentual}%` }} />
                    </div>
                    <span className="text-xs text-tinta-suave">{p.cumprimento.percentual}%</span>
                  </div>
                ),
              },
              { titulo: 'Conclusão prevista', render: (p) => data(p.dataConclusaoPrevista) },
              { titulo: 'Valor estimado', render: (p) => moeda(p.valorEstimado), alinhar: 'direita' },
            ]}
          />
          <Paginacao pagina={q.data!.pagina} paginas={q.data!.paginas} total={q.data!.total} aoMudar={(p) => set('pagina', String(p))} />
        </Cartao>
      ) : (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0" aria-label="Quadro Kanban por etapa">
          {ORDEM_ETAPAS.map((et) => {
            const doEt = q.data!.itens.filter((p) => p.etapa === et);
            return (
              <section key={et} className="w-72 shrink-0 snap-start rounded-xl border border-borda bg-white/70" aria-label={ETAPAS[et]}>
                <h2 className="flex items-center justify-between border-b border-borda px-3 py-2 text-sm font-semibold">
                  {ETAPAS[et]} <span className="rounded-full bg-fundo px-2 text-xs">{doEt.length}</span>
                </h2>
                <ul className="space-y-2 p-2">
                  {doEt.map((p) => (
                    <li key={p.id}>
                      <button onClick={() => navegar(`/processos/${p.id}`)} className="w-full rounded-lg border border-borda bg-white p-3 text-left hover:border-acao">
                        <p className="text-sm font-medium text-acao">{p.numeroInterno}</p>
                        <p className="line-clamp-2 text-xs text-tinta">{p.objeto}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <SeloSituacao p={p} />
                          <span className="text-xs text-tinta-suave">{p.cumprimento.percentual}% checklist</span>
                        </div>
                      </button>
                    </li>
                  ))}
                  {!doEt.length && <li className="p-3 text-center text-xs text-tinta-suave">Vazio</li>}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <FormularioModal
        aberto={criar}
        aoFechar={() => setCriar(false)}
        titulo="Novo processo"
        largo
        campos={campos}
        valoresIniciais={{ exercicio: String(exercicio), prioridade: 'MEDIA' }}
        rotuloEnviar="Criar processo"
        aviso={<p className="text-xs text-tinta-suave">O checklist é aplicado automaticamente conforme a forma de contratação (modelo versionado), podendo ser ajustado depois.</p>}
        aoEnviar={async (v) => {
          const p = await api.post<{ id: string }>('/processos', v);
          navegar(`/processos/${p.id}`);
        }}
      />
    </>
  );
}
