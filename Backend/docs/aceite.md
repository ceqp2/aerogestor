# Checklist de aceite (seção 16) — situação em 09/10/2026

Legenda: **Verificado** = implementado e comprovado por teste automatizado ou execução real; **Implementado** = presente no código, sem teste específico; **Pendente** = depende de fator externo/institucional.

| # | Critério | Situação | Evidência |
|---|---|---|---|
| 1 | Ações relevantes persistem no PostgreSQL e continuam após atualizar a página | Verificado | Toda escrita passa pela API/Prisma; testes de integração e navegação real |
| 2 | Gestor A não acessa contrato de B por URL, API, busca, relatório ou download; unidades isoladas | Verificado | `tests/api.e2e.spec.ts` (404 em contrato, financeiro, execução, documentos, busca vazia, relatório 403; unidade distinta 404) |
| 3 | Auxiliar só cria gestor; não promove usuários nem a si | Verificado | e2e + `dominio.spec.ts › podeGerir` |
| 4 | Desativação revoga sessões e preserva designações/histórico | Verificado | e2e (sessão ativa → 401 após desativação); designações não são apagadas |
| 5 | Processos com checklist aplicável, evidências e trilha | Verificado | modelos versionados, N/A fora do denominador, críticos bloqueiam etapa (`dominio.spec.ts`), evidência obrigatória, histórico |
| 6 | Ata expirada não admite nova utilização; sem botão de ignorar bloqueio | Verificado | `atas.regras.ts` + teste; bloqueio também na criação de contrato a partir de ata |
| 7 | Designação, atesto, recebimento e ato financeiro respeitam competência | Verificado | atesto sem designação ATIVA → 403 (e2e); lançamentos financeiros exigem documento e perfil da secretaria |
| 8 | Financeiro com rateios, entregas parciais, estornos e concorrência sem duplicação | Verificado | 5 pagamentos concorrentes → só 3 aceitos (e2e); estornos vinculados; rateio limitado ao empenhado; triggers impedem UPDATE/DELETE no ledger |
| 9 | Exemplo 100.000/40.000/10.000/5.000/20.000/15.000 → 45.000 / 55.000 / 25.000 / 5.000; sem inscrição, não rotular RAP | Verificado | `dominio.spec.ts` e seed demonstrativo (painel exibe exatamente esses valores) |
| 10 | Alerta não duplica após restart; datas civis não mudam com fuso | Verificado | `JobExecucao` com chave única + chave de idempotência por notificação; testes de `hojeCivil`/`marcoAtual` |
| 11 | Importação revisável, idempotente, com fonte/data; falha externa não fabrica resultado | Verificado | PNCP e CATMAT/CATSER consultados ao vivo; prévia com hash e dados originais; duplicata bloqueada; indisponibilidade → cache identificado ou erro 503 |
| 12 | Dashboard reconcilia com relatórios sob os mesmos filtros | Verificado | mesmos serviços; teste de fumaça compara valores |
| 13 | Interface em celular com teclado/touch sem esconder ações | Verificado | navegação real em 360 px sem rolagem horizontal; tabelas viram cartões com ações |
| 14 | Restaurar backup recupera metadados e bytes de documentos | Implementado — **não executado nesta máquina** | `deploy/backup.sh` / `restore.sh` (Linux + Docker); hash conferido a cada download |
| 15 | Testes de domínio, autorização, integrações e fluxos; build, lint e migrations | Verificado | Backend: 39 testes; Frontend: 7 testes; lint e typecheck sem erros; migrations aplicadas; imagens Docker construídas e pilha de produção iniciada |

## Limitações reais e pendências
- **Homologação institucional pendente**: normas FAB/COMAER, modelos locais, competências formais, calendário TOD, UASG/UG e parâmetros normativos com aprovador (ver `fontes-e-rastreabilidade.md`).
- **Não pronto para produção com dados reais**: requer ambiente autorizado, TLS institucional, antivírus/quarentena de uploads, cópia externa dos logs de auditoria, política de retenção e teste de restauração.
- E-mail não implementado (notificações internas no MVP, como previsto).
- Sem integração com SIAFI/SEI; lançamentos financeiros são gerenciais e conciliáveis.
- PNCP (consulta) não fornece itens/saldos de atas; CATMAT compara descrição de forma exata; CATSER não busca por descrição.
- Matriz contratual de alocação de riscos tratada como documento categorizado, não como entidade estruturada.
- Plugin Swagger do Nest gera caminhos absolutos para DTOs aninhados quando o caminho do projeto tem acentos (Windows); mitigado com `@ApiProperty` explícito. Na imagem Docker (`/app`) não ocorre.
