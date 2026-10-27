import { useQuery } from '@tanstack/react-query';
import { Download, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Carregando, ErroCarga, Vazio } from '@/components/feedback';
import { Campo, FormularioModal } from '@/components/Formulario';
import { Abas, Tabela } from '@/components/Tabela';
import { Aviso, Botao, CabecalhoPagina, Cartao, Indicador, Selo } from '@/components/ui';
import { api } from '@/lib/api';
import { exportarXlsx } from '@/lib/exportar';
import { data, dataHora, moeda } from '@/lib/formato';
import { useAuth } from '@/hooks/useAuth';
import { useExercicio } from '@/hooks/useExercicio';
import { useFornecedoresOpcoes, useProcessosOpcoes, useContratosOpcoes } from '@/hooks/useOpcoes';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Aba = 'resumo' | 'creditos' | 'empenhos' | 'demanda' | 'rap';

export default function FinanceiroPage() {
  const { exercicio } = useExercicio();
  const { pode } = useAuth();
  const [sp, setSp] = useSearchParams();
  const aba = (sp.get('aba') as Aba) ?? 'resumo';
  const resumo = useQuery({ queryKey: ['financeiro', 'resumo', exercicio], queryFn: () => api.get<any>(`/financeiro/resumo?exercicio=${exercicio}`) });
  const empenhos = useQuery({ queryKey: ['financeiro', 'empenhos', exercicio], queryFn: () => api.get<any[]>(`/financeiro/empenhos?exercicio=${exercicio}`), enabled: aba === 'empenhos' });
  const alocacoes = useQuery({ queryKey: ['financeiro', 'alocacoes', exercicio], queryFn: () => api.get<any[]>(`/financeiro/alocacoes?exercicio=${exercicio}`), enabled: aba === 'demanda' });
  const fornecedores = useFornecedoresOpcoes();
  const processos = useProcessosOpcoes();
  const contratos = useContratosOpcoes();
  const demandasAprov = useQuery({ queryKey: ['demandas', 'aprovadas', exercicio], queryFn: () => api.get<any>(`/planejamento/demandas?exercicio=${exercicio}&status=APROVADA&tamanho=200`), enabled: aba === 'demanda' && pode.escrever });
  const [modal, setModal] = useState<null | 'credito' | 'movCredito' | 'empenho' | 'alocacao' | 'conciliar'>(null);
  const [alvo, setAlvo] = useState<any>(null);

  const recarregar = async () => {
    await Promise.all([resumo.refetch(), empenhos.refetch(), alocacoes.refetch()]);
  };
  const creditosOpc = (resumo.data?.creditos ?? []).map((c: any) => ({
    value: c.creditoId,
    label: `PTRES ${c.classificacao.ptres} • FR ${c.classificacao.fonte} • ND ${c.classificacao.naturezaDespesa}${c.classificacao.planoInterno ? ` • PI ${c.classificacao.planoInterno}` : ''} — disponível ${moeda(c.disponivelParaEmpenhar)}`,
  }));

  const t = resumo.data?.totais;
  return (
    <>
      <CabecalhoPagina
        titulo="Financeiro"
        subtitulo={`Acompanhamento gerencial do exercício ${exercicio} — conciliável com as fontes oficiais; não emite atos no SIAFI.`}
        acoes={
          <>
            {aba === 'empenhos' && empenhos.data?.length ? (
              <Botao variante="secundario" pequeno icone={<Download className="size-4" />} onClick={() => exportarXlsx(
                empenhos.data!.map((e: any) => ({
                  'Número': e.numero,
                  'Fornecedor': e.fornecedor?.razaoSocial ?? '',
                  'Emissão': e.dataEmissao,
                  'Empenhado líq.': e.saldos.empenhadoLiquido,
                  'A liquidar': e.saldos.aLiquidar,
                  'Liquidado a pagar': e.saldos.liquidadoAPagar,
                  'Pago': e.saldos.pagoLiquido,
                })),
                'empenhos'
              )}>
                Exportar XLSX
              </Botao>
            ) : null}
            {pode.escrever && (
              <>
                <Botao variante="secundario" icone={<Plus className="size-4" />} onClick={() => setModal('credito')}>
                  Crédito
                </Botao>
                <Botao icone={<Plus className="size-4" />} onClick={() => setModal('empenho')}>
                  Empenho
                </Botao>
              </>
            )}
          </>
        }
      />
      <Abas
        abas={[
          { chave: 'resumo', rotulo: 'Resumo' },
          { chave: 'creditos', rotulo: 'Créditos' },
          { chave: 'empenhos', rotulo: 'Empenhos' },
          { chave: 'demanda', rotulo: 'Demanda a empenhar' },
          { chave: 'rap', rotulo: 'Restos a pagar' },
        ]}
        ativa={aba}
        aoMudar={(a) => setSp({ aba: a })}
      />
      {resumo.isLoading ? (
        <Carregando linhas={5} />
      ) : resumo.isError ? (
        <ErroCarga erro={resumo.error} tentarNovamente={() => resumo.refetch()} />
      ) : (
        <>
          {aba === 'resumo' && (
            <>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Indicador rotulo="Crédito atualizado" valor={moeda(t.creditoAtualizado)} detalhe="Inicial + acréscimos − reduções" />
                <Indicador rotulo="Crédito disponível para empenhar" valor={moeda(t.disponivelParaEmpenhar)} detalhe="Crédito atualizado − empenhado líquido" />
                <Indicador rotulo="Empenhado líquido" valor={moeda(t.empenhadoLiquido)} detalhe="Emissão + reforços − anulações" />
                <Indicador rotulo="Empenhado a liquidar" valor={moeda(t.empenhadoALiquidar)} detalhe="Empenhado líquido − liquidado líquido" />
                <Indicador rotulo="Liquidado líquido" valor={moeda(t.liquidadoLiquido)} detalhe="Liquidações − estornos" />
                <Indicador rotulo="Liquidado a pagar" valor={moeda(t.liquidadoAPagar)} detalhe="Liquidado líquido − pago líquido" />
                <Indicador rotulo="Pago líquido" valor={moeda(t.pagoLiquido)} detalhe="Pagamentos − estornos" />
                <Indicador rotulo="Demanda a empenhar" valor={moeda(t.demandaAEmpenhar)} detalhe="Necessidade aprovada sem empenho vinculado (não é crédito)" to="/financeiro?aba=demanda" />
              </div>
              <Cartao titulo="Execução por classificação orçamentária">
                {!resumo.data.creditos.length ? (
                  <Vazio titulo="Nenhum crédito cadastrado no exercício" />
                ) : (
                  <div className="h-72" role="img" aria-label="Gráfico de execução por crédito">
                    <ResponsiveContainer>
                      <BarChart data={resumo.data.creditos.map((c: any) => ({ nome: `ND ${c.classificacao.naturezaDespesa}`, Crédito: Number(c.creditoAtualizado), Empenhado: Number(c.empenhadoLiquido), Liquidado: Number(c.liquidadoLiquido), Pago: Number(c.pagoLiquido) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#DFE8F0" />
                        <XAxis dataKey="nome" tick={{ fontSize: 12, fill: '#4a6680' }} />
                        <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 12, fill: '#4a6680' }} width={45} />
                        <Tooltip formatter={(v) => moeda(Number(v))} />
                        <Legend />
                        <Bar dataKey="Crédito" fill="#D9ECFA" stroke="#246A9E" />
                        <Bar dataKey="Empenhado" fill="#246A9E" />
                        <Bar dataKey="Liquidado" fill="#163A59" />
                        <Bar dataKey="Pago" fill="#16794A" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="mt-2 text-xs text-tinta-suave">{resumo.data.observacao}</p>
              </Cartao>
            </>
          )}

          {aba === 'creditos' && (
            <Cartao titulo="Créditos / dotações">
              <Tabela
                rotulo="Créditos"
                dados={resumo.data.creditos}
                chave={(c: any) => c.creditoId}
                vazio={<Vazio titulo="Nenhum crédito" />}
                colunas={[
                  {
                    titulo: 'Classificação', principal: true,
                    render: (c: any) => (
                      <div>
                        <p className="font-medium">
                          ND {c.classificacao.naturezaDespesa} • PTRES {c.classificacao.ptres}
                        </p>
                        <p className="text-xs text-tinta-suave">
                          Fonte {c.classificacao.fonte}
                          {c.classificacao.planoInterno && ` • PI ${c.classificacao.planoInterno}`} {c.descricao && `• ${c.descricao}`}
                        </p>
                      </div>
                    ),
                  },
                  { titulo: 'Crédito atualizado', render: (c: any) => moeda(c.creditoAtualizado), alinhar: 'direita' },
                  { titulo: 'Empenhado líquido', render: (c: any) => moeda(c.empenhadoLiquido), alinhar: 'direita' },
                  { titulo: 'Disponível', render: (c: any) => <span className="font-semibold">{moeda(c.disponivelParaEmpenhar)}</span>, alinhar: 'direita' },
                  { titulo: 'Conciliação', render: (c: any) => (c.ultimaConciliacao ? <span className="text-xs">{dataHora(c.ultimaConciliacao)}<br />{c.fonteConciliacao}</span> : <Selo tom="atencao">Não conciliado</Selo>) },
                  {
                    titulo: '',
                    render: (c: any) =>
                      pode.escrever && (
                        <div className="flex flex-wrap gap-1">
                          <Botao pequeno variante="secundario" onClick={() => { setAlvo(c); setModal('movCredito'); }}>
                            Movimentar
                          </Botao>
                          <Botao pequeno variante="fantasma" onClick={() => { setAlvo({ tipo: 'creditos', id: c.creditoId }); setModal('conciliar'); }}>
                            Conciliar
                          </Botao>
                        </div>
                      ),
                  },
                ]}
              />
            </Cartao>
          )}

          {aba === 'empenhos' && (
            <Cartao titulo="Empenhos do exercício">
              {empenhos.isLoading ? (
                <Carregando />
              ) : (
                <Tabela
                  rotulo="Empenhos"
                  dados={empenhos.data ?? []}
                  chave={(e: any) => e.id}
                  linkPara={(e: any) => `/financeiro/empenhos/${e.id}`}
                  vazio={<Vazio titulo="Nenhum empenho" />}
                  colunas={[
                    { titulo: 'Empenho', principal: true, render: (e: any) => <Link to={`/financeiro/empenhos/${e.id}`} className="font-medium text-acao hover:underline">{e.numero}</Link> },
                    { titulo: 'Fornecedor', render: (e: any) => <span className="text-xs">{e.fornecedor?.razaoSocial}</span> },
                    { titulo: 'Emissão', render: (e: any) => data(e.dataEmissao) },
                    { titulo: 'Empenhado líq.', render: (e: any) => moeda(e.saldos.empenhadoLiquido), alinhar: 'direita' },
                    { titulo: 'A liquidar', render: (e: any) => moeda(e.saldos.aLiquidar), alinhar: 'direita' },
                    { titulo: 'Liquidado a pagar', render: (e: any) => moeda(e.saldos.liquidadoAPagar), alinhar: 'direita' },
                    { titulo: 'Pago', render: (e: any) => moeda(e.saldos.pagoLiquido), alinhar: 'direita' },
                    { titulo: 'RAP', render: (e: any) => (e.inscritoEmRap ? <Selo tom="info">Inscrito</Selo> : '—') },
                  ]}
                />
              )}
            </Cartao>
          )}

          {aba === 'demanda' && (
            <div className="space-y-4">
              <Aviso>“Demanda a empenhar” é a necessidade aprovada/alocada ainda não coberta por empenhos vinculados ao processo — é exibida separadamente do crédito disponível e não é saldo orçamentário.</Aviso>
              <Cartao titulo="Demanda a empenhar" acoes={pode.escrever && <Botao pequeno icone={<Plus className="size-4" />} onClick={() => setModal('alocacao')}>Alocação</Botao>}>
                <Tabela
                  rotulo="Demanda a empenhar"
                  dados={resumo.data.demandaAEmpenhar}
                  chave={(d: any) => d.descricao + d.processoId}
                  vazio={<Vazio titulo="Nenhuma alocação aprovada" />}
                  colunas={[
                    { titulo: 'Processo / demanda', principal: true, render: (d: any) => (d.processoId ? <Link to={`/processos/${d.processoId}`} className="text-acao hover:underline">{d.descricao}</Link> : d.descricao) },
                    { titulo: 'Alocado', render: (d: any) => moeda(d.alocado), alinhar: 'direita' },
                    { titulo: 'Empenhado vinculado', render: (d: any) => moeda(d.empenhadoVinculado), alinhar: 'direita' },
                    { titulo: 'A empenhar', render: (d: any) => <span className="font-semibold">{moeda(d.aEmpenhar)}</span>, alinhar: 'direita' },
                  ]}
                />
              </Cartao>
              <Cartao titulo="Alocações registradas">
                <Tabela
                  rotulo="Alocações"
                  dados={alocacoes.data ?? []}
                  chave={(a: any) => a.id}
                  vazio={<Vazio titulo="Nenhuma alocação" />}
                  colunas={[
                    { titulo: 'Vínculo', principal: true, render: (a: any) => a.processo?.numeroInterno ?? a.demanda?.titulo ?? '—' },
                    { titulo: 'Aprovada em', render: (a: any) => data(a.aprovadaEm) },
                    { titulo: 'Documento', render: (a: any) => a.documento ?? '—' },
                    { titulo: 'Valor', render: (a: any) => moeda(a.valor), alinhar: 'direita' },
                  ]}
                />
              </Cartao>
            </div>
          )}

          {aba === 'rap' && (
            <div className="space-y-4">
              <Aviso>Restos a pagar existem somente com inscrição própria registrada ao encerramento do exercício. Empenho não pago do exercício corrente não é RAP. A classificação original (processado/não processado) não é reescrita.</Aviso>
              <div className="grid gap-3 sm:grid-cols-2">
                {(['processados', 'naoProcessados'] as const).map((k) => {
                  const r = resumo.data.restosAPagar[k];
                  return (
                    <Cartao key={k} titulo={k === 'processados' ? 'RAP processados' : 'RAP não processados'}>
                      <dl className="grid grid-cols-2 gap-2 text-sm">
                        <dt className="text-tinta-suave">Inscrições</dt>
                        <dd className="tabular text-right">{r.inscricoes}</dd>
                        <dt className="text-tinta-suave">Saldo de abertura</dt>
                        <dd className="tabular text-right">{moeda(r.abertura)}</dd>
                        <dt className="text-tinta-suave">Pago</dt>
                        <dd className="tabular text-right">{moeda(r.pago)}</dd>
                        <dt className="text-tinta-suave">Cancelado</dt>
                        <dd className="tabular text-right">{moeda(r.cancelado)}</dd>
                        <dt className="font-medium">Saldo</dt>
                        <dd className="tabular text-right font-semibold">{moeda(r.saldo)}</dd>
                      </dl>
                    </Cartao>
                  );
                })}
              </div>
              <p className="text-sm text-tinta-suave">A inscrição é feita no detalhe de cada empenho (perfil chefe/administrador).</p>
            </div>
          )}
        </>
      )}

      <FormularioModal
        aberto={modal === 'credito'}
        aoFechar={() => setModal(null)}
        titulo="Novo crédito / dotação"
        largo
        campos={
          [
            { nome: 'exercicio', rotulo: 'Exercício do crédito', tipo: 'numero', obrigatorio: true, min: 2000, max: 2100, meia: true },
            { nome: 'naturezaDespesa', rotulo: 'Natureza de despesa', obrigatorio: true, meia: true, placeholder: '339030' },
            { nome: 'ptres', rotulo: 'PTRES', obrigatorio: true, meia: true },
            { nome: 'fonte', rotulo: 'Fonte de recursos', obrigatorio: true, meia: true },
            { nome: 'planoInterno', rotulo: 'Plano interno', meia: true },
            { nome: 'ugr', rotulo: 'UGR', meia: true },
            { nome: 'descricao', rotulo: 'Descrição' },
            { nome: 'valorInicial', rotulo: 'Crédito inicial (R$)', tipo: 'dinheiro', obrigatorio: true, meia: true },
            { nome: 'dataMovimento', rotulo: 'Data do movimento', tipo: 'data', obrigatorio: true, meia: true },
            { nome: 'documento', rotulo: 'Documento (ex.: NC nº)', obrigatorio: true },
          ] as Campo[]
        }
        valoresIniciais={{ exercicio: String(exercicio) }}
        aoEnviar={async (v) => {
          await api.post('/financeiro/creditos', v);
          await recarregar();
        }}
      />
      <FormularioModal
        aberto={modal === 'movCredito'}
        aoFechar={() => setModal(null)}
        titulo="Movimentação de crédito"
        campos={[
          { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: [{ value: 'ACRESCIMO', label: 'Acréscimo' }, { value: 'REDUCAO', label: 'Redução' }] },
          { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'dinheiro', obrigatorio: true, meia: true },
          { nome: 'dataMovimento', rotulo: 'Data', tipo: 'data', obrigatorio: true, meia: true },
          { nome: 'documento', rotulo: 'Documento', obrigatorio: true },
          { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
        ]}
        aoEnviar={async (v) => {
          await api.post(`/financeiro/creditos/${alvo.creditoId}/movimentos`, v);
          await recarregar();
        }}
      />
      <FormularioModal
        aberto={modal === 'empenho'}
        aoFechar={() => setModal(null)}
        titulo="Registrar empenho"
        largo
        aviso={<p className="text-xs text-tinta-suave">Registro gerencial de nota de empenho já emitida no sistema oficial. O valor não pode exceder o crédito disponível.</p>}
        campos={[
          { nome: 'numero', rotulo: 'Número da NE', obrigatorio: true, meia: true, placeholder: `${exercicio}NE000000` },
          { nome: 'dataEmissao', rotulo: 'Data de emissão', tipo: 'data', obrigatorio: true, meia: true },
          { nome: 'creditoId', rotulo: 'Crédito', tipo: 'select', opcoes: creditosOpc, obrigatorio: true },
          { nome: 'fornecedorId', rotulo: 'Fornecedor/credor', tipo: 'select', opcoes: fornecedores, obrigatorio: true },
          { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'dinheiro', obrigatorio: true, meia: true },
          { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', meia: true, opcoes: [{ value: 'ORDINARIO', label: 'Ordinário' }, { value: 'ESTIMATIVO', label: 'Estimativo' }, { value: 'GLOBAL', label: 'Global' }] },
          { nome: 'processoId', rotulo: 'Processo vinculado', tipo: 'select', opcoes: processos },
          { nome: 'contratoId', rotulo: 'Ratear integralmente ao contrato (opcional)', tipo: 'select', opcoes: contratos },
          { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea' },
        ]}
        aoEnviar={async (v) => {
          await api.post('/financeiro/empenhos', v);
          await recarregar();
        }}
      />
      <FormularioModal
        aberto={modal === 'alocacao'}
        aoFechar={() => setModal(null)}
        titulo="Alocação orçamentária"
        campos={[
          { nome: 'demandaId', rotulo: 'Demanda aprovada', tipo: 'select', opcoes: (demandasAprov.data?.itens ?? []).map((d: any) => ({ value: d.id, label: d.titulo })) },
          { nome: 'processoId', rotulo: 'Processo', tipo: 'select', opcoes: processos },
          { nome: 'creditoId', rotulo: 'Crédito de referência', tipo: 'select', opcoes: creditosOpc },
          { nome: 'exercicio', rotulo: 'Exercício', tipo: 'numero', obrigatorio: true, min: 2000, max: 2100, meia: true },
          { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'dinheiro', obrigatorio: true, meia: true },
          { nome: 'aprovadaEm', rotulo: 'Aprovada em', tipo: 'data', obrigatorio: true, meia: true },
          { nome: 'documento', rotulo: 'Documento', meia: true },
        ]}
        valoresIniciais={{ exercicio: String(exercicio) }}
        aoEnviar={async (v) => {
          await api.post('/financeiro/alocacoes', v);
          await recarregar();
        }}
      />
      <FormularioModal
        aberto={modal === 'conciliar'}
        aoFechar={() => setModal(null)}
        titulo="Registrar conciliação"
        campos={[{ nome: 'fonte', rotulo: 'Fonte oficial conferida', obrigatorio: true, placeholder: 'Ex.: Tesouro Gerencial — relatório X' }]}
        aoEnviar={async (v) => {
          await api.post(`/financeiro/${alvo.tipo}/${alvo.id}/conciliacao`, v);
          await recarregar();
        }}
      />
    </>
  );
}
