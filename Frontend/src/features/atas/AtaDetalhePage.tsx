import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { DocumentosPainel } from '@/components/DocumentosPainel';
import { Carregando, ErroCarga, Vazio } from '@/components/feedback';
import { FormularioModal } from '@/components/Formulario';
import { HistoricoPainel } from '@/components/HistoricoPainel';
import { Abas, Tabela } from '@/components/Tabela';
import { Aviso, Botao, CabecalhoPagina, Cartao, ListaDefinicao } from '@/components/ui';
import { api } from '@/lib/api';
import { data, dataHora, moeda, numero } from '@/lib/formato';
import { FORMAS, rotulo, TIPOS_MOV_ATA, TIPOS_VINCULO_ATA } from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';
import { useContratosOpcoes, useFornecedoresOpcoes, useProcessosOpcoes } from '@/hooks/useOpcoes';
import { SeloAta } from './AtasPage';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AtaDetalhePage() {
  const { id = '' } = useParams();
  const { pode } = useAuth();
  const [sp, setSp] = useSearchParams();
  const aba = sp.get('aba') ?? 'itens';
  const q = useQuery({ queryKey: ['ata', id], queryFn: () => api.get<any>(`/atas/${id}`) });
  const fornecedores = useFornecedoresOpcoes();
  const processos = useProcessosOpcoes();
  const contratos = useContratosOpcoes();
  const [novoItem, setNovoItem] = useState(false);
  const [mov, setMov] = useState<any>(null);
  const [destinada, setDestinada] = useState<any>(null);
  const [autorizar, setAutorizar] = useState(false);
  const [vigencia, setVigencia] = useState(false);

  if (q.isLoading) return <Carregando linhas={6} />;
  if (q.isError) return <ErroCarga erro={q.error} tentarNovamente={() => q.refetch()} />;
  const a = q.data;
  const processosAdesao = (a.processos ?? []).filter((p: any) => p.formaContratacao === 'ADESAO_ATA').map((p: any) => ({ value: p.id, label: `${p.numeroInterno} — ${p.objeto.slice(0, 50)}` }));

  return (
    <>
      <CabecalhoPagina
        voltar={{ to: '/atas', rotulo: 'Atas' }}
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            Ata {a.numero} <SeloAta a={a} />
          </span>
        }
        subtitulo={a.objeto}
        acoes={
          pode.gerir && (
            <>
              {!a.expirada && !a.cancelada && (
                <Botao onClick={() => setAutorizar(true)}>{a.tipoVinculo === 'CONSULTA' ? 'Registrar participação/adesão' : 'Atualizar autorização'}</Botao>
              )}
              <Botao variante="secundario" onClick={() => setVigencia(true)}>
                Alterar vigência
              </Botao>
            </>
          )
        }
      />
      {a.impedimentos.length > 0 && (
        <div className="mb-4">
          <Aviso tom={a.expirada || a.cancelada ? 'perigo' : 'atencao'} titulo="Utilização bloqueada no fluxo normal">
            <ul className="list-disc pl-4">
              {a.impedimentos.map((i: string) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            {a.expirada && <p className="mt-1">Tratamento excepcional exige validação expressa da regra aplicável — não há opção de ignorar o bloqueio.</p>}
          </Aviso>
        </div>
      )}
      <Cartao className="mb-4">
        <ListaDefinicao
          itens={[
            ['Órgão gerenciador', a.orgaoGerenciador],
            ['CNPJ gerenciador', a.cnpjGerenciador],
            ['UASG', a.uasg],
            ['Identificador PNCP', a.idPncp],
            ['Processo de origem', a.processoOrigem],
            ['Vigência', `${data(a.vigenciaInicio)} a ${data(a.vigenciaFim)}`],
            ['Vínculo da unidade', rotulo(TIPOS_VINCULO_ATA, a.tipoVinculo)],
            ['Autorização de utilização', a.autorizacaoUtilizacao ? `${a.autorizacaoUtilizacao} (${dataHora(a.autorizadaEm)})` : '—'],
            ['Importada do PNCP', a.importacaoId ? 'Sim (com revisão humana)' : 'Não'],
          ]}
        />
      </Cartao>
      <Abas
        abas={[
          { chave: 'itens', rotulo: 'Itens e saldo interno', contador: a.itens.length },
          { chave: 'vinculos', rotulo: 'Processos e contratos' },
          { chave: 'documentos', rotulo: 'Documentos' },
          { chave: 'historico', rotulo: 'Histórico' },
        ]}
        ativa={aba}
        aoMudar={(k) => setSp({ aba: k })}
      />
      {aba === 'itens' && (
        <Cartao titulo="Itens" acoes={pode.escrever && <Botao pequeno icone={<Plus className="size-4" />} onClick={() => setNovoItem(true)}>Item</Botao>}>
          <div className="mb-3">
            <Aviso>{a.avisoSaldo} Quantidade registrada “desconhecida” indica que a fonte não informou.</Aviso>
          </div>
          <Tabela
            rotulo="Itens da ata"
            dados={a.itens}
            chave={(i: any) => i.id}
            vazio={<Vazio titulo="Nenhum item" texto="A API pública de consulta do PNCP não fornece itens; cadastre-os a partir dos documentos oficiais." />}
            colunas={[
              { titulo: 'Item', principal: true, render: (i: any) => <span><b>{i.numeroItem}.</b> {i.descricao}</span> },
              { titulo: 'Fornecedor', render: (i: any) => <span className="text-xs">{i.fornecedor?.razaoSocial ?? '—'}</span> },
              { titulo: 'Preço unit.', render: (i: any) => moeda(i.precoUnitario), alinhar: 'direita' },
              { titulo: 'Registrada', render: (i: any) => (i.quantidadeRegistradaInformada ? numero(i.quantidadeRegistrada) : 'desconhecida'), alinhar: 'direita' },
              { titulo: 'Destinada', render: (i: any) => numero(i.quantidadeDestinada), alinhar: 'direita' },
              { titulo: 'Consumo', render: (i: any) => numero(i.consumo), alinhar: 'direita' },
              { titulo: 'Reservas', render: (i: any) => numero(i.reservas), alinhar: 'direita' },
              { titulo: 'Saldo interno', render: (i: any) => <b>{numero(i.saldoInterno)} {i.unidadeMedida}</b>, alinhar: 'direita' },
              {
                titulo: '',
                render: (i: any) => (
                  <div className="flex flex-wrap gap-1">
                    {pode.escrever && (
                      <Botao pequeno variante="secundario" onClick={() => setMov(i)}>
                        Movimentar
                      </Botao>
                    )}
                    {pode.gerir && (
                      <Botao pequeno variante="fantasma" onClick={() => setDestinada(i)}>
                        Destinada
                      </Botao>
                    )}
                  </div>
                ),
              },
            ]}
          />
          {a.itens.some((i: any) => i.movimentos.length) && (
            <>
              <h3 className="mb-2 mt-5 text-sm font-semibold">Movimentos de quantidade</h3>
              <ul className="space-y-1 text-sm">
                {a.itens.flatMap((i: any) =>
                  i.movimentos.map((m: any) => (
                    <li key={m.id} className="text-tinta-suave">
                      {dataHora(m.criadoEm)} — item {i.numeroItem} — <span className="text-tinta">{rotulo(TIPOS_MOV_ATA, m.tipo)}</span> de {numero(m.quantidade)} {m.documento && `— ${m.documento}`} {m.motivo && `— ${m.motivo}`}
                    </li>
                  )),
                )}
              </ul>
            </>
          )}
        </Cartao>
      )}
      {aba === 'vinculos' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Cartao titulo="Processos">
            {!a.processos.length ? <Vazio titulo="Nenhum processo vinculado" /> : (
              <ul className="space-y-1 text-sm">
                {a.processos.map((p: any) => (
                  <li key={p.id}>
                    <Link to={`/processos/${p.id}`} className="text-acao hover:underline">{p.numeroInterno}</Link> — {rotulo(FORMAS, p.formaContratacao)}
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
          <Cartao titulo="Contratos originados">
            {!a.contratos.length ? <Vazio titulo="Nenhum contrato" /> : (
              <ul className="space-y-1 text-sm">
                {a.contratos.map((c: any) => (
                  <li key={c.id}><Link to={`/contratos/${c.id}`} className="text-acao hover:underline">{c.numero}</Link></li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-tinta-suave">Vigência da ata e vigência do contrato são independentes.</p>
          </Cartao>
        </div>
      )}
      {aba === 'documentos' && (
        <Cartao>
          <DocumentosPainel vinculoTipo="ATA" vinculoId={id} categoriaPadrao="ATA" podeEnviar={pode.escrever} />
        </Cartao>
      )}
      {aba === 'historico' && (
        <Cartao titulo="Histórico">
          <HistoricoPainel caminho={`/atas/${id}/historico`} />
        </Cartao>
      )}

      <FormularioModal
        aberto={novoItem}
        aoFechar={() => setNovoItem(false)}
        titulo="Novo item da ata"
        largo
        campos={[
          { nome: 'numeroItem', rotulo: 'Nº do item', tipo: 'numero', obrigatorio: true, min: 1, max: 100000, meia: true },
          { nome: 'unidadeMedida', rotulo: 'Unidade', obrigatorio: true, meia: true },
          { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', obrigatorio: true },
          { nome: 'fornecedorId', rotulo: 'Fornecedor', tipo: 'select', opcoes: fornecedores },
          { nome: 'codigoCatalogo', rotulo: 'Código CATMAT/CATSER', meia: true },
          { nome: 'precoUnitario', rotulo: 'Preço unitário (R$)', tipo: 'dinheiro', obrigatorio: true, meia: true },
          { nome: 'quantidadeRegistrada', rotulo: 'Quantidade registrada (vazio = desconhecida)', tipo: 'quantidade', meia: true },
          { nome: 'quantidadeDestinada', rotulo: 'Quantidade destinada à unidade', tipo: 'quantidade', obrigatorio: true, meia: true },
        ]}
        aoEnviar={async (v) => {
          await api.post(`/atas/${id}/itens`, v);
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={!!mov}
        aoFechar={() => setMov(null)}
        titulo={`Movimentar item ${mov?.numeroItem ?? ''}`}
        aviso={<p className="text-sm">Saldo interno atual: <b>{mov && numero(mov.saldoInterno)}</b>. Reserva e consumo só são aceitos com ata utilizável.</p>}
        campos={[
          { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: Object.entries(TIPOS_MOV_ATA).map(([value, label]) => ({ value, label })) },
          { nome: 'quantidade', rotulo: 'Quantidade', tipo: 'quantidade', obrigatorio: true, meia: true },
          { nome: 'documento', rotulo: 'Documento', meia: true, ajuda: 'Obrigatório para consumo formalizado.' },
          { nome: 'processoId', rotulo: 'Processo', tipo: 'select', opcoes: processos },
          { nome: 'contratoId', rotulo: 'Contrato', tipo: 'select', opcoes: contratos },
          { nome: 'motivo', rotulo: 'Motivo', tipo: 'textarea' },
        ]}
        aoEnviar={async (v) => {
          await api.post(`/atas/${id}/itens/${mov.id}/movimentos`, v);
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={!!destinada}
        aoFechar={() => setDestinada(null)}
        titulo="Alterar quantidade destinada"
        campos={[
          { nome: 'quantidadeDestinada', rotulo: 'Nova quantidade destinada', tipo: 'quantidade', obrigatorio: true },
          { nome: 'motivo', rotulo: 'Motivo / documento', tipo: 'textarea', obrigatorio: true, minimo: 5 },
        ]}
        valoresIniciais={destinada ? { quantidadeDestinada: destinada.quantidadeDestinada } : undefined}
        aoEnviar={async (v) => {
          await api.post(`/atas/${id}/itens/${destinada.id}/destinada`, v);
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={autorizar}
        aoFechar={() => setAutorizar(false)}
        titulo="Registrar participação / adesão"
        aviso={<Aviso tom="atencao">Adesão exige processo (forma “Adesão a ata”) vinculado a esta ata, com o dossiê de justificativas e verificações concluído no checklist. Limites de adesão seguem regra normativa versionada.</Aviso>}
        campos={[
          { nome: 'tipoVinculo', rotulo: 'Vínculo', tipo: 'select', obrigatorio: true, opcoes: [{ value: 'PARTICIPANTE', label: 'Participante' }, { value: 'GERENCIADOR', label: 'Gerenciador' }, { value: 'ADESAO', label: 'Adesão (carona)' }] },
          { nome: 'documento', rotulo: 'Documento de autorização', obrigatorio: true },
          { nome: 'processoAdesaoId', rotulo: 'Processo de adesão (dossiê)', tipo: 'select', opcoes: processosAdesao, visivel: (v) => v.tipoVinculo === 'ADESAO' },
        ]}
        aoEnviar={async (v) => {
          await api.post(`/atas/${id}/autorizar-utilizacao`, v);
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={vigencia}
        aoFechar={() => setVigencia(false)}
        titulo="Alterar vigência da ata"
        aviso={<Aviso tom="atencao">Prorrogação requer registro documental e validação; nunca ocorre automaticamente.</Aviso>}
        campos={[
          { nome: 'vigenciaFim', rotulo: 'Novo fim da vigência', tipo: 'data', obrigatorio: true },
          { nome: 'documento', rotulo: 'Documento', obrigatorio: true },
          { nome: 'fundamento', rotulo: 'Fundamento', tipo: 'textarea', obrigatorio: true, minimo: 10 },
        ]}
        aoEnviar={async (v) => {
          await api.post(`/atas/${id}/vigencia`, v);
          await q.refetch();
        }}
      />
    </>
  );
}
