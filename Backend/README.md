# AEROGEST GSD — Backend (API)

API do sistema de apoio à gestão de aquisições e contratos. Monólito modular **NestJS 11 + TypeScript + Prisma 6 + PostgreSQL 16**.

> Ferramenta de apoio gerencial para **homologação institucional**. Não substitui atos nem sistemas oficiais (SIAFI, SEI, Compras.gov.br, PNCP). Não usar com dados reais antes da definição do ambiente autorizado.

## Requisitos
- Node.js ≥ 20.19 (testado com 24.15) e npm
- Docker (para o PostgreSQL de desenvolvimento) **ou** um PostgreSQL 16 próprio

## Início rápido (desenvolvimento)
```bash
cp .env.example .env              # preencha os segredos (comandos de geração no próprio arquivo)
docker compose -f deploy/docker-compose.dev.yml --env-file .env up -d   # banco em 127.0.0.1:5439
npm ci
npx prisma migrate deploy         # aplica migrations (inclui triggers de imutabilidade)
npm run db:seed                   # unidade, parâmetros, modelos de checklist + dados DEMO fictícios
npm run start:dev                 # API em http://localhost:3000/api/v1 (Swagger: /api/docs)
```
No Windows há o atalho `deploy/iniciar-dev.ps1`, que sobe banco, API e interface.

Credenciais demonstrativas (senhas aleatórias, dados fictícios) ficam em `.local/credenciais-demo.txt` (não versionado).
Para não gerar dados de demonstração: `SEED_DEMO=false npm run db:seed`.

### Administrador inicial (sem senha padrão)
```bash
npm run admin:create -- --email admin@orgao.gov.br --nome "Nome Completo" --unidade GSD-SJ
```
Imprime um link de convite de uso único (72 h); o próprio administrador define a senha.

## Comandos
| Comando | Função |
|---|---|
| `npm run start:dev` | API com recarga |
| `npm run build` / `npm start` | build e execução de produção |
| `npm test` | testes de domínio + integração (requer banco com seed) |
| `npm run lint` / `npm run typecheck` | qualidade |
| `npx prisma migrate deploy` | migrations |
| `npm run db:seed` | seed |
| `npm run openapi:export` | gera `openapi.json` (o frontend gera tipos com `npm run gen:api`) |
| `npm run admin:create` | cria/convida administrador |

## Estrutura
```
src/
  main.ts, app.module.ts
  config/        env validado, swagger
  common/        guard de autenticação/CSRF/perfis, escopo por objeto, auditoria, parâmetros, filtros de erro
  database/      PrismaService
  jobs/          job diário persistente e idempotente (lembretes/escalonamento)
  integrations/  pncp, compras-catalogo (CATMAT/CATSER), cliente HTTP com cache/timeout/retentativa
  modules/       auth, usuarios, unidades, auditoria, planejamento, processos, atas, contratos,
                 execucao, financeiro, riscos, calendario, notificacoes, solicitacoes,
                 documentos, dashboard, relatorios
  cli/           create-admin, export-openapi
prisma/          schema, migrations, seed
deploy/          compose dev e produção, backup/restore, script de inicialização
docs/            arquitetura, permissões, segurança, fontes, API, aceite
tests/           domínio e integração
```

Documentação detalhada: [docs/](docs/).
