import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Carregando, ErroCarga, Vazio } from '@/components/feedback';
import { Campo, FormularioModal } from '@/components/Formulario';
import { BarraFiltros, FiltroSelect, FiltroTexto, Paginacao, Tabela } from '@/components/Tabela';
import { Botao, CabecalhoPagina, Cartao, Selo } from '@/components/ui';
import { api, Paginado, qs } from '@/lib/api';
import { data } from '@/lib/formato';
import { opcoes, rotulo, TIPOS_VINCULO_ATA } from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';

interface AtaLista {
  id: string;
  numero: string;
  idPncp?: string;
  orgaoGerenciador: string;
  objeto: string;
  tipoVinculo: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  cancelada: boolean;
  expirada: boolean;
  impedimentos: string[];
  _count: { itens: number };
}

export const camposAta: Campo[] = [
  { nome: 'numero', rotulo: 'Número da ata', obrigatorio: true, meia: true },
  { nome: 'ano', rotulo: 'Ano', tipo: 'numero', min: 2000, max: 2100, meia: true },
  { nome: 'orgaoGerenciador', rotulo: 'Órgão gerenciador', obrigatorio: true },
  { nome: 'cnpjGerenciador', rotulo: 'CNPJ do gerenciador', meia: true },
  { nome: 'uasg', rotulo: 'UASG (quando disponível)', meia: true },
  { nome: 'idPncp', rotulo: 'Identificador PNCP', meia: true },
  { nome: 'processoOrigem', rotulo: 'Processo de origem', meia: true },
  { nome: 'objeto', rotulo: 'Objeto', tipo: 'textarea', obrigatorio: true },
  { nome: 'vigenciaInicio', rotulo: 'Início da vigência', tipo: 'data', obrigatorio: true, meia: true },
  { nome: 'vigenciaFim', rotulo: 'Fim da vigência', tipo: 'data', obrigatorio: true, meia: true },
];

export function SeloAta({ a }: { a: Pick<AtaLista, 'cancelada' | 'expirada' | 'impedimentos'> }) {
  if (a.cancelada) return <Selo tom="perigo">Cancelada</Selo>;
  if (a.expirada) return <Selo tom="perigo">Expirada</Selo>;
  if (a.impedimentos.length) return <Selo tom="atencao">Uso não autorizado</Selo>;
  return <Selo tom="ok">Utilizável</Selo>;
}

export default function AtasPage() {
  const { pode } = useAuth();
  const navegar = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [criar, setCriar] = useState(false);
  const f = { busca: sp.get('busca') ?? '', vigencia: sp.get('vigencia') ?? '', tipoVinculo: sp.get('tipoVinculo') ?? '', pagina: Number(sp.get('pagina') ?? 1) };
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'pagina') n.delete('pagina');
    setSp(n, { replace: true });
  };
  const q = useQuery({ queryKey: ['atas', f], queryFn: () => api.get<Paginado<AtaLista>>(`/atas${qs(f)}`) });

  return (
    <>
      <CabecalhoPagina
        titulo="Atas de registro de preços"
        subtitulo="Ata é instrumento próprio — não é contrato nem orçamento disponível. Importar uma ata não autoriza sua utilização."
        acoes={
          pode.escrever && (
            <>
              <Link to="/consultas" className="inline-flex min-h-11 items-center rounded-lg border border-borda bg-white px-4 text-sm font-medium hover:bg-azul-claro-2">
                Importar do PNCP
              </Link>
              <Botao icone={<Plus className="size-4" />} onClick={() => setCriar(true)}>
                Cadastrar ata
              </Botao>
            </>
          )
        }
      />
      <BarraFiltros>
        <FiltroTexto valor={f.busca} aoMudar={(v) => set('busca', v)} placeholder="Número, objeto, órgão, PNCP" />
        <FiltroSelect rotulo="Vigência" valor={f.vigencia} aoMudar={(v) => set('vigencia', v)} opcoes={[{ value: 'vigentes', label: 'Vigentes' }, { value: 'expiradas', label: 'Expiradas' }]} todos="Todas" />
        <FiltroSelect rotulo="Vínculo" valor={f.tipoVinculo} aoMudar={(v) => set('tipoVinculo', v)} opcoes={opcoes(TIPOS_VINCULO_ATA)} />
      </BarraFiltros>
      <Cartao>
        {q.isLoading ? (
          <Carregando />
        ) : q.isError ? (
          <ErroCarga erro={q.error} tentarNovamente={() => q.refetch()} />
        ) : (
          <>
            <Tabela
              rotulo="Atas"
              dados={q.data!.itens}
              chave={(a) => a.id}
              linkPara={(a) => `/atas/${a.id}`}
              vazio={<Vazio titulo="Nenhuma ata" />}
              colunas={[
                {
                  titulo: 'Ata', principal: true,
                  render: (a) => (
                    <div>
                      <Link to={`/atas/${a.id}`} className="font-medium text-acao hover:underline">
                        {a.numero}
                      </Link>
                      <p className="line-clamp-2 text-xs text-tinta-suave">{a.objeto}</p>
                    </div>
                  ),
                },
                { titulo: 'Gerenciador', render: (a) => <span className="text-xs">{a.orgaoGerenciador}</span> },
                { titulo: 'Vínculo', render: (a) => rotulo(TIPOS_VINCULO_ATA, a.tipoVinculo) },
                { titulo: 'Vigência', render: (a) => `${data(a.vigenciaInicio)} a ${data(a.vigenciaFim)}` },
                { titulo: 'Itens', render: (a) => a._count.itens },
                { titulo: 'Situação', render: (a) => <SeloAta a={a} /> },
              ]}
            />
            <Paginacao pagina={q.data!.pagina} paginas={q.data!.paginas} total={q.data!.total} aoMudar={(p) => set('pagina', String(p))} />
          </>
        )}
      </Cartao>
      <FormularioModal
        aberto={criar}
        aoFechar={() => setCriar(false)}
        titulo="Cadastrar ata"
        largo
        campos={camposAta}
        aviso={<p className="text-xs text-tinta-suave">A ata é cadastrada como “somente consulta”. A utilização exige registro de participação/adesão com documento.</p>}
        aoEnviar={async (v) => {
          const a = await api.post<{ id: string }>('/atas', v);
          navegar(`/atas/${a.id}`);
        }}
      />
    </>
  );
}
