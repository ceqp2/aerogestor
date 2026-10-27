import { useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Carregando, mensagemErro } from '@/components/feedback';
import { Aviso, Selo } from '@/components/ui';
import { api } from '@/lib/api';
import { PERFIS } from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';
import { TelaPublica } from './TelaPublica';

export default function SelecionarUnidadePage() {
  const { me, carregando, recarregar } = useAuth();
  const qc = useQueryClient();
  const navegar = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  if (carregando) return <Carregando />;
  if (!me) return <Navigate to="/login" replace />;
  if (me.mfaPendente) return <Navigate to="/mfa" replace />;

  const [escolhendo, setEscolhendo] = useState<string | null>(null);
  const escolher = async (id: string) => {
    if (escolhendo) return;
    setEscolhendo(id);
    try {
      await api.post('/auth/unidade', { unidadeId: id });
      qc.clear();
      await recarregar();
      navegar('/', { replace: true });
    } catch (e) {
      setErro(mensagemErro(e));
      setEscolhendo(null);
    }
  };

  return (
    <TelaPublica titulo="Selecione a unidade" subtitulo="Os dados de cada unidade são isolados.">
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
      {!me.unidades.length && <Aviso tom="atencao">Sua conta não possui vínculo ativo com nenhuma unidade. Procure o administrador.</Aviso>}
      <ul className="space-y-2">
        {me.unidades.map((u) => (
          <li key={u.id}>
            <button onClick={() => escolher(u.id)} disabled={!!escolhendo} className="flex w-full items-center gap-3 rounded-xl border border-borda p-3 text-left hover:border-acao hover:bg-azul-claro-2 disabled:opacity-60">
              {escolhendo === u.id ? <Loader2 className="size-6 animate-spin text-acao" aria-hidden /> : <Building2 className="size-6 text-acao" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{u.sigla}</span>
                <span className="block truncate text-xs text-tinta-suave">{u.nome}</span>
              </span>
              <Selo tom={u.suporte ? 'atencao' : 'info'}>{u.suporte ? 'Suporte' : PERFIS[u.perfil]}</Selo>
            </button>
          </li>
        ))}
      </ul>
    </TelaPublica>
  );
}
