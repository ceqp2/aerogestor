import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DocumentosPainel } from '@/components/DocumentosPainel';
import { Carregando, ErroCarga } from '@/components/feedback';
import { FormularioModal } from '@/components/Formulario';
import { Botao, CabecalhoPagina, Cartao, ListaDefinicao, Selo } from '@/components/ui';
import { api } from '@/lib/api';
import { data, dataHora, isoData } from '@/lib/formato';
import { NIVEIS_RISCO, opcoes, rotulo, STATUS_RISCO } from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';
import { useContratosOpcoes, useProcessosOpcoes, useUsuariosOpcoes } from '@/hooks/useOpcoes';
import { camposRisco, converterRisco, tomNivel } from './RiscosPage';

/* eslint-disable @typescript-eslint/no-explicit-any */
const ESCALA = ['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }));

export default function RiscoDetalhePage() {
  const { id = '' } = useParams();
  const { pode } = useAuth();
  const q = useQuery({ queryKey: ['risco', id], queryFn: () => api.get<any>(`/riscos/${id}`) });
  const processos = useProcessosOpcoes();
  const contratos = useContratosOpcoes();
  const usuarios = useUsuariosOpcoes();
  const [modal, setModal] = useState<null | 'editar' | 'reavaliar' | 'status'>(null);

  if (q.isLoading) return <Carregando linhas={6} />;
  if (q.isError) return <ErroCarga erro={q.error} tentarNovamente={() => q.refetch()} />;
  const r = q.data;
  const serie = [...r.avaliacoes].reverse().map((a: any) => ({ data: dataHora(a.criadoEm).split(' ')[0], Inicial: a.score, Residual: a.scoreResidual }));

  return (
    <>
      <CabecalhoPagina
        voltar={{ to: '/riscos', rotulo: 'Riscos' }}
        titulo={r.evento}
        subtitulo={
          <span className="flex flex-wrap gap-2">
            <Selo tom={tomNivel(r.nivel)}>Inicial: {NIVEIS_RISCO[r.nivel]} ({r.score})</Selo>
            {r.nivelResidual && <Selo tom={tomNivel(r.nivelResidual)}>Residual: {NIVEIS_RISCO[r.nivelResidual]} ({r.scoreResidual})</Selo>}
            <Selo>{rotulo(STATUS_RISCO, r.status)}</Selo>
          </span>
        }
        acoes={
          pode.escrever && (
            <>
              <Botao onClick={() => setModal('reavaliar')}>Reavaliar</Botao>
              <Botao variante="secundario" onClick={() => setModal('editar')}>Editar tratamento</Botao>
              <Botao variante="secundario" onClick={() => setModal('status')}>Status</Botao>
            </>
          )
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Cartao titulo="Identificação e tratamento" className="lg:col-span-2">
          <ListaDefinicao
            itens={[
              ['Causa', r.causa],
              ['Consequência', r.consequencia],
              ['Fase', r.fase],
              ['Categoria', r.categoria],
              ['Vínculo', r.processo ? <Link className="text-acao hover:underline" to={`/processos/${r.processo.id}`}>{r.processo.numeroInterno}</Link> : r.contrato ? <Link className="text-acao hover:underline" to={`/contratos/${r.contrato.id}`}>{r.contrato.numero}</Link> : '—'],
              ['Probabilidade × impacto', `${r.probabilidade} × ${r.impacto} = ${r.score}`],
              ['Residual', r.scoreResidual ? `${r.probResidual} × ${r.impactoResidual} = ${r.scoreResidual}` : '—'],
              ['Controles', r.controles],
              ['Ação preventiva', r.acaoPreventiva],
              ['Contingência', r.contingencia],
              ['Responsável', usuarios.find((u) => u.value === r.responsavelId)?.label ?? '—'],
              ['Próxima revisão', data(r.proximaRevisao)],
            ]}
          />
        </Cartao>
        <Cartao titulo="Evolução">
          <div className="h-56" role="img" aria-label="Evolução do score do risco">
            <ResponsiveContainer>
              <LineChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DFE8F0" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 25]} tick={{ fontSize: 11 }} width={28} />
                <Tooltip />
                <Legend />
                <Line dataKey="Inicial" stroke="#B42318" strokeWidth={2} />
                <Line dataKey="Residual" stroke="#246A9E" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-tinta-suave">
            {r.avaliacoes.map((a: any) => (
              <li key={a.id}>
                {dataHora(a.criadoEm)}: {a.probabilidade}×{a.impacto}={a.score}
                {a.comentario && ` — ${a.comentario}`}
              </li>
            ))}
          </ul>
        </Cartao>
        <Cartao className="lg:col-span-3">
          <DocumentosPainel vinculoTipo="RISCO" vinculoId={id} categoriaPadrao="ANALISE_RISCOS" podeEnviar={pode.escrever} />
        </Cartao>
      </div>
      <FormularioModal
        aberto={modal === 'editar'}
        aoFechar={() => setModal(null)}
        titulo="Editar risco"
        largo
        campos={camposRisco(processos, contratos, usuarios).filter((c) => !['probabilidade', 'impacto', 'probResidual', 'impactoResidual'].includes(c.nome))}
        valoresIniciais={{ ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null ? '' : v])), proximaRevisao: isoData(r.proximaRevisao) }}
        aoEnviar={async (v) => {
          await api.patch(`/riscos/${id}`, v);
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={modal === 'reavaliar'}
        aoFechar={() => setModal(null)}
        titulo="Reavaliar risco"
        campos={[
          { nome: 'probabilidade', rotulo: 'Probabilidade', tipo: 'select', opcoes: ESCALA, obrigatorio: true, meia: true },
          { nome: 'impacto', rotulo: 'Impacto', tipo: 'select', opcoes: ESCALA, obrigatorio: true, meia: true },
          { nome: 'probResidual', rotulo: 'Probabilidade residual', tipo: 'select', opcoes: ESCALA, meia: true },
          { nome: 'impactoResidual', rotulo: 'Impacto residual', tipo: 'select', opcoes: ESCALA, meia: true },
          { nome: 'proximaRevisao', rotulo: 'Próxima revisão', tipo: 'data' },
          { nome: 'comentario', rotulo: 'Comentário', tipo: 'textarea' },
        ]}
        valoresIniciais={{ probabilidade: String(r.probabilidade), impacto: String(r.impacto), probResidual: r.probResidual ? String(r.probResidual) : '', impactoResidual: r.impactoResidual ? String(r.impactoResidual) : '' }}
        aoEnviar={async (v) => {
          await api.post(`/riscos/${id}/avaliacoes`, converterRisco(v));
          await q.refetch();
        }}
      />
      <FormularioModal
        aberto={modal === 'status'}
        aoFechar={() => setModal(null)}
        titulo="Alterar status"
        campos={[
          { nome: 'status', rotulo: 'Status', tipo: 'select', opcoes: opcoes(STATUS_RISCO), obrigatorio: true },
          { nome: 'motivo', rotulo: 'Motivo', tipo: 'textarea', obrigatorio: true },
        ]}
        aoEnviar={async (v) => {
          await api.post(`/riscos/${id}/status`, v);
          await q.refetch();
        }}
      />
    </>
  );
}
