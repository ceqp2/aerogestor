import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DocumentoLista, DocumentosPainel } from '@/components/DocumentosPainel';
import { Carregando, ErroCarga, useToast, Vazio } from '@/components/feedback';
import { BarraFiltros, FiltroSelect, FiltroTexto, Tabela } from '@/components/Tabela';
import { Botao, CabecalhoPagina, Cartao, Selo } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { dataHora, tamanhoArquivo } from '@/lib/formato';
import { CATEGORIAS_DOC, opcoes, rotulo } from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';

const LINKS: Record<string, (id: string) => string | null> = {
  PROCESSO: (id) => `/processos/${id}`,
  CONTRATO: (id) => `/contratos/${id}`,
  ATA: (id) => `/atas/${id}`,
  SOLICITACAO: (id) => `/solicitacoes/${id}`,
  RISCO: (id) => `/riscos/${id}`,
  EMPENHO: (id) => `/financeiro/empenhos/${id}`,
};

export default function DocumentosPage() {
  const { me, pode } = useAuth();
  const toast = useToast();
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const q = useQuery({ queryKey: ['documentos', 'todos', busca, categoria], queryFn: () => api.get<DocumentoLista[]>(`/documentos${qs({ busca, categoria })}`) });

  return (
    <>
      <CabecalhoPagina titulo="Documentos" subtitulo="Armazenamento privado, com versões, hash de integridade e autorização a cada download." />
      <BarraFiltros>
        <FiltroTexto valor={busca} aoMudar={setBusca} placeholder="Título" />
        <FiltroSelect rotulo="Categoria" valor={categoria} aoMudar={setCategoria} opcoes={opcoes(CATEGORIAS_DOC)} todos="Todas" />
      </BarraFiltros>
      <Cartao className="mb-4">
        {q.isLoading ? (
          <Carregando />
        ) : q.isError ? (
          <ErroCarga erro={q.error} />
        ) : (
          <Tabela
            rotulo="Documentos"
            dados={q.data!}
            chave={(d) => d.id}
            vazio={<Vazio titulo="Nenhum documento" />}
            colunas={[
              { titulo: 'Documento', principal: true, render: (d) => <div><p className="font-medium">{d.titulo}</p><p className="text-xs text-tinta-suave">{rotulo(CATEGORIAS_DOC, d.categoria)} • v{d.versoes[0]?.versao} • {tamanhoArquivo(d.versoes[0]?.tamanho ?? 0)}</p></div> },
              {
                titulo: 'Vínculos',
                render: (d) => (
                  <span className="flex flex-wrap gap-1 text-xs">
                    {d.vinculos.map((v) => {
                      const l = LINKS[v.tipo]?.(v.entidadeId);
                      return l ? (
                        <Link key={v.tipo + v.entidadeId} to={l} className="text-acao hover:underline">
                          {v.tipo.toLowerCase().replace('_', ' ')}
                        </Link>
                      ) : (
                        <span key={v.tipo + v.entidadeId}>{v.tipo.toLowerCase().replace('_', ' ')}</span>
                      );
                    })}
                  </span>
                ),
              },
              { titulo: 'Acesso', render: (d) => <Selo tom={d.liberadoGestor ? 'ok' : 'neutro'}>{d.liberadoGestor ? 'Visível ao gestor' : 'Interno'}</Selo> },
              { titulo: 'Atualizado', render: (d) => dataHora(d.versoes[0]?.criadoEm) },
              {
                titulo: '',
                render: (d) => (
                  <Botao pequeno variante="secundario" icone={<Download className="size-4" />} onClick={() => api.baixar(`/documentos/${d.id}/download`, d.versoes[0]?.nomeOriginal).catch((e) => toast.erro(e))}>
                    Baixar
                  </Botao>
                ),
              },
            ]}
          />
        )}
      </Cartao>
      {pode.escrever && me?.unidadeAtual && (
        <Cartao>
          <DocumentosPainel vinculoTipo="GERAL" vinculoId={me.unidadeAtual.id} titulo="Documentos gerais da unidade (modelos, normas internas)" />
        </Cartao>
      )}
    </>
  );
}
