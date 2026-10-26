import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { DocumentosPainel } from '@/components/DocumentosPainel';
import { Carregando, ErroCarga, Vazio } from '@/components/feedback';
import { Campo, FormularioModal } from '@/components/Formulario';
import { HistoricoPainel } from '@/components/HistoricoPainel';
import { Abas, Tabela } from '@/components/Tabela';
import { Aviso, Botao, CabecalhoPagina, Cartao, Indicador, ListaDefinicao, Selo } from '@/components/ui';
import { api, Paginado } from '@/lib/api';
import { data, dataHora, diasTexto, hojeISO, moeda, numero } from '@/lib/formato';
import {
  CATEGORIAS_SOLICITACAO, FUNCOES, NATUREZAS, opcoes, PRIORIDADES, rotulo, SITUACOES_CONTRATO, STATUS_DESIGNACAO, STATUS_ENTREGA, STATUS_MEDICAO,
  STATUS_NF, STATUS_SOLICITACAO, TIPOS_ADITIVO, TIPOS_INSTRUMENTO, TIPOS_REGISTRO,
} from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';
import { useUsuariosOpcoes } from '@/hooks/useOpcoes';
import { tomVigencia } from './ContratosPage';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Aba = 'resumo' | 'designacoes' | 'execucao' | 'financeiro' | 'solicitacoes' | 'documentos' | 'historico';
type ModalTipo = null | 'aditivo' | 'indicar' | 'confirmar' | 'encerrarDesig' | 'entrega' | 'recebEntrega' | 'medicao' | 'recebMedicao' | 'registro' | 'nota' | 'atesto' | 'rejeitarNota' | 'solicitacao' | 'situacao' | 'item' | 'correcao';

export default function ContratoDetalhePage() {
  const { id = '' } = useParams();
  const { pode } = useAuth();
  const [sp, setSp] = useSearchParams();
  const aba = (sp.get('aba') as Aba) ?? 'resumo';
  const usuarios = useUsuariosOpcoes();
  const q = useQuery({ queryKey: ['contrato', id], queryFn: () => api.get<any>(`/contratos/${id}`) });
  const exec = useQuery({ queryKey: ['contrato', id, 'execucao'], queryFn: () => api.get<any>(`/execucao/contratos/${id}`), enabled: aba === 'execucao' || aba === 'financeiro' });
  const fin = useQuery({ queryKey: ['contrato', id, 'financeiro'], queryFn: () => api.get<any>(`/financeiro/contratos/${id}`), enabled: aba === 'financeiro' });
  const sols = useQuery({ queryKey: ['contrato', id, 'solicitacoes'], queryFn: () => api.get<Paginado<any>>(`/solicitacoes?contratoId=${id}&tamanho=100`), enabled: aba === 'solicitacoes' });
  const [modal, setModal] = useState<ModalTipo>(null);
  const [alvo, setAlvo] = useState<any>(null);
  const abrir = (m: ModalTipo, a?: any) => {
    setAlvo(a ?? null);
    setModal(m);
  };
  const fechar = () => setModal(null);
  const recarregar = async () => {
    await Promise.all([q.refetch(), exec.refetch(), fin.isFetched ? fin.refetch() : null, sols.isFetched ? sols.refetch() : null]);
  };

  if (q.isLoading) return <Carregando linhas={6} />;
  if (q.isError) return <ErroCarga erro={q.error} tentarNovamente={() => q.refetch()} />;
  const c = q.data;
  const operar = pode.escrever || pode.gestor;
  const setAba = (a: Aba) => setSp({ aba: a }, { replace: true });

  return (
    <>
      <CabecalhoPagina
        voltar={{ to: '/contratos', rotulo: 'Contratos' }}
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            {rotulo(TIPOS_INSTRUMENTO, c.tipo)} {c.numero}
            <Selo tom={tomVigencia(c.diasParaVencer, c.situacao)}>{rotulo(SITUACOES_CONTRATO, c.situacao)} • {diasTexto(c.diasParaVencer)}</Selo>
          </span>
        }
        subtitulo={`${c.objeto} — ${c.fornecedor?.razaoSocial ?? ''}`}
        acoes={
          <>
            {operar && (
              <Botao variante="secundario" onClick={() => abrir('solicitacao')}>
                Solicitar à secretaria
              </Botao>
            )}
            {pode.gerir && (
              <>
                <Botao variante="secundario" onClick={() => abrir('aditivo')}>
                  Registrar aditivo
                </Botao>
                <Botao variante="secundario" onClick={() => abrir('situacao')}>
                  Alterar situação
                </Botao>
              </>
            )}
            {pode.admin && (
              <Botao variante="fantasma" onClick={() => abrir('correcao')}>
                Correção administrativa
              </Botao>
            )}
          </>
        }
      />
      {c.vigenciaExpirada && !c.execucaoEncerrada && (
        <div className="mb-4">
          <Aviso tom="atencao">Vigência expirada em {data(c.vigenciaFim)}. Isso não encerra automaticamente a execução contratual; registre o encerramento quando cabível.</Aviso>
        </div>
      )}
      {pode.gestor && c.minhasFuncoes.length > 0 && (
        <div className="mb-4">
          <Aviso tom={c.minhasFuncoes.some((f: any) => f.status === 'ATIVA') ? 'info' : 'atencao'}>
            Suas funções neste contrato: {c.minhasFuncoes.map((f: any) => `${FUNCOES[f.funcao]} (${STATUS_DESIGNACAO[f.status]})`).join(', ')}. Atesto e recebimento formal exigem designação ATIVA com função competente.
          </Aviso>
        </div>
      )}
      <Abas
        abas={[
          { chave: 'resumo', rotulo: 'Resumo' },
          { chave: 'designacoes', rotulo: 'Designações', contador: c.designacoes.filter((d: any) => d.status !== 'ENCERRADA').length },
          { chave: 'execucao', rotulo: 'Execução e entregas' },
          { chave: 'financeiro', rotulo: 'Notas e financeiro' },
          { chave: 'solicitacoes', rotulo: 'Solicitações' },
          { chave: 'documentos', rotulo: 'Documentos' },
          { chave: 'historico', rotulo: 'Histórico' },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />

      {aba === 'resumo' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Cartao titulo="Dados do instrumento" className="lg:col-span-2">
            <ListaDefinicao
              itens={[
                ['Número', c.numero],
                ['Tipo / natureza', `${rotulo(TIPOS_INSTRUMENTO, c.tipo)} • ${rotulo(NATUREZAS, c.natureza)}`],
                ['Fornecedor', `${c.fornecedor?.razaoSocial ?? ''} (${c.fornecedor?.documento ?? ''})`],
                ['Processo', c.processo ? <Link className="text-acao hover:underline" to={`/processos/${c.processo.id}`}>{c.processo.numeroInterno}</Link> : '—'],
                ['Ata de origem', c.ata ? (pode.lerUnidade ? <Link className="text-acao hover:underline" to={`/atas/${c.ata.id}`}>{c.ata.numero}</Link> : c.ata.numero) : '—'],
                ['Assinatura', data(c.dataAssinatura)],
                ['Vigência', `${data(c.vigenciaInicio)} a ${data(c.vigenciaFim)}`],
                ['Prazo de execução', c.prazoExecucaoDias ? `${c.prazoExecucaoDias} dias` : '—'],
                ['Início previsto / real', `${data(c.inicioPrevisto)} / ${data(c.inicioReal)}`],
                ['Valor inicial', moeda(c.valorInicial)],
                ['Valor atualizado', moeda(c.valorAtualizado)],
                ['Reajuste / repactuação', c.reajusteIndice],
                ['Garantia', c.garantiaTipo ? `${c.garantiaTipo} — ${moeda(c.garantiaValor)} — válida até ${data(c.garantiaValidade)}` : '—'],
                ['Execução encerrada em', data(c.execucaoEncerradaEm)],
              ]}
            />
            {c.obrigacoes && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold">Obrigações</h3>
                <p className="whitespace-pre-line text-sm">{c.obrigacoes}</p>
              </div>
            )}
          </Cartao>
          <Cartao titulo="Aditivos e alterações">
            {!c.aditivos.length ? (
              <Vazio titulo="Nenhum aditivo" texto="Prorrogação nunca ocorre automaticamente." />
            ) : (
              <ol className="space-y-3 text-sm">
                {c.aditivos.map((a: any) => (
                  <li key={a.id} className="rounded-lg border border-borda p-2">
                    <p className="font-medium">
                      {a.numero} — {rotulo(TIPOS_ADITIVO, a.tipo)} ({data(a.dataAssinatura)})
                    </p>
                    <p className="text-xs">Valor: {moeda(a.valorAntes)} → {moeda(a.valorDepois)}</p>
                    <p className="text-xs">Vigência: {data(a.vigenciaFimAntes)} → {data(a.vigenciaFimDepois)}</p>
                    <p className="text-xs text-tinta-suave">{a.fundamento} — {a.documento}</p>
                  </li>
                ))}
              </ol>
            )}
          </Cartao>
          <Cartao titulo="Itens" className="lg:col-span-3" acoes={pode.escrever && <Botao pequeno icone={<Plus className="size-4" />} onClick={() => abrir('item')}>Item</Botao>}>
            <Tabela
              rotulo="Itens do contrato"
              dados={c.itens}
              chave={(i: any) => i.id}
              vazio={<Vazio titulo="Nenhum item" />}
              colunas={[
                { titulo: 'Nº', render: (i: any) => i.numero },
                { titulo: 'Descrição', principal: true, render: (i: any) => i.descricao },
                { titulo: 'Qtd.', render: (i: any) => `${numero(i.quantidade)} ${i.unidadeMedida}`, alinhar: 'direita' },
                { titulo: 'Unitário', render: (i: any) => moeda(i.valorUnitario), alinhar: 'direita' },
              ]}
            />
          </Cartao>
        </div>
      )}

      {aba === 'designacoes' && (
        <Cartao titulo="Gestores e fiscais" acoes={pode.escrever && <Botao pequeno icone={<Plus className="size-4" />} onClick={() => abrir('indicar')}>Indicar</Botao>}>
          <div className="mb-3">
            <Aviso>Gestor e fiscal são atribuições distintas. A indicação permanece pendente até o registro do documento de designação competente (chefe/administrador).</Aviso>
          </div>
          <Tabela
            rotulo="Designações"
            dados={c.designacoes}
            chave={(d: any) => d.id}
            vazio={<Vazio titulo="Nenhuma designação" />}
            colunas={[
              { titulo: 'Pessoa', principal: true, render: (d: any) => `${d.usuario.postoGraduacao ?? ''} ${d.usuario.nome}` },
              { titulo: 'Função', render: (d: any) => FUNCOES[d.funcao] },
              { titulo: 'Status', render: (d: any) => <Selo tom={d.status === 'ATIVA' ? 'ok' : d.status === 'PENDENTE' ? 'atencao' : 'neutro'}>{STATUS_DESIGNACAO[d.status]}</Selo> },
              { titulo: 'Período', render: (d: any) => `${data(d.inicio)} a ${d.fim ? data(d.fim) : 'indeterminado'}` },
              { titulo: 'Documento', render: (d: any) => <span className="text-xs">{d.documentoDesignacao ? `${d.documentoDesignacao} (${data(d.dataDocumento)})` : '—'}</span> },
              {
                titulo: '',
                render: (d: any) =>
                  pode.gerir && (
                    <div className="flex flex-wrap gap-1">
                      {d.status === 'PENDENTE' && (
                        <Botao pequeno onClick={() => abrir('confirmar', d)}>
                          Registrar designação
                        </Botao>
                      )}
                      {d.status !== 'ENCERRADA' && (
                        <Botao pequeno variante="secundario" onClick={() => abrir('encerrarDesig', d)}>
                          Encerrar
                        </Botao>
                      )}
                    </div>
                  ),
              },
            ]}
          />
        </Cartao>
      )}

      {aba === 'execucao' &&
        (exec.isLoading ? (
          <Carregando />
        ) : exec.isError ? (
          <ErroCarga erro={exec.error} />
        ) : (
          <div className="space-y-4">
            <Cartao titulo="Entregas (materiais)" acoes={operar && <Botao pequeno icone={<Plus className="size-4" />} onClick={() => abrir('entrega')}>Entrega</Botao>}>
              <Tabela
                rotulo="Entregas"
                dados={exec.data.entregas}
                chave={(e: any) => e.id}
                vazio={<Vazio titulo="Nenhuma entrega programada" />}
                colunas={[
                  { titulo: 'Entrega', principal: true, render: (e: any) => <span>{e.descricao}<span className="block text-xs text-tinta-suave">{e.local}</span></span> },
                  { titulo: 'Prazo', render: (e: any) => <span>{data(e.prazo)} {e.atrasada && <Selo tom="perigo">Atrasada</Selo>}</span> },
                  { titulo: 'Entregue / previsto', render: (e: any) => `${numero(e.quantidadeEntregue)} / ${numero(e.quantidadePrevista)}`, alinhar: 'direita' },
                  { titulo: 'Status', render: (e: any) => <Selo tom={e.status === 'RECEBIDA_DEFINITIVA' ? 'ok' : e.status === 'REJEITADA' ? 'perigo' : 'info'}>{STATUS_ENTREGA[e.status]}</Selo> },
                  {
                    titulo: '',
                    render: (e: any) =>
                      operar && !['RECEBIDA_DEFINITIVA', 'CANCELADA'].includes(e.status) && (
                        <Botao pequeno variante="secundario" onClick={() => abrir('recebEntrega', e)}>
                          Registrar recebimento
                        </Botao>
                      ),
                  },
                ]}
              />
            </Cartao>
            <Cartao titulo="Medições (serviços)" acoes={operar && <Botao pequeno icone={<Plus className="size-4" />} onClick={() => abrir('medicao')}>Medição</Botao>}>
              <Tabela
                rotulo="Medições"
                dados={exec.data.medicoes}
                chave={(m: any) => m.id}
                vazio={<Vazio titulo="Nenhuma medição" />}
                colunas={[
                  { titulo: 'Competência', principal: true, render: (m: any) => m.competencia },
                  { titulo: 'Descrição', render: (m: any) => <span className="text-xs">{m.descricao}</span> },
                  { titulo: '% físico', render: (m: any) => `${numero(m.percentualFisico)}%`, alinhar: 'direita' },
                  { titulo: 'Valor', render: (m: any) => moeda(m.valor), alinhar: 'direita' },
                  { titulo: 'Status', render: (m: any) => <Selo tom={m.status === 'APROVADA' ? 'ok' : m.status === 'GLOSADA' ? 'perigo' : 'info'}>{STATUS_MEDICAO[m.status]}</Selo> },
                  {
                    titulo: '',
                    render: (m: any) =>
                      operar && m.status !== 'APROVADA' && (
                        <Botao pequeno variante="secundario" onClick={() => abrir('recebMedicao', m)}>
                          Avaliar
                        </Botao>
                      ),
                  },
                ]}
              />
            </Cartao>
            <Cartao titulo="Relatórios, ocorrências e ordens de serviço" acoes={operar && <Botao pequeno icone={<Plus className="size-4" />} onClick={() => abrir('registro')}>Registro</Botao>}>
              {!exec.data.registros.length ? (
                <Vazio titulo="Nenhum registro de acompanhamento" />
              ) : (
                <ul className="space-y-3">
                  {exec.data.registros.map((r: any) => (
                    <li key={r.id} className="rounded-lg border border-borda p-3">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        <Selo tom={r.tipo === 'INCONFORMIDADE' ? 'perigo' : r.tipo === 'OCORRENCIA' ? 'atencao' : 'info'}>{TIPOS_REGISTRO[r.tipo]}</Selo>
                        {r.titulo} <span className="text-xs font-normal text-tinta-suave">{data(r.data)}</span>
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm">{r.texto}</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-tinta-suave">Fotos e evidências: anexe na aba Documentos (liberadas ao gestor quando aplicável).</p>
            </Cartao>
          </div>
        ))}

      {aba === 'financeiro' && (
        <div className="space-y-4">
          {fin.data && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Indicador rotulo="Valor contratual atualizado" valor={moeda(fin.data.contrato.valorAtualizado)} detalhe="Não é crédito orçamentário" />
              <Indicador rotulo="Empenhado (rateios)" valor={moeda(fin.data.totais.empenhado)} />
              <Indicador rotulo="Liquidado" valor={moeda(fin.data.totais.liquidado)} />
              <Indicador rotulo="Pago" valor={moeda(fin.data.totais.pago)} />
            </div>
          )}
          <Cartao titulo="Notas fiscais" acoes={operar && <Botao pequeno icone={<Plus className="size-4" />} onClick={() => abrir('nota')}>Nota recebida</Botao>}>
            <div className="mb-3">
              <Aviso>Nota recebida, atesto, liquidação e pagamento são estados distintos. O atesto exige designação ATIVA com função competente.</Aviso>
            </div>
            {fin.isLoading || exec.isLoading ? (
              <Carregando />
            ) : (
              <Tabela
                rotulo="Notas fiscais"
                dados={fin.data?.notas ?? []}
                chave={(n: any) => n.id}
                vazio={<Vazio titulo="Nenhuma nota fiscal" />}
                colunas={[
                  { titulo: 'NF', principal: true, render: (n: any) => `${n.numero}${n.serie ? `/${n.serie}` : ''}` },
                  { titulo: 'Emissão / recebimento', render: (n: any) => `${data(n.dataEmissao)} / ${data(n.dataRecebimento)}` },
                  { titulo: 'Valor', render: (n: any) => moeda(n.valor), alinhar: 'direita' },
                  { titulo: 'Liquidado', render: (n: any) => moeda(n.liquidado), alinhar: 'direita' },
                  { titulo: 'Pago', render: (n: any) => moeda(n.pago), alinhar: 'direita' },
                  { titulo: 'Situação', render: (n: any) => <Selo tom={n.situacaoFinanceira === 'PAGA' ? 'ok' : n.status === 'REJEITADA' || n.status === 'CANCELADA' ? 'perigo' : n.status === 'ATESTADA' ? 'info' : 'atencao'}>{STATUS_NF[n.situacaoFinanceira] ?? n.situacaoFinanceira}</Selo> },
                  {
                    titulo: 'Atesto',
                    render: (n: any) =>
                      n.atestos?.length ? (
                        <span className="text-xs">{data(n.atestos[0].data)} — {n.atestos[0].competencia}</span>
                      ) : n.status === 'RECEBIDA' && operar ? (
                        <div className="flex flex-wrap gap-1">
                          <Botao pequeno onClick={() => abrir('atesto', n)}>
                            Atestar
                          </Botao>
                          <Botao pequeno variante="secundario" onClick={() => abrir('rejeitarNota', n)}>
                            Rejeitar
                          </Botao>
                        </div>
                      ) : (
                        '—'
                      ),
                  },
                ]}
              />
            )}
          </Cartao>
          {fin.data && (
            <Cartao titulo="Empenhos rateados ao contrato">
              <Tabela
                rotulo="Empenhos"
                dados={fin.data.empenhos}
                chave={(e: any) => e.empenhoId}
                linkPara={pode.lerUnidade ? (e: any) => `/financeiro/empenhos/${e.empenhoId}` : undefined}
                vazio={<Vazio titulo="Nenhum empenho rateado" />}
                colunas={[
                  { titulo: 'Empenho', principal: true, render: (e: any) => `${e.numero} (${e.exercicio})` },
                  { titulo: 'Rateado', render: (e: any) => moeda(e.rateado), alinhar: 'direita' },
                  { titulo: 'Liquidado', render: (e: any) => moeda(e.liquidadoContrato), alinhar: 'direita' },
                  { titulo: 'Pago', render: (e: any) => moeda(e.pagoContrato), alinhar: 'direita' },
                  { titulo: 'A liquidar', render: (e: any) => moeda(e.aLiquidarContrato), alinhar: 'direita' },
                  { titulo: 'Conciliação', render: (e: any) => (e.ultimaConciliacao ? dataHora(e.ultimaConciliacao) : 'Não conciliado') },
                ]}
              />
              <p className="mt-2 text-xs text-tinta-suave">{fin.data.aviso}</p>
            </Cartao>
          )}
        </div>
      )}

      {aba === 'solicitacoes' && (
        <Cartao titulo="Solicitações à secretaria" acoes={operar && <Botao pequeno icone={<Plus className="size-4" />} onClick={() => abrir('solicitacao')}>Nova</Botao>}>
          {sols.isLoading ? (
            <Carregando />
          ) : (
            <Tabela
              rotulo="Solicitações"
              dados={sols.data?.itens ?? []}
              chave={(s: any) => s.id}
              linkPara={(s: any) => `/solicitacoes/${s.id}`}
              vazio={<Vazio titulo="Nenhuma solicitação" />}
              colunas={[
                { titulo: 'Título', principal: true, render: (s: any) => s.titulo },
                { titulo: 'Categoria', render: (s: any) => CATEGORIAS_SOLICITACAO[s.categoria] },
                { titulo: 'Prioridade', render: (s: any) => PRIORIDADES[s.prioridade] },
                { titulo: 'Status', render: (s: any) => STATUS_SOLICITACAO[s.status] },
                { titulo: 'Aberta em', render: (s: any) => dataHora(s.criadoEm) },
              ]}
            />
          )}
        </Cartao>
      )}

      {aba === 'documentos' && (
        <Cartao>
          <DocumentosPainel vinculoTipo="CONTRATO" vinculoId={id} categoriaPadrao="CONTRATO" podeEnviar={operar} />
        </Cartao>
      )}

      {aba === 'historico' && (
        <Cartao titulo="Histórico">
          <HistoricoPainel caminho={`/contratos/${id}/historico`} />
        </Cartao>
      )}

      {/* ───── Diálogos ───── */}
      <Form aberto={modal === 'item'} fechar={fechar} titulo="Novo item do contrato" ok={recarregar} url={`/contratos/${id}/itens`}
        campos={[
          { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', obrigatorio: true },
          { nome: 'unidadeMedida', rotulo: 'Unidade', obrigatorio: true, meia: true },
          { nome: 'quantidade', rotulo: 'Quantidade', tipo: 'quantidade', obrigatorio: true, meia: true },
          { nome: 'valorUnitario', rotulo: 'Valor unitário (R$)', tipo: 'dinheiro', obrigatorio: true, meia: true },
        ]}
      />
      <Form aberto={modal === 'aditivo'} fechar={fechar} titulo="Registrar aditivo / apostilamento" ok={recarregar} url={`/contratos/${id}/aditivos`}
        aviso={<Aviso tom="atencao">Valores e datas anteriores ficam preservados. Informe o documento e o fundamento; a validação jurídica é externa ao sistema.</Aviso>}
        campos={[
          { nome: 'numero', rotulo: 'Número', obrigatorio: true, meia: true },
          { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: opcoes(TIPOS_ADITIVO), obrigatorio: true, meia: true },
          { nome: 'dataAssinatura', rotulo: 'Data de assinatura', tipo: 'data', obrigatorio: true, meia: true },
          { nome: 'documento', rotulo: 'Documento', obrigatorio: true, meia: true },
          { nome: 'novoValor', rotulo: `Novo valor atualizado (atual ${moeda(c.valorAtualizado)})`, tipo: 'dinheiro', meia: true },
          { nome: 'novaVigenciaFim', rotulo: `Novo fim de vigência (atual ${data(c.vigenciaFim)})`, tipo: 'data', meia: true },
          { nome: 'fundamento', rotulo: 'Fundamento', tipo: 'textarea', obrigatorio: true, minimo: 5 },
        ]}
      />
      <Form aberto={modal === 'situacao'} fechar={fechar} titulo="Alterar situação do contrato" ok={recarregar} url={`/contratos/${id}/situacao`}
        campos={[
          { nome: 'situacao', rotulo: 'Situação', tipo: 'select', opcoes: opcoes(SITUACOES_CONTRATO), obrigatorio: true },
          { nome: 'data', rotulo: 'Data (encerramento da execução)', tipo: 'data', visivel: (v) => v.situacao === 'EXECUCAO_ENCERRADA' },
          { nome: 'motivo', rotulo: 'Motivo', tipo: 'textarea', obrigatorio: true, minimo: 5 },
        ]}
      />
      <Form aberto={modal === 'correcao'} fechar={fechar} titulo="Correção administrativa (administrador)" ok={recarregar} url={`/contratos/${id}/correcao`}
        aviso={<Aviso tom="atencao">Use somente para corrigir erro de registro. O estado anterior é preservado na auditoria com o motivo informado.</Aviso>}
        campos={[
          { nome: 'numero', rotulo: 'Número', meia: true },
          { nome: 'valorInicial', rotulo: 'Valor inicial', tipo: 'dinheiro', meia: true },
          { nome: 'valorAtualizado', rotulo: 'Valor atualizado', tipo: 'dinheiro', meia: true },
          { nome: 'vigenciaInicio', rotulo: 'Início da vigência', tipo: 'data', meia: true },
          { nome: 'vigenciaFim', rotulo: 'Fim da vigência', tipo: 'data', meia: true },
          { nome: 'motivo', rotulo: 'Motivo da correção', tipo: 'textarea', obrigatorio: true, minimo: 10 },
        ]}
      />
      <Form aberto={modal === 'indicar'} fechar={fechar} titulo="Indicar gestor/fiscal" ok={recarregar} url={`/contratos/${id}/designacoes`}
        campos={[
          { nome: 'usuarioId', rotulo: 'Pessoa', tipo: 'select', opcoes: usuarios, obrigatorio: true, ajuda: 'Cadastre a conta de gestor em Administração, se necessário.' },
          { nome: 'funcao', rotulo: 'Função', tipo: 'select', opcoes: opcoes(FUNCOES), obrigatorio: true },
          { nome: 'inicio', rotulo: 'Início', tipo: 'data', obrigatorio: true, meia: true },
          { nome: 'fim', rotulo: 'Fim (opcional)', tipo: 'data', meia: true },
          { nome: 'escopo', rotulo: 'Escopo', tipo: 'textarea' },
        ]}
        iniciais={{ inicio: hojeISO() }}
      />
      <Form aberto={modal === 'confirmar'} fechar={fechar} titulo="Registrar documento de designação" ok={recarregar} url={`/contratos/designacoes/${alvo?.id}/confirmar`}
        campos={[
          { nome: 'documentoDesignacao', rotulo: 'Documento (portaria, boletim…)', obrigatorio: true },
          { nome: 'dataDocumento', rotulo: 'Data do documento', tipo: 'data', obrigatorio: true },
        ]}
      />
      <Form aberto={modal === 'encerrarDesig'} fechar={fechar} titulo="Encerrar designação" ok={recarregar} url={`/contratos/designacoes/${alvo?.id}/encerrar`}
        campos={[
          { nome: 'fim', rotulo: 'Data de encerramento', tipo: 'data', obrigatorio: true },
          { nome: 'motivo', rotulo: 'Motivo', tipo: 'textarea', obrigatorio: true, minimo: 5 },
        ]}
        iniciais={{ fim: hojeISO() }}
      />
      <Form aberto={modal === 'entrega'} fechar={fechar} titulo="Programar entrega" ok={recarregar} url={`/execucao/contratos/${id}/entregas`}
        campos={[
          { nome: 'descricao', rotulo: 'Descrição', obrigatorio: true },
          { nome: 'local', rotulo: 'Local', meia: true },
          { nome: 'quantidadePrevista', rotulo: 'Quantidade prevista', tipo: 'quantidade', obrigatorio: true, meia: true },
          { nome: 'prazo', rotulo: 'Prazo', tipo: 'data', obrigatorio: true, meia: true },
        ]}
      />
      <Form aberto={modal === 'recebEntrega'} fechar={fechar} titulo={`Recebimento — ${alvo?.descricao ?? ''}`} ok={recarregar} url={`/execucao/entregas/${alvo?.id}/recebimentos`}
        aviso={<Aviso>Provisório: fiscais. Definitivo: gestor (parâmetro de competência versionado). Entregas parciais somam a quantidade recebida.</Aviso>}
        campos={[
          { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: [{ value: 'PROVISORIO', label: 'Recebimento provisório' }, { value: 'DEFINITIVO', label: 'Recebimento definitivo' }, { value: 'REJEICAO', label: 'Rejeição' }] },
          { nome: 'quantidade', rotulo: 'Quantidade', tipo: 'quantidade', meia: true },
          { nome: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true, meia: true },
          { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
        ]}
        iniciais={{ data: hojeISO() }}
      />
      <Form aberto={modal === 'medicao'} fechar={fechar} titulo="Registrar medição" ok={recarregar} url={`/execucao/contratos/${id}/medicoes`}
        campos={[
          { nome: 'competencia', rotulo: 'Competência (AAAA-MM)', obrigatorio: true, meia: true, placeholder: hojeISO().slice(0, 7) },
          { nome: 'percentualFisico', rotulo: '% físico executado', obrigatorio: true, meia: true },
          { nome: 'valor', rotulo: 'Valor medido (R$)', tipo: 'dinheiro', obrigatorio: true, meia: true },
          { nome: 'descricao', rotulo: 'Atividades', tipo: 'textarea', obrigatorio: true },
          { nome: 'inconformidades', rotulo: 'Inconformidades', tipo: 'textarea' },
        ]}
      />
      <Form aberto={modal === 'recebMedicao'} fechar={fechar} titulo={`Avaliar medição ${alvo?.competencia ?? ''}`} ok={recarregar} url={`/execucao/medicoes/${alvo?.id}/recebimentos`}
        campos={[
          { nome: 'tipo', rotulo: 'Ato', tipo: 'select', obrigatorio: true, opcoes: [{ value: 'PROVISORIO', label: 'Recebimento provisório' }, { value: 'DEFINITIVO', label: 'Aprovação / recebimento definitivo' }, { value: 'REJEICAO', label: 'Glosa / rejeição' }] },
          { nome: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
          { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
        ]}
        iniciais={{ data: hojeISO() }}
      />
      <Form aberto={modal === 'registro'} fechar={fechar} titulo="Registro de acompanhamento" ok={recarregar} url={`/execucao/contratos/${id}/registros`}
        campos={[
          { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: opcoes(TIPOS_REGISTRO), meia: true },
          { nome: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true, meia: true },
          { nome: 'titulo', rotulo: 'Título', obrigatorio: true },
          { nome: 'texto', rotulo: 'Descrição', tipo: 'textarea', obrigatorio: true },
        ]}
        iniciais={{ data: hojeISO(), tipo: 'RELATORIO' }}
      />
      <Form aberto={modal === 'nota'} fechar={fechar} titulo="Registrar nota fiscal recebida" ok={recarregar} url={`/execucao/contratos/${id}/notas`}
        campos={[
          { nome: 'numero', rotulo: 'Número', obrigatorio: true, meia: true },
          { nome: 'serie', rotulo: 'Série', meia: true },
          { nome: 'chaveAcesso', rotulo: 'Chave de acesso (44 dígitos)' },
          { nome: 'dataEmissao', rotulo: 'Emissão', tipo: 'data', obrigatorio: true, meia: true },
          { nome: 'dataRecebimento', rotulo: 'Recebimento', tipo: 'data', obrigatorio: true, meia: true },
          { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'dinheiro', obrigatorio: true },
        ]}
        iniciais={{ dataRecebimento: hojeISO() }}
      />
      <Form aberto={modal === 'atesto'} fechar={fechar} titulo={`Atestar NF ${alvo?.numero ?? ''}`} ok={recarregar} url={`/execucao/notas/${alvo?.id}/atesto`}
        aviso={<Aviso tom="atencao">Ao atestar, você declara a conformidade conforme sua designação. O registro inclui função e documento de designação.</Aviso>}
        campos={[
          { nome: 'data', rotulo: 'Data do atesto', tipo: 'data', obrigatorio: true },
          { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
        ]}
        iniciais={{ data: hojeISO() }}
      />
      <Form aberto={modal === 'rejeitarNota'} fechar={fechar} titulo={`Rejeitar NF ${alvo?.numero ?? ''}`} ok={recarregar} url={`/execucao/notas/${alvo?.id}/rejeitar`}
        campos={[{ nome: 'motivo', rotulo: 'Motivo', tipo: 'textarea', obrigatorio: true, minimo: 5 }]}
      />
      <Form aberto={modal === 'solicitacao'} fechar={fechar} titulo="Solicitação à secretaria" ok={recarregar} url="/solicitacoes"
        aviso={<p className="text-xs text-tinta-suave">A secretaria fará a triagem. Envio de comunicação à empresa é ato explícito de usuário autorizado e não constitui sanção automática.</p>}
        extra={{ contratoId: id }}
        campos={[
          { nome: 'categoria', rotulo: 'Categoria', tipo: 'select', opcoes: opcoes(CATEGORIAS_SOLICITACAO), obrigatorio: true, meia: true },
          { nome: 'prioridade', rotulo: 'Prioridade', tipo: 'select', opcoes: opcoes(PRIORIDADES), meia: true },
          { nome: 'titulo', rotulo: 'Título', obrigatorio: true },
          { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', obrigatorio: true },
          { nome: 'prazo', rotulo: 'Prazo desejado', tipo: 'data', meia: true },
        ]}
      />
    </>
  );
}

/** Atalho: formulário que faz POST na URL informada. */
function Form({ aberto, fechar, titulo, campos, url, ok, aviso, iniciais, extra }: { aberto: boolean; fechar: () => void; titulo: string; campos: Campo[]; url: string; ok: () => Promise<unknown>; aviso?: React.ReactNode; iniciais?: Record<string, unknown>; extra?: Record<string, unknown> }) {
  return (
    <FormularioModal
      aberto={aberto}
      aoFechar={fechar}
      titulo={titulo}
      campos={campos}
      aviso={aviso}
      valoresIniciais={iniciais}
      largo={campos.length > 5}
      aoEnviar={async (v) => {
        await api.post(url, { ...v, ...(extra ?? {}) });
        await ok();
      }}
    />
  );
}
