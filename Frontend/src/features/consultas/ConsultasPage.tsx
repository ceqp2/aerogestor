import { useQuery } from '@tanstack/react-query';
import { Search, Star } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Carregando, ErroCarga, mensagemErro, useToast, Vazio } from '@/components/feedback';
import { Campo, FormularioModal } from '@/components/Formulario';
import { Abas, Tabela } from '@/components/Tabela';
import { Aviso, Botao, CabecalhoPagina, Cartao, Selo } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { data, dataHora, hojeISO } from '@/lib/formato';
import { useAuth } from '@/hooks/useAuth';
import { useProcessosOpcoes } from '@/hooks/useOpcoes';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ConsultasPage() {
  const [sp, setSp] = useSearchParams();
  const aba = sp.get('aba') ?? 'pncp';
  return (
    <>
      <CabecalhoPagina titulo="Consultas públicas" subtitulo="Fontes oficiais consultadas pelo servidor, com cache datado. Toda importação passa por prévia e revisão humana." />
      <Abas
        abas={[
          { chave: 'pncp', rotulo: 'Atas no PNCP' },
          { chave: 'catalogo', rotulo: 'CATMAT / CATSER' },
          { chave: 'importacoes', rotulo: 'Importações' },
          { chave: 'status', rotulo: 'Status das integrações' },
        ]}
        ativa={aba}
        aoMudar={(a) => setSp({ aba: a, ...(sp.get('processoId') ? { processoId: sp.get('processoId')! } : {}) })}
      />
      {aba === 'pncp' && <BuscaPncp />}
      {aba === 'catalogo' && <BuscaCatalogo />}
      {aba === 'importacoes' && <Importacoes />}
      {aba === 'status' && <StatusIntegracoes />}
    </>
  );
}

function AvisoFonte({ r }: { r: any }) {
  return (
    <div className="mb-3 space-y-2">
      {r.avisoCache && <Aviso tom="atencao" titulo="Fonte indisponível — dados do cache">{r.avisoCache}</Aviso>}
      {r.aviso && <Aviso tom="info">{r.aviso}</Aviso>}
      <p className="text-xs text-tinta-suave">
        Fonte: {r.fonte ?? 'Compras.gov.br'} • consultado em {dataHora(r.consultadoEm)} {r.deCache && !r.avisoCache && '(cache recente)'}
        {r.filtroLocalAplicado && ' • filtro textual aplicado localmente à página retornada'}
      </p>
    </div>
  );
}

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const MODALIDADES_PNCP = [
  { value: '', label: 'Todas as modalidades' },
  { value: '1', label: 'Leilão - Eletrônico' },
  { value: '2', label: 'Diálogo Competitivo' },
  { value: '3', label: 'Concurso' },
  { value: '4', label: 'Concorrência - Eletrônica' },
  { value: '5', label: 'Concorrência - Presencial' },
  { value: '6', label: 'Pregão - Eletrônico' },
  { value: '7', label: 'Pregão - Presencial' },
  { value: '8', label: 'Dispensa de Licitação' },
  { value: '9', label: 'Inexigibilidade' },
  { value: '10', label: 'Manifestação de Interesse' },
  { value: '11', label: 'Pré-qualificação' },
  { value: '12', label: 'Credenciamento' },
  { value: '13', label: 'Leilão - Presencial' },
];

function BuscaPncp() {
  const { pode } = useAuth();
  const toast = useToast();
  const navegar = useNavigate();
  const hoje = hojeISO();
  const [f, setF] = useState({ dataInicial: hoje.slice(0, 8) + '01', dataFinal: hoje, cnpj: '', uf: '', modalidade: '', numeroAta: '', textoLocal: '', pagina: 1 });
  const [busca, setBusca] = useState<typeof f | null>(null);
  const q = useQuery({ queryKey: ['pncp', busca], queryFn: () => api.get<any>(`/integracoes/pncp/atas${qs({ ...busca!, modalidadeId: busca!.modalidade || undefined, tamanhoPagina: 20 })}`), enabled: !!busca, retry: false });
  const [previa, setPrevia] = useState<any>(null);

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    setBusca({ ...f, cnpj: f.cnpj.replace(/\D/g, ''), pagina: 1 });
  };
  const abrirPrevia = async (a: any) => {
    try {
      setPrevia(await api.post('/integracoes/pncp/atas/previa', { chaveCache: q.data.chaveCache, numeroControlePNCPAta: a.numeroControlePNCPAta }));
    } catch (e) {
      toast.erro(e);
    }
  };
  const favoritar = async (a: any) => {
    try {
      await api.post('/integracoes/favoritos', { fonte: 'PNCP_ATA', identificador: a.numeroControlePNCPAta, descricao: `${a.numeroAtaRegistroPreco} — ${a.objetoContratacao.slice(0, 200)}` });
      toast.sucesso('Adicionado aos favoritos');
    } catch (e) {
      toast.erro(e);
    }
  };

  return (
    <>
      <Cartao className="mb-4">
        <form onSubmit={buscar} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
          <label className="text-xs font-medium text-tinta-suave">
            Vigência a partir de *
            <input type="date" required value={f.dataInicial} onChange={(e) => setF({ ...f, dataInicial: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-borda px-3 text-sm text-tinta" />
          </label>
          <label className="text-xs font-medium text-tinta-suave">
            Vigência até *
            <input type="date" required value={f.dataFinal} onChange={(e) => setF({ ...f, dataFinal: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-borda px-3 text-sm text-tinta" />
          </label>
          <label className="text-xs font-medium text-tinta-suave">
            UF do órgão
            <select value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-borda bg-white px-3 text-sm text-tinta">
              <option value="">Todos os estados</option>
              {UFS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-tinta-suave">
            Modalidade
            <select value={f.modalidade} onChange={(e) => setF({ ...f, modalidade: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-borda bg-white px-3 text-sm text-tinta">
              {MODALIDADES_PNCP.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-tinta-suave">
            CNPJ do órgão
            <input value={f.cnpj} onChange={(e) => setF({ ...f, cnpj: e.target.value })} inputMode="numeric" placeholder="Somente números" className="mt-1 min-h-11 w-full rounded-lg border border-borda px-3 text-sm text-tinta" />
          </label>
          <label className="text-xs font-medium text-tinta-suave">
            Número da ata
            <input value={f.numeroAta} onChange={(e) => setF({ ...f, numeroAta: e.target.value })} placeholder="Ex: 001/2024" className="mt-1 min-h-11 w-full rounded-lg border border-borda px-3 text-sm text-tinta" />
          </label>
          <label className="text-xs font-medium text-tinta-suave">
            Palavra-chave no objeto
            <input value={f.textoLocal} onChange={(e) => setF({ ...f, textoLocal: e.target.value })} placeholder="Filtro local na página retornada" className="mt-1 min-h-11 w-full rounded-lg border border-borda px-3 text-sm text-tinta" />
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <Botao type="submit" icone={<Search className="size-4" />}>Consultar PNCP</Botao>
          </div>
        </form>
        <p className="mt-2 text-xs text-tinta-suave">Fonte: PNCP API pública (GET /v1/atas). UF e CNPJ filtram na API; número da ata e palavra-chave filtram localmente na página retornada. A API não expõe itens, quantidades nem saldos.</p>
      </Cartao>
      {busca && (
        <Cartao>
          {q.isLoading ? (
            <Carregando />
          ) : q.isError ? (
            <ErroCarga erro={q.error} tentarNovamente={() => q.refetch()} />
          ) : (
            <>
              <AvisoFonte r={q.data} />
              <Tabela
                rotulo="Atas no PNCP"
                dados={(q.data.itens as any[]).filter((a: any) => {
                  if (busca?.numeroAta && !a.numeroAtaRegistroPreco?.toLowerCase().includes(busca.numeroAta.toLowerCase())) return false;
                  if (busca?.textoLocal && !a.objetoContratacao?.toLowerCase().includes(busca.textoLocal.toLowerCase())) return false;
                  return true;
                })}
                chave={(a: any) => a.numeroControlePNCPAta}
                vazio={<Vazio titulo="Nenhuma ata nesta página" />}
                colunas={[
                  { titulo: 'Ata', principal: true, render: (a: any) => <div><p className="font-medium">{a.numeroAtaRegistroPreco}</p><p className="line-clamp-2 text-xs text-tinta-suave">{a.objetoContratacao}</p></div> },
                  { titulo: 'Órgão', render: (a: any) => <span className="text-xs">{a.nomeOrgao}</span> },
                  { titulo: 'Vigência', render: (a: any) => `${data(a.vigenciaInicio)} a ${data(a.vigenciaFim)}` },
                  { titulo: 'Situação', render: (a: any) => (a.cancelado ? <Selo tom="perigo">Cancelada</Selo> : <Selo tom="ok">Ativa na fonte</Selo>) },
                  {
                    titulo: '',
                    render: (a: any) => (
                      <div className="flex gap-1">
                        {pode.escrever && <Botao pequeno onClick={() => abrirPrevia(a)}>Prévia</Botao>}
                        <button onClick={() => favoritar(a)} className="rounded p-2 text-atencao hover:bg-atencao-fundo" aria-label="Favoritar">
                          <Star className="size-4" />
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-tinta-suave">
                  Página {q.data.pagina} de {q.data.totalPaginas} ({q.data.totalRegistros} registros na fonte)
                </span>
                <div className="flex gap-2">
                  <Botao pequeno variante="secundario" disabled={busca.pagina <= 1} onClick={() => setBusca({ ...busca, pagina: busca.pagina - 1 })}>Anterior</Botao>
                  <Botao pequeno variante="secundario" disabled={busca.pagina >= q.data.totalPaginas} onClick={() => setBusca({ ...busca, pagina: busca.pagina + 1 })}>Próxima</Botao>
                </div>
              </div>
            </>
          )}
        </Cartao>
      )}
      <FormularioModal
        aberto={!!previa}
        aoFechar={() => setPrevia(null)}
        titulo={previa?.ataExistente ? 'Atualização de ata já importada' : 'Prévia de importação'}
        largo
        rotuloEnviar={previa?.ataExistente ? 'Aplicar atualização revisada' : 'Importar após revisão'}
        aviso={
          previa && (
            <div className="space-y-2">
              {previa.avisos.map((a: string) => (
                <Aviso key={a} tom="atencao">{a}</Aviso>
              ))}
              {previa.diferencas?.length > 0 && (
                <Aviso tom="info" titulo="Diferenças entre o registro interno e a fonte">
                  <ul className="list-disc pl-4">
                    {previa.diferencas.map((d: any) => (
                      <li key={d.campo}>
                        {d.campo}: interno “{String(d.interno ?? '—')}” × fonte “{String(d.externo ?? '—')}”
                      </li>
                    ))}
                  </ul>
                  Nada é sobrescrito sem sua confirmação. Vigência é alterada apenas pelo fluxo próprio da ata.
                </Aviso>
              )}
              <p className="text-xs text-tinta-suave">Origem: PNCP • consultado em {dataHora(previa.consultadoEm)} • hash {previa.hash.slice(0, 16)}…</p>
            </div>
          )
        }
        campos={
          [
            { nome: 'numero', rotulo: 'Número', obrigatorio: true, meia: true },
            { nome: 'uasg', rotulo: 'UASG / unidade', meia: true },
            { nome: 'orgaoGerenciador', rotulo: 'Órgão gerenciador', obrigatorio: true },
            { nome: 'objeto', rotulo: 'Objeto', tipo: 'textarea', obrigatorio: true },
            { nome: 'vigenciaInicio', rotulo: 'Início da vigência', tipo: 'data', obrigatorio: true, meia: true },
            { nome: 'vigenciaFim', rotulo: 'Fim da vigência', tipo: 'data', obrigatorio: true, meia: true },
          ] as Campo[]
        }
        valoresIniciais={previa?.sugeridos}
        aoEnviar={async (v) => {
          const r = await api.post<any>(`/integracoes/importacoes/${previa.importacaoId}/confirmar`, { campos: v, aplicarAtualizacao: !!previa.ataExistente });
          toast.sucesso('Ata importada como “somente consulta”. Registre participação/adesão antes de utilizá-la.');
          navegar(`/atas/${r.id}`);
        }}
      />
    </>
  );
}

function BuscaCatalogo() {
  const { pode } = useAuth();
  const toast = useToast();
  const [sp] = useSearchParams();
  const processos = useProcessosOpcoes();
  const [f, setF] = useState({ tipo: 'CATMAT', codigo: '', descricao: '', codigoClasse: '', codigoGrupo: '', pagina: 1 });
  const [busca, setBusca] = useState<typeof f | null>(null);
  const [vincular, setVincular] = useState<any>(null);
  const q = useQuery({ queryKey: ['catalogo', busca], queryFn: () => api.get<any>(`/integracoes/catalogo${qs({ ...busca! })}`), enabled: !!busca, retry: false });
  const fav = useQuery({ queryKey: ['favoritos'], queryFn: () => api.get<any[]>('/integracoes/favoritos') });

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    setBusca({ ...f, pagina: 1 });
  };
  const favoritar = async (i: any) => {
    try {
      await api.post('/integracoes/favoritos', { fonte: i.tipo, identificador: i.codigo, descricao: i.descricao.slice(0, 480) });
      await fav.refetch();
      toast.sucesso('Favorito salvo');
    } catch (e) {
      toast.erro(e);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div>
        <Cartao className="mb-4">
          <form onSubmit={buscar} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <label className="text-xs font-medium text-tinta-suave">
              Catálogo
              <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-borda bg-white px-3 text-sm text-tinta">
                <option value="CATMAT">CATMAT (materiais)</option>
                <option value="CATSER">CATSER (serviços)</option>
              </select>
            </label>
            <label className="text-xs font-medium text-tinta-suave">
              Código do item
              <input value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value.replace(/\D/g, '') })} inputMode="numeric" className="mt-1 min-h-11 w-full rounded-lg border border-borda px-3 text-sm text-tinta" />
            </label>
            <label className="text-xs font-medium text-tinta-suave">
              {f.tipo === 'CATMAT' ? (f.codigoClasse ? 'Palavra (filtro local na classe)' : 'Descrição exata (fonte)') : 'Texto (filtro local)'}
              <input value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-borda px-3 text-sm text-tinta" />
            </label>
            <label className="text-xs font-medium text-tinta-suave">
              Código da classe
              <input value={f.codigoClasse} onChange={(e) => setF({ ...f, codigoClasse: e.target.value.replace(/\D/g, '') })} inputMode="numeric" className="mt-1 min-h-11 w-full rounded-lg border border-borda px-3 text-sm text-tinta" />
            </label>
            <div className="sm:col-span-2 lg:col-span-4">
              <Botao type="submit" icone={<Search className="size-4" />}>Consultar Compras.gov.br</Botao>
            </div>
          </form>
          <p className="mt-2 text-xs text-tinta-suave">CATMAT compara a descrição de forma exata na fonte; para buscar por palavra informe também o código da classe. CATSER não aceita busca por descrição: informe código do serviço, da classe ou do grupo. Código de catálogo não substitui a especificação do objeto nem a pesquisa de preços.</p>
        </Cartao>
        {busca && (
          <Cartao>
            {q.isLoading ? (
              <Carregando />
            ) : q.isError ? (
              <ErroCarga erro={q.error} tentarNovamente={() => q.refetch()} />
            ) : (
              <>
                <AvisoFonte r={q.data} />
                <Tabela
                  rotulo="Itens do catálogo"
                  dados={q.data.itens}
                  chave={(i: any) => i.codigo}
                  vazio={<Vazio titulo="Nenhum item encontrado" />}
                  colunas={[
                    { titulo: 'Código', render: (i: any) => <b>{i.codigo}</b> },
                    { titulo: 'Descrição', principal: true, render: (i: any) => <div>{i.descricao}<p className="text-xs text-tinta-suave">{[i.grupo, i.classe, i.pdm].filter(Boolean).join(' › ')}</p></div> },
                    { titulo: 'Situação', render: (i: any) => <Selo tom={i.ativo ? 'ok' : 'neutro'}>{i.ativo ? 'Ativo' : 'Inativo'}</Selo> },
                    {
                      titulo: '',
                      render: (i: any) => (
                        <div className="flex gap-1">
                          {pode.escrever && <Botao pequeno onClick={() => setVincular(i)}>Vincular a processo</Botao>}
                          <button onClick={() => favoritar(i)} className="rounded p-2 text-atencao hover:bg-atencao-fundo" aria-label="Favoritar">
                            <Star className="size-4" />
                          </button>
                        </div>
                      ),
                    },
                  ]}
                />
              </>
            )}
          </Cartao>
        )}
      </div>
      <Cartao titulo="Favoritos">
        {!fav.data?.length ? (
          <Vazio titulo="Sem favoritos" />
        ) : (
          <ul className="space-y-2 text-sm">
            {fav.data.map((x: any) => (
              <li key={x.id} className="flex items-start justify-between gap-2">
                <button className="text-left hover:underline" onClick={() => x.fonte !== 'PNCP_ATA' && setF({ ...f, tipo: x.fonte, codigo: x.identificador, descricao: '', codigoClasse: '' })}>
                  <span className="text-xs text-tinta-suave">{x.fonte} {x.identificador}</span>
                  <span className="line-clamp-2 block">{x.descricao}</span>
                </button>
                <button
                  className="text-xs text-perigo hover:underline"
                  onClick={async () => {
                    await api.delete(`/integracoes/favoritos/${x.id}`);
                    fav.refetch();
                  }}
                >
                  remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      <FormularioModal
        aberto={!!vincular}
        aoFechar={() => setVincular(null)}
        titulo={`Vincular ${vincular?.tipo ?? ''} ${vincular?.codigo ?? ''} a processo`}
        largo
        aviso={<Aviso tom="atencao">Confirme a compatibilidade entre o código e a especificação do objeto. A importação registra fonte, data da consulta e dados originais.</Aviso>}
        campos={[
          { nome: 'processoId', rotulo: 'Processo', tipo: 'select', opcoes: processos, obrigatorio: true },
          { nome: 'especificacao', rotulo: 'Especificação do item no processo', tipo: 'textarea', obrigatorio: true },
          { nome: 'unidadeMedida', rotulo: 'Unidade', obrigatorio: true, meia: true },
          { nome: 'quantidade', rotulo: 'Quantidade', tipo: 'quantidade', obrigatorio: true, meia: true },
          { nome: 'valorUnitarioEstimado', rotulo: 'Valor unitário estimado (R$)', tipo: 'dinheiro', meia: true },
          { nome: 'compatibilidadeVerificada', rotulo: 'Verifiquei a compatibilidade entre o código de catálogo e a especificação', tipo: 'checkbox' },
        ]}
        valoresIniciais={{ processoId: sp.get('processoId') ?? '', especificacao: vincular?.descricao ?? '' }}
        aoEnviar={async (v) => {
          await api.post('/integracoes/catalogo/vincular', { ...v, tipo: vincular.tipo, codigo: vincular.codigo, chaveCache: q.data.chaveCache });
          toast.sucesso('Item vinculado ao processo');
        }}
      />
    </div>
  );
}

function Importacoes() {
  const q = useQuery({ queryKey: ['importacoes'], queryFn: () => api.get<any[]>('/integracoes/importacoes') });
  const toast = useToast();
  if (q.isLoading) return <Carregando />;
  if (q.isError) return <ErroCarga erro={q.error} />;
  return (
    <Cartao titulo="Histórico de importações">
      <Tabela
        rotulo="Importações"
        dados={q.data!}
        chave={(i: any) => i.id}
        vazio={<Vazio titulo="Nenhuma importação" />}
        colunas={[
          { titulo: 'Fonte', render: (i: any) => i.fonte },
          { titulo: 'Identificador', principal: true, render: (i: any) => i.identificador },
          { titulo: 'Consultado em', render: (i: any) => dataHora(i.consultadoEm) },
          { titulo: 'Status', render: (i: any) => <Selo tom={i.status === 'IMPORTADA' ? 'ok' : i.status === 'DESCARTADA' ? 'neutro' : 'atencao'}>{i.status}</Selo> },
          { titulo: 'Hash', render: (i: any) => <span className="text-xs">{i.hash.slice(0, 12)}…</span>, ocultarMobile: true },
          {
            titulo: '',
            render: (i: any) =>
              ['PREVIA', 'ATUALIZACAO_PENDENTE'].includes(i.status) && (
                <Botao
                  pequeno
                  variante="secundario"
                  onClick={async () => {
                    try {
                      await api.post(`/integracoes/importacoes/${i.id}/descartar`);
                      q.refetch();
                    } catch (e) {
                      toast.erro(mensagemErro(e));
                    }
                  }}
                >
                  Descartar
                </Botao>
              ),
          },
        ]}
      />
    </Cartao>
  );
}

function StatusIntegracoes() {
  const q = useQuery({ queryKey: ['integracoes', 'status'], queryFn: () => api.get<any[]>('/integracoes/status') });
  if (q.isLoading) return <Carregando />;
  if (q.isError) return <ErroCarga erro={q.error} />;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {q.data!.map((s: any) => (
        <Cartao key={s.fonte} titulo={s.fonte}>
          <p className="text-sm">{s.descricao}</p>
          <p className="mt-2 break-all text-xs text-tinta-suave">{s.base}</p>
          <dl className="mt-3 space-y-1 text-xs">
            <div>Endpoint verificado em: {data(s.endpointVerificadoEm)}</div>
            <div>Último sucesso: {s.ultimoSucesso ? dataHora(s.ultimoSucesso) : '— (desde o último reinício)'}</div>
            <div>Última falha: {s.ultimaFalha ? `${dataHora(s.ultimaFalha)} — ${s.ultimoErro}` : '—'}</div>
          </dl>
          <p className="mt-3 text-xs text-atencao">{s.limitacoes}</p>
        </Cartao>
      ))}
    </div>
  );
}
