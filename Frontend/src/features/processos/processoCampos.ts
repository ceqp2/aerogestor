import { Campo } from '@/components/Formulario';
import { FORMAS, HIPOTESES, MODALIDADES, opcoes, PRIORIDADES, TIPOS_OBJETO } from '@/lib/rotulos';

/** Campos do processo. Forma de contratação, modalidade e hipótese legal são dimensões distintas. */
export function camposProcesso(usuarios: Array<{ value: string; label: string }>, atas: Array<{ value: string; label: string }>, exercicioPadrao: number): Campo[] {
  return [
    { nome: 'objeto', rotulo: 'Objeto', tipo: 'textarea', obrigatorio: true },
    { nome: 'exercicio', rotulo: 'Exercício', tipo: 'numero', obrigatorio: true, meia: true, min: 2000, max: 2100, placeholder: String(exercicioPadrao) },
    { nome: 'nup', rotulo: 'NUP', meia: true, placeholder: '00000.000000/0000-00' },
    { nome: 'tipoObjeto', rotulo: 'Tipo de objeto', tipo: 'select', opcoes: opcoes(TIPOS_OBJETO), obrigatorio: true, meia: true },
    { nome: 'prioridade', rotulo: 'Prioridade', tipo: 'select', opcoes: opcoes(PRIORIDADES), meia: true },
    {
      nome: 'formaContratacao', rotulo: 'Forma de contratação', tipo: 'select', opcoes: opcoes(FORMAS), obrigatorio: true,
      ajuda: 'Dispensa, inexigibilidade e adesão a ata não são modalidades licitatórias.',
    },
    { nome: 'modalidade', rotulo: 'Modalidade licitatória', tipo: 'select', opcoes: opcoes(MODALIDADES), meia: true, visivel: (v) => v.formaContratacao === 'LICITACAO' },
    { nome: 'hipoteseDireta', rotulo: 'Hipótese de contratação direta', tipo: 'select', opcoes: opcoes(HIPOTESES), meia: true, visivel: (v) => v.formaContratacao === 'CONTRATACAO_DIRETA' },
    { nome: 'ataId', rotulo: 'Ata de registro de preços', tipo: 'select', opcoes: atas, visivel: (v) => v.formaContratacao === 'ADESAO_ATA' || v.formaContratacao === 'UTILIZACAO_ATA_PARTICIPANTE' },
    { nome: 'fundamentoLegal', rotulo: 'Fundamento legal', placeholder: 'Ex.: Lei 14.133/2021, art. 75, … (validar redação vigente)' },
    { nome: 'procedimentoAuxiliar', rotulo: 'Procedimento auxiliar (se houver)', meia: true },
    { nome: 'valorEstimado', rotulo: 'Valor estimado (R$)', tipo: 'dinheiro', meia: true },
    { nome: 'setorRequisitante', rotulo: 'Setor requisitante', meia: true },
    { nome: 'origemDemanda', rotulo: 'Origem da demanda', meia: true },
    { nome: 'responsavelId', rotulo: 'Responsável', tipo: 'select', opcoes: usuarios },
    { nome: 'dataInicioPrevista', rotulo: 'Início previsto', tipo: 'data', meia: true },
    { nome: 'dataConclusaoPrevista', rotulo: 'Conclusão prevista', tipo: 'data', meia: true },
  ];
}
