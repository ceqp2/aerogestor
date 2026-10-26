import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Carregando, ErroCarga, Vazio } from '@/components/feedback';
import { Campo, FormularioModal } from '@/components/Formulario';
import { BarraFiltros, FiltroSelect, FiltroTexto, Paginacao, Tabela } from '@/components/Tabela';
import { Botao, CabecalhoPagina, Cartao, Selo, Tom } from '@/components/ui';
import { api, Paginado, qs } from '@/lib/api';
import { data, diasTexto, moeda } from '@/lib/formato';
import { FUNCOES, NATUREZAS, opcoes, rotulo, SITUACOES_CONTRATO, TIPOS_INSTRUMENTO } from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';
import { useFornecedoresOpcoes, useProcessosOpcoes } from '@/hooks/useOpcoes';

interface ContratoLista {
  id: string;
  numero: string;
  objeto: string;
  tipo: string;
  natureza: string;
  situacao: string;
  valorAtualizado: string;
  vigenciaFim: string;
  diasParaVencer: number;
  vigenciaExpirada: boolean;
  fornecedor?: { razaoSocial: string };
  designacoes: Array<{ funcao: string; status: string; usuario: { nome: string } }>;
}

export const tomVigencia = (dias: number, situacao: string): Tom =>
  situacao !== 'VIGENTE' && situacao !== 'SUSPENSO' ? 'neutro' : dias < 0 ? 'perigo' : dias <= 15 ? 'perigo' : dias <= 30 ? 'atencao' : dias <= 90 ? 'info' : 'ok';

export default function ContratosPage() {
  const { pode } = useAuth();
  const navegar = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [criar, setCriar] = useState(false);
  const [fornecedor, setFornecedor] = useState(false);
  const fornecedores = useFornecedoresOpcoes();
  const processos = useProcessosOpcoes();
  const atas = useQuery({ queryKey: ['atas', 'utilizaveis'], queryFn: () => api.get<Paginado<{ id: string; numero: string; impedimentos: string[] }>>('/atas?tamanho=200&vigencia=vigentes'), enabled: pode.escrever });
  const f = {
    busca: sp.get('busca') ?? '',
    situacao: sp.get('situacao') ?? '',
    natureza: sp.get('natureza') ?? '',
    vencendoEmDias: sp.get('vencendoEmDias') ?? '',
    semDesignacao: sp.get('semDesignacao') ?? '',
    pagina: Number(sp.get('pagina') ?? 1),
  };
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'pagina') n.delete('pagina');
    setSp(n, { replace: true });
  };
  const q = useQuery({ queryKey: ['contratos', f], queryFn: () => api.get<Paginado<ContratoLista>>(`/contratos${qs(f)}`) });

  const campos: Campo[] = [
    { nome: 'numero', rotulo: 'Número', obrigatorio: true, meia: true },
    { nome: 'tipo', rotulo: 'Tipo de instrumento', tipo: 'select', opcoes: opcoes(TIPOS_INSTRUMENTO), obrigatorio: true, meia: true, ajuda: 'Verifique se a hipótese admite instrumento substitutivo.' },
    { nome: 'natureza', rotulo: 'Natureza', tipo: 'select', opcoes: opcoes(NATUREZAS), obrigatorio: true, meia: true },
    { nome: 'fornecedorId', rotulo: 'Fornecedor', tipo: 'select', opcoes: fornecedores, obrigatorio: true, meia: true },
    { nome: 'objeto', rotulo: 'Objeto', tipo: 'textarea', obrigatorio: true },
    { nome: 'processoId', rotulo: 'Processo de origem', tipo: 'select', opcoes: processos },
    { nome: 'ataId', rotulo: 'Ata de origem (somente atas utilizáveis)', tipo: 'select', opcoes: (atas.data?.itens ?? []).filter((a) => !a.impedimentos.length).map((a) => ({ value: a.id, label: a.numero })) },
    { nome: 'valorInicial', rotulo: 'Valor inicial (R$)', tipo: 'dinheiro', obrigatorio: true, meia: true },
    { nome: 'dataAssinatura', rotulo: 'Data de assinatura', tipo: 'data', meia: true },
    { nome: 'vigenciaInicio', rotulo: 'Início da vigência', tipo: 'data', obrigatorio: true, meia: true },
    { nome: 'vigenciaFim', rotulo: 'Fim da vigência', tipo: 'data', obrigatorio: true, meia: true },
    { nome: 'prazoExecucaoDias', rotulo: 'Prazo de execução (dias)', tipo: 'numero', min: 1, max: 36500, meia: true },
    { nome: 'inicioPrevisto', rotulo: 'Início previsto da execução', tipo: 'data', meia: true },
    { nome: 'reajusteIndice', rotulo: 'Índice de reajuste/repactuação', meia: true },
    { nome: 'garantiaTipo', rotulo: 'Garantia (tipo)', meia: true },
    { nome: 'garantiaValor', rotulo: 'Garantia (valor R$)', tipo: 'dinheiro', meia: true },
    { nome: 'garantiaValidade', rotulo: 'Validade da garantia', tipo: 'data', meia: true },
    { nome: 'obrigacoes', rotulo: 'Principais obrigações', tipo: 'textarea' },
  ];

  return (
    <>
      <CabecalhoPagina
        titulo={pode.gestor ? 'Meus contratos' : 'Contratos e instrumentos'}
        subtitulo={pode.gestor ? 'Contratos com sua indicação ou designação vigente' : 'Vigência expirada não significa execução encerrada.'}
        acoes={
          pode.escrever && (
            <>
              <Botao variante="secundario" onClick={() => setFornecedor(true)}>
                Novo fornecedor
              </Botao>
              <Botao icone={<Plus className="size-4" />} onClick={() => setCriar(true)}>
                Novo instrumento
              </Botao>
            </>
          )
        }
      />
      <BarraFiltros>
        <FiltroTexto valor={f.busca} aoMudar={(v) => set('busca', v)} placeholder="Número ou objeto" />
        <FiltroSelect rotulo="Situação" valor={f.situacao} aoMudar={(v) => set('situacao', v)} opcoes={opcoes(SITUACOES_CONTRATO)} todos="Todas" />
        <FiltroSelect rotulo="Natureza" valor={f.natureza} aoMudar={(v) => set('natureza', v)} opcoes={opcoes(NATUREZAS)} todos="Todas" />
        <FiltroSelect rotulo="Vencendo em" valor={f.vencendoEmDias} aoMudar={(v) => set('vencendoEmDias', v)} opcoes={[30, 60, 90, 180].map((d) => ({ value: String(d), label: `${d} dias` }))} todos="Qualquer" />
        {!pode.gestor && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="size-5 accent-acao" checked={f.semDesignacao === 'true'} onChange={(e) => set('semDesignacao', e.target.checked ? 'true' : '')} />
            Sem gestor designado
          </label>
        )}
      </BarraFiltros>
      <Cartao>
        {q.isLoading ? (
          <Carregando />
        ) : q.isError ? (
          <ErroCarga erro={q.error} tentarNovamente={() => q.refetch()} />
        ) : (
          <>
            <Tabela
              rotulo="Contratos"
              dados={q.data!.itens}
              chave={(c) => c.id}
              linkPara={(c) => `/contratos/${c.id}`}
              vazio={<Vazio titulo="Nenhum contrato encontrado" />}
              colunas={[
                {
                  titulo: 'Instrumento', principal: true,
                  render: (c) => (
                    <div>
                      <Link to={`/contratos/${c.id}`} className="font-medium text-acao hover:underline">
                        {c.numero}
                      </Link>
                      <p className="line-clamp-2 text-xs text-tinta-suave">{c.objeto}</p>
                    </div>
                  ),
                },
                { titulo: 'Fornecedor', render: (c) => <span className="text-xs">{c.fornecedor?.razaoSocial}</span> },
                { titulo: 'Tipo', render: (c) => <span className="text-xs">{rotulo(TIPOS_INSTRUMENTO, c.tipo)} • {rotulo(NATUREZAS, c.natureza)}</span>, ocultarMobile: true },
                {
                  titulo: 'Gestão',
                  render: (c) =>
                    c.designacoes.length ? (
                      <span className="text-xs">
                        {c.designacoes.slice(0, 2).map((d, i) => (
                          <span key={i} className="block">
                            {FUNCOES[d.funcao]}: {d.usuario.nome}
                            {d.status === 'PENDENTE' && ' (pendente)'}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <Selo tom="perigo">Sem designação</Selo>
                    ),
                },
                { titulo: 'Situação', render: (c) => rotulo(SITUACOES_CONTRATO, c.situacao) },
                { titulo: 'Vigência', render: (c) => <div><span className="text-xs">{data(c.vigenciaFim)}</span><br /><Selo tom={tomVigencia(c.diasParaVencer, c.situacao)}>{diasTexto(c.diasParaVencer)}</Selo></div> },
                { titulo: 'Valor atualizado', render: (c) => moeda(c.valorAtualizado), alinhar: 'direita' },
              ]}
            />
            <Paginacao pagina={q.data!.pagina} paginas={q.data!.paginas} total={q.data!.total} aoMudar={(p) => set('pagina', String(p))} />
          </>
        )}
      </Cartao>
      <FormularioModal
        aberto={criar}
        aoFechar={() => setCriar(false)}
        titulo="Novo instrumento contratual"
        largo
        campos={campos}
        aoEnviar={async (v) => {
          const c = await api.post<{ id: string }>('/contratos', v);
          navegar(`/contratos/${c.id}?aba=designacoes`);
        }}
      />
      <FormularioModal
        aberto={fornecedor}
        aoFechar={() => setFornecedor(false)}
        titulo="Novo fornecedor"
        campos={[
          { nome: 'documento', rotulo: 'CNPJ/CPF', obrigatorio: true, ajuda: 'Dígitos verificadores conferidos.' },
          { nome: 'razaoSocial', rotulo: 'Razão social / nome', obrigatorio: true },
          { nome: 'email', rotulo: 'E-mail', tipo: 'email', meia: true },
          { nome: 'telefone', rotulo: 'Telefone', meia: true },
        ]}
        aoEnviar={async (v) => {
          await api.post('/fornecedores', v);
        }}
      />
    </>
  );
}
