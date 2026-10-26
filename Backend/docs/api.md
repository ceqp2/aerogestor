# API `/api/v1`

Documentação interativa (fora de produção): `http://localhost:3000/api/docs` — JSON em `/api/docs/openapi.json` (126 rotas).

Convenções:
- Autenticação por cookie `aerogest_sid` (HttpOnly). Escritas exigem `X-CSRF-Token` = valor do cookie `aerogest_csrf`.
- Listas paginadas: `?pagina=1&tamanho=25&busca=…` → `{ itens, total, pagina, tamanho, paginas }`.
- Valores monetários como string decimal (`"1500.00"`); datas civis `AAAA-MM-DD`.
- Erros: `{ statusCode, error, message, correlationId }`. 404 também para registros fora do escopo.
- Saldos nunca são editados diretamente: use **comandos de movimento/estorno**.

| Grupo | Rotas principais |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/mfa/verificar`, `GET /auth/me`, `POST /auth/unidade`, `POST /auth/logout`, `GET/POST /auth/convite…`, `POST /auth/senha`, `POST /auth/mfa/configurar|ativar`, `GET/DELETE /auth/sessoes` |
| Usuários | `GET /usuarios`, `GET /usuarios/opcoes`, `POST /usuarios`, `POST /usuarios/:id/(desativar|reativar|perfil|link-acesso|revogar-sessoes|resetar-mfa)`, `…/suporte/concessoes` |
| Unidades | `GET/POST /unidades`, `PATCH /unidades/atual`, `GET/POST /unidades/parametros` |
| Processos | `GET/POST /processos`, `GET/PATCH /processos/:id`, `POST …/etapa`, `POST …/situacao`, `POST …/checklist`, `PATCH …/checklist/:itemId`, `POST …/checklist/:itemId/revisar-na`, `POST …/checklist/aplicar-modelo`, `POST/DELETE …/itens`, `GET …/historico`, `GET/POST /processos/modelos-checklist` |
| Planejamento | `…/planejamento/demandas`, `…/demandas/:id/status`, `…/planejamento/propostas`, `…/propostas/:id/versoes` |
| Atas | `GET/POST /atas`, `GET/PATCH /atas/:id`, `POST …/vigencia`, `POST …/autorizar-utilizacao`, `POST …/itens`, `POST …/itens/:itemId/(movimentos|destinada)` |
| Contratos | `GET/POST /contratos`, `GET/PATCH /contratos/:id`, `POST …/(correcao|situacao|itens|designacoes|aditivos)`, `POST /contratos/designacoes/:id/(confirmar|encerrar)`, `GET/POST/PATCH /fornecedores` |
| Execução | `GET /execucao/contratos/:id`, `POST …/(entregas|medicoes|registros|notas)`, `POST /execucao/entregas/:id/recebimentos`, `POST /execucao/medicoes/:id/recebimentos`, `POST /execucao/notas/:id/(atesto|rejeitar|cancelar)` |
| Financeiro | `GET /financeiro/resumo`, `…/creditos`(+`/movimentos`, `/conciliacao`), `…/empenhos`(+`/movimentos`, `/rateios`, `/conciliacao`, `/inscricao-rap`), `POST /financeiro/restos-a-pagar/:id/movimentos`, `…/alocacoes`, `GET /financeiro/contratos/:id` |
| Riscos | `GET/POST /riscos`, `GET/PATCH /riscos/:id`, `POST …/avaliacoes`, `POST …/status` |
| Calendário | `GET /calendario/agenda?de&ate`, `GET/POST/PATCH/DELETE /calendario/eventos` |
| Notificações | `GET /notificacoes`, `GET …/contagem`, `POST …/:id/lida`, `POST …/todas-lidas` |
| Solicitações | `GET/POST /solicitacoes`, `GET /solicitacoes/:id`, `POST …/(triagem|status|interacoes|minuta)` |
| Documentos | `GET/POST /documentos` (multipart), `POST …/:id/versoes`, `GET …/:id/download`, `PATCH …/:id`, `POST …/:id/(arquivar|vinculos)`, `GET /documentos/categorias` |
| Integrações | `GET /integracoes/status`, `GET /integracoes/pncp/atas`, `POST …/pncp/atas/previa`, `GET /integracoes/importacoes`, `POST …/importacoes/:id/(confirmar|descartar)`, `GET /integracoes/catalogo`, `POST …/catalogo/vincular`, `…/favoritos` |
| Painel/relatórios | `GET /dashboard?exercicio`, `GET /relatorios/:tipo?exercicio&formato=json|csv` (`executivo`, `execucao-orcamentaria`, `processos`, `riscos`, `vigencias`) |
| Auditoria | `GET /auditoria` |
| Saúde | `GET /health` (fora do prefixo) |
