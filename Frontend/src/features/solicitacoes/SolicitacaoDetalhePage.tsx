import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DocumentosPainel } from '@/components/DocumentosPainel';
import { Carregando, ErroCarga, useToast } from '@/components/feedback';
import { FormularioModal } from '@/components/Formulario';
import { Modal } from '@/components/Modal';
import { Aviso, Botao, CabecalhoPagina, Cartao, ListaDefinicao, Selo } from '@/components/ui';
import { api } from '@/lib/api';
import { data, dataHora, isoData } from '@/lib/formato';
import { CATEGORIAS_SOLICITACAO, opcoes, PRIORIDADES, STATUS_SOLICITACAO } from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';
import { useUsuariosOpcoes } from '@/hooks/useOpcoes';
import { tomSolicitacao } from './SolicitacoesPage';

/* eslint-disable @typescript-eslint/no-explicit-any */
const TRANSICOES: Record<string, string[]> = {
  ABERTA: ['EM_TRIAGEM', 'EM_ATENDIMENTO', 'CANCELADA'],
  EM_TRIAGEM: ['EM_ATENDIMENTO', 'AGUARDANDO_EMPRESA', 'RESOLVIDA', 'CANCELADA'],
  EM_ATENDIMENTO: ['AGUARDANDO_EMPRESA', 'RESOLVIDA', 'CANCELADA'],
  AGUARDANDO_EMPRESA: ['EM_ATENDIMENTO', 'RESOLVIDA', 'CANCELADA'],
  RESOLVIDA: ['EM_ATENDIMENTO'],
  CANCELADA: [],
};

export default function SolicitacaoDetalhePage() {
  const { id = '' } = useParams();
  const { pode, me, perfil } = useAuth();
  const toast = useToast();
  const usuarios = useUsuariosOpcoes();
  const q = useQuery({ queryKey: ['solicitacao', id], queryFn: () => api.get<any>(`/solicitacoes/${id}`) });
  const [modal, setModal] = useState<null | 'triagem' | 'status' | 'interacao' | 'externa'>(null);
  const [minuta, setMinuta] = useState<string | null>(null);

  if (q.isLoading) return <Carregando linhas={5} />;
  if (q.isError) return <ErroCarga erro={q.error} tentarNovamente={() => q.refetch()} />;
  const s = q.data;
  const nome = (uid?: string) => s.pessoas.find((p: any) => p.id === uid)?.nome ?? '—';
  const proprio = s.autorId === me?.usuario.id;
  const transicoes = pode.escrever ? TRANSICOES[s.status] : proprio && s.status !== 'CANCELADA' && s.status !== 'RESOLVIDA' ? ['CANCELADA'] : [];

  return (
    <>
      <CabecalhoPagina
        voltar={{ to: '/solicitacoes', rotulo: 'Solicitações' }}
        titulo={s.titulo}
        subtitulo={
          <span className="flex flex-wrap items-center gap-2">
            <Selo tom={tomSolicitacao(s.status)}>{STATUS_SOLICITACAO[s.status]}</Selo>
            {CATEGORIAS_SOLICITACAO[s.categoria]} • Contrato <Link to={`/contratos/${s.contrato.id}`} className="text-acao hover:underline">{s.contrato.numero}</Link>
          </span>
        }
        acoes={
          <>
            {pode.escrever && <Botao variante="secundario" onClick={() => setModal('triagem')}>Triagem</Botao>}
            {transicoes.length > 0 && <Botao variante="secundario" onClick={() => setModal('status')}>Mudar status</Botao>}
            {pode.escrever && (
              <Botao
                variante="secundario"
                onClick={async () => {
                  try {
                    setMinuta((await api.post<{ texto: string }>(`/solicitacoes/${id}/minuta`)).texto);
                    q.refetch();
                  } catch (e) {
                    toast.erro(e);
                  }
                }}
              >
                Gerar minuta
              </Botao>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Cartao titulo="Descrição">
            <p className="whitespace-pre-line text-sm">{s.descricao}</p>
          </Cartao>
          <Cartao
            titulo="Histórico de interações"
            acoes={
              perfil !== 'COMANDANTE' && s.status !== 'CANCELADA' && (
                <>
                  <Botao pequeno onClick={() => setModal('interacao')}>Comentar</Botao>
                  {pode.escrever && <Botao pequeno variante="secundario" onClick={() => setModal('externa')}>Registrar comunicação com a empresa</Botao>}
                </>
              )
            }
          >
            <ol className="space-y-3">
              {s.interacoes.map((i: any) => (
                <li key={i.id} className={`rounded-lg border p-3 text-sm ${i.tipo === 'COMUNICACAO_EXTERNA' ? 'border-atencao/30 bg-atencao-fundo' : i.tipo === 'MINUTA' ? 'border-acao/20 bg-azul-claro-2' : 'border-borda'}`}>
                  <p className="text-xs text-tinta-suave">
                    {dataHora(i.criadoEm)} • {nome(i.autorId)} •{' '}
                    {i.tipo === 'COMUNICACAO_EXTERNA' ? 'Comunicação com a empresa (registro)' : i.tipo === 'MUDANCA_STATUS' ? 'Mudança de status' : i.tipo === 'MINUTA' ? 'Minuta gerada' : 'Comentário'}
                  </p>
                  <p className="mt-1 whitespace-pre-line">{i.texto}</p>
                </li>
              ))}
            </ol>
          </Cartao>
        </div>
        <div className="space-y-4">
          <Cartao titulo="Dados">
            <ListaDefinicao
              itens={[
                ['Autor', nome(s.autorId)],
                ['Responsável', nome(s.responsavelId)],
                ['Prioridade', PRIORIDADES[s.prioridade]],
                ['Prazo', data(s.prazo)],
                ['Aberta em', dataHora(s.criadoEm)],
                ['Motivo do cancelamento', s.motivoCancelamento],
              ]}
            />
          </Cartao>
          <Cartao>
            <DocumentosPainel vinculoTipo="SOLICITACAO" vinculoId={id} titulo="Anexos e comprovações" categoriaPadrao="COMUNICACAO" podeEnviar={perfil !== 'COMANDANTE'} />
          </Cartao>
        </div>
      </div>

      <FormularioModal
        aberto={modal === 'triagem'}
        aoFechar={() => setModal(null)}
        titulo="Triagem"
        campos={[
          { nome: 'responsavelId', rotulo: 'Responsável na secretaria', tipo: 'select', opcoes: usuarios },
          { nome: 'prioridade', rotulo: 'Prioridade', tipo: 'select', opcoes: opcoes(PRIORIDADES), meia: true },
          { nome: 'prazo', rotulo: 'Prazo', tipo: 'data', meia: true },
        ]}
        valoresIniciais={{ responsavelId: s.responsavelId ?? '', prioridade: s.prioridade, prazo: isoData(s.prazo) }}
        aoEnviar={async (v) => {
          await api.post(`/solicitacoes/${id}/triagem`, v);
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={modal === 'status'}
        aoFechar={() => setModal(null)}
        titulo="Mudar status"
        campos={[
          { nome: 'status', rotulo: 'Novo status', tipo: 'select', obrigatorio: true, opcoes: transicoes.map((t) => ({ value: t, label: STATUS_SOLICITACAO[t] })) },
          { nome: 'motivo', rotulo: 'Motivo / observação', tipo: 'textarea', ajuda: 'Obrigatório para cancelamento.' },
        ]}
        aoEnviar={async (v) => {
          await api.post(`/solicitacoes/${id}/status`, v);
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={modal === 'interacao' || modal === 'externa'}
        aoFechar={() => setModal(null)}
        titulo={modal === 'externa' ? 'Registrar comunicação com a empresa' : 'Comentário'}
        aviso={modal === 'externa' && <Aviso tom="atencao">Este registro documenta uma comunicação já realizada por canal oficial. Anexe a comprovação em “Anexos e comprovações”.</Aviso>}
        campos={[{ nome: 'texto', rotulo: 'Texto', tipo: 'textarea', obrigatorio: true }]}
        aoEnviar={async (v) => {
          await api.post(`/solicitacoes/${id}/interacoes`, { ...v, tipo: modal === 'externa' ? 'COMUNICACAO_EXTERNA' : 'COMENTARIO' });
          await q.refetch();
        }}
      />
      <Modal aberto={!!minuta} aoFechar={() => setMinuta(null)} titulo="Minuta (rascunho para revisão)" largo rodape={<Botao onClick={() => { navigator.clipboard?.writeText(minuta ?? ''); toast.sucesso('Minuta copiada'); }}>Copiar texto</Botao>}>
        <Aviso tom="atencao">A minuta não é enviada automaticamente e não constitui ato formal. Revise e envie por canal oficial com a autoridade competente.</Aviso>
        <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-fundo p-3 text-sm">{minuta}</pre>
      </Modal>
    </>
  );
}
