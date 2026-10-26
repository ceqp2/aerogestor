import { useQuery } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { Carregando, ErroCarga, useToast, Vazio } from '@/components/feedback';
import { Botao, CabecalhoPagina, Cartao } from '@/components/ui';
import { api } from '@/lib/api';
import { useExercicio } from '@/hooks/useExercicio';

const RELATORIOS = [
  { chave: 'executivo', titulo: 'Relatório executivo', descricao: 'Indicadores financeiros, processos e riscos — mesmos números do painel.' },
  { chave: 'execucao-orcamentaria', titulo: 'Execução orçamentária', descricao: 'Por classificação: crédito, empenhado, liquidado, pago e disponível.' },
  { chave: 'processos', titulo: 'Processos', descricao: 'Situação, etapa, classificação, prazos e cumprimento de checklist.' },
  { chave: 'riscos', titulo: 'Riscos', descricao: 'Registro de riscos com score inicial e residual.' },
  { chave: 'vigencias', titulo: 'Vigências', descricao: 'Contratos e atas ordenados por proximidade do vencimento.' },
];

export default function RelatoriosPage() {
  const { exercicio } = useExercicio();
  const toast = useToast();
  const [tipo, setTipo] = useState('executivo');
  const q = useQuery({ queryKey: ['relatorio', tipo, exercicio], queryFn: () => api.get<{ titulo: string; linhas: Array<Record<string, unknown>>; aviso?: string; observacao?: string }>(`/relatorios/${tipo}?exercicio=${exercicio}`) });
  const colunas = q.data?.linhas[0] ? Object.keys(q.data.linhas[0]) : [];

  return (
    <>
      <CabecalhoPagina titulo="Relatórios" subtitulo={`Exercício ${exercicio}. Exportações respeitam o mesmo escopo de acesso e são registradas na auditoria.`} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {RELATORIOS.map((r) => (
          <button
            key={r.chave}
            onClick={() => setTipo(r.chave)}
            aria-pressed={tipo === r.chave}
            className={`rounded-xl border p-3 text-left transition-colors ${tipo === r.chave ? 'border-acao bg-azul-claro-2' : 'border-borda bg-white hover:border-acao/40'}`}
          >
            <p className="font-medium">{r.titulo}</p>
            <p className="text-xs text-tinta-suave">{r.descricao}</p>
          </button>
        ))}
      </div>
      <Cartao
        titulo={q.data?.titulo ?? 'Relatório'}
        acoes={
          <>
            <Botao pequeno variante="secundario" icone={<Printer className="size-4" />} onClick={() => window.print()}>
              Imprimir
            </Botao>
            <Botao pequeno icone={<Download className="size-4" />} onClick={() => api.baixar(`/relatorios/${tipo}?exercicio=${exercicio}&formato=csv`, `${tipo}.csv`).catch((e) => toast.erro(e))}>
              Exportar CSV
            </Botao>
          </>
        }
      >
        {q.isLoading ? (
          <Carregando />
        ) : q.isError ? (
          <ErroCarga erro={q.error} />
        ) : !q.data?.linhas.length ? (
          <Vazio titulo="Sem dados para o recorte" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-borda text-xs uppercase text-tinta-suave">
                  {colunas.map((c) => (
                    <th key={c} scope="col" className="whitespace-nowrap px-2 py-2 font-medium">
                      {c.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {q.data.linhas.map((l, i) => (
                  <tr key={i} className="border-b border-borda/60">
                    {colunas.map((c) => (
                      <td key={c} className="tabular px-2 py-1.5 align-top">
                        {l[c] === null || l[c] === undefined ? '—' : typeof l[c] === 'boolean' ? (l[c] ? 'Sim' : 'Não') : String(l[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(q.data?.aviso || q.data?.observacao) && <p className="mt-3 text-xs text-tinta-suave">{q.data.aviso ?? q.data.observacao}</p>}
      </Cartao>
    </>
  );
}
