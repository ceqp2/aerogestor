import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';
import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo';

const estilosBotao: Record<Variante, string> = {
  primario: 'bg-acao text-white hover:bg-acao-escuro disabled:bg-acao/50',
  secundario: 'bg-white text-tinta border border-borda hover:bg-azul-claro-2 disabled:opacity-60',
  fantasma: 'text-acao hover:bg-azul-claro-2 disabled:opacity-50',
  perigo: 'bg-perigo text-white hover:bg-perigo/90 disabled:opacity-60',
};

export const Botao = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean; icone?: ReactNode; pequeno?: boolean }
>(function Botao({ variante = 'primario', carregando, icone, pequeno, className, children, disabled, type = 'button', ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || carregando}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed',
        pequeno ? 'min-h-9 px-3 text-sm' : 'min-h-11 px-4 text-[0.95rem]',
        estilosBotao[variante],
        className,
      )}
      {...rest}
    >
      {carregando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icone}
      {children}
    </button>
  );
});

export function Cartao({ children, className, titulo, acoes, id }: { children: ReactNode; className?: string; titulo?: ReactNode; acoes?: ReactNode; id?: string }) {
  return (
    <section id={id} className={clsx('rounded-xl border border-borda bg-white shadow-cartao', className)} aria-label={typeof titulo === 'string' ? titulo : undefined}>
      {(titulo || acoes) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-borda px-4 py-3">
          {titulo && <h2 className="text-[0.95rem] font-semibold text-tinta">{titulo}</h2>}
          {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export type Tom = 'ok' | 'atencao' | 'perigo' | 'info' | 'neutro';
const estilosTom: Record<Tom, string> = {
  ok: 'bg-ok-fundo text-ok border-ok/20',
  atencao: 'bg-atencao-fundo text-atencao border-atencao/20',
  perigo: 'bg-perigo-fundo text-perigo border-perigo/20',
  info: 'bg-azul-claro-2 text-acao border-acao/20',
  neutro: 'bg-fundo text-tinta-suave border-borda',
};
const iconesTom: Record<Tom, ReactNode> = {
  ok: <CheckCircle2 className="size-3.5" aria-hidden />,
  atencao: <AlertTriangle className="size-3.5" aria-hidden />,
  perigo: <XCircle className="size-3.5" aria-hidden />,
  info: <Info className="size-3.5" aria-hidden />,
  neutro: null,
};

/** Selo de status: sempre texto + ícone (não depende só da cor). */
export function Selo({ tom = 'neutro', children, semIcone }: { tom?: Tom; children: ReactNode; semIcone?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', estilosTom[tom])}>
      {!semIcone && iconesTom[tom]}
      {children}
    </span>
  );
}

export function Aviso({ tom = 'info', titulo, children }: { tom?: Tom; titulo?: string; children: ReactNode }) {
  return (
    <div role={tom === 'perigo' ? 'alert' : 'status'} className={clsx('flex gap-3 rounded-lg border p-3 text-sm', estilosTom[tom])}>
      <span className="mt-0.5 shrink-0">{iconesTom[tom] ?? iconesTom.info}</span>
      <div className="text-tinta">
        {titulo && <p className="font-semibold">{titulo}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function CabecalhoPagina({ titulo, subtitulo, acoes, voltar }: { titulo: ReactNode; subtitulo?: ReactNode; acoes?: ReactNode; voltar?: { to: string; rotulo: string } }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {voltar && (
          <Link to={voltar.to} className="mb-1 inline-block text-sm text-acao hover:underline">
            ← {voltar.rotulo}
          </Link>
        )}
        <h1 className="text-xl font-semibold text-tinta sm:text-2xl">{titulo}</h1>
        {subtitulo && <div className="mt-1 text-sm text-tinta-suave">{subtitulo}</div>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Indicador({ rotulo, valor, detalhe, to, tom, icone }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; to?: string; tom?: Tom; icone?: ReactNode }) {
  const corpo = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-tinta-suave">{rotulo}</span>
        {icone && <span className="text-acao" aria-hidden>{icone}</span>}
      </div>
      <div className={clsx('tabular mt-1 text-2xl font-semibold', tom === 'perigo' ? 'text-perigo' : tom === 'atencao' ? 'text-atencao' : 'text-tinta')}>{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-tinta-suave">{detalhe}</div>}
    </>
  );
  const cls = 'block rounded-xl border border-borda bg-white p-4 shadow-cartao';
  return to ? (
    <Link to={to} className={clsx(cls, 'transition-colors hover:border-acao/40 hover:bg-azul-claro-2/40')}>
      {corpo}
    </Link>
  ) : (
    <div className={cls}>{corpo}</div>
  );
}

export function ListaDefinicao({ itens }: { itens: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {itens.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-tinta-suave">{k}</dt>
          <dd className="mt-0.5 break-words text-sm text-tinta">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LinkAcao({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-medium text-acao hover:underline">
      {children}
    </Link>
  );
}
