import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Carregando, ErroCarga, Vazio } from '@/components/feedback';
import { Botao, CabecalhoPagina, Cartao, Selo } from '@/components/ui';
import { api } from '@/lib/api';
import { dataHora } from '@/lib/formato';

interface Notificacao {
  id: string;
  nivel: 'INFO' | 'ATENCAO' | 'CRITICO';
  titulo: string;
  mensagem: string;
  regra: string;
  link?: string;
  lidaEm?: string;
  criadaEm: string;
}

export default function NotificacoesPage() {
  const [soNaoLidas, setSoNaoLidas] = useState(true);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notificacoes', soNaoLidas], queryFn: () => api.get<Notificacao[]>(`/notificacoes?naoLidas=${soNaoLidas}`) });
  const atualizar = () => qc.invalidateQueries({ queryKey: ['notificacoes'] });
  const marcar = async (id: string) => {
    await api.post(`/notificacoes/${id}/lida`);
    atualizar();
  };

  return (
    <>
      <CabecalhoPagina
        titulo="Notificações"
        subtitulo="Geradas pelo job diário idempotente (lembretes de vigência, atrasos, pendências) e por eventos do sistema."
        acoes={
          <>
            <Botao variante="secundario" onClick={() => setSoNaoLidas(!soNaoLidas)}>
              {soNaoLidas ? 'Mostrar todas' : 'Somente não lidas'}
            </Botao>
            <Botao
              onClick={async () => {
                await api.post('/notificacoes/todas-lidas');
                atualizar();
              }}
            >
              Marcar todas como lidas
            </Botao>
          </>
        }
      />
      <Cartao>
        {q.isLoading ? (
          <Carregando />
        ) : q.isError ? (
          <ErroCarga erro={q.error} />
        ) : !q.data!.length ? (
          <Vazio titulo="Nenhuma notificação" />
        ) : (
          <ul className="divide-y divide-borda">
            {q.data!.map((n) => (
              <li key={n.id} className={`flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-3 ${n.lidaEm ? 'opacity-70' : ''}`}>
                <Selo tom={n.nivel === 'CRITICO' ? 'perigo' : n.nivel === 'ATENCAO' ? 'atencao' : 'info'}>{n.nivel === 'CRITICO' ? 'Crítico' : n.nivel === 'ATENCAO' ? 'Atenção' : 'Info'}</Selo>
                <div className="min-w-0 flex-1">
                  {n.link ? (
                    <Link to={n.link} onClick={() => !n.lidaEm && marcar(n.id)} className="font-medium hover:text-acao hover:underline">
                      {n.titulo}
                    </Link>
                  ) : (
                    <p className="font-medium">{n.titulo}</p>
                  )}
                  <p className="text-sm">{n.mensagem}</p>
                  <p className="text-xs text-tinta-suave">
                    {dataHora(n.criadaEm)} • Regra: {n.regra}
                  </p>
                </div>
                {!n.lidaEm && (
                  <Botao pequeno variante="fantasma" onClick={() => marcar(n.id)}>
                    Marcar lida
                  </Botao>
                )}
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </>
  );
}
