import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Carregando, ErroCarga, Vazio } from '@/components/feedback';
import { Campo, FormularioModal } from '@/components/Formulario';
import { BarraFiltros, FiltroSelect, FiltroTexto, Paginacao, Tabela } from '@/components/Tabela';
import { Botao, CabecalhoPagina, Cartao, Selo, Tom } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { data } from '@/lib/formato';
import { NIVEIS_RISCO, opcoes, rotulo, STATUS_RISCO } from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';
import { useContratosOpcoes, useProcessosOpcoes, useUsuariosOpcoes } from '@/hooks/useOpcoes';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const tomNivel = (n?: string | null): Tom => (n === 'critico' ? 'perigo' : n === 'alto' ? 'atencao' : n === 'moderado' ? 'info' : 'ok');
const corCelula = (s: number) => (s >= 17 ? 'bg-perigo/80 text-white' : s >= 10 ? 'bg-atencao/70 text-white' : s >= 5 ? 'bg-azul-claro' : 'bg-ok-fundo');
const ESCALA = ['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }));

export function camposRisco(processos: any[], contratos: any[], usuarios: any[]): Campo[] {
  return [
    { nome: 'evento', rotulo: 'Evento de risco', obrigatorio: true },
    { nome: 'causa', rotulo: 'Causa', tipo: 'textarea', obrigatorio: true },
    { nome: 'consequencia', rotulo: 'Consequência', tipo: 'textarea', obrigatorio: true },
    { nome: 'processoId', rotulo: 'Processo', tipo: 'select', opcoes: processos, meia: true },
    { nome: 'contratoId', rotulo: 'Contrato', tipo: 'select', opcoes: contratos, meia: true },
    { nome: 'fase', rotulo: 'Fase', obrigatorio: true, meia: true, placeholder: 'Planejamento, seleção, gestão contratual…' },
    { nome: 'categoria', rotulo: 'Categoria', obrigatorio: true, meia: true, placeholder: 'Operacional, legal, econômico…' },
    { nome: 'probabilidade', rotulo: 'Probabilidade inicial (1–5)', tipo: 'select', opcoes: ESCALA, obrigatorio: true, meia: true },
    { nome: 'impacto', rotulo: 'Impacto inicial (1–5)', tipo: 'select', opcoes: ESCALA, obrigatorio: true, meia: true },
    { nome: 'probResidual', rotulo: 'Probabilidade residual', tipo: 'select', opcoes: ESCALA, meia: true },
    { nome: 'impactoResidual', rotulo: 'Impacto residual', tipo: 'select', opcoes: ESCALA, meia: true },
    { nome: 'controles', rotulo: 'Controles existentes', tipo: 'textarea' },
    { nome: 'acaoPreventiva', rotulo: 'Ação preventiva', tipo: 'textarea' },
    { nome: 'contingencia', rotulo: 'Contingência', tipo: 'textarea' },
    { nome: 'responsavelId', rotulo: 'Responsável', tipo: 'select', opcoes: usuarios, meia: true },
    { nome: 'proximaRevisao', rotulo: 'Próxima revisão', tipo: 'data', meia: true },
  ];
}

export function converterRisco(v: Record<string, unknown>) {
  const r = { ...v };
  for (const k of ['probabilidade', 'impacto', 'probResidual', 'impactoResidual']) if (r[k]) r[k] = Number(r[k]);
  return r;
}

export default function RiscosPage() {
  const { pode } = useAuth();
  const navegar = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [criar, setCriar] = useState(false);
  const processos = useProcessosOpcoes();
  const contratos = useContratosOpcoes();
  const usuarios = useUsuariosOpcoes();
  const f = { busca: sp.get('busca') ?? '', nivel: sp.get('nivel') ?? '', status: sp.get('status') ?? '', revisaoVencida: sp.get('revisaoVencida') ?? '', pagina: Number(sp.get('pagina') ?? 1) };
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'pagina') n.delete('pagina');
    setSp(n, { replace: true });
  };
  const q = useQuery({ queryKey: ['riscos', f], queryFn: () => api.get<any>(`/riscos${qs({ ...f, tamanho: 50 })}`) });
  const todos = useQuery({ queryKey: ['riscos', 'matriz'], queryFn: () => api.get<any>('/riscos?tamanho=200') });

  useEffect(() => {
    if (sp.get('novo') === '1' && pode.escrever) setCriar(true);
  }, [sp, pode.escrever]);

  const matriz = (todos.data?.itens ?? []).filter((r: any) => r.status !== 'ENCERRADO');
  const contar = (p: number, i: number) => matriz.filter((r: any) => r.probabilidade === p && r.impacto === i).length;

  return (
    <>
      <CabecalhoPagina
        titulo="Riscos"
        subtitulo="Registro de riscos processuais e contratuais. Score = probabilidade × impacto; faixas são parâmetros gerenciais propostos, não impostos pela lei."
        acoes={pode.escrever && <Botao icone={<Plus className="size-4" />} onClick={() => setCriar(true)}>Registrar risco</Botao>}
      />
      <div className="mb-4 grid gap-4 lg:grid-cols-[auto_1fr]">
        <Cartao titulo="Matriz de calor (riscos não encerrados)">
          <div className="overflow-x-auto">
            <table className="text-center text-sm" aria-label="Matriz probabilidade por impacto">
              <caption className="sr-only">Quantidade de riscos por probabilidade e impacto</caption>
              <tbody>
                {[5, 4, 3, 2, 1].map((p) => (
                  <tr key={p}>
                    <th scope="row" className="pr-2 text-xs font-medium text-tinta-suave">P{p}</th>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <td key={i} className="p-0.5">
                        <div className={clsx('flex size-12 items-center justify-center rounded-md text-sm font-semibold', corCelula(p * i))} title={`P${p} × I${i} = ${p * i}`}>
                          {contar(p, i) || ''}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td />
                  {[1, 2, 3, 4, 5].map((i) => (
                    <th key={i} scope="col" className="pt-1 text-xs font-medium text-tinta-suave">I{i}</th>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-1 text-xs">
            {Object.entries(NIVEIS_RISCO).map(([k, v]) => (
              <Selo key={k} tom={tomNivel(k)}>
                {v} {todos.data?.faixas?.[k] ? `(${todos.data.faixas[k][0]}–${todos.data.faixas[k][1]})` : ''}
              </Selo>
            ))}
          </div>
        </Cartao>
        <div>
          <BarraFiltros>
            <FiltroTexto valor={f.busca} aoMudar={(v) => set('busca', v)} placeholder="Evento ou categoria" />
            <FiltroSelect rotulo="Nível" valor={f.nivel} aoMudar={(v) => set('nivel', v)} opcoes={opcoes(NIVEIS_RISCO)} />
            <FiltroSelect rotulo="Status" valor={f.status} aoMudar={(v) => set('status', v)} opcoes={opcoes(STATUS_RISCO)} />
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="size-5 accent-acao" checked={f.revisaoVencida === 'true'} onChange={(e) => set('revisaoVencida', e.target.checked ? 'true' : '')} />
              Revisão vencida
            </label>
          </BarraFiltros>
          <Cartao>
            {q.isLoading ? (
              <Carregando />
            ) : q.isError ? (
              <ErroCarga erro={q.error} />
            ) : (
              <>
                <Tabela
                  rotulo="Riscos"
                  dados={q.data.itens}
                  chave={(r: any) => r.id}
                  linkPara={(r: any) => `/riscos/${r.id}`}
                  vazio={<Vazio titulo="Nenhum risco" />}
                  colunas={[
                    { titulo: 'Evento', principal: true, render: (r: any) => <Link to={`/riscos/${r.id}`} className="font-medium text-acao hover:underline">{r.evento}</Link> },
                    { titulo: 'Vínculo', render: (r: any) => <span className="text-xs">{r.processo?.numeroInterno ?? r.contrato?.numero ?? '—'}</span> },
                    { titulo: 'Inicial', render: (r: any) => <Selo tom={tomNivel(r.nivel)}>{NIVEIS_RISCO[r.nivel]} • {r.score}</Selo> },
                    { titulo: 'Residual', render: (r: any) => (r.nivelResidual ? <Selo tom={tomNivel(r.nivelResidual)}>{NIVEIS_RISCO[r.nivelResidual]} • {r.scoreResidual}</Selo> : '—') },
                    { titulo: 'Status', render: (r: any) => rotulo(STATUS_RISCO, r.status) },
                    { titulo: 'Revisão', render: (r: any) => data(r.proximaRevisao) },
                  ]}
                />
                <Paginacao pagina={q.data.pagina} paginas={q.data.paginas} total={q.data.total} aoMudar={(p) => set('pagina', String(p))} />
              </>
            )}
          </Cartao>
        </div>
      </div>
      <FormularioModal
        aberto={criar}
        aoFechar={() => {
          setCriar(false);
          if (sp.get('novo')) set('novo', '');
        }}
        titulo="Registrar risco"
        largo
        campos={camposRisco(processos, contratos, usuarios)}
        valoresIniciais={{ processoId: sp.get('processoId') ?? '', contratoId: sp.get('contratoId') ?? '' }}
        aviso={<p className="text-xs text-tinta-suave">O registro de riscos não substitui a matriz contratual de alocação de riscos, que tem documentos próprios quando aplicável.</p>}
        aoEnviar={async (v) => {
          const r = await api.post<{ id: string }>('/riscos', converterRisco(v));
          navegar(`/riscos/${r.id}`);
        }}
      />
    </>
  );
}
