/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, ChevronRight, FileCheck2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { DocumentosPainel } from '@/components/DocumentosPainel';
import { Carregando, ErroCarga, useToast, Vazio } from '@/components/feedback';
import { Campo, FormularioModal } from '@/components/Formulario';
import { HistoricoPainel } from '@/components/HistoricoPainel';
import { Confirmacao, Modal } from '@/components/Modal';
import { Abas, Tabela } from '@/components/Tabela';
import { Aviso, Botao, CabecalhoPagina, Cartao, ListaDefinicao, Selo, Tom } from '@/components/ui';
import { api, Paginado } from '@/lib/api';
import { data, isoData, moeda, numero } from '@/lib/formato';
import { ESTADOS_CHECKLIST, ETAPAS, opcoes, ORDEM_ETAPAS, PRIORIDADES, rotulo, SITUACOES_CONTRATO, STATUS_RISCO, TIPOS_OBJETO } from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';
import { useExercicio } from '@/hooks/useExercicio';
import { useMutacao } from '@/hooks/useMutacao';
import { useUsuariosOpcoes } from '@/hooks/useOpcoes';
import { camposProcesso } from './processoCampos';
import { classificacao, SeloSituacao } from './ProcessosPage';

interface ItemChecklist {
  id: string;
  ordem: number;
  titulo: string;
  etapa: string;
  critico: boolean;
  exigeEvidencia: boolean;
  exigeRevisaoNA: boolean;
  referenciaNormativa?: string;
  estado: string;
  justificativaNA?: string;
  naRevisadoEm?: string;
  observacao?: string;
  responsavelId?: string;
  atribuidoGestorId?: string;
  prazo?: string;
  evidencias: number;
}

type Processo = any;

type Aba = 'resumo' | 'checklist' | 'itens' | 'financeiro' | 'riscos' | 'documentos' | 'historico';

const tomEstado = (e: string): Tom => (e === 'CONCLUIDO' ? 'ok' : e === 'NAO_APLICAVEL' ? 'neutro' : e === 'DEVOLVIDO' ? 'perigo' : e === 'EM_ANDAMENTO' ? 'info' : 'atencao');

export default function ProcessoDetalhePage() {
  const { id = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const aba = (sp.get('aba') as Aba) ?? 'resumo';
  const { pode } = useAuth();
  const { exercicio } = useExercicio();
  const toast = useToast();
  const usuarios = useUsuariosOpcoes();
  const chave = ['processo', id];
  const q = useQuery({ queryKey: chave, queryFn: () => api.get<Processo>(`/processos/${id}`) });
  const modelos = useQuery({ queryKey: ['modelos-checklist'], queryFn: () => api.get<Array<{ id: string; nome: string; versao: number; ativo: boolean; formaContratacao: string }>>('/processos/modelos-checklist'), enabled: pode.escrever });
  const atas = useQuery({ queryKey: ['atas', 'opcoes'], queryFn: () => api.get<Paginado<{ id: string; numero: string; objeto: string }>>('/atas?tamanho=200'), enabled: pode.escrever });

  const [editar, setEditar] = useState(false);
  const [retornar, setRetornar] = useState(false);
  const [situacao, setSituacao] = useState<string | null>(null);
  const [itemEditar, setItemEditar] = useState<ItemChecklist | null>(null);
  const [itemNA, setItemNA] = useState<ItemChecklist | null>(null);
  const [itemReabrir, setItemReabrir] = useState<{ item: ItemChecklist; estado: string } | null>(null);
  const [itemDevolver, setItemDevolver] = useState<ItemChecklist | null>(null);
  const [itemEvid, setItemEvid] = useState<ItemChecklist | null>(null);
  const [novoItem, setNovoItem] = useState(false);
  const [novoItemProc, setNovoItemProc] = useState(false);
  const [aplicar, setAplicar] = useState(false);

  const inv = [chave, ['processos']];
  const mudarEtapa = useMutacao((b: any) => api.post(`/processos/${id}/etapa`, b), { invalidar: inv, sucesso: 'Etapa atualizada' });
  const mudarSituacao = useMutacao((b: any) => api.post(`/processos/${id}/situacao`, b), { invalidar: inv, sucesso: 'Situação atualizada' });
  const atualizarItem = useMutacao(({ itemId, ...b }: { itemId: string } & Record<string, unknown>) => api.patch(`/processos/${id}/checklist/${itemId}`, b), { invalidar: [chave], sucesso: 'Checklist atualizado' });
  const revisarNa = useMutacao(({ itemId, ...b }: { itemId: string; aprovado: boolean; comentario?: string }) => api.post(`/processos/${id}/checklist/${itemId}/revisar-na`, b), { invalidar: [chave], sucesso: 'Revisão registrada' });
  const removerItemProc = useMutacao((itemId: string) => api.delete(`/processos/${id}/itens/${itemId}`), { invalidar: [chave], sucesso: 'Item removido' });

  const campos = useMemo(() => camposProcesso(usuarios, (atas.data?.itens ?? []).map((a) => ({ value: a.id, label: `${a.numero} — ${a.objeto.slice(0, 60)}` })), exercicio), [usuarios, atas.data, exercicio]);

  if (q.isLoading) return <Carregando linhas={6} />;
  if (q.isError) return <ErroCarga erro={q.error} tentarNovamente={() => q.refetch()} />;
  const p = q.data as Processo;
  const idx = ORDEM_ETAPAS.indexOf(p.etapa);
  const proxima = ORDEM_ETAPAS[idx + 1];
  const anterior = ORDEM_ETAPAS[idx - 1];
  const checklist: ItemChecklist[] = p.checklist;
  const setAba = (a: Aba) => setSp({ aba: a }, { replace: true });
  const nomeUsuario = (uid?: string) => usuarios.find((u) => u.value === uid)?.label.split(' (')[0] ?? (uid ? '—' : 'Não atribuído');

  const mudarEstado = (item: ItemChecklist, estado: string) => {
    if (estado === item.estado) return;
    if (estado === 'NAO_APLICAVEL') return setItemNA(item);
    if (estado === 'DEVOLVIDO') return setItemDevolver(item);
    if (item.estado === 'CONCLUIDO' || item.estado === 'NAO_APLICAVEL') return setItemReabrir({ item, estado });
    atualizarItem.mutate({ itemId: item.id, estado });
  };

  const abas: Array<{ chave: Aba; rotulo: string; contador?: number }> = [
    { chave: 'resumo', rotulo: 'Resumo' },
    { chave: 'checklist', rotulo: 'Etapas e checklist', contador: checklist.length },
    ...(p.somenteTarefasAtribuidas
      ? []
      : ([
          { chave: 'itens', rotulo: 'Itens', contador: p.itens.length },
          { chave: 'financeiro', rotulo: 'Financeiro' },
          { chave: 'riscos', rotulo: 'Riscos', contador: p.riscos?.length ?? 0 },
          { chave: 'documentos', rotulo: 'Documentos' },
          { chave: 'historico', rotulo: 'Histórico' },
        ] as Array<{ chave: Aba; rotulo: string; contador?: number }>)),
  ];

  return (
    <>
      <CabecalhoPagina
        voltar={{ to: '/processos', rotulo: 'Processos' }}
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            {p.numeroInterno} <SeloSituacao p={p} />
          </span>
        }
        subtitulo={
          <>
            {p.objeto}
            <br />
            {p.nup && <>NUP {p.nup} • </>}
            {classificacao(p)}
          </>
        }
        acoes={
          pode.escrever && (
            <>
              <Botao variante="secundario" icone={<Pencil className="size-4" />} onClick={() => setEditar(true)}>
                Editar
              </Botao>
              {p.situacao === 'ATIVO' ? (
                <>
                  <Botao variante="secundario" onClick={() => setSituacao('SUSPENSO')}>
                    Suspender
                  </Botao>
                  <Botao variante="secundario" onClick={() => setSituacao('CANCELADO')}>
                    Cancelar
                  </Botao>
                </>
              ) : (
                <Botao variante="secundario" onClick={() => setSituacao('ATIVO')}>
                  Reativar
                </Botao>
              )}
            </>
          )
        }
      />

      {/* Etapas */}
      <Cartao className="mb-4">
        <ol className="flex flex-wrap items-center gap-1 text-xs sm:text-sm" aria-label="Etapas do processo">
          {ORDEM_ETAPAS.map((e, i) => (
            <li key={e} className="flex items-center gap-1">
              <span
                aria-current={i === idx ? 'step' : undefined}
                className={clsx(
                  'flex items-center gap-1 rounded-full px-2.5 py-1',
                  i < idx && 'bg-ok-fundo text-ok',
                  i === idx && 'bg-acao font-semibold text-white',
                  i > idx && 'bg-fundo text-tinta-suave',
                )}
              >
                {i < idx && <Check className="size-3" aria-hidden />}
                {ETAPAS[e].split(' /')[0]}
              </span>
              {i < ORDEM_ETAPAS.length - 1 && <ChevronRight className="size-3 text-tinta-suave" aria-hidden />}
            </li>
          ))}
        </ol>
        {pode.escrever && p.situacao === 'ATIVO' && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {proxima && (
              <Botao onClick={() => mudarEtapa.mutate({ etapa: proxima })} carregando={mudarEtapa.isPending} disabled={p.bloqueiosEtapa.length > 0}>
                Concluir etapa e avançar para “{ETAPAS[proxima].split(' /')[0]}”
              </Botao>
            )}
            {anterior && (
              <Botao variante="secundario" icone={<RotateCcw className="size-4" />} onClick={() => setRetornar(true)}>
                Retornar etapa
              </Botao>
            )}
          </div>
        )}
        {p.bloqueiosEtapa.length > 0 && (
          <div className="mt-3">
            <Aviso tom="atencao" titulo="Itens críticos pendentes bloqueiam o avanço">
              <ul className="list-disc pl-4">
                {p.bloqueiosEtapa.map((b: string) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </Aviso>
          </div>
        )}
      </Cartao>

      <Abas abas={abas} ativa={aba} aoMudar={setAba} />

      {aba === 'resumo' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Cartao titulo="Dados do processo" className="lg:col-span-2">
            <ListaDefinicao
              itens={[
                ['Número interno', p.numeroInterno],
                ['NUP', p.nup],
                ['Exercício', p.exercicio],
                ['Tipo de objeto', rotulo(TIPOS_OBJETO, p.tipoObjeto)],
                ['Forma / modalidade / hipótese', classificacao(p)],
                ['Procedimento auxiliar', p.procedimentoAuxiliar],
                ['Fundamento legal', p.fundamentoLegal],
                ['Prioridade', rotulo(PRIORIDADES, p.prioridade)],
                ['Valor estimado', moeda(p.valorEstimado)],
                ['Setor requisitante', p.setorRequisitante],
                ['Origem da demanda', p.origemDemanda],
                ['Responsável', p.responsavel?.nome],
                ['Início previsto / real', `${data(p.dataInicioPrevista)} / ${data(p.dataInicioReal)}`],
                ['Conclusão prevista / real', `${data(p.dataConclusaoPrevista)} / ${data(p.dataConclusaoReal)}`],
                ['Ata vinculada', p.ata ? <Link className="text-acao hover:underline" to={`/atas/${p.ata.id}`}>{p.ata.numero}</Link> : '—'],
                ['Justificativa da situação', p.justificativaSituacao],
              ]}
            />
          </Cartao>
          <Cartao titulo="Cumprimento do checklist">
            <p className="tabular text-3xl font-semibold">{p.cumprimento.percentual}%</p>
            <p className="text-sm text-tinta-suave">
              {p.cumprimento.concluidos} de {p.cumprimento.aplicaveis} itens aplicáveis concluídos ({p.cumprimento.naoAplicaveis} não aplicáveis fora do cálculo)
            </p>
            <div className="mt-3 h-2 rounded-full bg-fundo">
              <div className="h-2 rounded-full bg-acao" style={{ width: `${p.cumprimento.percentual}%` }} />
            </div>
            <h3 className="mt-5 text-sm font-semibold">Instrumentos originados</h3>
            {p.contratos.length ? (
              <ul className="mt-1 space-y-1 text-sm">
                {p.contratos.map((c: any) => (
                  <li key={c.id}>
                    <Link className="text-acao hover:underline" to={`/contratos/${c.id}`}>
                      {c.numero}
                    </Link>{' '}
                    — {rotulo(SITUACOES_CONTRATO, c.situacao)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-tinta-suave">Nenhum. Encerrar o processo de contratação não encerra a execução contratual.</p>
            )}
          </Cartao>
        </div>
      )}

      {aba === 'checklist' && (
        <Cartao
          titulo="Checklist processual"
          acoes={
            pode.escrever && (
              <>
                <Botao pequeno variante="secundario" onClick={() => setAplicar(true)}>
                  Aplicar modelo
                </Botao>
                <Botao pequeno icone={<Plus className="size-4" />} onClick={() => setNovoItem(true)}>
                  Item
                </Botao>
              </>
            )
          }
        >
          {p.somenteTarefasAtribuidas && <div className="mb-3"><Aviso>Você vê apenas as tarefas expressamente atribuídas a você.</Aviso></div>}
          {!checklist.length ? (
            <Vazio titulo="Checklist vazio" texto="Aplique um modelo versionado conforme a forma de contratação." />
          ) : (
            ORDEM_ETAPAS.filter((e) => checklist.some((c) => c.etapa === e)).map((e) => (
              <div key={e} className="mb-5">
                <h3 className="mb-2 text-sm font-semibold text-tinta-suave">{ETAPAS[e]}</h3>
                <ul className="divide-y divide-borda rounded-lg border border-borda">
                  {checklist
                    .filter((c) => c.etapa === e)
                    .map((c) => (
                      <li key={c.id} className="flex flex-col gap-2 p-3 lg:flex-row lg:items-start">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {c.titulo} {c.critico && <Selo tom="atencao">Crítico</Selo>}
                          </p>
                          {c.referenciaNormativa && <p className="text-xs text-tinta-suave">Ref.: {c.referenciaNormativa}</p>}
                          <p className="text-xs text-tinta-suave">
                            Responsável: {nomeUsuario(c.responsavelId)} • Prazo: {data(c.prazo)}
                            {c.atribuidoGestorId && <> • Atribuído a gestor: {nomeUsuario(c.atribuidoGestorId)}</>}
                          </p>
                          {c.estado === 'NAO_APLICAVEL' && (
                            <p className="mt-1 text-xs">
                              Justificativa N/A: {c.justificativaNA}{' '}
                              {c.exigeRevisaoNA && (c.naRevisadoEm ? <Selo tom="ok">Revisado</Selo> : <Selo tom="atencao">Aguardando revisão</Selo>)}
                            </p>
                          )}
                          {c.observacao && <p className="mt-1 text-xs">Obs.: {c.observacao}</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Selo tom={tomEstado(c.estado)}>{ESTADOS_CHECKLIST[c.estado]}</Selo>
                          {(pode.escrever || c.atribuidoGestorId) && (
                            <>
                              <label className="sr-only" htmlFor={`estado-${c.id}`}>
                                Alterar estado de {c.titulo}
                              </label>
                              <select
                                id={`estado-${c.id}`}
                                value={c.estado}
                                onChange={(ev) => mudarEstado(c, ev.target.value)}
                                className="min-h-9 rounded-lg border border-borda bg-white px-2 text-sm"
                              >
                                {Object.entries(ESTADOS_CHECKLIST)
                                  .filter(([k]) => pode.escrever || ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO'].includes(k))
                                  .filter(([k]) => k !== 'DEVOLVIDO' || pode.gerir)
                                  .map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v}
                                    </option>
                                  ))}
                              </select>
                            </>
                          )}
                          <Botao pequeno variante="fantasma" icone={<FileCheck2 className="size-4" />} onClick={() => setItemEvid(c)}>
                            Evidências ({c.evidencias}){c.exigeEvidencia && '*'}
                          </Botao>
                          {pode.escrever && (
                            <Botao pequeno variante="fantasma" onClick={() => setItemEditar(c)} aria-label={`Atribuir ${c.titulo}`}>
                              Atribuir
                            </Botao>
                          )}
                          {pode.gerir && c.estado === 'NAO_APLICAVEL' && c.exigeRevisaoNA && !c.naRevisadoEm && (
                            <>
                              <Botao pequeno onClick={() => revisarNa.mutate({ itemId: c.id, aprovado: true })}>
                                Aceitar N/A
                              </Botao>
                              <Botao pequeno variante="secundario" onClick={() => revisarNa.mutate({ itemId: c.id, aprovado: false, comentario: 'Não aplicabilidade não aceita na revisão' })}>
                                Devolver
                              </Botao>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            ))
          )}
          <p className="text-xs text-tinta-suave">* exige evidência anexada para conclusão. Anexar arquivo não presume a validade do documento.</p>
        </Cartao>
      )}

      {aba === 'itens' && (
        <Cartao
          titulo="Itens do processo"
          acoes={
            pode.escrever && (
              <>
                <Link to={`/consultas?processoId=${id}`} className="inline-flex min-h-9 items-center rounded-lg border border-borda px-3 text-sm hover:bg-fundo">
                  Buscar no CATMAT/CATSER
                </Link>
                <Botao pequeno icone={<Plus className="size-4" />} onClick={() => setNovoItemProc(true)}>
                  Item
                </Botao>
              </>
            )
          }
        >
          <Tabela
            rotulo="Itens"
            dados={p.itens}
            chave={(i: any) => i.id}
            vazio={<Vazio titulo="Nenhum item" />}
            colunas={[
              { titulo: 'Nº', render: (i: any) => i.numero },
              { titulo: 'Descrição', principal: true, render: (i: any) => i.descricao },
              { titulo: 'Catálogo', render: (i: any) => (i.codigoCatalogo ? `${i.tipoCatalogo} ${i.codigoCatalogo}` : '—') },
              { titulo: 'Qtd.', render: (i: any) => `${numero(i.quantidade)} ${i.unidadeMedida}`, alinhar: 'direita' },
              { titulo: 'Unitário est.', render: (i: any) => moeda(i.valorUnitarioEstimado), alinhar: 'direita' },
              {
                titulo: '',
                render: (i: any) =>
                  pode.escrever && (
                    <button onClick={() => removerItemProc.mutate(i.id)} className="rounded p-1 text-perigo hover:bg-perigo-fundo" aria-label="Remover item">
                      <Trash2 className="size-4" />
                    </button>
                  ),
              },
            ]}
          />
          <p className="mt-2 text-xs text-tinta-suave">Código de catálogo não substitui a especificação do objeto nem a pesquisa de preços.</p>
        </Cartao>
      )}

      {aba === 'financeiro' && (
        <Cartao titulo="Alocações orçamentárias vinculadas">
          <Tabela
            rotulo="Alocações"
            dados={p.alocacoes ?? []}
            chave={(a: any) => a.id}
            vazio={<Vazio titulo="Nenhuma alocação" texto="Registre alocações no módulo Financeiro." />}
            colunas={[
              { titulo: 'Aprovada em', render: (a: any) => data(a.aprovadaEm), principal: true },
              { titulo: 'Exercício', render: (a: any) => a.exercicio },
              { titulo: 'Documento', render: (a: any) => a.documento ?? '—' },
              { titulo: 'Valor', render: (a: any) => moeda(a.valor), alinhar: 'direita' },
            ]}
          />
          <p className="mt-3 text-xs text-tinta-suave">
            Empenhos vinculados e “demanda a empenhar” aparecem em <Link className="text-acao hover:underline" to="/financeiro?aba=demanda">Financeiro</Link>.
          </p>
        </Cartao>
      )}

      {aba === 'riscos' && (
        <Cartao titulo="Riscos do processo" acoes={<Link to={`/riscos?novo=1&processoId=${id}`} className="text-sm text-acao hover:underline">Registrar risco</Link>}>
          <Tabela
            rotulo="Riscos"
            dados={p.riscos ?? []}
            chave={(r: any) => r.id}
            linkPara={(r: any) => `/riscos/${r.id}`}
            vazio={<Vazio titulo="Nenhum risco registrado" />}
            colunas={[
              { titulo: 'Evento', principal: true, render: (r: any) => r.evento },
              { titulo: 'P × I', render: (r: any) => `${r.probabilidade} × ${r.impacto} = ${r.probabilidade * r.impacto}` },
              { titulo: 'Status', render: (r: any) => rotulo(STATUS_RISCO, r.status) },
            ]}
          />
        </Cartao>
      )}

      {aba === 'documentos' && (
        <Cartao>
          <DocumentosPainel vinculoTipo="PROCESSO" vinculoId={id} podeEnviar={pode.escrever} />
        </Cartao>
      )}

      {aba === 'historico' && (
        <Cartao titulo="Histórico">
          <HistoricoPainel caminho={`/processos/${id}/historico`} />
        </Cartao>
      )}

      {/* Diálogos */}
      <FormularioModal
        aberto={editar}
        aoFechar={() => setEditar(false)}
        titulo="Editar processo"
        largo
        campos={campos}
        valoresIniciais={{
          ...Object.fromEntries(campos.map((c) => [c.nome, p[c.nome] === null || p[c.nome] === undefined ? '' : String(p[c.nome])])),
          dataInicioPrevista: isoData(p.dataInicioPrevista),
          dataConclusaoPrevista: isoData(p.dataConclusaoPrevista),
          valorEstimado: String(p.valorEstimado ?? ''),
        }}
        aoEnviar={async (v) => {
          await api.patch(`/processos/${id}`, v);
          await q.refetch();
          toast.sucesso('Processo atualizado');
        }}
      />
      <Confirmacao
        aberto={retornar}
        aoFechar={() => setRetornar(false)}
        titulo="Retornar etapa"
        texto={`O processo voltará para “${anterior ? ETAPAS[anterior] : ''}”. O retorno fica registrado no histórico.`}
        pedirMotivo
        rotuloConfirmar="Retornar"
        aoConfirmar={(motivo) => mudarEtapa.mutate({ etapa: anterior!, motivo }, { onSuccess: () => setRetornar(false) })}
      />
      <Confirmacao
        aberto={!!situacao}
        aoFechar={() => setSituacao(null)}
        titulo={situacao === 'ATIVO' ? 'Reativar processo' : situacao === 'SUSPENSO' ? 'Suspender processo' : 'Cancelar processo'}
        texto="Informe a justificativa. A alteração de situação é registrada na trilha de auditoria."
        pedirMotivo
        perigo={situacao === 'CANCELADO'}
        aoConfirmar={(justificativa) => mudarSituacao.mutate({ situacao: situacao!, justificativa }, { onSuccess: () => setSituacao(null) })}
      />
      <Confirmacao
        aberto={!!itemReabrir}
        aoFechar={() => setItemReabrir(null)}
        titulo="Reabrir item do checklist"
        texto={`Reabrir “${itemReabrir?.item.titulo}” exige motivo e fica no histórico.`}
        pedirMotivo
        aoConfirmar={(motivoReabertura) =>
          atualizarItem.mutate({ itemId: itemReabrir!.item.id, estado: itemReabrir!.estado, motivoReabertura }, { onSuccess: () => setItemReabrir(null) })
        }
      />
      <FormularioModal
        aberto={!!itemNA}
        aoFechar={() => setItemNA(null)}
        titulo="Marcar como não aplicável"
        campos={[{ nome: 'justificativaNA', rotulo: 'Justificativa', tipo: 'textarea', obrigatorio: true, minimo: 10, ajuda: 'Itens N/A saem do cálculo de cumprimento e podem exigir revisão do chefe.' }]}
        aoEnviar={async (v) => {
          await api.patch(`/processos/${id}/checklist/${itemNA!.id}`, {
            estado: 'NAO_APLICAVEL',
            justificativaNA: v.justificativaNA,
            ...(itemNA!.estado === 'CONCLUIDO' ? { motivoReabertura: `Alterado para N/A: ${v.justificativaNA}` } : {}),
          });
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={!!itemDevolver}
        aoFechar={() => setItemDevolver(null)}
        titulo="Devolver item"
        campos={[{ nome: 'observacao', rotulo: 'Observação da revisão', tipo: 'textarea', obrigatorio: true, minimo: 5 }]}
        aoEnviar={async (v) => {
          await api.patch(`/processos/${id}/checklist/${itemDevolver!.id}`, {
            estado: 'DEVOLVIDO',
            observacao: v.observacao,
            ...(['CONCLUIDO', 'NAO_APLICAVEL'].includes(itemDevolver!.estado) ? { motivoReabertura: String(v.observacao) } : {}),
          });
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={!!itemEditar}
        aoFechar={() => setItemEditar(null)}
        titulo="Atribuir item"
        campos={[
          { nome: 'responsavelId', rotulo: 'Responsável (secretaria)', tipo: 'select', opcoes: usuarios },
          { nome: 'atribuidoGestorId', rotulo: 'Atribuir expressamente a gestor/fiscal (opcional)', tipo: 'select', opcoes: usuarios },
          { nome: 'prazo', rotulo: 'Prazo', tipo: 'data', meia: true },
          { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
        ]}
        valoresIniciais={{ responsavelId: itemEditar?.responsavelId ?? '', atribuidoGestorId: itemEditar?.atribuidoGestorId ?? '', prazo: isoData(itemEditar?.prazo), observacao: itemEditar?.observacao ?? '' }}
        aoEnviar={async (v) => {
          await api.patch(`/processos/${id}/checklist/${itemEditar!.id}`, v);
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={novoItem}
        aoFechar={() => setNovoItem(false)}
        titulo="Novo item de checklist"
        campos={[
          { nome: 'titulo', rotulo: 'Título', obrigatorio: true },
          { nome: 'etapa', rotulo: 'Etapa', tipo: 'select', opcoes: opcoes(ETAPAS), obrigatorio: true },
          { nome: 'referenciaNormativa', rotulo: 'Referência normativa' },
          { nome: 'critico', rotulo: 'Crítico (bloqueia a conclusão da etapa)', tipo: 'checkbox' },
          { nome: 'exigeEvidencia', rotulo: 'Exige evidência anexada', tipo: 'checkbox' },
        ]}
        aoEnviar={async (v) => {
          await api.post(`/processos/${id}/checklist`, v);
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={novoItemProc}
        aoFechar={() => setNovoItemProc(false)}
        titulo="Novo item do processo"
        campos={
          [
            { nome: 'descricao', rotulo: 'Especificação', tipo: 'textarea', obrigatorio: true },
            { nome: 'unidadeMedida', rotulo: 'Unidade de medida', obrigatorio: true, meia: true },
            { nome: 'quantidade', rotulo: 'Quantidade', tipo: 'quantidade', obrigatorio: true, meia: true },
            { nome: 'valorUnitarioEstimado', rotulo: 'Valor unitário estimado (R$)', tipo: 'dinheiro', meia: true },
          ] as Campo[]
        }
        aoEnviar={async (v) => {
          await api.post(`/processos/${id}/itens`, v);
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={aplicar}
        aoFechar={() => setAplicar(false)}
        titulo="Aplicar modelo de checklist"
        campos={[
          {
            nome: 'modeloId', rotulo: 'Modelo (versão ativa)', tipo: 'select', obrigatorio: true,
            opcoes: (modelos.data ?? []).filter((m) => m.ativo).map((m) => ({ value: m.id, label: `${m.nome} — v${m.versao}` })),
            ajuda: 'Apenas itens ainda não presentes são adicionados.',
          },
        ]}
        aoEnviar={async (v) => {
          await api.post(`/processos/${id}/checklist/aplicar-modelo`, v);
          await q.refetch();
        }}
      />
      <Modal
        aberto={!!itemEvid}
        aoFechar={() => {
          setItemEvid(null);
          q.refetch();
        }}
        titulo={`Evidências — ${itemEvid?.titulo ?? ''}`} largo>
        {itemEvid && (
          <DocumentosPainel
            vinculoTipo="CHECKLIST_ITEM"
            vinculoId={itemEvid.id}
            titulo="Arquivos de evidência"
            categoriaPadrao="EVIDENCIA"
            podeEnviar={pode.escrever || itemEvid.atribuidoGestorId !== undefined}
          />
        )}
      </Modal>
    </>
  );
}
