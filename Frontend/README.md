# AEROGEST GSD — Frontend

Interface web **React 19 + TypeScript + Vite 7 + Tailwind 4**, React Router, TanStack Query, React Hook Form + Zod, Recharts e FullCalendar (plugins MIT).

## Desenvolvimento
```bash
npm ci
npm run dev        # http://localhost:5173 — /api é encaminhado para http://127.0.0.1:3000 (vite.config.ts)
```
O backend precisa estar em execução (ver `../Backend/README.md`).

## Comandos
| Comando | Função |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | typecheck + build de produção (`dist/`) |
| `npm run preview` | serve o build em http://localhost:4173 (com proxy para a API) |
| `npm test` | testes (Vitest + Testing Library) |
| `npm run lint` / `npm run typecheck` | qualidade |
| `npm run gen:api` | gera `src/types/api.d.ts` a partir de `../Backend/openapi.json` |

## Produção
`Dockerfile` gera o build e o serve com Nginx sem privilégios (`nginx.conf` + `nginx-seguranca.conf`: CSP, X-Frame-Options, nosniff, Referrer-Policy), encaminhando `/api` ao serviço `api` (mesma origem, cookies `SameSite=Strict`). A composição conjunta fica em `../Backend/deploy/docker-compose.yml`.

## Estrutura
```
src/
  app/          App (providers, rotas protegidas) e LayoutApp (sidebar recolhível, cabeçalho com busca, unidade/exercício, notificações, perfil)
  components/   ui (botões, cartões, selos com ícone+texto), Modal/Confirmação acessíveis, FormularioModal declarativo,
                Tabela responsiva (tabela ↔ cartões), Abas, DocumentosPainel, HistoricoPainel, feedback (carregando/vazio/erro/toasts)
  features/     auth, dashboard, processos, planejamento, financeiro, atas, contratos, riscos, calendario,
                consultas, documentos, solicitacoes, relatorios, administracao, notificacoes, busca
  hooks/        useAuth, useExercicio, useMutacao, useOpcoes
  lib/          cliente HTTP (cookie + CSRF), formatação pt-BR/BRL/datas civis, rótulos
  styles/       tema (paleta proposta) e ajustes do calendário
  types/        api.d.ts gerado da OpenAPI
docs/           guia de interface
tests/          testes de componentes e utilitários
```
Detalhes de UX e acessibilidade: [docs/interface.md](docs/interface.md).
