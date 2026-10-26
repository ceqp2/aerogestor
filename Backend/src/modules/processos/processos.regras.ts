import { EstadoChecklist, EtapaProcesso, FormaContratacao, HipoteseDireta, Modalidade } from '@prisma/client';

/** Regras de domínio puras (testáveis sem banco). */

export const ORDEM_ETAPAS: EtapaProcesso[] = [
  'A_INICIAR',
  'PLANEJAMENTO',
  'INSTRUCAO',
  'ANALISE',
  'SELECAO_FORNECEDOR',
  'FORMALIZACAO',
  'FINALIZADO',
];

export const indiceEtapa = (e: EtapaProcesso) => ORDEM_ETAPAS.indexOf(e);

/**
 * Forma de contratação, modalidade e hipótese legal são dimensões distintas:
 * dispensa/inexigibilidade e adesão a ata NÃO são modalidades licitatórias.
 */
export function validarClassificacao(p: {
  formaContratacao: FormaContratacao;
  modalidade?: Modalidade | null;
  hipoteseDireta?: HipoteseDireta | null;
  ataId?: string | null;
}): string[] {
  const erros: string[] = [];
  switch (p.formaContratacao) {
    case 'LICITACAO':
      if (!p.modalidade) erros.push('Licitação exige modalidade');
      if (p.hipoteseDireta) erros.push('Licitação não admite hipótese de contratação direta');
      break;
    case 'CONTRATACAO_DIRETA':
      if (!p.hipoteseDireta) erros.push('Contratação direta exige hipótese (dispensa ou inexigibilidade)');
      if (p.modalidade) erros.push('Contratação direta não possui modalidade licitatória');
      break;
    case 'UTILIZACAO_ATA_PARTICIPANTE':
    case 'ADESAO_ATA':
      if (p.modalidade) erros.push('Utilização/adesão de ata não é modalidade licitatória');
      if (p.hipoteseDireta) erros.push('Utilização/adesão de ata não é hipótese de contratação direta');
      break;
  }
  return erros;
}

export interface ItemChecklistLite {
  etapa: EtapaProcesso;
  estado: EstadoChecklist;
  critico: boolean;
  exigeRevisaoNA: boolean;
  naRevisadoEm: Date | null;
  titulo: string;
}

/** Percentual de cumprimento — itens "não aplicável" ficam fora do denominador. */
export function cumprimento(itens: ItemChecklistLite[]) {
  const aplicaveis = itens.filter((i) => i.estado !== 'NAO_APLICAVEL');
  const concluidos = aplicaveis.filter((i) => i.estado === 'CONCLUIDO').length;
  return {
    total: itens.length,
    aplicaveis: aplicaveis.length,
    concluidos,
    naoAplicaveis: itens.length - aplicaveis.length,
    percentual: aplicaveis.length ? Math.round((concluidos / aplicaveis.length) * 1000) / 10 : 0,
  };
}

/** Item resolvido para fins de avanço: concluído, ou N/A já revisado quando a revisão é exigida. */
export function itemResolvido(i: ItemChecklistLite) {
  if (i.estado === 'CONCLUIDO') return true;
  if (i.estado === 'NAO_APLICAVEL') return !i.exigeRevisaoNA || !!i.naRevisadoEm;
  return false;
}

/** Itens críticos aplicáveis que impedem concluir a etapa atual (e anteriores). */
export function bloqueiosParaAvancar(itens: ItemChecklistLite[], etapaAtual: EtapaProcesso): ItemChecklistLite[] {
  const limite = indiceEtapa(etapaAtual);
  return itens.filter((i) => i.critico && indiceEtapa(i.etapa) <= limite && !itemResolvido(i));
}
