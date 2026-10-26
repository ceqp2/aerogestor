-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('COMANDANTE', 'ADMIN', 'CHEFE', 'AUXILIAR', 'GESTOR');

-- CreateEnum
CREATE TYPE "TipoConvite" AS ENUM ('CONVITE', 'RECUPERACAO');

-- CreateEnum
CREATE TYPE "Prioridade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "StatusDemanda" AS ENUM ('RASCUNHO', 'EM_ANALISE', 'APROVADA', 'REJEITADA', 'ATENDIDA');

-- CreateEnum
CREATE TYPE "FormaContratacao" AS ENUM ('LICITACAO', 'CONTRATACAO_DIRETA', 'UTILIZACAO_ATA_PARTICIPANTE', 'ADESAO_ATA');

-- CreateEnum
CREATE TYPE "Modalidade" AS ENUM ('PREGAO', 'CONCORRENCIA', 'CONCURSO', 'LEILAO', 'DIALOGO_COMPETITIVO');

-- CreateEnum
CREATE TYPE "HipoteseDireta" AS ENUM ('DISPENSA', 'INEXIGIBILIDADE');

-- CreateEnum
CREATE TYPE "TipoObjeto" AS ENUM ('MATERIAL', 'SERVICO', 'SERVICO_CONTINUO', 'OBRA_SERVICO_ENGENHARIA', 'TIC', 'OUTRO');

-- CreateEnum
CREATE TYPE "EtapaProcesso" AS ENUM ('A_INICIAR', 'PLANEJAMENTO', 'INSTRUCAO', 'ANALISE', 'SELECAO_FORNECEDOR', 'FORMALIZACAO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "SituacaoProcesso" AS ENUM ('ATIVO', 'SUSPENSO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoChecklist" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'NAO_APLICAVEL', 'DEVOLVIDO');

-- CreateEnum
CREATE TYPE "TipoVinculoAta" AS ENUM ('GERENCIADOR', 'PARTICIPANTE', 'ADESAO', 'CONSULTA');

-- CreateEnum
CREATE TYPE "TipoMovQtdAta" AS ENUM ('RESERVA', 'LIBERACAO_RESERVA', 'CONSUMO', 'CANCELAMENTO_CONSUMO');

-- CreateEnum
CREATE TYPE "TipoInstrumento" AS ENUM ('CONTRATO', 'NOTA_EMPENHO', 'CARTA_CONTRATO', 'AUTORIZACAO_COMPRA', 'ORDEM_EXECUCAO_SERVICO', 'OUTRO');

-- CreateEnum
CREATE TYPE "NaturezaInstrumento" AS ENUM ('MATERIAL', 'SERVICO', 'MISTO');

-- CreateEnum
CREATE TYPE "SituacaoContrato" AS ENUM ('EM_FORMALIZACAO', 'VIGENTE', 'SUSPENSO', 'EXECUCAO_ENCERRADA', 'RESCINDIDO');

-- CreateEnum
CREATE TYPE "FuncaoDesignacao" AS ENUM ('GESTOR', 'GESTOR_SUBSTITUTO', 'FISCAL_TECNICO', 'FISCAL_ADMINISTRATIVO', 'FISCAL_REQUISITANTE', 'FISCAL_SUBSTITUTO');

-- CreateEnum
CREATE TYPE "StatusDesignacao" AS ENUM ('PENDENTE', 'ATIVA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "TipoAditivo" AS ENUM ('PRORROGACAO', 'ACRESCIMO', 'SUPRESSAO', 'REAJUSTE', 'REPACTUACAO', 'REEQUILIBRIO', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusEntrega" AS ENUM ('PENDENTE', 'ENTREGUE_PARCIAL', 'RECEBIDA_PROVISORIA', 'RECEBIDA_DEFINITIVA', 'REJEITADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusMedicao" AS ENUM ('EM_ELABORACAO', 'ENVIADA', 'APROVADA', 'GLOSADA');

-- CreateEnum
CREATE TYPE "TipoRecebimento" AS ENUM ('PROVISORIO', 'DEFINITIVO', 'REJEICAO');

-- CreateEnum
CREATE TYPE "TipoRegistroExecucao" AS ENUM ('RELATORIO', 'OCORRENCIA', 'INCONFORMIDADE', 'ORDEM_SERVICO');

-- CreateEnum
CREATE TYPE "StatusNotaFiscal" AS ENUM ('RECEBIDA', 'ATESTADA', 'REJEITADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoMovCredito" AS ENUM ('INICIAL', 'ACRESCIMO', 'REDUCAO');

-- CreateEnum
CREATE TYPE "TipoMovEmpenho" AS ENUM ('EMISSAO', 'REFORCO', 'ANULACAO', 'LIQUIDACAO', 'ESTORNO_LIQUIDACAO', 'PAGAMENTO', 'ESTORNO_PAGAMENTO');

-- CreateEnum
CREATE TYPE "TipoRestosAPagar" AS ENUM ('PROCESSADO', 'NAO_PROCESSADO');

-- CreateEnum
CREATE TYPE "TipoMovRap" AS ENUM ('LIQUIDACAO', 'PAGAMENTO', 'CANCELAMENTO', 'ESTORNO');

-- CreateEnum
CREATE TYPE "StatusRisco" AS ENUM ('ABERTO', 'EM_TRATAMENTO', 'MONITORADO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('CONTATO_EMPRESA', 'SOLICITACAO_EMPENHO', 'ENTREGA', 'INICIO_SERVICO', 'TERMINO_SERVICO', 'DFD', 'REVISAO_RISCO', 'VIGENCIA', 'MARCO_TOD', 'PROPOSTA_ORCAMENTARIA', 'REUNIAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "CategoriaSolicitacao" AS ENUM ('CONTATO', 'NOTIFICACAO', 'DOCUMENTACAO', 'CORRECAO', 'OUTRA');

-- CreateEnum
CREATE TYPE "StatusSolicitacao" AS ENUM ('ABERTA', 'EM_TRIAGEM', 'EM_ATENDIMENTO', 'AGUARDANDO_EMPRESA', 'RESOLVIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoVinculoDoc" AS ENUM ('PROCESSO', 'CHECKLIST_ITEM', 'ATA', 'CONTRATO', 'ENTREGA', 'MEDICAO', 'NOTA_FISCAL', 'SOLICITACAO', 'RISCO', 'EMPENHO', 'GERAL');

-- CreateTable
CREATE TABLE "Unidade" (
    "id" UUID NOT NULL,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeSecao" TEXT NOT NULL DEFAULT 'Secretaria de Aquisições',
    "cidade" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "postoGraduacao" TEXT,
    "senhaHash" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "mfaSecretEnc" TEXT,
    "mfaAtivo" BOOLEAN NOT NULL DEFAULT false,
    "tentativasFalhas" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TIMESTAMPTZ(3),
    "ultimoLogin" TIMESTAMPTZ(3),
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "desativadoEm" TIMESTAMPTZ(3),
    "desativadoMotivo" TEXT,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VinculoUnidadePerfil" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "perfil" "Perfil" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPor" UUID,

    CONSTRAINT "VinculoUnidadePerfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConcessaoSuporte" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "motivo" TEXT NOT NULL,
    "concedidoPor" UUID NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim" TIMESTAMPTZ(3) NOT NULL,
    "revogadoEm" TIMESTAMPTZ(3),

    CONSTRAINT "ConcessaoSuporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "csrfHash" TEXT NOT NULL,
    "usuarioId" UUID NOT NULL,
    "unidadeId" UUID,
    "mfaPendente" BOOLEAN NOT NULL DEFAULT false,
    "criadaEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoUso" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,
    "revogadaEm" TIMESTAMPTZ(3),
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Convite" (
    "id" UUID NOT NULL,
    "tipo" "TipoConvite" NOT NULL DEFAULT 'CONVITE',
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "usuarioId" UUID NOT NULL,
    "criadoPor" UUID,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,
    "usadoEm" TIMESTAMPTZ(3),

    CONSTRAINT "Convite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroAuditoria" (
    "id" BIGSERIAL NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unidadeId" UUID,
    "usuarioId" UUID,
    "usuarioNome" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "antes" JSONB,
    "depois" JSONB,
    "motivo" TEXT,
    "correlationId" TEXT,
    "ip" TEXT,

    CONSTRAINT "RegistroAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametroNormativo" (
    "id" UUID NOT NULL,
    "unidadeId" UUID,
    "chave" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "fonte" TEXT NOT NULL,
    "vigenciaInicio" DATE NOT NULL,
    "vigenciaFim" DATE,
    "aprovador" TEXT,
    "pendenteValidacao" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParametroNormativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Demanda" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "setorRequisitante" TEXT NOT NULL,
    "prioridade" "Prioridade" NOT NULL DEFAULT 'MEDIA',
    "valorEstimado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "StatusDemanda" NOT NULL DEFAULT 'RASCUNHO',
    "numeroDfd" TEXT,
    "itemPca" TEXT,
    "dataNecessidade" DATE,
    "processoId" UUID,
    "criadoPor" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Demanda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropostaOrcamentaria" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaOrcamentaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersaoProposta" (
    "id" UUID NOT NULL,
    "propostaId" UUID NOT NULL,
    "versao" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "itens" JSONB NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "observacao" TEXT,
    "criadoPor" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersaoProposta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Processo" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "nup" TEXT,
    "numeroInterno" TEXT NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "objeto" TEXT NOT NULL,
    "tipoObjeto" "TipoObjeto" NOT NULL,
    "origemDemanda" TEXT,
    "setorRequisitante" TEXT,
    "prioridade" "Prioridade" NOT NULL DEFAULT 'MEDIA',
    "valorEstimado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "formaContratacao" "FormaContratacao" NOT NULL,
    "modalidade" "Modalidade",
    "hipoteseDireta" "HipoteseDireta",
    "procedimentoAuxiliar" TEXT,
    "fundamentoLegal" TEXT,
    "etapa" "EtapaProcesso" NOT NULL DEFAULT 'A_INICIAR',
    "situacao" "SituacaoProcesso" NOT NULL DEFAULT 'ATIVO',
    "justificativaSituacao" TEXT,
    "responsavelId" UUID,
    "ataId" UUID,
    "dataInicioPrevista" DATE,
    "dataConclusaoPrevista" DATE,
    "dataInicioReal" DATE,
    "dataConclusaoReal" DATE,
    "modeloChecklistId" UUID,
    "criadoPor" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Processo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemProcesso" (
    "id" UUID NOT NULL,
    "processoId" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "codigoCatalogo" TEXT,
    "tipoCatalogo" TEXT,
    "unidadeMedida" TEXT NOT NULL,
    "quantidade" DECIMAL(18,4) NOT NULL,
    "valorUnitarioEstimado" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ItemProcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeloChecklist" (
    "id" UUID NOT NULL,
    "unidadeId" UUID,
    "nome" TEXT NOT NULL,
    "formaContratacao" "FormaContratacao" NOT NULL,
    "tipoObjeto" "TipoObjeto",
    "versao" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "fonte" TEXT,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModeloChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeloChecklistItem" (
    "id" UUID NOT NULL,
    "modeloId" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "etapa" "EtapaProcesso" NOT NULL,
    "critico" BOOLEAN NOT NULL DEFAULT false,
    "exigeEvidencia" BOOLEAN NOT NULL DEFAULT false,
    "exigeRevisaoNA" BOOLEAN NOT NULL DEFAULT true,
    "referenciaNormativa" TEXT,
    "aplicabilidade" TEXT,

    CONSTRAINT "ModeloChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" UUID NOT NULL,
    "processoId" UUID NOT NULL,
    "modeloItemId" UUID,
    "ordem" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "etapa" "EtapaProcesso" NOT NULL,
    "critico" BOOLEAN NOT NULL DEFAULT false,
    "exigeEvidencia" BOOLEAN NOT NULL DEFAULT false,
    "exigeRevisaoNA" BOOLEAN NOT NULL DEFAULT true,
    "referenciaNormativa" TEXT,
    "estado" "EstadoChecklist" NOT NULL DEFAULT 'PENDENTE',
    "justificativaNA" TEXT,
    "naRevisadoPor" UUID,
    "naRevisadoEm" TIMESTAMPTZ(3),
    "observacao" TEXT,
    "responsavelId" UUID,
    "atribuidoGestorId" UUID,
    "prazo" DATE,
    "concluidoEm" TIMESTAMPTZ(3),
    "concluidoPor" UUID,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "documento" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ata" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "ano" INTEGER,
    "idPncp" TEXT,
    "orgaoGerenciador" TEXT NOT NULL,
    "cnpjGerenciador" TEXT,
    "uasg" TEXT,
    "objeto" TEXT NOT NULL,
    "processoOrigem" TEXT,
    "tipoVinculo" "TipoVinculoAta" NOT NULL DEFAULT 'CONSULTA',
    "vigenciaInicio" DATE NOT NULL,
    "vigenciaFim" DATE NOT NULL,
    "cancelada" BOOLEAN NOT NULL DEFAULT false,
    "autorizacaoUtilizacao" TEXT,
    "autorizadaEm" TIMESTAMPTZ(3),
    "autorizadaPor" UUID,
    "importacaoId" UUID,
    "criadoPor" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Ata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemAta" (
    "id" UUID NOT NULL,
    "ataId" UUID NOT NULL,
    "numeroItem" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "fornecedorId" UUID,
    "unidadeMedida" TEXT NOT NULL,
    "codigoCatalogo" TEXT,
    "quantidadeRegistrada" DECIMAL(18,4),
    "quantidadeDestinada" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "precoUnitario" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "ItemAta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoQuantidadeAta" (
    "id" UUID NOT NULL,
    "itemAtaId" UUID NOT NULL,
    "tipo" "TipoMovQtdAta" NOT NULL,
    "quantidade" DECIMAL(18,4) NOT NULL,
    "processoId" UUID,
    "contratoId" UUID,
    "documento" TEXT,
    "motivo" TEXT,
    "autorId" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoQuantidadeAta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratoInstrumento" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" "TipoInstrumento" NOT NULL,
    "natureza" "NaturezaInstrumento" NOT NULL,
    "processoId" UUID,
    "ataId" UUID,
    "fornecedorId" UUID NOT NULL,
    "objeto" TEXT NOT NULL,
    "valorInicial" DECIMAL(18,2) NOT NULL,
    "valorAtualizado" DECIMAL(18,2) NOT NULL,
    "dataAssinatura" DATE,
    "vigenciaInicio" DATE NOT NULL,
    "vigenciaFim" DATE NOT NULL,
    "prazoExecucaoDias" INTEGER,
    "inicioPrevisto" DATE,
    "inicioReal" DATE,
    "reajusteIndice" TEXT,
    "garantiaTipo" TEXT,
    "garantiaValor" DECIMAL(18,2),
    "garantiaValidade" DATE,
    "obrigacoes" TEXT,
    "situacao" "SituacaoContrato" NOT NULL DEFAULT 'VIGENTE',
    "execucaoEncerradaEm" DATE,
    "criadoPor" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ContratoInstrumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemContrato" (
    "id" UUID NOT NULL,
    "contratoId" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "unidadeMedida" TEXT NOT NULL,
    "quantidade" DECIMAL(18,4) NOT NULL,
    "valorUnitario" DECIMAL(18,2) NOT NULL,
    "itemAtaId" UUID,

    CONSTRAINT "ItemContrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Designacao" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "contratoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "funcao" "FuncaoDesignacao" NOT NULL,
    "status" "StatusDesignacao" NOT NULL DEFAULT 'PENDENTE',
    "documentoDesignacao" TEXT,
    "dataDocumento" DATE,
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "escopo" TEXT,
    "indicadoPor" UUID NOT NULL,
    "confirmadoPor" UUID,
    "confirmadoEm" TIMESTAMPTZ(3),
    "encerradoMotivo" TEXT,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Designacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aditivo" (
    "id" UUID NOT NULL,
    "contratoId" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" "TipoAditivo" NOT NULL,
    "fundamento" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "dataAssinatura" DATE NOT NULL,
    "valorAntes" DECIMAL(18,2) NOT NULL,
    "valorDepois" DECIMAL(18,2) NOT NULL,
    "vigenciaFimAntes" DATE NOT NULL,
    "vigenciaFimDepois" DATE NOT NULL,
    "criadoPor" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aditivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entrega" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "contratoId" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "local" TEXT,
    "quantidadePrevista" DECIMAL(18,4) NOT NULL,
    "quantidadeEntregue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "prazo" DATE NOT NULL,
    "status" "StatusEntrega" NOT NULL DEFAULT 'PENDENTE',
    "criadoPor" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medicao" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "contratoId" UUID NOT NULL,
    "competencia" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "percentualFisico" DECIMAL(5,2) NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "status" "StatusMedicao" NOT NULL DEFAULT 'EM_ELABORACAO',
    "inconformidades" TEXT,
    "criadoPor" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recebimento" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "entregaId" UUID,
    "medicaoId" UUID,
    "tipo" "TipoRecebimento" NOT NULL,
    "quantidade" DECIMAL(18,4),
    "data" DATE NOT NULL,
    "observacao" TEXT,
    "responsavelId" UUID NOT NULL,
    "designacaoId" UUID,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recebimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroExecucao" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "contratoId" UUID NOT NULL,
    "tipo" "TipoRegistroExecucao" NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "autorId" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroExecucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaFiscal" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "contratoId" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "serie" TEXT,
    "chaveAcesso" TEXT,
    "dataEmissao" DATE NOT NULL,
    "dataRecebimento" DATE NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "status" "StatusNotaFiscal" NOT NULL DEFAULT 'RECEBIDA',
    "criadoPor" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atesto" (
    "id" UUID NOT NULL,
    "notaFiscalId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "designacaoId" UUID,
    "competencia" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Atesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credito" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "ptres" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "naturezaDespesa" TEXT NOT NULL,
    "planoInterno" TEXT,
    "ugr" TEXT,
    "descricao" TEXT,
    "ultimaConciliacao" TIMESTAMPTZ(3),
    "fonteConciliacao" TEXT,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Credito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoCredito" (
    "id" UUID NOT NULL,
    "creditoId" UUID NOT NULL,
    "tipo" "TipoMovCredito" NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "dataMovimento" DATE NOT NULL,
    "documento" TEXT NOT NULL,
    "observacao" TEXT,
    "estornoDeId" UUID,
    "autorId" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoCredito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlocacaoOrcamentaria" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "creditoId" UUID,
    "demandaId" UUID,
    "processoId" UUID,
    "exercicio" INTEGER NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "aprovadaEm" DATE NOT NULL,
    "documento" TEXT,
    "autorId" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlocacaoOrcamentaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empenho" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "creditoId" UUID NOT NULL,
    "fornecedorId" UUID NOT NULL,
    "processoId" UUID,
    "tipo" TEXT NOT NULL DEFAULT 'ORDINARIO',
    "dataEmissao" DATE NOT NULL,
    "descricao" TEXT,
    "ultimaConciliacao" TIMESTAMPTZ(3),
    "fonteConciliacao" TEXT,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empenho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoEmpenho" (
    "id" UUID NOT NULL,
    "empenhoId" UUID NOT NULL,
    "tipo" "TipoMovEmpenho" NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "dataMovimento" DATE NOT NULL,
    "documento" TEXT NOT NULL,
    "notaFiscalId" UUID,
    "contratoId" UUID,
    "estornoDeId" UUID,
    "observacao" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "autorId" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoEmpenho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateioEmpenho" (
    "id" UUID NOT NULL,
    "empenhoId" UUID NOT NULL,
    "contratoId" UUID NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateioEmpenho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InscricaoRestosAPagar" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "empenhoId" UUID NOT NULL,
    "exercicioOrigem" INTEGER NOT NULL,
    "tipo" "TipoRestosAPagar" NOT NULL,
    "saldoAbertura" DECIMAL(18,2) NOT NULL,
    "dataInscricao" DATE NOT NULL,
    "documento" TEXT NOT NULL,
    "autorId" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InscricaoRestosAPagar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoRestosAPagar" (
    "id" UUID NOT NULL,
    "inscricaoId" UUID NOT NULL,
    "tipo" "TipoMovRap" NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "dataMovimento" DATE NOT NULL,
    "documento" TEXT NOT NULL,
    "estornoDeId" UUID,
    "autorId" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoRestosAPagar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risco" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "processoId" UUID,
    "contratoId" UUID,
    "evento" TEXT NOT NULL,
    "causa" TEXT NOT NULL,
    "consequencia" TEXT NOT NULL,
    "fase" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "probabilidade" INTEGER NOT NULL,
    "impacto" INTEGER NOT NULL,
    "probResidual" INTEGER,
    "impactoResidual" INTEGER,
    "controles" TEXT,
    "acaoPreventiva" TEXT,
    "contingencia" TEXT,
    "responsavelId" UUID,
    "proximaRevisao" DATE,
    "status" "StatusRisco" NOT NULL DEFAULT 'ABERTO',
    "criadoPor" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Risco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvaliacaoRisco" (
    "id" UUID NOT NULL,
    "riscoId" UUID NOT NULL,
    "probabilidade" INTEGER NOT NULL,
    "impacto" INTEGER NOT NULL,
    "probResidual" INTEGER,
    "impactoResidual" INTEGER,
    "comentario" TEXT,
    "autorId" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvaliacaoRisco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoEvento" NOT NULL,
    "responsavelId" UUID,
    "participantes" UUID[],
    "processoId" UUID,
    "contratoId" UUID,
    "ataId" UUID,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fim" TIMESTAMPTZ(3),
    "diaInteiro" BOOLEAN NOT NULL DEFAULT false,
    "prioridade" "Prioridade" NOT NULL DEFAULT 'MEDIA',
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "recorrencia" TEXT NOT NULL DEFAULT 'NENHUMA',
    "lembreteDias" INTEGER[],
    "criadoPor" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "chave" TEXT NOT NULL,
    "nivel" TEXT NOT NULL DEFAULT 'INFO',
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "regra" TEXT NOT NULL,
    "link" TEXT,
    "lidaEm" TIMESTAMPTZ(3),
    "criadaEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobExecucao" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "dataReferencia" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 1,
    "iniciadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadoEm" TIMESTAMPTZ(3),
    "log" TEXT,

    CONSTRAINT "JobExecucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Solicitacao" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "contratoId" UUID NOT NULL,
    "categoria" "CategoriaSolicitacao" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "prioridade" "Prioridade" NOT NULL DEFAULT 'MEDIA',
    "status" "StatusSolicitacao" NOT NULL DEFAULT 'ABERTA',
    "responsavelId" UUID,
    "prazo" DATE,
    "autorId" UUID NOT NULL,
    "motivoCancelamento" TEXT,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Solicitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteracaoSolicitacao" (
    "id" UUID NOT NULL,
    "solicitacaoId" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "autorId" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteracaoSolicitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "liberadoGestor" BOOLEAN NOT NULL DEFAULT false,
    "criadoPor" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arquivadoEm" TIMESTAMPTZ(3),

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersaoDocumento" (
    "id" UUID NOT NULL,
    "documentoId" UUID NOT NULL,
    "versao" INTEGER NOT NULL,
    "nomeOriginal" TEXT NOT NULL,
    "chaveStorage" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "criadoPor" UUID NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersaoDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VinculoDocumento" (
    "id" UUID NOT NULL,
    "documentoId" UUID NOT NULL,
    "tipo" "TipoVinculoDoc" NOT NULL,
    "entidadeId" UUID NOT NULL,
    "contratoId" UUID,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VinculoDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportacaoExterna" (
    "id" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "fonte" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "consultadoEm" TIMESTAMPTZ(3) NOT NULL,
    "urlConsulta" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "dadosOriginais" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIA',
    "entidadeId" UUID,
    "revisadoPor" UUID,
    "revisadoEm" TIMESTAMPTZ(3),
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportacaoExterna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CacheConsulta" (
    "chave" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "resposta" JSONB NOT NULL,
    "consultadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CacheConsulta_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "Favorito" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "unidadeId" UUID NOT NULL,
    "fonte" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unidade_sigla_key" ON "Unidade"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VinculoUnidadePerfil_usuarioId_unidadeId_key" ON "VinculoUnidadePerfil"("usuarioId", "unidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "Sessao_tokenHash_key" ON "Sessao"("tokenHash");

-- CreateIndex
CREATE INDEX "Sessao_usuarioId_idx" ON "Sessao"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Convite_tokenHash_key" ON "Convite"("tokenHash");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_entidade_entidadeId_idx" ON "RegistroAuditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_unidadeId_criadoEm_idx" ON "RegistroAuditoria"("unidadeId", "criadoEm");

-- CreateIndex
CREATE INDEX "ParametroNormativo_chave_idx" ON "ParametroNormativo"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaOrcamentaria_unidadeId_exercicio_titulo_key" ON "PropostaOrcamentaria"("unidadeId", "exercicio", "titulo");

-- CreateIndex
CREATE UNIQUE INDEX "VersaoProposta_propostaId_versao_key" ON "VersaoProposta"("propostaId", "versao");

-- CreateIndex
CREATE INDEX "Processo_unidadeId_exercicio_idx" ON "Processo"("unidadeId", "exercicio");

-- CreateIndex
CREATE UNIQUE INDEX "Processo_unidadeId_numeroInterno_key" ON "Processo"("unidadeId", "numeroInterno");

-- CreateIndex
CREATE INDEX "ChecklistItem_processoId_idx" ON "ChecklistItem"("processoId");

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_unidadeId_documento_key" ON "Fornecedor"("unidadeId", "documento");

-- CreateIndex
CREATE UNIQUE INDEX "Ata_unidadeId_idPncp_key" ON "Ata"("unidadeId", "idPncp");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAta_ataId_numeroItem_key" ON "ItemAta"("ataId", "numeroItem");

-- CreateIndex
CREATE UNIQUE INDEX "ContratoInstrumento_unidadeId_numero_key" ON "ContratoInstrumento"("unidadeId", "numero");

-- CreateIndex
CREATE INDEX "Designacao_usuarioId_status_idx" ON "Designacao"("usuarioId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_contratoId_numero_serie_key" ON "NotaFiscal"("contratoId", "numero", "serie");

-- CreateIndex
CREATE UNIQUE INDEX "Credito_unidadeId_exercicio_ptres_fonte_naturezaDespesa_pla_key" ON "Credito"("unidadeId", "exercicio", "ptres", "fonte", "naturezaDespesa", "planoInterno");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentoCredito_estornoDeId_key" ON "MovimentoCredito"("estornoDeId");

-- CreateIndex
CREATE UNIQUE INDEX "Empenho_unidadeId_numero_key" ON "Empenho"("unidadeId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentoEmpenho_estornoDeId_key" ON "MovimentoEmpenho"("estornoDeId");

-- CreateIndex
CREATE INDEX "MovimentoEmpenho_empenhoId_idx" ON "MovimentoEmpenho"("empenhoId");

-- CreateIndex
CREATE UNIQUE INDEX "RateioEmpenho_empenhoId_contratoId_key" ON "RateioEmpenho"("empenhoId", "contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "InscricaoRestosAPagar_empenhoId_exercicioOrigem_tipo_key" ON "InscricaoRestosAPagar"("empenhoId", "exercicioOrigem", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentoRestosAPagar_estornoDeId_key" ON "MovimentoRestosAPagar"("estornoDeId");

-- CreateIndex
CREATE UNIQUE INDEX "Notificacao_chave_key" ON "Notificacao"("chave");

-- CreateIndex
CREATE INDEX "Notificacao_usuarioId_lidaEm_idx" ON "Notificacao"("usuarioId", "lidaEm");

-- CreateIndex
CREATE UNIQUE INDEX "JobExecucao_nome_dataReferencia_key" ON "JobExecucao"("nome", "dataReferencia");

-- CreateIndex
CREATE UNIQUE INDEX "VersaoDocumento_chaveStorage_key" ON "VersaoDocumento"("chaveStorage");

-- CreateIndex
CREATE UNIQUE INDEX "VersaoDocumento_documentoId_versao_key" ON "VersaoDocumento"("documentoId", "versao");

-- CreateIndex
CREATE INDEX "VinculoDocumento_tipo_entidadeId_idx" ON "VinculoDocumento"("tipo", "entidadeId");

-- CreateIndex
CREATE INDEX "VinculoDocumento_contratoId_idx" ON "VinculoDocumento"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "VinculoDocumento_documentoId_tipo_entidadeId_key" ON "VinculoDocumento"("documentoId", "tipo", "entidadeId");

-- CreateIndex
CREATE INDEX "ImportacaoExterna_unidadeId_fonte_identificador_idx" ON "ImportacaoExterna"("unidadeId", "fonte", "identificador");

-- CreateIndex
CREATE UNIQUE INDEX "Favorito_usuarioId_fonte_identificador_key" ON "Favorito"("usuarioId", "fonte", "identificador");

-- AddForeignKey
ALTER TABLE "VinculoUnidadePerfil" ADD CONSTRAINT "VinculoUnidadePerfil_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoUnidadePerfil" ADD CONSTRAINT "VinculoUnidadePerfil_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demanda" ADD CONSTRAINT "Demanda_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersaoProposta" ADD CONSTRAINT "VersaoProposta_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaOrcamentaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Processo" ADD CONSTRAINT "Processo_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Processo" ADD CONSTRAINT "Processo_ataId_fkey" FOREIGN KEY ("ataId") REFERENCES "Ata"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemProcesso" ADD CONSTRAINT "ItemProcesso_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeloChecklistItem" ADD CONSTRAINT "ModeloChecklistItem_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "ModeloChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAta" ADD CONSTRAINT "ItemAta_ataId_fkey" FOREIGN KEY ("ataId") REFERENCES "Ata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoQuantidadeAta" ADD CONSTRAINT "MovimentoQuantidadeAta_itemAtaId_fkey" FOREIGN KEY ("itemAtaId") REFERENCES "ItemAta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoInstrumento" ADD CONSTRAINT "ContratoInstrumento_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoInstrumento" ADD CONSTRAINT "ContratoInstrumento_ataId_fkey" FOREIGN KEY ("ataId") REFERENCES "Ata"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemContrato" ADD CONSTRAINT "ItemContrato_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "ContratoInstrumento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Designacao" ADD CONSTRAINT "Designacao_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "ContratoInstrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Designacao" ADD CONSTRAINT "Designacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aditivo" ADD CONSTRAINT "Aditivo_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "ContratoInstrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "ContratoInstrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicao" ADD CONSTRAINT "Medicao_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "ContratoInstrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_medicaoId_fkey" FOREIGN KEY ("medicaoId") REFERENCES "Medicao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroExecucao" ADD CONSTRAINT "RegistroExecucao_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "ContratoInstrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "ContratoInstrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atesto" ADD CONSTRAINT "Atesto_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "NotaFiscal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoCredito" ADD CONSTRAINT "MovimentoCredito_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "Credito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlocacaoOrcamentaria" ADD CONSTRAINT "AlocacaoOrcamentaria_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "Credito"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlocacaoOrcamentaria" ADD CONSTRAINT "AlocacaoOrcamentaria_demandaId_fkey" FOREIGN KEY ("demandaId") REFERENCES "Demanda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlocacaoOrcamentaria" ADD CONSTRAINT "AlocacaoOrcamentaria_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empenho" ADD CONSTRAINT "Empenho_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "Credito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEmpenho" ADD CONSTRAINT "MovimentoEmpenho_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateioEmpenho" ADD CONSTRAINT "RateioEmpenho_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateioEmpenho" ADD CONSTRAINT "RateioEmpenho_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "ContratoInstrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscricaoRestosAPagar" ADD CONSTRAINT "InscricaoRestosAPagar_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoRestosAPagar" ADD CONSTRAINT "MovimentoRestosAPagar_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "InscricaoRestosAPagar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risco" ADD CONSTRAINT "Risco_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risco" ADD CONSTRAINT "Risco_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "ContratoInstrumento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoRisco" ADD CONSTRAINT "AvaliacaoRisco_riscoId_fkey" FOREIGN KEY ("riscoId") REFERENCES "Risco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "ContratoInstrumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteracaoSolicitacao" ADD CONSTRAINT "InteracaoSolicitacao_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "Solicitacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersaoDocumento" ADD CONSTRAINT "VersaoDocumento_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoDocumento" ADD CONSTRAINT "VinculoDocumento_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
