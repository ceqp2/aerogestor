import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Carregando, ErroCarga, mensagemErro, useToast } from '@/components/feedback';
import { Tabela } from '@/components/Tabela';
import { Aviso, Botao, CabecalhoPagina, Cartao, ListaDefinicao, Selo } from '@/components/ui';
import { api } from '@/lib/api';
import { dataHora } from '@/lib/formato';
import { PERFIS } from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';
import { useMutacao } from '@/hooks/useMutacao';
import { ListaRequisitos, requisitosSenha } from './ConvitePage';

interface SessaoAtiva {
  id: string;
  criadaEm: string;
  ultimoUso: string;
  ip?: string;
  userAgent?: string;
}

export default function MinhaContaPage() {
  const { me, recarregar } = useAuth();
  const toast = useToast();
  const sessoes = useQuery({ queryKey: ['sessoes'], queryFn: () => api.get<SessaoAtiva[]>('/auth/sessoes') });
  const revogar = useMutacao((id: string) => api.delete(`/auth/sessoes/${id}`), { invalidar: [['sessoes']], sucesso: 'Sessão encerrada' });

  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const trocar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroSenha(null);
    try {
      await api.post('/auth/senha', { senhaAtual: atual, novaSenha: nova });
      setAtual('');
      setNova('');
      toast.sucesso('Senha alterada. Outras sessões foram encerradas.');
    } catch (err) {
      setErroSenha(mensagemErro(err));
    }
  };

  const [qr, setQr] = useState<{ qrCode: string; segredo: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const configurar = async () => {
    try {
      setQr(await api.post('/auth/mfa/configurar'));
    } catch (e) {
      toast.erro(e);
    }
  };
  const ativar = async () => {
    try {
      await api.post('/auth/mfa/ativar', { codigo });
      setQr(null);
      setCodigo('');
      await recarregar();
      toast.sucesso('Autenticação em dois fatores ativada');
    } catch (e) {
      toast.erro(e);
    }
  };

  if (!me) return null;
  return (
    <>
      <CabecalhoPagina titulo="Minha conta e segurança" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao titulo="Dados">
          <ListaDefinicao
            itens={[
              ['Nome', me.usuario.nome],
              ['E-mail', me.usuario.email],
              ['Unidade', me.unidadeAtual?.sigla],
              ['Perfil', me.unidadeAtual ? PERFIS[me.unidadeAtual.perfil] : '—'],
              ['Sessão expira em', dataHora(me.expiraEm)],
            ]}
          />
        </Cartao>

        <Cartao titulo="Autenticação em dois fatores (MFA)">
          {me.usuario.mfaAtivo ? (
            <Aviso tom="ok">MFA ativo. Para redefinir, solicite ao administrador.</Aviso>
          ) : qr ? (
            <div className="space-y-3">
              <p className="text-sm">Escaneie o QR code no aplicativo autenticador (ex.: Google Authenticator, Microsoft Authenticator) e informe o código gerado.</p>
              <img src={qr.qrCode} alt="QR code para configuração do autenticador" className="mx-auto size-48" />
              <p className="break-all text-center text-xs text-tinta-suave">
                Chave manual: <code>{qr.segredo}</code>
              </p>
              <div className="flex gap-2">
                <label htmlFor="cod" className="sr-only">
                  Código
                </label>
                <input id="cod" inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} className="tabular min-h-11 flex-1 rounded-lg border border-borda px-3 text-center tracking-widest" placeholder="000000" />
                <Botao onClick={ativar} disabled={codigo.length !== 6}>
                  Ativar
                </Botao>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Aviso tom={me.mfaObrigatorio ? 'atencao' : 'info'}>
                {me.mfaObrigatorio ? 'Obrigatório para o seu perfil.' : 'Recomendado para perfis com privilégios.'} Proteja sua conta com um segundo fator.
              </Aviso>
              <Botao onClick={configurar}>Configurar MFA</Botao>
            </div>
          )}
        </Cartao>

        <Cartao titulo="Alterar senha">
          <form onSubmit={trocar} className="space-y-3">
            {erroSenha && <Aviso tom="perigo">{erroSenha}</Aviso>}
            <div>
              <label htmlFor="atual" className="mb-1 block text-sm font-medium">
                Senha atual
              </label>
              <input id="atual" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} className="min-h-11 w-full rounded-lg border border-borda px-3" />
            </div>
            <div>
              <label htmlFor="nova" className="mb-1 block text-sm font-medium">
                Nova senha
              </label>
              <input id="nova" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} className="min-h-11 w-full rounded-lg border border-borda px-3" />
            </div>
            <ListaRequisitos senha={nova} email={me.usuario.email} />
            <Botao type="submit" disabled={!atual || !requisitosSenha(nova, me.usuario.email).every((r) => r.ok)}>
              Alterar senha
            </Botao>
          </form>
        </Cartao>

        <Cartao titulo="Sessões ativas">
          {sessoes.isLoading ? (
            <Carregando />
          ) : sessoes.isError ? (
            <ErroCarga erro={sessoes.error} />
          ) : (
            <Tabela
              rotulo="Sessões ativas"
              dados={sessoes.data ?? []}
              chave={(s) => s.id}
              colunas={[
                { titulo: 'Início', render: (s) => dataHora(s.criadaEm), principal: true },
                { titulo: 'Último uso', render: (s) => dataHora(s.ultimoUso) },
                { titulo: 'Origem', render: (s) => <span className="text-xs">{s.ip ?? '—'}</span> },
                {
                  titulo: '',
                  render: (s) => (
                    <Botao pequeno variante="secundario" onClick={() => revogar.mutate(s.id)}>
                      Encerrar
                    </Botao>
                  ),
                },
              ]}
            />
          )}
          <p className="mt-2 text-xs text-tinta-suave">
            <Selo tom="info">Dica</Selo> Encerrar a sessão atual equivale a sair.
          </p>
        </Cartao>
      </div>
    </>
  );
}
