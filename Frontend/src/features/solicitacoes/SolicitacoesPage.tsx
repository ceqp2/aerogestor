import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Carregando, ErroCarga, Vazio } from '@/components/feedback';
import { FormularioModal } from '@/components/Formulario';
import { BarraFiltros, FiltroSelect, FiltroTexto, Paginacao, Tabela } from '@/components/Tabela';
import { Botao, CabecalhoPagina, Cartao, Selo, Tom } from '@/components/ui';
import { api, Paginado, qs } from '@/lib/api';
import { data, dataHora } from '@/lib/formato';
import { CATEGORIAS_SOLICITACAO, opcoes, PRIORIDADES, STATUS_SOLICITACAO } from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';
import { useContratosOpcoes } from '@/hooks/useOpcoes';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const tomSolicitacao = (s: string): Tom => (s === 'RESOLVIDA' ? 'ok' : s === 'CANCELADA' ? 'neutro' : s === 'AGUARDANDO_EMPRESA' ? 'atencao' : 'info');

export default function SolicitacoesPage() {
  const { perfil } = useAuth();
  const navegar = useNavigate();
  const contratos = useContratosOpcoes();
  const [sp, setSp] = useSearchParams();
  const [criar, setCriar] = useState(false);
  const f = { busca: sp.get('busca') ?? '', status: sp.get('status') ?? '', filtro: sp.get('filtro') ?? '', pagina: Number(sp.get('pagina') ?? 1) };
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'pagina') n.delete('pagina');
    setSp(n, { replace: true });
  };
  const q = useQuery({ queryKey: ['solicitacoes', f], queryFn: () => api.get<Paginado<any>>(`/solicitacoes${qs(f)}`) });

  return (
    <>
      <CabecalhoPagina
        titulo="Solicitações à secretaria"
        subtitulo="Pedidos de gestores/fiscais: contato, notificação, documentação e correções. Não geram sanção automática."
        acoes={perfil !== 'COMANDANTE' && <Botao icone={<Plus className="size-4" />} onClick={() => setCriar(true)}>Nova solicitação</Botao>}
      />
      <BarraFiltros>
        <FiltroTexto valor={f.busca} aoMudar={(v) => set('busca', v)} />
        <FiltroSelect rotulo="Status" valor={f.status} aoMudar={(v) => set('status', v)} opcoes={opcoes(STATUS_SOLICITACAO)} />
        <FiltroSelect rotulo="Recorte" valor={f.filtro} aoMudar={(v) => set('filtro', v)} opcoes={[{ value: 'abertas', label: 'Em aberto' }, { value: 'minhas', label: 'Minhas' }]} todos="Todas" />
      </BarraFiltros>
      <Cartao>
        {q.isLoading ? (
          <Carregando />
        ) : q.isError ? (
          <ErroCarga erro={q.error} />
        ) : (
          <>
            <Tabela
              rotulo="Solicitações"
              dados={q.data!.itens}
              chave={(s) => s.id}
              linkPara={(s) => `/solicitacoes/${s.id}`}
              vazio={<Vazio titulo="Nenhuma solicitação" />}
              colunas={[
                { titulo: 'Solicitação', principal: true, render: (s) => <Link to={`/solicitacoes/${s.id}`} className="font-medium text-acao hover:underline">{s.titulo}</Link> },
                { titulo: 'Contrato', render: (s) => s.contrato?.numero },
                { titulo: 'Categoria', render: (s) => CATEGORIAS_SOLICITACAO[s.categoria] },
                { titulo: 'Prioridade', render: (s) => <Selo tom={s.prioridade === 'URGENTE' ? 'perigo' : s.prioridade === 'ALTA' ? 'atencao' : 'neutro'}>{PRIORIDADES[s.prioridade]}</Selo> },
                { titulo: 'Status', render: (s) => <Selo tom={tomSolicitacao(s.status)}>{STATUS_SOLICITACAO[s.status]}</Selo> },
                { titulo: 'Prazo', render: (s) => data(s.prazo) },
                { titulo: 'Aberta em', render: (s) => dataHora(s.criadoEm), ocultarMobile: true },
              ]}
            />
            <Paginacao pagina={q.data!.pagina} paginas={q.data!.paginas} total={q.data!.total} aoMudar={(p) => set('pagina', String(p))} />
          </>
        )}
      </Cartao>
      <FormularioModal
        aberto={criar}
        aoFechar={() => setCriar(false)}
        titulo="Nova solicitação"
        largo
        campos={[
          { nome: 'contratoId', rotulo: 'Contrato', tipo: 'select', opcoes: contratos, obrigatorio: true },
          { nome: 'categoria', rotulo: 'Categoria', tipo: 'select', opcoes: opcoes(CATEGORIAS_SOLICITACAO), obrigatorio: true, meia: true },
          { nome: 'prioridade', rotulo: 'Prioridade', tipo: 'select', opcoes: opcoes(PRIORIDADES), meia: true },
          { nome: 'titulo', rotulo: 'Título', obrigatorio: true },
          { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea', obrigatorio: true },
          { nome: 'prazo', rotulo: 'Prazo desejado', tipo: 'data', meia: true },
        ]}
        aoEnviar={async (v) => {
          const s = await api.post<{ id: string }>('/solicitacoes', v);
          navegar(`/solicitacoes/${s.id}`);
        }}
      />
    </>
  );
}
