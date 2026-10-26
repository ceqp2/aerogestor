import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { normalizarValor } from '@/lib/formato';
import { mensagemErro } from './feedback';
import { Modal } from './Modal';
import { Aviso, Botao } from './ui';

export type TipoCampo = 'texto' | 'textarea' | 'select' | 'data' | 'datahora' | 'dinheiro' | 'quantidade' | 'numero' | 'checkbox' | 'email' | 'senha';

export interface Campo {
  nome: string;
  rotulo: string;
  tipo?: TipoCampo;
  opcoes?: Array<{ value: string; label: string }>;
  obrigatorio?: boolean;
  ajuda?: string;
  meia?: boolean;
  min?: number;
  max?: number;
  minimo?: number; // tamanho mínimo de texto
  placeholder?: string;
  visivel?: (v: Record<string, unknown>) => boolean;
}

type Valores = Record<string, unknown>;

function schemaDe(campos: Campo[]) {
  const forma: Record<string, z.ZodTypeAny> = {};
  for (const c of campos) {
    const t = c.tipo ?? 'texto';
    if (t === 'checkbox') {
      forma[c.nome] = z.boolean().optional();
      continue;
    }
    let s = z.string().trim();
    if (c.obrigatorio) s = s.min(1, 'Campo obrigatório');
    if (c.minimo) s = s.refine((v) => !v || v.length >= c.minimo!, `Mínimo de ${c.minimo} caracteres`) as unknown as z.ZodString;
    let r: z.ZodTypeAny = s;
    if (t === 'dinheiro') r = s.refine((v) => !v || /^\d{1,16}(\.\d{1,2})?$/.test(normalizarValor(v)), 'Valor inválido (ex.: 1.234,56)');
    if (t === 'quantidade') r = s.refine((v) => !v || /^\d{1,14}(\.\d{1,4})?$/.test(normalizarValor(v)), 'Quantidade inválida');
    if (t === 'numero')
      r = s.refine((v) => !v || (/^-?\d+$/.test(v) && (c.min === undefined || Number(v) >= c.min) && (c.max === undefined || Number(v) <= c.max)), `Número inteiro${c.min !== undefined ? ` entre ${c.min} e ${c.max}` : ''}`);
    if (t === 'data') r = s.refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Data inválida');
    if (t === 'email') r = s.refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'E-mail inválido');
    forma[c.nome] = c.visivel ? r.optional() : r;
  }
  return z.object(forma);
}

/** Converte os valores do formulário para o formato da API (strings decimais, números, sem campos vazios). */
export function converter(campos: Campo[], v: Valores) {
  const out: Valores = {};
  for (const c of campos) {
    if (c.visivel && !c.visivel(v)) continue;
    const t = c.tipo ?? 'texto';
    const val = v[c.nome];
    if (t === 'checkbox') {
      out[c.nome] = !!val;
      continue;
    }
    if (val === undefined || val === null || val === '') continue;
    if (t === 'dinheiro' || t === 'quantidade') out[c.nome] = normalizarValor(String(val));
    else if (t === 'numero') out[c.nome] = Number(val);
    else if (t === 'datahora') out[c.nome] = new Date(String(val)).toISOString();
    else out[c.nome] = String(val).trim();
  }
  return out;
}

export function CamposFormulario({ campos, form }: { campos: Campo[]; form: ReturnType<typeof useForm<Valores>> }) {
  const valores = form.watch();
  const base = 'w-full rounded-lg border border-borda bg-white px-3 py-2 text-[0.95rem] text-tinta placeholder:text-tinta-suave/60 focus:border-acao min-h-11';
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {campos.map((c) => {
        if (c.visivel && !c.visivel(valores)) return null;
        const t = c.tipo ?? 'texto';
        const id = `campo-${c.nome}`;
        const erro = form.formState.errors[c.nome]?.message as string | undefined;
        const desc = [c.ajuda ? `${id}-ajuda` : null, erro ? `${id}-erro` : null].filter(Boolean).join(' ') || undefined;
        const comum = { id, 'aria-invalid': !!erro, 'aria-describedby': desc, ...form.register(c.nome) };
        return (
          <div key={c.nome} className={clsx(c.meia ? '' : 'sm:col-span-2', t === 'checkbox' && 'flex items-start gap-2')}>
            {t === 'checkbox' ? (
              <>
                <input type="checkbox" className="mt-1 size-5 accent-acao" {...comum} />
                <label htmlFor={id} className="text-sm text-tinta">
                  {c.rotulo}
                  {c.ajuda && <span id={`${id}-ajuda`} className="block text-xs text-tinta-suave">{c.ajuda}</span>}
                </label>
              </>
            ) : (
              <>
                <label htmlFor={id} className="mb-1 block text-sm font-medium text-tinta">
                  {c.rotulo} {c.obrigatorio && <span className="text-perigo" aria-hidden>*</span>}
                </label>
                {t === 'textarea' ? (
                  <textarea rows={3} className={base} placeholder={c.placeholder} {...comum} />
                ) : t === 'select' ? (
                  <select className={base} {...comum}>
                    <option value="">Selecione…</option>
                    {c.opcoes?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={clsx(base, (t === 'dinheiro' || t === 'quantidade' || t === 'numero') && 'tabular')}
                    type={t === 'data' ? 'date' : t === 'datahora' ? 'datetime-local' : t === 'email' ? 'email' : t === 'senha' ? 'password' : 'text'}
                    inputMode={t === 'dinheiro' || t === 'quantidade' ? 'decimal' : t === 'numero' ? 'numeric' : undefined}
                    placeholder={c.placeholder ?? (t === 'dinheiro' ? '0,00' : undefined)}
                    autoComplete={t === 'senha' ? 'new-password' : 'off'}
                    {...comum}
                  />
                )}
                {c.ajuda && (
                  <p id={`${id}-ajuda`} className="mt-1 text-xs text-tinta-suave">
                    {c.ajuda}
                  </p>
                )}
              </>
            )}
            {erro && (
              <p id={`${id}-erro`} className="mt-1 text-xs font-medium text-perigo">
                {erro}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Formulário em diálogo: valida no cliente, mantém os dados quando o servidor recusa e mostra o motivo. */
export function FormularioModal({
  aberto, aoFechar, titulo, campos, valoresIniciais, aoEnviar, rotuloEnviar = 'Salvar', aviso, largo,
}: {
  aberto: boolean; aoFechar: () => void; titulo: string; campos: Campo[]; valoresIniciais?: Valores;
  aoEnviar: (dados: Valores) => Promise<unknown>; rotuloEnviar?: string; aviso?: React.ReactNode; largo?: boolean;
}) {
  const schema = useMemo(() => schemaDe(campos), [campos]);
  const padrao = useMemo(() => {
    const p: Valores = {};
    for (const c of campos) p[c.nome] = c.tipo === 'checkbox' ? false : '';
    return { ...p, ...(valoresIniciais ?? {}) };
  }, [campos, valoresIniciais]);
  const form = useForm<Valores>({ resolver: zodResolver(schema), defaultValues: padrao });
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (aberto) {
      form.reset(padrao);
      setErroServidor(null);
    }
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = form.handleSubmit(async (v) => {
    setEnviando(true);
    setErroServidor(null);
    try {
      await aoEnviar(converter(campos, v));
      aoFechar();
    } catch (e) {
      setErroServidor(mensagemErro(e));
    } finally {
      setEnviando(false);
    }
  });

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={titulo}
      largo={largo}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" form={`form-${titulo}`} carregando={enviando}>
            {rotuloEnviar}
          </Botao>
        </>
      }
    >
      <form id={`form-${titulo}`} onSubmit={enviar} noValidate className="space-y-4">
        {aviso}
        {erroServidor && (
          <Aviso tom="perigo" titulo="Não foi possível salvar">
            {erroServidor}
          </Aviso>
        )}
        <CamposFormulario campos={campos} form={form} />
      </form>
    </Modal>
  );
}
