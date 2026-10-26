# Arquitetura

## Visão geral
- **Monólito modular**: uma API NestJS (`/api/v1`) + SPA React servida separadamente; PostgreSQL; armazenamento privado de documentos (disco local em desenvolvimento, S3 compatível em ambiente autorizado).
- **Organização obrigatória**: a raiz do projeto contém somente `Backend/` e `Frontend/`; cada lado tem dependências, lockfile, Dockerfile e documentação próprios. A infraestrutura conjunta fica em `Backend/deploy`.
- **Contrato de API**: OpenAPI gerada pelo Nest (`/api/docs/openapi.json`, `npm run openapi:export`); o frontend gera tipos com `openapi-typescript` (`Frontend/src/types/api.d.ts`).

## Camadas por módulo
`controller` (rotas, perfis permitidos) → `DTOs` (validação `class-validator`, whitelist e rejeição de campos extras) → `service` (casos de uso, transações, auditoria) → `*.regras.ts` (regras de domínio puras e testáveis) → Prisma (acesso a dados).

## Decisões relevantes
| Tema | Decisão |
|---|---|
| Dinheiro | `Decimal(18,2)`; DTOs aceitam apenas string decimal; nenhum `float` |
| Datas | instantes em `timestamptz` (UTC); vigências/prazos em `DATE` (data civil, sem fuso); interface em America/Sao_Paulo |
| Financeiro | ledger único por empenho (`MovimentoEmpenho`), somente inserção; correções por estorno vinculado; bloqueio de linha (`SELECT … FOR UPDATE`) contra concorrência; rateio explícito empenho→contrato; liquidação exige NF atestada |
| Restos a pagar | inscrição explícita, com classificação processado/não processado preservada; movimentos próprios; empenho inscrito não recebe novos movimentos no ledger do exercício |
| Atas | saldo **interno** = destinada − consumo − reservas; ata importada nasce “somente consulta”; uso exige vínculo autorizado com documento e vigência em curso; sem botão de “ignorar bloqueio” |
| Checklists | modelos versionados por forma de contratação; N/A com justificativa e revisão; críticos bloqueiam avanço; N/A fora do denominador |
| Designações | indicação fica PENDENTE até registro do documento; atesto/recebimento exigem designação ATIVA com função competente (parâmetro versionado) |
| Calendário | eventos manuais + marcos derivados em tempo de consulta (sempre coerentes com a origem) |
| Jobs | `JobExecucao` com chave única (nome, data) — não duplica após restart; retentativa até 3x; notificações com chave de idempotência que inclui a data-alvo (alteração de vigência gera novos lembretes) |
| Dashboard × relatórios | relatórios reutilizam os mesmos serviços do painel → reconciliação sob os mesmos filtros |
| Integrações | somente APIs públicas de consulta verificadas; cache persistente datado; fallback identificado; prévia + revisão humana; prevenção de duplicatas; nunca sobrescreve silenciosamente |

## Modelo de dados
Ver `prisma/schema.prisma` (comentado). Entidades de negócio carregam `unidadeId`; relações são validadas na mesma unidade pelo serviço (`EscopoService`). Tabelas técnicas globais: `Usuario`, `Sessao`, `Convite`, `ParametroNormativo` (unidadeId nulo = global), `ModeloChecklist` (idem), `CacheConsulta`, `JobExecucao`.

Simplificações conscientes nesta versão (documentadas para homologação):
- `MatrizAlocacaoRiscos` é tratada como **categoria de documento** (“Matriz de alocação de riscos”), não como entidade estruturada.
- `Liquidacao`, `Pagamento`, `Estorno`, `MovimentoEmpenho`, `RateioEmpenho` foram consolidados no ledger `MovimentoEmpenho` + `RateioEmpenho` (mesma semântica, menos risco de dupla contagem).
- Ordem de serviço e relatórios/ocorrências estão em `RegistroExecucao` (tipos distintos).
