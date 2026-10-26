import { useQuery } from '@tanstack/react-query';
import { Plus, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Carregando, ErroCarga, Vazio } from '@/components/feedback';
import { FormularioModal } from '@/components/Formulario';
import { DocumentosPainel } from '@/components/DocumentosPainel';
import { Tabela } from '@/components/Tabela';
import { Aviso, Botao, CabecalhoPagina, Cartao, Indicador, ListaDefinicao, Selo } from '@/components/ui';
import { api } from '@/lib/api';
import { data, dataHora, hojeISO, moeda } from '@/lib/formato';
import { rotulo, TIPOS_MOV_EMPENHO, TIPOS_MOV_RAP } from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';
import { useContratosOpcoes } from '@/hooks/useOpcoes';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function EmpenhoDetalhePage() {
  const { id = '' } = useParams();
  const { pode } = useAuth();
  const q = useQuery({ queryKey: ['empenho', id], queryFn: () => api.get<any>(`/financeiro/empenhos/${id}`) });
  const contratos = useContratosOpcoes();
  const [mov, setMov] = useState(false);
  const [estornar, setEstornar] = useState<any>(null);
  const [rateio, setRateio] = useState(false);
  const [rap, setRap] = useState(false);
  const [movRap, setMovRap] = useState<any>(null);
  const [conc, setConc] = useState(false);
  const notas = useQuery({
    queryKey: ['empenho', id, 'notas'],
    queryFn: async () => {
      const e = q.data;
      const listas = await Promise.all((e?.rateios ?? []).map((r: any) => api.get<any>(`/financeiro/contratos/${r.contratoId}`)));
      return listas.flatMap((l: any) => l.notas.filter((n: any) => n.status === 'ATESTADA').map((n: any) => ({ value: n.id, label: `${l.contrato.numero} — NF ${n.numero} (${moeda(n.valor)}; liquidado ${moeda(n.liquidado)})` })));
    },
    enabled: !!q.data && mov,
  });

  if (q.isLoading) return <Carregando linhas={6} />;
  if (q.isError) return <ErroCarga erro={q.error} tentarNovamente={() => q.refetch()} />;
  const e = q.data;
  const inscrito = e.inscricoes.length > 0;
  const estornados = new Set(e.movimentos.filter((m: any) => m.estornoDeId).map((m: any) => m.estornoDeId));

  return (
    <>
      <CabecalhoPagina
        voltar={{ to: '/financeiro?aba=empenhos', rotulo: 'Empenhos' }}
        titulo={`Empenho ${e.numero}`}
        subtitulo={`${e.fornecedor?.razaoSocial ?? ''} • exercício ${e.exercicio} • emissão ${data(e.dataEmissao)}`}
        acoes={
          pode.escrever && (
            <>
              {!inscrito && (
                <Botao icone={<Plus className="size-4" />} onClick={() => setMov(true)}>
                  Movimento
                </Botao>
              )}
              <Botao variante="secundario" onClick={() => setRateio(true)}>
                Rateio a contrato
              </Botao>
              <Botao variante="secundario" onClick={() => setConc(true)}>
                Registrar conciliação
              </Botao>
              {pode.gerir && !inscrito && (
                <Botao variante="secundario" onClick={() => setRap(true)}>
                  Inscrever em RAP
                </Botao>
              )}
            </>
          )
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Indicador rotulo="Empenhado líquido" valor={moeda(e.saldos.empenhadoLiquido)} />
        <Indicador rotulo="Empenhado a liquidar" valor={moeda(e.saldos.aLiquidar)} />
        <Indicador rotulo="Liquidado líquido" valor={moeda(e.saldos.liquidadoLiquido)} />
        <Indicador rotulo="Liquidado a pagar" valor={moeda(e.saldos.liquidadoAPagar)} />
        <Indicador rotulo="Pago líquido" valor={moeda(e.saldos.pagoLiquido)} />
      </div>
      {inscrito && (
        <div className="mb-4">
          <Aviso tom="info">Empenho inscrito em restos a pagar: novos movimentos são registrados nas inscrições abaixo.</Aviso>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Cartao titulo="Lançamentos (ledger — somente inserção)" className="lg:col-span-2">
          <Tabela
            rotulo="Movimentos do empenho"
            dados={e.movimentos}
            chave={(m: any) => m.id}
            colunas={[
              { titulo: 'Data', render: (m: any) => data(m.dataMovimento), principal: true },
              {
                titulo: 'Tipo',
                render: (m: any) => (
                  <span className="flex flex-wrap items-center gap-1">
                    {rotulo(TIPOS_MOV_EMPENHO, m.tipo)}
                    {estornados.has(m.id) && <Selo tom="neutro">Estornado</Selo>}
                  </span>
                ),
              },
              { titulo: 'Documento', render: (m: any) => <span className="text-xs">{m.documento}</span> },
              { titulo: 'Valor', render: (m: any) => <span className={m.tipo.startsWith('ESTORNO') || m.tipo === 'ANULACAO' ? 'text-perigo' : ''}>{moeda(m.valor)}</span>, alinhar: 'direita' },
              { titulo: 'Registrado', render: (m: any) => <span className="text-xs">{dataHora(m.criadoEm)}</span>, ocultarMobile: true },
              {
                titulo: '',
                render: (m: any) =>
                  pode.escrever && !inscrito && (m.tipo === 'LIQUIDACAO' || m.tipo === 'PAGAMENTO') && !estornados.has(m.id) && (
                    <Botao pequeno variante="fantasma" icone={<Undo2 className="size-4" />} onClick={() => setEstornar(m)}>
                      Estornar
                    </Botao>
                  ),
              },
            ]}
          />
          <p className="mt-2 text-xs text-tinta-suave">Correções são feitas por estorno vinculado ao movimento original; lançamentos não são editados nem excluídos.</p>
        </Cartao>
        <div className="space-y-4">
          <Cartao titulo="Dados">
            <ListaDefinicao
              itens={[
                ['Crédito', `ND ${e.credito.naturezaDespesa} • PTRES ${e.credito.ptres} • FR ${e.credito.fonte}`],
                ['Exercício do crédito', e.credito.exercicio],
                ['Tipo', e.tipo],
                ['Processo', e.processoId ? <Link className="text-acao hover:underline" to={`/processos/${e.processoId}`}>abrir</Link> : '—'],
                ['Última conciliação', e.ultimaConciliacao ? `${dataHora(e.ultimaConciliacao)} — ${e.fonteConciliacao}` : 'Não conciliado'],
              ]}
            />
          </Cartao>
          <Cartao titulo="Rateios por contrato">
            {!e.rateios.length ? (
              <Vazio titulo="Sem rateio" texto="Liquidações vinculadas a contrato exigem rateio." />
            ) : (
              <ul className="space-y-1 text-sm">
                {e.rateios.map((r: any) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <Link to={`/contratos/${r.contrato.id}`} className="text-acao hover:underline">
                      {r.contrato.numero}
                    </Link>
                    <span className="tabular">{moeda(r.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>
      </div>

      {inscrito && (
        <Cartao titulo="Inscrições em restos a pagar" className="mt-4">
          <div className="space-y-4">
            {e.inscricoes.map((i: any) => (
              <div key={i.id} className="rounded-lg border border-borda p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {i.tipo === 'PROCESSADO' ? 'RAP processado' : 'RAP não processado'} — origem {i.exercicioOrigem} — inscrito em {data(i.dataInscricao)} ({i.documento})
                  </p>
                  {pode.escrever && (
                    <Botao pequeno onClick={() => setMovRap(i)}>
                      Movimento de RAP
                    </Botao>
                  )}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                  {Object.entries({ Abertura: i.saldos.abertura, Liquidado: i.saldos.liquidado, Pago: i.saldos.pago, Cancelado: i.saldos.cancelado, Saldo: i.saldos.saldo }).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-tinta-suave">{k}</dt>
                      <dd className="tabular">{moeda(v as string)}</dd>
                    </div>
                  ))}
                </dl>
                {!!i.movimentos.length && (
                  <ul className="mt-2 text-xs text-tinta-suave">
                    {i.movimentos.map((m: any) => (
                      <li key={m.id}>
                        {data(m.dataMovimento)} — {rotulo(TIPOS_MOV_RAP, m.tipo)} — {moeda(m.valor)} — {m.documento}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Cartao>
      )}

      <Cartao className="mt-4">
        <DocumentosPainel vinculoTipo="EMPENHO" vinculoId={id} categoriaPadrao="EMPENHO" podeEnviar={pode.escrever} />
      </Cartao>

      <FormularioModal
        aberto={mov}
        aoFechar={() => setMov(false)}
        titulo="Novo movimento do empenho"
        aviso={<Aviso>Liquidação exige nota fiscal atestada. Pagamento não pode exceder o liquidado a pagar; liquidação não pode exceder o empenhado a liquidar.</Aviso>}
        campos={[
          { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: ['REFORCO', 'ANULACAO', 'LIQUIDACAO', 'PAGAMENTO'].map((t) => ({ value: t, label: TIPOS_MOV_EMPENHO[t] })) },
          { nome: 'notaFiscalId', rotulo: 'Nota fiscal atestada', tipo: 'select', opcoes: notas.data ?? [], visivel: (v) => v.tipo === 'LIQUIDACAO' || v.tipo === 'PAGAMENTO', ajuda: 'Notas atestadas dos contratos rateados neste empenho.' },
          { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'dinheiro', obrigatorio: true, meia: true },
          { nome: 'dataMovimento', rotulo: 'Data do movimento', tipo: 'data', obrigatorio: true, meia: true },
          { nome: 'documento', rotulo: 'Documento comprobatório (NE/NS/OB)', obrigatorio: true },
          { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
        ]}
        valoresIniciais={{ dataMovimento: hojeISO() }}
        aoEnviar={async (v) => {
          await api.post(`/financeiro/empenhos/${id}/movimentos`, v);
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={!!estornar}
        aoFechar={() => setEstornar(null)}
        titulo={`Estornar ${estornar ? rotulo(TIPOS_MOV_EMPENHO, estornar.tipo).toLowerCase() : ''}`}
        aviso={estornar && <p className="text-sm">Movimento original: {moeda(estornar.valor)} em {data(estornar.dataMovimento)} — {estornar.documento}</p>}
        campos={[
          { nome: 'valor', rotulo: 'Valor do estorno (R$)', tipo: 'dinheiro', obrigatorio: true, meia: true },
          { nome: 'dataMovimento', rotulo: 'Data', tipo: 'data', obrigatorio: true, meia: true },
          { nome: 'documento', rotulo: 'Documento do estorno', obrigatorio: true },
          { nome: 'observacao', rotulo: 'Motivo', tipo: 'textarea', obrigatorio: true },
        ]}
        valoresIniciais={estornar ? { valor: estornar.valor, dataMovimento: hojeISO() } : undefined}
        aoEnviar={async (v) => {
          await api.post(`/financeiro/empenhos/${id}/movimentos`, { ...v, tipo: estornar.tipo === 'LIQUIDACAO' ? 'ESTORNO_LIQUIDACAO' : 'ESTORNO_PAGAMENTO', estornoDeId: estornar.id });
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={rateio}
        aoFechar={() => setRateio(false)}
        titulo="Rateio do empenho a contrato"
        aviso={<p className="text-xs text-tinta-suave">A soma dos rateios não pode exceder o empenhado líquido. Informar um contrato já rateado substitui o valor.</p>}
        campos={[
          { nome: 'contratoId', rotulo: 'Contrato', tipo: 'select', opcoes: contratos, obrigatorio: true },
          { nome: 'valor', rotulo: 'Valor rateado (R$)', tipo: 'dinheiro', obrigatorio: true },
        ]}
        aoEnviar={async (v) => {
          await api.post(`/financeiro/empenhos/${id}/rateios`, v);
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={conc}
        aoFechar={() => setConc(false)}
        titulo="Registrar conciliação"
        campos={[{ nome: 'fonte', rotulo: 'Fonte oficial conferida', obrigatorio: true }]}
        aoEnviar={async (v) => {
          await api.post(`/financeiro/empenhos/${id}/conciliacao`, v);
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={rap}
        aoFechar={() => setRap(false)}
        titulo="Inscrição em restos a pagar"
        aviso={
          <Aviso tom="atencao">
            Valores a inscrever conforme o ledger: processado {moeda(e.sugestaoRap.processado)} (liquidado a pagar) e não processado {moeda(e.sugestaoRap.naoProcessado)} (a liquidar). A inscrição deve refletir o ato oficial de encerramento do exercício.
          </Aviso>
        }
        campos={[
          { nome: 'dataInscricao', rotulo: 'Data da inscrição', tipo: 'data', obrigatorio: true, ajuda: 'Deve ser posterior ao exercício do empenho.' },
          { nome: 'documento', rotulo: 'Documento de referência', obrigatorio: true },
        ]}
        aoEnviar={async (v) => {
          await api.post(`/financeiro/empenhos/${id}/inscricao-rap`, v);
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={!!movRap}
        aoFechar={() => setMovRap(null)}
        titulo="Movimento de restos a pagar"
        campos={[
          { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: Object.entries(TIPOS_MOV_RAP).filter(([k]) => k !== 'ESTORNO').map(([value, label]) => ({ value, label })) },
          { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'dinheiro', obrigatorio: true, meia: true },
          { nome: 'dataMovimento', rotulo: 'Data', tipo: 'data', obrigatorio: true, meia: true },
          { nome: 'documento', rotulo: 'Documento', obrigatorio: true },
        ]}
        valoresIniciais={{ dataMovimento: hojeISO() }}
        aoEnviar={async (v) => {
          await api.post(`/financeiro/restos-a-pagar/${movRap.id}/movimentos`, v);
          await q.refetch();
        }}
      />
    </>
  );
}
