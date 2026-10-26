import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Carregando, mensagemErro } from '@/components/feedback';
import { Aviso, Botao } from '@/components/ui';
import { api } from '@/lib/api';
import { TelaPublica } from './TelaPublica';

export function requisitosSenha(s: string, email = '') {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(s)).length;
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  return [
    { ok: s.length >= 12, texto: 'Ao menos 12 caracteres' },
    { ok: classes >= 3, texto: '3 tipos entre minúsculas, maiúsculas, números e símbolos' },
    { ok: !(local.length >= 3 && s.toLowerCase().includes(local)), texto: 'Não conter o e-mail' },
    { ok: !/(.)\1{3,}/.test(s), texto: 'Sem repetir o mesmo caractere 4 vezes' },
  ];
}

export function ListaRequisitos({ senha, email }: { senha: string; email?: string }) {
  return (
    <ul className="space-y-1 text-xs" aria-live="polite">
      {requisitosSenha(senha, email).map((r) => (
        <li key={r.texto} className={r.ok ? 'text-ok' : 'text-tinta-suave'}>
          {r.ok ? '✓' : '○'} {r.texto}
        </li>
      ))}
    </ul>
  );
}

export default function ConvitePage() {
  const { token = '' } = useParams();
  const q = useQuery({ queryKey: ['convite', token], queryFn: () => api.get<{ nome: string; email: string; tipo: string }>(`/auth/convite/${encodeURIComponent(token)}`), retry: false });
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const valida = requisitosSenha(senha, q.data?.email).every((r) => r.ok) && senha === conf;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await api.post('/auth/convite/aceitar', { token, senha });
      setOk(true);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <TelaPublica titulo={q.data?.tipo === 'RECUPERACAO' ? 'Redefinir senha' : 'Ativar acesso'} subtitulo="Defina sua senha pessoal. O link é de uso único.">
      {q.isLoading && <Carregando />}
      {q.isError && (
        <Aviso tom="perigo" titulo="Link inválido ou expirado">
          Solicite um novo link à secretaria ou ao administrador.
        </Aviso>
      )}
      {ok && (
        <div className="space-y-4">
          <Aviso tom="ok" titulo="Senha definida">
            Sua senha foi registrada com sucesso.
          </Aviso>
          <Link to="/login" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-acao font-medium text-white">
            Ir para o login
          </Link>
        </div>
      )}
      {q.data && !ok && (
        <form onSubmit={enviar} className="space-y-4">
          <p className="text-sm">
            <span className="font-medium">{q.data.nome}</span>
            <br />
            <span className="text-tinta-suave">{q.data.email}</span>
          </p>
          {erro && <Aviso tom="perigo">{erro}</Aviso>}
          <div>
            <label htmlFor="nova" className="mb-1 block text-sm font-medium">
              Nova senha
            </label>
            <input id="nova" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="min-h-11 w-full rounded-lg border border-borda px-3" />
          </div>
          <ListaRequisitos senha={senha} email={q.data.email} />
          <div>
            <label htmlFor="conf" className="mb-1 block text-sm font-medium">
              Confirmar senha
            </label>
            <input id="conf" type="password" autoComplete="new-password" value={conf} onChange={(e) => setConf(e.target.value)} className="min-h-11 w-full rounded-lg border border-borda px-3" />
            {conf && conf !== senha && <p className="mt-1 text-xs text-perigo">As senhas não conferem</p>}
          </div>
          <Botao type="submit" className="w-full" disabled={!valida} carregando={enviando}>
            Definir senha
          </Botao>
        </form>
      )}
      {!q.isLoading && !q.data && !q.isError && <p>{mensagemErro(null)}</p>}
    </TelaPublica>
  );
}
