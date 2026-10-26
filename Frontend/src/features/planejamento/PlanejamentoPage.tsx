import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Carregando, ErroCarga, mensagemErro, useToast, Vazio } from '@/components/feedback';
import { Campo, FormularioModal } from '@/components/Formulario';
import { Modal } from '@/components/Modal';
import { Abas, BarraFiltros, FiltroSelect, FiltroTexto, Paginacao, Tabela } from '@/components/Tabela';
import { Aviso, Botao, CabecalhoPagina, Cartao, Selo } from '@/components/ui';
import { api, Paginado, qs } from '@/lib/api';
import { data, dataHora, moeda, normalizarValor } from '@/lib/formato';
import { opcoes, PRIORIDADES, rotulo, STATUS_DEMANDA } from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';
import { useExercicio } from '@/hooks/useExercicio';
import { useMutacao } from '@/hooks/useMutacao';

interface Demanda {
  id: string;
  titulo: string;
  descricao: string;
  setorRequisitante: string;
  prioridade: string;
  status: string;
  valorEstimado: string;
  valorAlocado: string;
  numeroDfd?: string;
  itemPca?: string;
  dataNecessidade?: string;
  processo?: { id: string; numeroInterno: string };
}

interface Proposta {
  id: string;
  exercicio: number;
  titulo: string;
  versoes: Array<{ id: string; versao: number; status: string; total: string; criadoEm: string; observacao?: string; itens: Array<{ descricao: string; naturezaDespesa: string; valor: string }> }>;
}

export default function PlanejamentoPage() {
  const [sp, setSp] = useSearchParams();
  const aba = (sp.get('aba') as 'demandas' | 'propostas') ?? 'demandas';
  return (
    <>
      <CabecalhoPagina titulo="Planejamento" subtitulo="Demandas (DFD), vínculo ao PCA quando aplicável e proposta orçamentária versionada" />
      <Abas
        abas={[
          { chave: 'demandas', rotulo: 'Demandas' },
          { chave: 'propostas', rotulo: 'Proposta orçamentária' },
        ]}
        ativa={aba}
        aoMudar={(a) => setSp({ aba: a })}
      />
      {aba === 'demandas' ? <Demandas /> : <Propostas />}
    </>
  );
}

const camposDemanda: Campo[] = [
  { nome: 'titulo', rotulo: 'Título', obrigatorio: true },
  { nome: 'descricao', rotulo: 'Descrição da necessidade', tipo: 'textarea', obrigatorio: true },
  { nome: 'setorRequisitante', rotulo: 'Setor requisitante', obrigatorio: true, meia: true },
  { nome: 'exercicio', rotulo: 'Exercício', tipo: 'numero', obrigatorio: true, min: 2000, max: 2100, meia: true },
  { nome: 'prioridade', rotulo: 'Prioridade', tipo: 'select', opcoes: opcoes(PRIORIDADES), meia: true },
  { nome: 'valorEstimado', rotulo: 'Valor estimado (R$)', tipo: 'dinheiro', meia: true },
  { nome: 'numeroDfd', rotulo: 'Número do DFD', meia: true },
  { nome: 'itemPca', rotulo: 'Item do PCA (quando aplicável)', meia: true },
  { nome: 'dataNecessidade', rotulo: 'Data da necessidade', tipo: 'data', meia: true },
];

function Demandas() {
  const { pode } = useAuth();
  const { exercicio } = useExercicio();
  const navegar = useNavigate();
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [pagina, setPagina] = useState(1);
  const [criar, setCriar] = useState(false);
  const [editar, setEditar] = useState<Demanda | null>(null);
  const [processoDe, setProcessoDe] = useState<Demanda | null>(null);
  const q = useQuery({ queryKey: ['demandas', exercicio, busca, status, pagina], queryFn: () => api.get<Paginado<Demanda>>(`/planejamento/demandas${qs({ exercicio, busca, status, pagina })}`) });
  const mudarStatus = useMutacao((b: { id: string; status: string }) => api.post(`/planejamento/demandas/${b.id}/status`, { status: b.status }), { invalidar: [['demandas']], sucesso: 'Status atualizado' });

  return (
    <>
      <BarraFiltros>
        <FiltroTexto valor={busca} aoMudar={(v) => { setBusca(v); setPagina(1); }} placeholder="Título ou setor" />
        <FiltroSelect rotulo="Status" valor={status} aoMudar={(v) => { setStatus(v); setPagina(1); }} opcoes={opcoes(STATUS_DEMANDA)} />
        {pode.escrever && (
          <Botao className="sm:ml-auto" icone={<Plus className="size-4" />} onClick={() => setCriar(true)}>
            Nova demanda
          </Botao>
        )}
      </BarraFiltros>
      <Cartao>
        {q.isLoading ? (
          <Carregando />
        ) : q.isError ? (
          <ErroCarga erro={q.error} />
        ) : (
          <>
            <Tabela
              rotulo="Demandas"
              dados={q.data!.itens}
              chave={(d) => d.id}
              vazio={<Vazio titulo="Nenhuma demanda no exercício" />}
              colunas={[
                {
                  titulo: 'Demanda', principal: true,
                  render: (d) => (
                    <div>
                      <button className="text-left font-medium text-acao hover:underline" onClick={() => pode.escrever && setEditar(d)}>
                        {d.titulo}
                      </button>
                      <p className="text-xs text-tinta-suave">
                        {d.setorRequisitante}
                        {d.numeroDfd && ` • ${d.numeroDfd}`}
                        {d.itemPca && ` • PCA ${d.itemPca}`}
                      </p>
                    </div>
                  ),
                },
                { titulo: 'Prioridade', render: (d) => rotulo(PRIORIDADES, d.prioridade) },
                { titulo: 'Necessidade', render: (d) => data(d.dataNecessidade) },
                { titulo: 'Status', render: (d) => <Selo tom={d.status === 'APROVADA' || d.status === 'ATENDIDA' ? 'ok' : d.status === 'REJEITADA' ? 'perigo' : 'neutro'}>{rotulo(STATUS_DEMANDA, d.status)}</Selo> },
                { titulo: 'Estimado', render: (d) => moeda(d.valorEstimado), alinhar: 'direita' },
                { titulo: 'Alocado', render: (d) => moeda(d.valorAlocado), alinhar: 'direita' },
                {
                  titulo: 'Processo',
                  render: (d) =>
                    d.processo ? (
                      <Link to={`/processos/${d.processo.id}`} className="text-acao hover:underline">
                        {d.processo.numeroInterno}
                      </Link>
                    ) : pode.escrever && d.status === 'APROVADA' ? (
                      <Botao pequeno variante="secundario" onClick={() => setProcessoDe(d)}>
                        Iniciar processo
                      </Botao>
                    ) : (
                      '—'
                    ),
                },
                {
                  titulo: 'Ações',
                  render: (d) =>
                    pode.escrever && (
                      <select
                        aria-label={`Alterar status de ${d.titulo}`}
                        value=""
                        onChange={(e) => e.target.value && mudarStatus.mutate({ id: d.id, status: e.target.value })}
                        className="min-h-9 rounded-lg border border-borda bg-white px-2 text-sm"
                      >
                        <option value="">Mudar status…</option>
                        {Object.entries(STATUS_DEMANDA)
                          .filter(([k]) => k !== d.status && (pode.gerir || !['APROVADA', 'REJEITADA'].includes(k)))
                          .map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                      </select>
                    ),
                },
              ]}
            />
            <Paginacao pagina={q.data!.pagina} paginas={q.data!.paginas} total={q.data!.total} aoMudar={setPagina} />
          </>
        )}
      </Cartao>
      <FormularioModal
        aberto={criar}
        aoFechar={() => setCriar(false)}
        titulo="Nova demanda"
        largo
        campos={camposDemanda}
        valoresIniciais={{ exercicio: String(exercicio), prioridade: 'MEDIA' }}
        aoEnviar={async (v) => {
          await api.post('/planejamento/demandas', v);
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={!!editar}
        aoFechar={() => setEditar(null)}
        titulo="Editar demanda"
        largo
        campos={camposDemanda}
        valoresIniciais={
          editar
            ? {
                titulo: editar.titulo, descricao: editar.descricao, setorRequisitante: editar.setorRequisitante, exercicio: String(exercicio),
                prioridade: editar.prioridade, valorEstimado: editar.valorEstimado, numeroDfd: editar.numeroDfd ?? '', itemPca: editar.itemPca ?? '',
                dataNecessidade: editar.dataNecessidade?.slice(0, 10) ?? '',
              }
            : undefined
        }
        aoEnviar={async (v) => {
          await api.patch(`/planejamento/demandas/${editar!.id}`, v);
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={!!processoDe}
        aoFechar={() => setProcessoDe(null)}
        titulo="Iniciar processo a partir da demanda"
        campos={[
          { nome: 'formaContratacao', rotulo: 'Forma de contratação', tipo: 'select', obrigatorio: true, opcoes: [{ value: 'LICITACAO', label: 'Licitação' }, { value: 'CONTRATACAO_DIRETA', label: 'Contratação direta' }] },
          { nome: 'modalidade', rotulo: 'Modalidade', tipo: 'select', opcoes: [{ value: 'PREGAO', label: 'Pregão' }, { value: 'CONCORRENCIA', label: 'Concorrência' }], visivel: (v) => v.formaContratacao === 'LICITACAO' },
          { nome: 'hipoteseDireta', rotulo: 'Hipótese', tipo: 'select', opcoes: [{ value: 'DISPENSA', label: 'Dispensa' }, { value: 'INEXIGIBILIDADE', label: 'Inexigibilidade' }], visivel: (v) => v.formaContratacao === 'CONTRATACAO_DIRETA' },
          { nome: 'tipoObjeto', rotulo: 'Tipo de objeto', tipo: 'select', obrigatorio: true, opcoes: [{ value: 'MATERIAL', label: 'Material' }, { value: 'SERVICO', label: 'Serviço' }, { value: 'SERVICO_CONTINUO', label: 'Serviço contínuo' }, { value: 'OUTRO', label: 'Outro' }] },
        ]}
        aoEnviar={async (v) => {
          const p = await api.post<{ id: string }>('/processos', {
            ...v, exercicio, objeto: processoDe!.titulo, setorRequisitante: processoDe!.setorRequisitante, valorEstimado: processoDe!.valorEstimado,
            origemDemanda: processoDe!.numeroDfd ?? 'Demanda', demandaId: processoDe!.id, prioridade: processoDe!.prioridade,
          });
          navegar(`/processos/${p.id}`);
        }}
      />
    </>
  );
}

function Propostas() {
  const { pode } = useAuth();
  const { exercicio } = useExercicio();
  const toast = useToast();
  const q = useQuery({ queryKey: ['propostas'], queryFn: () => api.get<Proposta[]>('/planejamento/propostas') });
  const [criar, setCriar] = useState(false);
  const [versaoDe, setVersaoDe] = useState<Proposta | null>(null);
  const [itens, setItens] = useState<Array<{ descricao: string; naturezaDespesa: string; valor: string }>>([]);
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const enviada = useMutacao((b: { p: string; v: string }) => api.post(`/planejamento/propostas/${b.p}/versoes/${b.v}/enviada`), { invalidar: [['propostas']], sucesso: 'Versão marcada como enviada' });

  const abrirVersao = (p: Proposta) => {
    setVersaoDe(p);
    setItens(p.versoes[0]?.itens.map((i) => ({ ...i })) ?? [{ descricao: '', naturezaDespesa: '', valor: '' }]);
    setObs('');
    setErro(null);
  };
  const salvarVersao = async () => {
    try {
      await api.post(`/planejamento/propostas/${versaoDe!.id}/versoes`, { itens: itens.map((i) => ({ ...i, valor: normalizarValor(i.valor) })), observacao: obs || undefined });
      setVersaoDe(null);
      await q.refetch();
      toast.sucesso('Nova versão registrada');
    } catch (e) {
      setErro(mensagemErro(e));
    }
  };

  if (q.isLoading) return <Carregando />;
  if (q.isError) return <ErroCarga erro={q.error} />;
  return (
    <>
      <div className="mb-3 flex justify-end">
        {pode.escrever && (
          <Botao icone={<Plus className="size-4" />} onClick={() => setCriar(true)}>
            Nova proposta
          </Botao>
        )}
      </div>
      {!q.data!.length ? (
        <Cartao>
          <Vazio titulo="Nenhuma proposta orçamentária" texto="Cada alteração gera uma nova versão; versões anteriores ficam preservadas." />
        </Cartao>
      ) : (
        <div className="space-y-4">
          {q.data!.map((p) => (
            <Cartao
              key={p.id}
              titulo={`${p.titulo} — exercício ${p.exercicio}`}
              acoes={
                pode.escrever && (
                  <Botao pequeno onClick={() => abrirVersao(p)}>
                    Nova versão
                  </Botao>
                )
              }
            >
              {!p.versoes.length ? (
                <Vazio titulo="Sem versões" />
              ) : (
                <Tabela
                  rotulo="Versões"
                  dados={p.versoes}
                  chave={(v) => v.id}
                  colunas={[
                    { titulo: 'Versão', principal: true, render: (v) => `v${v.versao}` },
                    { titulo: 'Status', render: (v) => <Selo tom={v.status === 'ENVIADA' ? 'ok' : v.status === 'SUBSTITUIDA' ? 'neutro' : 'info'}>{v.status === 'RASCUNHO' ? 'Rascunho' : v.status === 'ENVIADA' ? 'Enviada' : 'Substituída'}</Selo> },
                    { titulo: 'Itens', render: (v) => v.itens.length },
                    { titulo: 'Criada em', render: (v) => dataHora(v.criadoEm) },
                    { titulo: 'Total', render: (v) => moeda(v.total), alinhar: 'direita' },
                    {
                      titulo: '',
                      render: (v) =>
                        pode.gerir && v.status === 'RASCUNHO' && (
                          <Botao pequeno variante="secundario" onClick={() => enviada.mutate({ p: p.id, v: v.id })}>
                            Marcar enviada
                          </Botao>
                        ),
                    },
                  ]}
                />
              )}
            </Cartao>
          ))}
        </div>
      )}
      <FormularioModal
        aberto={criar}
        aoFechar={() => setCriar(false)}
        titulo="Nova proposta orçamentária"
        campos={[
          { nome: 'titulo', rotulo: 'Título', obrigatorio: true },
          { nome: 'exercicio', rotulo: 'Exercício', tipo: 'numero', obrigatorio: true, min: 2000, max: 2100 },
        ]}
        valoresIniciais={{ exercicio: String(exercicio + 1) }}
        aoEnviar={async (v) => {
          await api.post('/planejamento/propostas', v);
          await q.refetch();
        }}
      />
      <Modal
        aberto={!!versaoDe}
        aoFechar={() => setVersaoDe(null)}
        titulo={`Nova versão — ${versaoDe?.titulo ?? ''}`}
        largo
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setVersaoDe(null)}>
              Cancelar
            </Botao>
            <Botao onClick={salvarVersao}>Registrar versão</Botao>
          </>
        }
      >
        <div className="space-y-3">
          {erro && <Aviso tom="perigo">{erro}</Aviso>}
          {itens.map((i, n) => (
            <div key={n} className="grid grid-cols-1 gap-2 rounded-lg border border-borda p-2 sm:grid-cols-[1fr_8rem_9rem_auto]">
              <input aria-label="Descrição" placeholder="Descrição" value={i.descricao} onChange={(e) => setItens(itens.map((x, k) => (k === n ? { ...x, descricao: e.target.value } : x)))} className="min-h-10 rounded border border-borda px-2" />
              <input aria-label="Natureza de despesa" placeholder="ND (ex.: 339030)" value={i.naturezaDespesa} onChange={(e) => setItens(itens.map((x, k) => (k === n ? { ...x, naturezaDespesa: e.target.value } : x)))} className="min-h-10 rounded border border-borda px-2" />
              <input aria-label="Valor" placeholder="Valor (R$)" inputMode="decimal" value={i.valor} onChange={(e) => setItens(itens.map((x, k) => (k === n ? { ...x, valor: e.target.value } : x)))} className="tabular min-h-10 rounded border border-borda px-2" />
              <button onClick={() => setItens(itens.filter((_, k) => k !== n))} className="rounded p-2 text-perigo hover:bg-perigo-fundo" aria-label="Remover linha">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <Botao pequeno variante="secundario" icone={<Plus className="size-4" />} onClick={() => setItens([...itens, { descricao: '', naturezaDespesa: '', valor: '' }])}>
            Linha
          </Botao>
          <label className="block text-sm font-medium">
            Observação
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-borda p-2" />
          </label>
        </div>
      </Modal>
    </>
  );
}
