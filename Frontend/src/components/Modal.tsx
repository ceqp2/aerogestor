import { X } from 'lucide-react';
import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Botao } from './ui';

/** Diálogo acessível: foco inicial, Esc fecha, foco preso, retorna o foco ao fechar. */
export function Modal({ aberto, aoFechar, titulo, children, rodape, largo }: { aberto: boolean; aoFechar: () => void; titulo: string; children: ReactNode; rodape?: ReactNode; largo?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focaveis = () =>
      Array.from(el?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter((x) => !x.hasAttribute('disabled'));
    setTimeout(() => (focaveis()[1] ?? focaveis()[0])?.focus(), 0);
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
      if (e.key === 'Tab') {
        const f = focaveis();
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = '';
      anterior?.focus();
    };
  }, [aberto, aoFechar]);
  if (!aberto) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${largo ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-borda px-5 py-4">
          <h2 id={tituloId} className="text-lg font-semibold text-tinta">
            {titulo}
          </h2>
          <button onClick={aoFechar} className="rounded-lg p-2 text-tinta-suave hover:bg-fundo" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <div className="flex flex-wrap justify-end gap-2 border-t border-borda px-5 py-3">{rodape}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Confirmação de ações relevantes, com campo de motivo opcional/obrigatório. */
export function Confirmacao({
  aberto, aoFechar, titulo, texto, aoConfirmar, rotuloConfirmar = 'Confirmar', perigo, pedirMotivo, carregando,
}: {
  aberto: boolean; aoFechar: () => void; titulo: string; texto: ReactNode; aoConfirmar: (motivo: string) => void;
  rotuloConfirmar?: string; perigo?: boolean; pedirMotivo?: boolean; carregando?: boolean;
}) {
  const [motivo, setMotivo] = useState('');
  const id = useId();
  const invalido = pedirMotivo && motivo.trim().length < 5;
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={titulo}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante={perigo ? 'perigo' : 'primario'} disabled={invalido} carregando={carregando} onClick={() => aoConfirmar(motivo.trim())}>
            {rotuloConfirmar}
          </Botao>
        </>
      }
    >
      <div className="space-y-3 text-sm text-tinta">
        <div>{texto}</div>
        {pedirMotivo && (
          <div>
            <label htmlFor={id} className="mb-1 block text-sm font-medium">
              Motivo / justificativa <span className="text-perigo">*</span>
            </label>
            <textarea id={id} value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} className="w-full rounded-lg border border-borda p-2" />
            <p className="mt-1 text-xs text-tinta-suave">Mínimo de 5 caracteres. Fica registrado na trilha de auditoria.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
