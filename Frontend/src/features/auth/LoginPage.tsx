import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { mensagemErro } from '@/components/feedback';
import { Aviso, Botao } from '@/components/ui';
import { api, definirCsrfToken, definirSessionToken } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { TelaPublica } from './TelaPublica';

const schema = z.object({ email: z.string().trim().email('Informe um e-mail válido'), senha: z.string().min(1, 'Informe a senha') });

export default function LoginPage() {
  const { me, recarregar } = useAuth();
  const navegar = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const [verSenha, setVerSenha] = useState(false);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: '', senha: '' } });
  const destino = (loc.state as { de?: string } | null)?.de ?? '/';

  if (me && !me.mfaPendente && me.unidadeAtual) return <Navigate to={destino} replace />;

  const enviar = form.handleSubmit(async (v) => {
    setErro(null);
    try {
      const r = await api.post<{ mfaPendente: boolean; csrfToken?: string; sessionToken?: string }>('/auth/login', v);
      if (r.csrfToken) definirCsrfToken(r.csrfToken);
      if (r.sessionToken) definirSessionToken(r.sessionToken);
      if (r.mfaPendente) { navegar('/mfa', { replace: true }); return; }
      qc.removeQueries({ queryKey: ['me'] });
      const resultado = await recarregar();
      const me = (resultado as { data?: import('@/hooks/useAuth').Me | null })?.data;
      if (!me) { navegar('/login', { replace: true }); return; }
      if (!me.unidadeAtual) { navegar('/selecionar-unidade', { replace: true }); return; }
      navegar(destino, { replace: true });
    } catch (e) {
      setErro(mensagemErro(e));
      form.setValue('senha', '');
    }
  });

  const e = form.formState.errors;
  return (
    <TelaPublica titulo="Entrar" subtitulo="Use as credenciais recebidas por convite.">
      <form onSubmit={enviar} noValidate className="space-y-4">
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            E-mail
          </label>
          <input id="email" type="email" autoComplete="username" className="min-h-11 w-full rounded-lg border border-borda px-3" aria-invalid={!!e.email} {...form.register('email')} />
          {e.email && <p className="mt-1 text-xs text-perigo">{e.email.message}</p>}
        </div>
        <div>
          <label htmlFor="senha" className="mb-1 block text-sm font-medium">
            Senha
          </label>
          <div className="relative">
            <input id="senha" type={verSenha ? 'text' : 'password'} autoComplete="current-password" className="min-h-11 w-full rounded-lg border border-borda px-3 pr-10" aria-invalid={!!e.senha} {...form.register('senha')} />
            <button type="button" className="absolute inset-y-0 right-2 flex items-center text-tinta-suave hover:text-tinta" onClick={() => setVerSenha(v => !v)} tabIndex={-1} aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}>
              {verSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {e.senha && <p className="mt-1 text-xs text-perigo">{e.senha.message}</p>}
        </div>
        <Botao type="submit" className="w-full" carregando={form.formState.isSubmitting}>
          Entrar
        </Botao>
        <p className="text-center text-xs text-tinta-suave">Esqueceu a senha? Solicite um novo link de acesso à secretaria ou ao administrador.</p>
      </form>
    </TelaPublica>
  );
}
