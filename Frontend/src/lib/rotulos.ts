/** Rótulos pt-BR dos enumerados do domínio. */
type Mapa = Record<string, string>;

export const PERFIS: Mapa = {
  COMANDANTE: 'Comandante',
  ADMIN: 'Administrador',
  CHEFE: 'Chefe da secretaria',
  AUXILIAR: 'Auxiliar da secretaria',
  GESTOR: 'Gestor/fiscal de contrato',
};

export const ETAPAS: Mapa = {
  A_INICIAR: 'A iniciar',
  PLANEJAMENTO: 'Planejamento',
  INSTRUCAO: 'Instrução',
  ANALISE: 'Análise',
  SELECAO_FORNECEDOR: 'Seleção do fornecedor / contratação direta',
  FORMALIZACAO: 'Formalização',
  FINALIZADO: 'Finalizado',
};
export const ORDEM_ETAPAS = Object.keys(ETAPAS);

export const SITUACOES_PROCESSO: Mapa = { ATIVO: 'Ativo', SUSPENSO: 'Suspenso', CANCELADO: 'Cancelado' };

export const FORMAS: Mapa = {
  LICITACAO: 'Licitação',
  CONTRATACAO_DIRETA: 'Contratação direta',
  UTILIZACAO_ATA_PARTICIPANTE: 'Utilização de ata (participante)',
  ADESAO_ATA: 'Adesão a ata',
};

export const MODALIDADES: Mapa = {
  PREGAO: 'Pregão',
  CONCORRENCIA: 'Concorrência',
  CONCURSO: 'Concurso',
  LEILAO: 'Leilão',
  DIALOGO_COMPETITIVO: 'Diálogo competitivo',
};

export const HIPOTESES: Mapa = { DISPENSA: 'Dispensa', INEXIGIBILIDADE: 'Inexigibilidade' };

export const TIPOS_OBJETO: Mapa = {
  MATERIAL: 'Material',
  SERVICO: 'Serviço',
  SERVICO_CONTINUO: 'Serviço contínuo',
  OBRA_SERVICO_ENGENHARIA: 'Obra/serviço de engenharia',
  TIC: 'Tecnologia da informação',
  OUTRO: 'Outro',
};

export const PRIORIDADES: Mapa = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', URGENTE: 'Urgente' };

export const ESTADOS_CHECKLIST: Mapa = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
  NAO_APLICAVEL: 'Não aplicável',
  DEVOLVIDO: 'Devolvido',
};

export const TIPOS_VINCULO_ATA: Mapa = {
  GERENCIADOR: 'Gerenciador',
  PARTICIPANTE: 'Participante',
  ADESAO: 'Adesão',
  CONSULTA: 'Somente consulta',
};

export const TIPOS_MOV_ATA: Mapa = {
  RESERVA: 'Reserva',
  LIBERACAO_RESERVA: 'Liberação de reserva',
  CONSUMO: 'Consumo formalizado',
  CANCELAMENTO_CONSUMO: 'Cancelamento de consumo',
};

export const TIPOS_INSTRUMENTO: Mapa = {
  CONTRATO: 'Contrato',
  NOTA_EMPENHO: 'Nota de empenho (substitutivo)',
  CARTA_CONTRATO: 'Carta-contrato',
  AUTORIZACAO_COMPRA: 'Autorização de compra',
  ORDEM_EXECUCAO_SERVICO: 'Ordem de execução de serviço',
  OUTRO: 'Outro',
};

export const NATUREZAS: Mapa = { MATERIAL: 'Material', SERVICO: 'Serviço', MISTO: 'Misto' };

export const SITUACOES_CONTRATO: Mapa = {
  EM_FORMALIZACAO: 'Em formalização',
  VIGENTE: 'Vigente',
  SUSPENSO: 'Suspenso',
  EXECUCAO_ENCERRADA: 'Execução encerrada',
  RESCINDIDO: 'Extinto/rescindido',
};

export const FUNCOES: Mapa = {
  GESTOR: 'Gestor',
  GESTOR_SUBSTITUTO: 'Gestor substituto',
  FISCAL_TECNICO: 'Fiscal técnico',
  FISCAL_ADMINISTRATIVO: 'Fiscal administrativo',
  FISCAL_REQUISITANTE: 'Fiscal requisitante',
  FISCAL_SUBSTITUTO: 'Fiscal substituto',
};

export const STATUS_DESIGNACAO: Mapa = { PENDENTE: 'Pendente de documento', ATIVA: 'Ativa', ENCERRADA: 'Encerrada' };

export const TIPOS_ADITIVO: Mapa = {
  PRORROGACAO: 'Prorrogação',
  ACRESCIMO: 'Acréscimo',
  SUPRESSAO: 'Supressão',
  REAJUSTE: 'Reajuste',
  REPACTUACAO: 'Repactuação',
  REEQUILIBRIO: 'Reequilíbrio',
  OUTRO: 'Outro',
};

export const STATUS_ENTREGA: Mapa = {
  PENDENTE: 'Pendente',
  ENTREGUE_PARCIAL: 'Entregue parcialmente',
  RECEBIDA_PROVISORIA: 'Recebida provisoriamente',
  RECEBIDA_DEFINITIVA: 'Recebida definitivamente',
  REJEITADA: 'Rejeitada',
  CANCELADA: 'Cancelada',
};

export const STATUS_MEDICAO: Mapa = { EM_ELABORACAO: 'Em elaboração', ENVIADA: 'Enviada', APROVADA: 'Aprovada', GLOSADA: 'Glosada' };

export const TIPOS_REGISTRO: Mapa = { RELATORIO: 'Relatório', OCORRENCIA: 'Ocorrência', INCONFORMIDADE: 'Inconformidade', ORDEM_SERVICO: 'Ordem de serviço' };

export const STATUS_NF: Mapa = { RECEBIDA: 'Recebida', ATESTADA: 'Atestada', REJEITADA: 'Rejeitada', CANCELADA: 'Cancelada', LIQUIDADA: 'Liquidada', PAGA: 'Paga' };

export const TIPOS_MOV_EMPENHO: Mapa = {
  EMISSAO: 'Emissão',
  REFORCO: 'Reforço',
  ANULACAO: 'Anulação',
  LIQUIDACAO: 'Liquidação',
  ESTORNO_LIQUIDACAO: 'Estorno de liquidação',
  PAGAMENTO: 'Pagamento',
  ESTORNO_PAGAMENTO: 'Estorno de pagamento',
};

export const TIPOS_MOV_RAP: Mapa = { LIQUIDACAO: 'Liquidação', PAGAMENTO: 'Pagamento', CANCELAMENTO: 'Cancelamento', ESTORNO: 'Estorno' };

export const STATUS_RISCO: Mapa = { ABERTO: 'Aberto', EM_TRATAMENTO: 'Em tratamento', MONITORADO: 'Monitorado', ENCERRADO: 'Encerrado' };
export const NIVEIS_RISCO: Mapa = { baixo: 'Baixo', moderado: 'Moderado', alto: 'Alto', critico: 'Crítico' };

export const TIPOS_EVENTO: Mapa = {
  CONTATO_EMPRESA: 'Contato com empresa',
  SOLICITACAO_EMPENHO: 'Solicitação de empenho',
  ENTREGA: 'Entrega',
  INICIO_SERVICO: 'Início de serviço',
  TERMINO_SERVICO: 'Término de serviço',
  DFD: 'DFD',
  REVISAO_RISCO: 'Revisão de risco',
  VIGENCIA: 'Vigência',
  MARCO_TOD: 'Marco TOD (definição pendente)',
  PROPOSTA_ORCAMENTARIA: 'Proposta orçamentária',
  REUNIAO: 'Reunião',
  OUTRO: 'Outro',
};

export const CATEGORIAS_SOLICITACAO: Mapa = { CONTATO: 'Contato', NOTIFICACAO: 'Notificação', DOCUMENTACAO: 'Documentação', CORRECAO: 'Correção', OUTRA: 'Outra' };
export const STATUS_SOLICITACAO: Mapa = {
  ABERTA: 'Aberta',
  EM_TRIAGEM: 'Em triagem',
  EM_ATENDIMENTO: 'Em atendimento',
  AGUARDANDO_EMPRESA: 'Aguardando empresa',
  RESOLVIDA: 'Resolvida',
  CANCELADA: 'Cancelada',
};

export const STATUS_DEMANDA: Mapa = { RASCUNHO: 'Rascunho', EM_ANALISE: 'Em análise', APROVADA: 'Aprovada', REJEITADA: 'Rejeitada', ATENDIDA: 'Atendida' };

export const CATEGORIAS_DOC: Mapa = {
  DFD: 'DFD',
  ETP: 'ETP',
  TR_PROJETO: 'TR / Projeto',
  PESQUISA_PRECOS: 'Pesquisa de preços',
  ANALISE_RISCOS: 'Análise de riscos',
  MATRIZ_ALOCACAO_RISCOS: 'Matriz de alocação de riscos',
  PARECER_JURIDICO: 'Parecer jurídico',
  AUTORIZACAO: 'Autorização',
  EDITAL_AVISO: 'Edital / aviso',
  CONTRATO: 'Contrato',
  ADITIVO: 'Aditivo',
  DESIGNACAO: 'Designação',
  NOTA_FISCAL: 'Nota fiscal',
  RELATORIO: 'Relatório',
  EVIDENCIA: 'Evidência',
  COMUNICACAO: 'Comunicação',
  ATA: 'Ata',
  EMPENHO: 'Empenho',
  OUTRO: 'Outro',
};

export const rotulo = (mapa: Mapa, v: string | null | undefined) => (v ? (mapa[v] ?? v) : '—');
export const opcoes = (mapa: Mapa) => Object.entries(mapa).map(([value, label]) => ({ value, label }));
