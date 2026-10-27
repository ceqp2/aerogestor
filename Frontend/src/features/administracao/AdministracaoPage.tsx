import { useQuery } from '@tanstack/react-query';
import { Eye, EyeOff, Plus } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Carregando, ErroCarga, useToast, Vazio } from '@/components/feedback';
import { FormularioModal } from '@/components/Formulario';
import { ListaAuditoria, RegistroAuditoria } from '@/components/HistoricoPainel';
import { Confirmacao, Modal } from '@/components/Modal';
import { Abas, BarraFiltros, FiltroTexto, Paginacao, Tabela } from '@/components/Tabela';
import { Aviso, Botao, CabecalhoPagina, Cartao, ListaDefinicao, Selo } from '@/components/ui';
import { api, Paginado, qs } from '@/lib/api';
import { data, dataHora } from '@/lib/formato';
import { ETAPAS, FORMAS, PERFIS, rotulo } from '@/lib/rotulos';
import { Perfil, useAuth } from '@/hooks/useAuth';
import { enviarEmailAcesso } from '@/lib/emailjs';

/* eslint-disable @typescript-eslint/no-explicit-any */
const PODE_GERIR: Record<Perfil, Perfil[]> = {
  ADMIN: ['ADMIN', 'COMANDANTE', 'CHEFE', 'AUXILIAR', 'GESTOR'],
  CHEFE: ['AUXILIAR', 'GESTOR'],
  AUXILIAR: ['GESTOR'],
  COMANDANTE: [],
  GESTOR: [],
};

export default function AdministracaoPage() {
  const { perfil } = useAuth();
  const [sp, setSp] = useSearchParams();
  const aba = sp.get('aba') ?? 'usuarios';
  const abas = [
    { chave: 'usuarios', rotulo: 'Usuários' },
    ...(perfil === 'ADMIN' || perfil === 'CHEFE' ? [{ chave: 'unidade', rotulo: 'Unidade e parâmetros' }] : []),
    { chave: 'modelos', rotulo: 'Modelos de checklist' },
    ...(perfil !== 'AUXILIAR' ? [{ chave: 'auditoria', rotulo: 'Auditoria' }] : []),
    ...(perfil === 'ADMIN' ? [{ chave: 'suporte', rotulo: 'Suporte entre unidades' }] : []),
  ];
  return (
    <>
      <CabecalhoPagina titulo="Administração" subtitulo="Usuários, permissões, parâmetros, modelos e auditoria. Toda alteração é registrada." />
      <Abas abas={abas} ativa={aba} aoMudar={(a) => setSp({ aba: a })} />
      {aba === 'usuarios' && <Usuarios />}
      {aba === 'unidade' && <Unidade />}
      {aba === 'modelos' && <Modelos />}
      {aba === 'auditoria' && <Auditoria />}
      {aba === 'suporte' && <Suporte />}
    </>
  );
}


function NovoUsuarioModal({ aberto, aoFechar, perfisCriaveis, aoSalvar }: { aberto: boolean; aoFechar: () => void; perfisCriaveis: string[]; aoSalvar: (v: any) => Promise<void> }) {
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState({ nome: '', nomeGuerra: '', postoGraduacao: '', email: '', perfil: perfisCriaveis[0] ?? '', senha: '', confirmarSenha: '' });
  const [enviando, setEnviando] = useState(false);
  const [verSenha, setVerSenha] = useState(false);
  const [verConfirmar, setVerConfirmar] = useState(false);

  const resetar = () => { setCampos({ nome: '', nomeGuerra: '', postoGraduacao: '', email: '', perfil: perfisCriaveis[0] ?? '', senha: '', confirmarSenha: '' }); setErro(null); setVerSenha(false); setVerConfirmar(false); };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!campos.nome.trim()) return setErro('Nome completo é obrigatório');
    if (!campos.nomeGuerra.trim()) return setErro('Nome de guerra é obrigatório');
    if (!campos.email.trim()) return setErro('E-mail é obrigatório');
    if (!campos.perfil) return setErro('Perfil é obrigatório');
    if (!campos.senha) return setErro('Senha temporária é obrigatória');
    if (campos.senha !== campos.confirmarSenha) return setErro('As senhas não coincidem');
    setEnviando(true);
    try {
      await aoSalvar({ nome: campos.nome.trim(), nomeGuerra: campos.nomeGuerra.trim(), postoGraduacao: campos.postoGraduacao.trim() || undefined, email: campos.email.trim(), perfil: campos.perfil, senha: campos.senha });
      resetar();
      aoFechar();
    } catch (ex: any) {
      setErro(ex?.message ?? 'Erro ao salvar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal aberto={aberto} aoFechar={() => { resetar(); aoFechar(); }} titulo="Novo usuário" rodape={<><Botao variante="secundario" onClick={() => { resetar(); aoFechar(); }}>Cancelar</Botao><Botao type="submit" form="form-novo-usuario" carregando={enviando}>Salvar</Botao></>}>
      <form id="form-novo-usuario" onSubmit={enviar} noValidate className="space-y-3">
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label htmlFor="nu-nome" className="mb-1 block text-sm font-medium">Nome completo *</label>
            <input id="nu-nome" className="min-h-11 w-full rounded-lg border border-borda px-3" value={campos.nome} onChange={e => setCampos(p => ({ ...p, nome: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="nu-nguerra" className="mb-1 block text-sm font-medium">Nome de guerra *</label>
            <input id="nu-nguerra" className="min-h-11 w-full rounded-lg border border-borda px-3" value={campos.nomeGuerra} onChange={e => setCampos(p => ({ ...p, nomeGuerra: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="nu-posto" className="mb-1 block text-sm font-medium">Posto/graduação</label>
            <input id="nu-posto" className="min-h-11 w-full rounded-lg border border-borda px-3" value={campos.postoGraduacao} onChange={e => setCampos(p => ({ ...p, postoGraduacao: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label htmlFor="nu-email" className="mb-1 block text-sm font-medium">E-mail institucional *</label>
            <input id="nu-email" type="email" className="min-h-11 w-full rounded-lg border border-borda px-3" value={campos.email} onChange={e => setCampos(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label htmlFor="nu-perfil" className="mb-1 block text-sm font-medium">Perfil *</label>
            <select id="nu-perfil" className="min-h-11 w-full rounded-lg border border-borda px-3" value={campos.perfil} onChange={e => setCampos(p => ({ ...p, perfil: e.target.value }))}>
              {perfisCriaveis.map(p => <option key={p} value={p}>{PERFIS[p as keyof typeof PERFIS] ?? p}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="nu-senha" className="mb-1 block text-sm font-medium">Senha temporária *</label>
            <div className="relative">
              <input id="nu-senha" type={verSenha ? 'text' : 'password'} autoComplete="new-password" className="min-h-11 w-full rounded-lg border border-borda px-3 pr-10" value={campos.senha} onChange={e => setCampos(p => ({ ...p, senha: e.target.value }))} />
              <button type="button" className="absolute inset-y-0 right-2 flex items-center text-tinta-suave hover:text-tinta" onClick={() => setVerSenha(v => !v)} tabIndex={-1} aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                {verSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="nu-confirmar" className="mb-1 block text-sm font-medium">Confirmar senha *</label>
            <div className="relative">
              <input id="nu-confirmar" type={verConfirmar ? 'text' : 'password'} autoComplete="new-password" className="min-h-11 w-full rounded-lg border border-borda px-3 pr-10" value={campos.confirmarSenha} onChange={e => setCampos(p => ({ ...p, confirmarSenha: e.target.value }))} />
              <button type="button" className="absolute inset-y-0 right-2 flex items-center text-tinta-suave hover:text-tinta" onClick={() => setVerConfirmar(v => !v)} tabIndex={-1} aria-label={verConfirmar ? 'Ocultar senha' : 'Mostrar senha'}>
                {verConfirmar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        </div>
        <p className="text-xs text-tinta-suave">Política: mín. 12 caracteres com ao menos 3 de: maiúsculas, minúsculas, números e símbolos.</p>
      </form>
    </Modal>
  );
}

function Usuarios() {
  const { perfil, pode } = useAuth();
  const toast = useToast();
  const q = useQuery({ queryKey: ['usuarios'], queryFn: () => api.get<any[]>('/usuarios') });
  const [criar, setCriar] = useState(false);
  const [link, setLink] = useState<{ link: string; expiraEmHoras: number } | null>(null);
  const [acao, setAcao] = useState<{ tipo: 'desativar' | 'reativar' | 'mfa'; u: any } | null>(null);
  const [mudarPerfil, setMudarPerfil] = useState<any>(null);
  const perfisCriaveis = perfil ? PODE_GERIR[perfil] : [];
  const executar = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.sucesso(msg);
      q.refetch();
    } catch (e) {
      toast.erro(e);
    }
  };

  if (q.isLoading) return <Carregando />;
  if (q.isError) return <ErroCarga erro={q.error} />;
  return (
    <>
      <Cartao titulo="Usuários da unidade" acoes={perfisCriaveis.length > 0 && <Botao pequeno icone={<Plus className="size-4" />} onClick={() => setCriar(true)}>Novo usuário</Botao>}>
        <div className="mb-3">
          <Aviso>
            {perfil === 'AUXILIAR' && 'Seu perfil cria apenas contas de gestor. '}
            {perfil === 'CHEFE' && 'Seu perfil cria e desativa auxiliares e gestores. '}
            Usuário com histórico é desativado, nunca apagado; a desativação revoga sessões e preserva designações.
          </Aviso>
        </div>
        <Tabela
          rotulo="Usuários"
          dados={q.data!}
          chave={(u) => u.id}
          vazio={<Vazio titulo="Nenhum usuário" />}
          colunas={[
            { titulo: 'Nome', principal: true, render: (u) => <div><p className="font-medium">{u.postoGraduacao} {u.nomeGuerra ?? u.nome}</p><p className="text-xs text-tinta-suave">{u.nome} · {u.email}</p></div> },
            { titulo: 'Perfil', render: (u) => PERFIS[u.perfil] },
            {
              titulo: 'Situação',
              render: (u) => (
                <span className="flex flex-wrap gap-1">
                  {u.vinculoAtivo && u.contaAtiva ? <Selo tom="ok">Ativo</Selo> : <Selo tom="neutro">Desativado</Selo>}
                  {!u.senhaDefinida && <Selo tom="atencao">Sem senha</Selo>}
                  {u.mfaAtivo && <Selo tom="info">MFA</Selo>}
                </span>
              ),
            },
            { titulo: 'Último acesso', render: (u) => dataHora(u.ultimoLogin) },
            {
              titulo: 'Ações',
              render: (u) =>
                u.podeGerir ? (
                  <div className="flex flex-wrap gap-1">
                    {u.vinculoAtivo ? (
                      <>
                        <Botao pequeno variante="secundario" onClick={() => executar(async () => setLink(await api.post(`/usuarios/${u.id}/link-acesso`)), 'Link gerado')}>
                          Link de redefinição de senha
                        </Botao>
                        <Botao pequeno variante="secundario" onClick={() => executar(() => api.post(`/usuarios/${u.id}/revogar-sessoes`), 'Sessões revogadas')}>
                          Revogar sessões
                        </Botao>
                        {pode.gerir && (
                          <Botao pequeno variante="fantasma" onClick={() => setMudarPerfil(u)}>
                            Perfil
                          </Botao>
                        )}
                        {perfil === 'ADMIN' && u.mfaAtivo && (
                          <Botao pequeno variante="fantasma" onClick={() => setAcao({ tipo: 'mfa', u })}>
                            Resetar MFA
                          </Botao>
                        )}
                        <Botao pequeno variante="perigo" onClick={() => setAcao({ tipo: 'desativar', u })}>
                          Desativar
                        </Botao>
                      </>
                    ) : (
                      <Botao pequeno variante="secundario" onClick={() => setAcao({ tipo: 'reativar', u })}>
                        Reativar
                      </Botao>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-tinta-suave">—</span>
                ),
            },
          ]}
        />
      </Cartao>
      <NovoUsuarioModal
        aberto={criar}
        aoFechar={() => setCriar(false)}
        perfisCriaveis={perfisCriaveis}
        aoSalvar={async (v) => {
          await api.post('/usuarios', v);
          await q.refetch();
          toast.sucesso('Usuário criado com sucesso');
          try {
            await enviarEmailAcesso({
              nomeDestinatario: v.nomeGuerra ?? v.nome,
              emailDestinatario: v.email,
              senhaTemporaria: v.senha,
              urlSistema: window.location.origin,
            });
          } catch {
            toast.info('Usuário criado, mas o e-mail não pôde ser enviado. Informe a senha manualmente.');
          }
        }}
      />
      <FormularioModal
        aberto={!!mudarPerfil}
        aoFechar={() => setMudarPerfil(null)}
        titulo={`Alterar perfil — ${mudarPerfil?.nome ?? ''}`}
        aviso={<Aviso tom="atencao">A alteração revoga as sessões do usuário. Acesso a uma tela não confere competência administrativa para atos formais.</Aviso>}
        campos={[
          { nome: 'perfil', rotulo: 'Novo perfil', tipo: 'select', obrigatorio: true, opcoes: perfisCriaveis.map((p) => ({ value: p, label: PERFIS[p] })) },
          { nome: 'motivo', rotulo: 'Motivo', tipo: 'textarea', obrigatorio: true, minimo: 5 },
        ]}
        aoEnviar={async (v) => {
          await api.post(`/usuarios/${mudarPerfil.id}/perfil`, v);
          await q.refetch();
        }}
      />
      <Confirmacao
        aberto={!!acao}
        aoFechar={() => setAcao(null)}
        titulo={acao?.tipo === 'desativar' ? 'Desativar usuário' : acao?.tipo === 'reativar' ? 'Reativar usuário' : 'Resetar MFA'}
        texto={
          acao?.tipo === 'desativar'
            ? `${acao.u.nome} perderá o acesso imediatamente (sessões revogadas). Designações e histórico são preservados.`
            : acao?.tipo === 'reativar'
              ? `Reativar o acesso de ${acao?.u.nome}.`
              : `O usuário precisará configurar o MFA novamente.`
        }
        perigo={acao?.tipo === 'desativar'}
        pedirMotivo
        aoConfirmar={(motivo) => {
          const a = acao!;
          setAcao(null);
          executar(
            () => api.post(`/usuarios/${a.u.id}/${a.tipo === 'mfa' ? 'resetar-mfa' : a.tipo}`, { motivo }),
            a.tipo === 'desativar' ? 'Usuário desativado' : a.tipo === 'reativar' ? 'Usuário reativado' : 'MFA resetado',
          );
        }}
      />
      {link && (
        <Modal aberto={!!link} aoFechar={() => setLink(null)} titulo="Link de redefinição de senha" rodape={<Botao onClick={() => setLink(null)}>Fechar</Botao>}>
          <p className="mb-2 text-sm">Envie este link para o usuário. Expira em <strong>{link.expiraEmHoras}h</strong>.</p>
          <div className="flex items-center gap-2 rounded-lg border border-borda bg-fundo-alt p-3">
            <code className="flex-1 break-all text-xs">{link.link}</code>
            <Botao pequeno variante="secundario" onClick={() => { navigator.clipboard.writeText(link.link); toast.sucesso('Link copiado'); }}>Copiar</Botao>
          </div>
        </Modal>
      )}
    </>
  );
}

function Unidade() {
  const { me, perfil } = useAuth();
  const unidades = useQuery({ queryKey: ['unidades'], queryFn: () => api.get<any[]>('/unidades') });
  const params = useQuery({ queryKey: ['parametros'], queryFn: () => api.get<any>('/unidades/parametros') });
  const [editar, setEditar] = useState(false);
  const [novoParam, setNovoParam] = useState(false);
  const [novaUnidade, setNovaUnidade] = useState(false);
  const atual = unidades.data?.find((u) => u.id === me?.unidadeAtual?.id);
  return (
    <div className="space-y-4">
      <Cartao titulo="Unidade atual" acoes={<Botao pequeno variante="secundario" onClick={() => setEditar(true)}>Editar</Botao>}>
        {atual ? (
          <ListaDefinicao itens={[['Sigla', atual.sigla], ['Nome', atual.nome], ['Nome da seção', atual.nomeSecao], ['Cidade', atual.cidade]]} />
        ) : (
          <Carregando />
        )}
        <p className="mt-3 text-xs text-tinta-suave">Nome da seção configurável: a nomenclatura interna deve ser confirmada pela organização.</p>
      </Cartao>
      {perfil === 'ADMIN' && (
        <Cartao titulo="Unidades" acoes={<Botao pequeno icone={<Plus className="size-4" />} onClick={() => setNovaUnidade(true)}>Unidade</Botao>}>
          <Tabela rotulo="Unidades" dados={unidades.data ?? []} chave={(u: any) => u.id} colunas={[{ titulo: 'Sigla', principal: true, render: (u: any) => u.sigla }, { titulo: 'Nome', render: (u: any) => u.nome }, { titulo: 'Ativa', render: (u: any) => (u.ativo ? 'Sim' : 'Não') }]} />
          <p className="mt-2 text-xs text-tinta-suave">Os dados de cada unidade são isolados; suporte entre unidades exige concessão explícita e temporária.</p>
        </Cartao>
      )}
      <Cartao titulo="Parâmetros normativos e gerenciais (versionados)" acoes={<Botao pequeno icone={<Plus className="size-4" />} onClick={() => setNovoParam(true)}>Nova versão</Botao>}>
        <div className="mb-3">
          <Aviso tom="atencao">Regras quantitativas, prazos e valores normativos são versionados com fonte, vigência e aprovador — não ficam fixos no código. Parâmetros sem aprovador permanecem “pendentes de validação”.</Aviso>
        </div>
        {params.isLoading ? (
          <Carregando />
        ) : (
          <Tabela
            rotulo="Parâmetros"
            dados={params.data?.cadastrados ?? []}
            chave={(p: any) => p.id}
            colunas={[
              { titulo: 'Chave', principal: true, render: (p: any) => <div><code className="text-xs">{p.chave}</code><p className="text-xs text-tinta-suave">{p.descricao}</p></div> },
              { titulo: 'Valor', render: (p: any) => <code className="break-all text-xs">{JSON.stringify(p.valor)}</code> },
              { titulo: 'Escopo', render: (p: any) => (p.unidadeId ? 'Unidade' : 'Global') },
              { titulo: 'Vigência', render: (p: any) => `${data(p.vigenciaInicio)}${p.vigenciaFim ? ` a ${data(p.vigenciaFim)}` : ''}` },
              { titulo: 'Fonte', render: (p: any) => <span className="text-xs">{p.fonte}</span> },
              { titulo: 'Validação', render: (p: any) => (p.pendenteValidacao ? <Selo tom="atencao">Pendente</Selo> : <Selo tom="ok">{p.aprovador}</Selo>) },
            ]}
          />
        )}
      </Cartao>
      <FormularioModal
        aberto={editar}
        aoFechar={() => setEditar(false)}
        titulo="Editar unidade"
        campos={[
          { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
          { nome: 'nomeSecao', rotulo: 'Nome da seção', obrigatorio: true },
          { nome: 'cidade', rotulo: 'Cidade' },
        ]}
        valoresIniciais={atual ? { nome: atual.nome, nomeSecao: atual.nomeSecao, cidade: atual.cidade ?? '' } : undefined}
        aoEnviar={async (v) => {
          await api.patch('/unidades/atual', v);
          await unidades.refetch();
        }}
      />
      <FormularioModal
        aberto={novaUnidade}
        aoFechar={() => setNovaUnidade(false)}
        titulo="Nova unidade"
        campos={[
          { nome: 'sigla', rotulo: 'Sigla (maiúsculas)', obrigatorio: true, meia: true },
          { nome: 'cidade', rotulo: 'Cidade', meia: true },
          { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
          { nome: 'nomeSecao', rotulo: 'Nome da seção' },
        ]}
        aoEnviar={async (v) => {
          await api.post('/unidades', v);
          await unidades.refetch();
        }}
      />
      <FormularioModal
        aberto={novoParam}
        aoFechar={() => setNovoParam(false)}
        titulo="Nova versão de parâmetro"
        largo
        campos={[
          { nome: 'chave', rotulo: 'Chave', obrigatorio: true, tipo: 'select', opcoes: Object.keys(params.data?.padroesPropostos ?? {}).filter((k) => perfil === 'ADMIN' || /^(lembretes|alertas)\./.test(k)).map((k) => ({ value: k, label: k })) },
          { nome: 'descricao', rotulo: 'Descrição', obrigatorio: true },
          { nome: 'valorJson', rotulo: 'Valor (JSON)', tipo: 'textarea', obrigatorio: true, placeholder: '[90, 60, 30, 15, 7, 0]' },
          { nome: 'fonte', rotulo: 'Fonte normativa / gerencial', obrigatorio: true },
          { nome: 'vigenciaInicio', rotulo: 'Vigência a partir de', tipo: 'data', obrigatorio: true, meia: true },
          { nome: 'vigenciaFim', rotulo: 'Vigência até', tipo: 'data', meia: true },
          { nome: 'aprovador', rotulo: 'Aprovador (deixe vazio se pendente)' },
          ...(perfil === 'ADMIN' ? [{ nome: 'global', rotulo: 'Parâmetro global (todas as unidades)', tipo: 'checkbox' as const }] : []),
        ]}
        aoEnviar={async (v) => {
          await api.post('/unidades/parametros', { ...v, global: !!v.global });
          await params.refetch();
        }}
      />
    </div>
  );
}

function Modelos() {
  const { perfil } = useAuth();
  const q = useQuery({ queryKey: ['modelos-checklist'], queryFn: () => api.get<any[]>('/processos/modelos-checklist') });
  const [ver, setVer] = useState<any>(null);
  if (q.isLoading) return <Carregando />;
  if (q.isError) return <ErroCarga erro={q.error} />;
  return (
    <Cartao titulo="Modelos de checklist (versionados)">
      <div className="mb-3">
        <Aviso>Modelos iniciais propostos com referências à Lei 14.133/2021. Devem ser validados com normas FAB/COMAER e modelos locais. Nova versão desativa a anterior sem apagá-la{perfil !== 'ADMIN' && ' (somente administrador)'}.</Aviso>
      </div>
      <Tabela
        rotulo="Modelos"
        dados={q.data!}
        chave={(m: any) => m.id}
        colunas={[
          { titulo: 'Modelo', principal: true, render: (m: any) => <button className="text-left font-medium text-acao hover:underline" onClick={() => setVer(m)}>{m.nome}</button> },
          { titulo: 'Forma', render: (m: any) => rotulo(FORMAS, m.formaContratacao) },
          { titulo: 'Versão', render: (m: any) => `v${m.versao}` },
          { titulo: 'Itens', render: (m: any) => m.itens.length },
          { titulo: 'Situação', render: (m: any) => (m.ativo ? <Selo tom="ok">Ativo</Selo> : <Selo tom="neutro">Inativo</Selo>) },
          { titulo: 'Escopo', render: (m: any) => (m.unidadeId ? 'Unidade' : 'Global') },
        ]}
      />
      <Modal aberto={!!ver} aoFechar={() => setVer(null)} titulo={`${ver?.nome ?? ''} — v${ver?.versao ?? ''}`} largo>
        <ol className="space-y-2 text-sm">
          {ver?.itens.map((i: any) => (
            <li key={i.id} className="rounded-lg border border-borda p-2">
              <p className="font-medium">
                {i.ordem}. {i.titulo} {i.critico && <Selo tom="atencao">Crítico</Selo>} {i.exigeEvidencia && <Selo tom="info">Evidência</Selo>}
              </p>
              <p className="text-xs text-tinta-suave">
                {ETAPAS[i.etapa]} • {i.referenciaNormativa}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-tinta-suave">Fonte: {ver?.fonte}</p>
      </Modal>
    </Cartao>
  );
}

function Auditoria() {
  const [busca, setBusca] = useState('');
  const [entidade, setEntidade] = useState('');
  const [pagina, setPagina] = useState(1);
  const q = useQuery({ queryKey: ['auditoria', busca, entidade, pagina], queryFn: () => api.get<Paginado<RegistroAuditoria>>(`/auditoria${qs({ busca, entidade, pagina, tamanho: 30 })}`) });
  return (
    <Cartao titulo="Trilha de auditoria (append-only)">
      <BarraFiltros>
        <FiltroTexto rotulo="Usuário" valor={busca} aoMudar={(v) => { setBusca(v); setPagina(1); }} />
        <FiltroTexto rotulo="Entidade" valor={entidade} aoMudar={(v) => { setEntidade(v); setPagina(1); }} placeholder="Processo, ContratoInstrumento, Usuario…" />
      </BarraFiltros>
      {q.isLoading ? <Carregando /> : q.isError ? <ErroCarga erro={q.error} /> : (
        <>
          <ListaAuditoria itens={q.data!.itens} />
          <Paginacao pagina={q.data!.pagina} paginas={q.data!.paginas} total={q.data!.total} aoMudar={setPagina} />
        </>
      )}
      <p className="mt-3 text-xs text-tinta-suave">Registros não podem ser alterados ou apagados pela aplicação (bloqueio também no banco). Recomenda-se cópia externa protegida dos logs.</p>
    </Cartao>
  );
}

function Suporte() {
  const q = useQuery({ queryKey: ['suporte'], queryFn: () => api.get<any[]>('/usuarios/suporte/concessoes') });
  const [conceder, setConceder] = useState(false);
  const toast = useToast();
  return (
    <Cartao titulo="Concessões de suporte entre unidades" acoes={<Botao pequeno onClick={() => setConceder(true)}>Conceder</Botao>}>
      <div className="mb-3">
        <Aviso>Permite que um administrador de outra unidade acesse esta unidade temporariamente. A concessão é explícita, com motivo e prazo, e rastreável.</Aviso>
      </div>
      {q.isLoading ? <Carregando /> : (
        <Tabela
          rotulo="Concessões"
          dados={q.data ?? []}
          chave={(c: any) => c.id}
          vazio={<Vazio titulo="Nenhuma concessão" />}
          colunas={[
            { titulo: 'Usuário', principal: true, render: (c: any) => <code className="text-xs">{c.usuarioId}</code> },
            { titulo: 'Motivo', render: (c: any) => c.motivo },
            { titulo: 'Período', render: (c: any) => `${dataHora(c.inicio)} → ${dataHora(c.fim)}` },
            {
              titulo: '',
              render: (c: any) =>
                c.revogadoEm ? <Selo>Revogada</Selo> : (
                  <Botao pequeno variante="secundario" onClick={async () => { try { await api.delete(`/usuarios/suporte/concessoes/${c.id}`); q.refetch(); } catch (e) { toast.erro(e); } }}>
                    Revogar
                  </Botao>
                ),
            },
          ]}
        />
      )}
      <FormularioModal
        aberto={conceder}
        aoFechar={() => setConceder(false)}
        titulo="Conceder suporte"
        campos={[
          { nome: 'usuarioId', rotulo: 'ID do usuário administrador (outra unidade)', obrigatorio: true },
          { nome: 'horas', rotulo: 'Duração (horas, máx. 168)', tipo: 'numero', obrigatorio: true, min: 1, max: 168 },
          { nome: 'motivo', rotulo: 'Motivo', tipo: 'textarea', obrigatorio: true, minimo: 5 },
        ]}
        aoEnviar={async (v) => {
          await api.post('/usuarios/suporte/concessoes', v);
          await q.refetch();
        }}
      />
    </Cartao>
  );
}

