import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, ClipboardCheck, FileClock, Info, Truck, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Carregando, ErroCarga, Vazio } from '@/components/feedback';
import { Modal } from '@/components/Modal';
import { CabecalhoPagina, Cartao, Indicador, Selo, Tom } from '@/components/ui';
import { api } from '@/lib/api';
import { data, dataHora, diasTexto, moeda } from '@/lib/formato';
import { ETAPAS, FUNCOES, NIVEIS_RISCO, PERFIS, rotulo, TIPOS_EVENTO } from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';
import { useExercicio } from '@/hooks/useExercicio';

interface Alerta {
  regra: string;
  descricaoRegra: string;
  nivel: 'INFO' | 'ATENCAO' | 'CRITICO';
  titulo: string;
  dados: Record<string, unknown>;
  link: string;
}
interface EventoAgenda {
  id: string;
  titulo: string;
  tipo: string;
  start: string;
  allDay: boolean;
  automatico: boolean;
  link?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Painel = any;

const CURTO: Record<string, string> = { A_INICIAR: 'A iniciar', PLANEJAMENTO: 'Planejamento', INSTRUCAO: 'Instrução', ANALISE: 'Análise', SELECAO_FORNECEDOR: 'Seleção', FORMALIZACAO: 'Formalização', FINALIZADO: 'Finalizado' };

const tomNivel = (n: string): Tom => (n === 'CRITICO' ? 'perigo' : n === 'ATENCAO' ? 'atencao' : 'info');
const tomDias = (d: number): Tom => (d <= 15 ? 'perigo' : d <= 30 ? 'atencao' : 'info');

export default function DashboardPage() {
  const { exercicio } = useExercicio();
  const { perfil, me } = useAuth();
  const q = useQuery({ queryKey: ['dashboard', exercicio], queryFn: () => api.get<Painel>(`/dashboard?exercicio=${exercicio}`) });
  const [alertaAberto, setAlertaAberto] = useState<Alerta | null>(null);

  if (q.isLoading) return <Carregando linhas={6} />;
  if (q.isError) return <ErroCarga erro={q.error} tentarNovamente={() => q.refetch()} />;
  const d = q.data as Painel;
  const gestor = perfil === 'GESTOR';

  return (
    <>
      <CabecalhoPagina
        titulo={gestor ? 'Minha carteira' : perfil === 'COMANDANTE' ? 'Painel executivo' : 'Visão geral'}
        subtitulo={`${me?.unidadeAtual?.nome} • exercício ${exercicio} • ${perfil ? PERFIS[perfil] : ''}`}
      />

      {!gestor && d.financeiro && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador rotulo="Crédito disponível para empenhar" valor={moeda(d.financeiro.disponivelParaEmpenhar)} detalhe={`de ${moeda(d.financeiro.creditoAtualizado)} de crédito atualizado`} to="/financeiro" icone={<Wallet className="size-5" />} />
            <Indicador rotulo="Empenhado líquido" valor={moeda(d.financeiro.empenhadoLiquido)} detalhe={`Empenhado a liquidar: ${moeda(d.financeiro.empenhadoALiquidar)}`} to="/financeiro" />
            <Indicador rotulo="Liquidado a pagar" valor={moeda(d.financeiro.liquidadoAPagar)} detalhe={`Pago líquido: ${moeda(d.financeiro.pagoLiquido)}`} to="/financeiro" />
            <Indicador rotulo="Demanda a empenhar" valor={moeda(d.financeiro.demandaAEmpenhar)} detalhe="Necessidade aprovada sem empenho vinculado" to="/financeiro?aba=demanda" />
          </div>
          <p className="-mt-2 mb-4 text-xs text-tinta-suave">
            Valores gerenciais conciliáveis com as fontes oficiais. Última conciliação registrada: {d.ultimaConciliacao ? dataHora(d.ultimaConciliacao) : 'nenhuma'}.
          </p>
        </>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!gestor && d.processos ? (
          <>
            <Indicador rotulo="Processos a iniciar" valor={d.processos.aIniciar} detalhe={d.processos.definicoes.a_iniciar} to="/processos?indicador=a_iniciar" icone={<FileClock className="size-5" />} />
            <Indicador rotulo="Processos iniciados" valor={d.processos.iniciados} detalhe={d.processos.definicoes.iniciados} to="/processos?indicador=iniciados" icone={<ClipboardCheck className="size-5" />} />
            <Indicador rotulo="Finalizados" valor={d.processos.finalizados} detalhe={d.processos.definicoes.finalizados} to="/processos?indicador=finalizados" />
            <Indicador rotulo="Atrasados" valor={d.processos.atrasados} tom={d.processos.atrasados ? 'perigo' : undefined} detalhe={d.processos.definicoes.atrasados} to="/processos?indicador=atrasados" />
          </>
        ) : (
          <>
            <Indicador rotulo="Contratos atribuídos" valor={d.carteira?.length ?? 0} to="/contratos" />
            <Indicador rotulo="Notas aguardando atesto" valor={d.notasAguardandoAtesto ?? 0} tom={d.notasAguardandoAtesto ? 'atencao' : undefined} to="/contratos" />
            <Indicador rotulo="Minhas solicitações abertas" valor={d.solicitacoesAbertas ?? 0} to="/solicitacoes?filtro=minhas" />
            <Indicador rotulo="Tarefas atribuídas" valor={d.tarefas?.length ?? 0} to="/processos" />
          </>
        )}
      </div>

      <div className={`mb-4 grid grid-cols-2 gap-3 ${perfil === 'CHEFE' || perfil === 'AUXILIAR' || perfil === 'ADMIN' ? 'lg:grid-cols-5' : gestor ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
        <Indicador rotulo="Alertas críticos" valor={d.totalAlertas.CRITICO} tom={d.totalAlertas.CRITICO ? 'perigo' : undefined} icone={<AlertTriangle className="size-5" />} />
        {!gestor && <Indicador rotulo="Riscos críticos" valor={d.riscosCriticos?.total ?? 0} tom={d.riscosCriticos?.total ? 'perigo' : undefined} to="/riscos?nivel=critico" />}
        <Indicador rotulo="Entregas em atraso" valor={d.entregasAtrasadas} tom={d.entregasAtrasadas ? 'atencao' : undefined} icone={<Truck className="size-5" />} to="/contratos" />
        <Indicador rotulo="Contratos vencendo (90 dias)" valor={d.contratosVencendo.length} to="/contratos?vencendoEmDias=90" icone={<CalendarClock className="size-5" />} />
        {perfil === 'CHEFE' || perfil === 'AUXILIAR' || perfil === 'ADMIN' ? (
          <Indicador rotulo="Solicitações a triar" valor={d.solicitacoesAbertas ?? 0} to="/solicitacoes?filtro=abertas" />
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Cartao titulo="Alertas" className="xl:col-span-2" acoes={<span className="text-xs text-tinta-suave">Clique para ver a regra e os dados</span>}>
          {!d.alertas.length ? (
            <Vazio titulo="Nenhum alerta ativo" />
          ) : (
            <ul className="divide-y divide-borda">
              {(d.alertas as Alerta[]).slice(0, 12).map((a, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 py-2">
                  <Selo tom={tomNivel(a.nivel)}>{a.nivel === 'CRITICO' ? 'Crítico' : a.nivel === 'ATENCAO' ? 'Atenção' : 'Info'}</Selo>
                  <Link to={a.link} className="min-w-0 flex-1 text-sm font-medium text-tinta hover:text-acao hover:underline">
                    {a.titulo}
                  </Link>
                  <button onClick={() => setAlertaAberto(a)} className="rounded p-1 text-tinta-suave hover:bg-fundo" aria-label={`Por que este alerta: ${a.titulo}`}>
                    <Info className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao titulo="Próximos eventos" acoes={<Link to="/calendario" className="text-sm text-acao hover:underline">Calendário</Link>}>
          {!d.proximosEventos.length ? (
            <Vazio titulo="Sem eventos nas próximas 3 semanas" />
          ) : (
            <ul className="space-y-2">
              {(d.proximosEventos as EventoAgenda[]).map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="tabular w-20 shrink-0 text-xs font-medium text-acao">{e.allDay ? data(e.start) : dataHora(e.start)}</span>
                  <span className="min-w-0 text-sm">
                    {e.link ? (
                      <Link to={e.link} className="hover:underline">
                        {e.titulo}
                      </Link>
                    ) : (
                      e.titulo
                    )}
                    <span className="block text-xs text-tinta-suave">
                      {rotulo(TIPOS_EVENTO, e.tipo)}
                      {e.automatico && ' • marco automático'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        {!gestor && d.processos && (
          <Cartao titulo="Processos ativos por etapa" className="xl:col-span-2">
            {d.processos.porEtapa.length ? (
              <div className="h-64" role="img" aria-label={`Gráfico: ${d.processos.porEtapa.map((e: { etapa: string; total: number }) => `${ETAPAS[e.etapa]} ${e.total}`).join(', ')}`}>
                <ResponsiveContainer>
                  <BarChart data={d.processos.porEtapa.map((e: { etapa: string; total: number }) => ({ etapa: CURTO[e.etapa] ?? e.etapa, total: e.total }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DFE8F0" />
                    <XAxis dataKey="etapa" tick={{ fontSize: 12, fill: '#4a6680' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#4a6680' }} width={30} />
                    <Tooltip />
                    <Bar dataKey="total" name="Processos" fill="#246A9E" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Vazio titulo="Nenhum processo ativo no exercício" />
            )}
          </Cartao>
        )}

        <Cartao titulo="Contratos próximos do vencimento">
          {!d.contratosVencendo.length ? (
            <Vazio titulo="Nenhum vencimento em 90 dias" />
          ) : (
            <ul className="space-y-2">
              {d.contratosVencendo.map((c: { id: string; numero: string; objeto: string; vigenciaFim: string; dias: number }) => (
                <li key={c.id} className="flex items-start justify-between gap-2">
                  <Link to={`/contratos/${c.id}`} className="min-w-0 text-sm hover:underline">
                    <span className="font-medium">{c.numero}</span>
                    <span className="block truncate text-xs text-tinta-suave">{c.objeto}</span>
                  </Link>
                  <Selo tom={tomDias(c.dias)}>{diasTexto(c.dias)}</Selo>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        {!gestor && d.atasVencendo && (
          <Cartao titulo="Atas próximas do vencimento">
            {!d.atasVencendo.length ? (
              <Vazio titulo="Nenhuma ata vencendo em 90 dias" />
            ) : (
              <ul className="space-y-2">
                {d.atasVencendo.map((a: { id: string; numero: string; objeto: string; dias: number }) => (
                  <li key={a.id} className="flex items-start justify-between gap-2">
                    <Link to={`/atas/${a.id}`} className="min-w-0 text-sm hover:underline">
                      <span className="font-medium">{a.numero}</span>
                      <span className="block truncate text-xs text-tinta-suave">{a.objeto}</span>
                    </Link>
                    <Selo tom={tomDias(a.dias)}>{diasTexto(a.dias)}</Selo>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        )}

        {!gestor && d.riscosCriticos && (
          <Cartao titulo="Riscos críticos" acoes={<Link to="/riscos" className="text-sm text-acao hover:underline">Ver todos</Link>}>
            {!d.riscosCriticos.itens.length ? (
              <Vazio titulo="Nenhum risco crítico" />
            ) : (
              <ul className="space-y-2">
                {d.riscosCriticos.itens.map((r: { id: string; evento: string; score: number; nivel: string }) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <Link to={`/riscos/${r.id}`} className="min-w-0 truncate text-sm hover:underline">
                      {r.evento}
                    </Link>
                    <Selo tom="perigo">
                      {NIVEIS_RISCO[r.nivel]} • {r.score}
                    </Selo>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        )}

        {d.minhasTarefas && (
          <Cartao titulo="Minhas tarefas de checklist" className="xl:col-span-2">
            {!d.minhasTarefas.length ? (
              <Vazio titulo="Nenhuma tarefa pendente" />
            ) : (
              <ul className="divide-y divide-borda">
                {d.minhasTarefas.map((t: { id: string; titulo: string; prazo?: string; critico: boolean; processo: { id: string; numeroInterno: string } }) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <Link to={`/processos/${t.processo.id}?aba=checklist`} className="min-w-0 flex-1 hover:underline">
                      <span className="font-medium">{t.processo.numeroInterno}</span> — {t.titulo}
                    </Link>
                    {t.critico && <Selo tom="atencao">Crítico</Selo>}
                    <span className="text-xs text-tinta-suave">{t.prazo ? `prazo ${data(t.prazo)}` : 'sem prazo'}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-tinta-suave">
              N/A aguardando revisão: {d.naRevisao} • Designações pendentes de documento: {d.designacoesPendentes}
            </p>
          </Cartao>
        )}

        {gestor && (
          <Cartao titulo="Contratos atribuídos" className="xl:col-span-3">
            {!d.carteira?.length ? (
              <Vazio titulo="Nenhum contrato atribuído" texto="Contratos aparecem aqui após a indicação/designação pela secretaria." />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {d.carteira.map((c: { id: string; numero: string; objeto: string; vigenciaFim: string; dias: number; funcoes: Array<{ funcao: string; status: string }> }) => (
                  <li key={c.id}>
                    <Link to={`/contratos/${c.id}`} className="block h-full rounded-xl border border-borda p-3 hover:border-acao hover:bg-azul-claro-2/40">
                      <p className="font-medium">{c.numero}</p>
                      <p className="line-clamp-2 text-sm text-tinta-suave">{c.objeto}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Selo tom={tomDias(c.dias)}>{diasTexto(c.dias)}</Selo>
                        {c.funcoes.map((f) => (
                          <Selo key={f.funcao} tom={f.status === 'ATIVA' ? 'ok' : 'atencao'}>
                            {FUNCOES[f.funcao]}
                            {f.status !== 'ATIVA' && ' (pendente)'}
                          </Selo>
                        ))}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        )}
      </div>

      <Modal aberto={!!alertaAberto} aoFechar={() => setAlertaAberto(null)} titulo="Por que este alerta?">
        {alertaAberto && (
          <div className="space-y-3 text-sm">
            <p className="font-medium">{alertaAberto.titulo}</p>
            <div>
              <p className="text-xs font-medium uppercase text-tinta-suave">Regra</p>
              <p>
                <code className="rounded bg-fundo px-1">{alertaAberto.regra}</code> — {alertaAberto.descricaoRegra}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-tinta-suave">Dados que acionaram</p>
              <dl className="mt-1 grid grid-cols-2 gap-1">
                {Object.entries(alertaAberto.dados).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-tinta-suave">{k}</dt>
                    <dd className="tabular">{String(v ?? '—')}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <Link to={alertaAberto.link} className="inline-block font-medium text-acao hover:underline" onClick={() => setAlertaAberto(null)}>
              Abrir registro →
            </Link>
          </div>
        )}
      </Modal>
    </>
  );
}
