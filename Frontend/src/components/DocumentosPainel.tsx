import { useQuery } from '@tanstack/react-query';
import { Download, FileUp, Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { dataHora, tamanhoArquivo } from '@/lib/formato';
import { CATEGORIAS_DOC, opcoes, rotulo } from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';
import { useMutacao } from '@/hooks/useMutacao';
import { Carregando, ErroCarga, mensagemErro, useToast, Vazio } from './feedback';
import { Modal } from './Modal';
import { Aviso, Botao, Selo } from './ui';

export interface DocumentoLista {
  id: string;
  titulo: string;
  categoria: string;
  liberadoGestor: boolean;
  criadoEm: string;
  versoes: Array<{ id: string; versao: number; nomeOriginal: string; mime: string; tamanho: number; sha256: string; criadoEm: string }>;
  vinculos: Array<{ tipo: string; entidadeId: string }>;
}

const ACEITOS = '.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.pptx,.odt,.ods,.txt,.csv';

export function DocumentosPainel({ vinculoTipo, vinculoId, titulo = 'Documentos', categoriaPadrao = 'OUTRO', podeEnviar = true }: { vinculoTipo: string; vinculoId: string; titulo?: string; categoriaPadrao?: string; podeEnviar?: boolean }) {
  const { pode } = useAuth();
  const chave = ['documentos', vinculoTipo, vinculoId];
  const q = useQuery({ queryKey: chave, queryFn: () => api.get<DocumentoLista[]>(`/documentos?vinculoTipo=${vinculoTipo}&vinculoId=${vinculoId}`) });
  const [enviarAberto, setEnviarAberto] = useState(false);
  const [versaoDe, setVersaoDe] = useState<DocumentoLista | null>(null);
  const toast = useToast();
  const liberar = useMutacao((d: DocumentoLista) => api.patch(`/documentos/${d.id}`, { liberadoGestor: !d.liberadoGestor }), { invalidar: [chave], sucesso: 'Acesso do gestor atualizado' });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{titulo}</h3>
        {podeEnviar && (
          <Botao pequeno icone={<Upload className="size-4" />} onClick={() => setEnviarAberto(true)}>
            Anexar
          </Botao>
        )}
      </div>
      {q.isLoading ? (
        <Carregando />
      ) : q.isError ? (
        <ErroCarga erro={q.error} tentarNovamente={() => q.refetch()} />
      ) : !q.data?.length ? (
        <Vazio titulo="Nenhum documento" texto="Anexos ficam em armazenamento privado; o download exige autorização a cada acesso." />
      ) : (
        <ul className="divide-y divide-borda rounded-lg border border-borda">
          {q.data.map((d) => {
            const v = d.versoes[0];
            return (
              <li key={d.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.titulo}</p>
                  <p className="text-xs text-tinta-suave">
                    {rotulo(CATEGORIAS_DOC, d.categoria)} • v{v?.versao} • {v ? tamanhoArquivo(v.tamanho) : ''} • {dataHora(v?.criadoEm)}
                  </p>
                  <p className="truncate text-[0.65rem] text-tinta-suave" title={v?.sha256}>
                    SHA-256 {v?.sha256.slice(0, 16)}…
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {pode.escrever && (
                    <button onClick={() => liberar.mutate(d)} className="text-xs" title="Alternar visibilidade para gestores do contrato">
                      <Selo tom={d.liberadoGestor ? 'ok' : 'neutro'}>{d.liberadoGestor ? 'Visível ao gestor' : 'Interno'}</Selo>
                    </button>
                  )}
                  <Botao
                    pequeno
                    variante="secundario"
                    icone={<Download className="size-4" />}
                    onClick={() => api.baixar(`/documentos/${d.id}/download`, v?.nomeOriginal).catch((e) => toast.erro(e))}
                  >
                    Baixar
                  </Botao>
                  {podeEnviar && (
                    <Botao pequeno variante="fantasma" icone={<FileUp className="size-4" />} onClick={() => setVersaoDe(d)}>
                      Nova versão
                    </Botao>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <UploadModal
        aberto={enviarAberto}
        aoFechar={() => setEnviarAberto(false)}
        titulo="Anexar documento"
        categoriaPadrao={categoriaPadrao}
        aoEnviar={async (arquivo, meta) => {
          const fd = new FormData();
          fd.append('arquivo', arquivo);
          fd.append('titulo', meta.titulo);
          fd.append('categoria', meta.categoria);
          fd.append('vinculoTipo', vinculoTipo);
          fd.append('vinculoId', vinculoId);
          fd.append('liberadoGestor', String(meta.liberadoGestor));
          await api.upload('/documentos', fd);
          await q.refetch();
          toast.sucesso('Documento anexado');
        }}
      />
      <UploadModal
        aberto={!!versaoDe}
        aoFechar={() => setVersaoDe(null)}
        titulo={`Nova versão — ${versaoDe?.titulo ?? ''}`}
        somenteArquivo
        aoEnviar={async (arquivo) => {
          const fd = new FormData();
          fd.append('arquivo', arquivo);
          await api.upload(`/documentos/${versaoDe!.id}/versoes`, fd);
          await q.refetch();
          toast.sucesso('Nova versão registrada');
        }}
      />
    </div>
  );
}

function UploadModal({
  aberto, aoFechar, titulo, aoEnviar, somenteArquivo, categoriaPadrao = 'OUTRO',
}: {
  aberto: boolean; aoFechar: () => void; titulo: string; somenteArquivo?: boolean; categoriaPadrao?: string;
  aoEnviar: (f: File, meta: { titulo: string; categoria: string; liberadoGestor: boolean }) => Promise<void>;
}) {
  const { pode } = useAuth();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tituloDoc, setTituloDoc] = useState('');
  const [categoria, setCategoria] = useState(categoriaPadrao);
  const [liberado, setLiberado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const fechar = () => {
    setArquivo(null);
    setTituloDoc('');
    setErro(null);
    aoFechar();
  };
  const enviar = async () => {
    if (!arquivo) return;
    if (arquivo.size > 20 * 1024 * 1024) return setErro('Arquivo acima de 20 MB');
    setEnviando(true);
    setErro(null);
    try {
      await aoEnviar(arquivo, { titulo: tituloDoc || arquivo.name, categoria, liberadoGestor: liberado });
      fechar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo={titulo}
      rodape={
        <>
          <Botao variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao onClick={enviar} disabled={!arquivo} carregando={enviando}>
            Enviar
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
        <div>
          <label htmlFor={`${id}-arq`} className="mb-1 block text-sm font-medium">
            Arquivo <span className="text-perigo">*</span>
          </label>
          <input
            ref={input}
            id={`${id}-arq`}
            type="file"
            accept={ACEITOS}
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="block w-full rounded-lg border border-dashed border-borda p-3 text-sm file:mr-3 file:rounded file:border-0 file:bg-azul-claro file:px-3 file:py-1.5 file:text-tinta"
          />
          <p className="mt-1 text-xs text-tinta-suave">PDF, imagens, documentos Office/ODF, TXT ou CSV, até 20 MB. O tipo real é verificado no servidor.</p>
        </div>
        {!somenteArquivo && (
          <>
            <div>
              <label htmlFor={`${id}-tit`} className="mb-1 block text-sm font-medium">
                Título
              </label>
              <input id={`${id}-tit`} value={tituloDoc} onChange={(e) => setTituloDoc(e.target.value)} maxLength={300} className="min-h-11 w-full rounded-lg border border-borda px-3" placeholder={arquivo?.name} />
            </div>
            <div>
              <label htmlFor={`${id}-cat`} className="mb-1 block text-sm font-medium">
                Categoria
              </label>
              <select id={`${id}-cat`} value={categoria} onChange={(e) => setCategoria(e.target.value)} className="min-h-11 w-full rounded-lg border border-borda bg-white px-3">
                {opcoes(CATEGORIAS_DOC).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {pode.escrever && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={liberado} onChange={(e) => setLiberado(e.target.checked)} className="size-5 accent-acao" />
                Liberar para os gestores/fiscais do contrato vinculado
              </label>
            )}
          </>
        )}
        <p className="text-xs text-tinta-suave">O envio de um arquivo não presume a validade do documento.</p>
      </div>
    </Modal>
  );
}
