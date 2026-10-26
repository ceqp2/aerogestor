# Fontes normativas, integrações e pendências

## Matriz de rastreabilidade (requisito → regra → fonte)
| Requisito no sistema | Onde | Fonte | Situação |
|---|---|---|---|
| Separar forma de contratação, modalidade e hipótese | `processos.regras.ts › validarClassificacao` | Lei 14.133/2021, arts. 28, 72, 74, 75, 86 | Implementado |
| Instrução da fase preparatória (DFD, ETP, TR, riscos, preços, orçamento) | Modelos de checklist (seed) | Lei 14.133/2021, art. 18; IN SEGES/ME 65/2021 | Modelos **propostos** — validar com normas FAB/COMAER e modelos locais |
| Itens da contratação direta | Modelo “Contratação direta” | Lei 14.133/2021, art. 72 | Proposto — validar |
| Adesão a ata: justificativa, compatibilidade de preços, aceite do gerenciador | Modelo “Adesão a ata” + bloqueio em `autorizarUtilizacao` | Lei 14.133/2021, art. 86; Decreto 11.462/2023 | Limites quantitativos de adesão **não fixados no código** — cadastrar como parâmetro versionado |
| Vigência de ata e uso após expiração | `atas.regras.ts` | Lei 14.133/2021, art. 84 | Implementado (bloqueio sem exceção genérica) |
| Gestão, fiscalização e designação | `Designacao`, `EscopoService.designacaoCompetente` | Lei 14.133/2021, art. 117; Decreto 11.246/2022 | Funções competentes em parâmetro versionado, **pendente de validação** |
| Recebimento provisório/definitivo | `execucao.service` | Lei 14.133/2021, art. 140 | Idem |
| Duração e prorrogação de contratos | Aditivos com registro documental | Lei 14.133/2021, arts. 105–107 | Prazos máximos não automatizados — validação jurídica externa |
| Estágios da despesa e restos a pagar | `financeiro.regras.ts` | Lei 4.320/1964, arts. 36, 58–64 | Implementado (gerencial, conciliável) |
| Registro de riscos e faixas | `riscos.regras.ts` + parâmetro | Lei 14.133/2021, arts. 18, X; 22; 103 | Faixas são **proposta gerencial** |
| Divulgação no PNCP | Item de checklist | Lei 14.133/2021, arts. 54, 72 p.ú., 94 | Controle documental; sistema não publica no PNCP |

Referências consultadas (conforme especificação, 06/10/2026): Lei 14.133/2021, Lei 4.320/1964, Decreto 11.246/2022, Decreto 11.462/2023, IN SEGES/ME 65/2021. **Referências estruturam requisitos; não constituem certificação de conformidade.** Verificar redação vigente antes de cada uso.

## Integrações verificadas em 08/10/2026
| Fonte | Endpoint | Uso | Limitações reais |
|---|---|---|---|
| PNCP — API de consulta (`https://pncp.gov.br/api/consulta`, OpenAPI em `/v3/api-docs`) | `GET /v1/atas?dataInicial&dataFinal&cnpj&codigoUnidadeAdministrativa&pagina&tamanhoPagina` | Busca de atas por período de vigência, prévia e importação revisada | Não retorna itens, quantidades nem saldo; filtro textual é local sobre a página. A API de publicação/manutenção não é usada. |
| Compras.gov.br — Dados Abertos (`https://dadosabertos.compras.gov.br`, OpenAPI em `/v3/api-docs`) | `GET /modulo-material/4_consultarItemMaterial` | CATMAT por código, descrição ou classe | `descricaoItem` é correspondência **exata** na fonte (verificado); busca por palavra exige código da classe + filtro local |
| idem | `GET /modulo-servico/6_consultarItemServico` | CATSER por código, classe ou grupo | Sem filtro por descrição na fonte; filtro local apenas sobre a página |

Comportamento: chamadas apenas pelo backend; timeout configurável (15 s); até 3 tentativas com backoff em falha de rede/5xx/429; cache persistente de 6 h com data; em indisponibilidade, retorna o último cache **identificado como tal** ou erro explícito (nunca dados fictícios). Toda importação registra fonte, identificador, data da consulta, hash e dados originais (`ImportacaoExterna`), com prevenção de duplicatas e revisão humana.

## Pendências institucionais (não inferíveis)
1. Normas FAB/COMAER aplicáveis, modelos locais de checklist e de documentos.
2. UASG/UG da unidade e nomenclatura oficial da seção.
3. Significado da sigla, marcos e prazos do **calendário TOD** (o sistema oferece o tipo de evento “Marco TOD” sem datas inventadas).
4. Competências formais: quem atesta, recebe, aprova; delegações do Comandante.
5. Parâmetros normativos com aprovador (limites de adesão, prazos legais, faixas de risco).
6. Ambiente autorizado (hospedagem, TLS, backup, antivírus, retenção documental) antes de dados reais.
7. Canal oficial de e-mail (notificações por e-mail estão previstas para fase posterior; no MVP são internas).
