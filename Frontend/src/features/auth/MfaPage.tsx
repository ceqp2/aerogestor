import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { mensagemErro } from '@/components/feedback';
import { Aviso, Botao } from '@/components/ui';
import { api, definirCsrfToken, definirSessionToken } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { TelaPublica } from './TelaPublica';

export default function MfaPage() {
  const { me, recarregar, sair } = useAuth();
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const navegar = useNavigate();
  if (!me) return <Navigate to="/login" replace />;
  if (!me.mfaPendente) return <Navigate to="/" replace />;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const r = await api.post<{ ok: boolean; csrfToken?: string; sessionToken?: string }>('/auth/mfa/verificar', { codigo });
      if (r.csrfToken) definirCsrfToken(r.csrfToken);
      if (r.sessionToken) definirSessionToken(r.sessionToken);
      const resultado = await recarregar();
      const meAtual = (resultado as { data?: import('@/hooks/useAuth').Me | null })?.data;
      if (!meAtual?.unidadeAtual) { navegar('/selecionar-unidade', { replace: true }); return; }
      navegar('/', { replace: true });
    } catch (err) {
      setErro(mensagemErro(err));
      setCodigo('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <TelaPublica titulo="Verificação em dois fatores" subtitulo="Digite o código de 6 dígitos do seu aplicativo autenticador.">
      <form onSubmit={enviar} className="space-y-4">
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
        <label htmlFor="codigo" className="block text-sm font-medium">
          Código
        </label>
        <input
          id="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
          className="tabular min-h-12 w-full rounded-lg border border-borda px-3 text-center text-2xl tracking-[0.5em]"
        />
        <Botao type="submit" className="w-full" disabled={codigo.length !== 6} carregando={enviando}>
          Verificar
        </Botao>
        <button type="button" onClick={() => sair().then(() => navegar('/login'))} className="w-full text-sm text-acao hover:underline">
          Cancelar e voltar ao login
        </button>
      </form>
    </TelaPublica>
  );
}
