# Segurança e operação

## Autenticação e sessão
- Sem cadastro público; contas por **convite** de uso único (72 h) ou link de redefinição (2 h). Tokens guardados apenas como HMAC-SHA256 com segredo do servidor.
- Senhas com **Argon2id** (m=19 MiB, t=2, p=1); política: 12+ caracteres, 3 classes, sem e-mail/nome, sem padrões comuns.
- Tempo de resposta equalizado para usuário inexistente; bloqueio de 15 min após 5 falhas; rate limit (login 10/min por IP; global 300/min).
- Sessão opaca em cookie **HttpOnly + SameSite=Strict + Secure** (produção); nunca em localStorage. Expiração configurável (8 h), revogação individual/total, rotação ao concluir MFA.
- **CSRF**: double submit — cookie `aerogest_csrf` legível + cabeçalho `X-CSRF-Token`, comparação em tempo constante com hash armazenado na sessão.
- **MFA TOTP** (RFC 6238) com segredo cifrado em AES-256-GCM; obrigatório para perfis privilegiados em produção.

## API
- Helmet (CSP, HSTS via proxy, nosniff, frameguard), CORS restrito a `APP_ORIGIN`, `x-powered-by` desligado, corpo JSON ≤ 1 MB.
- Validação global com whitelist e rejeição de campos desconhecidos; valores monetários só como string decimal.
- Erros padronizados com `correlationId`; detalhes internos nunca são expostos.
- Swagger apenas fora de produção.

## Documentos
- Tipo real verificado por assinatura (magic bytes) + extensão coerente; lista fechada (PDF, PNG, JPG, WEBP, DOCX, XLSX, PPTX, ODT, ODS, TXT, CSV); limite 20 MB.
- Nome interno aleatório (256 bits), fora de pasta pública, permissão 0600; SHA-256 registrado e conferido a cada download.
- Download sempre autorizado no servidor; resposta `attachment`, `nosniff`, `Cache-Control: no-store`, CSP `sandbox`.
- Antivírus/quarentena: **não incluído** — integrar (ex.: ClamAV) no ambiente autorizado antes de uso real.

## Auditoria
- `RegistroAuditoria`: usuário, unidade, ação, entidade, antes/depois (campos sensíveis omitidos), motivo, IP, data e `correlationId`, gravado na mesma transação da alteração.
- **Append-only** pela aplicação e por trigger no banco (UPDATE/DELETE/TRUNCATE bloqueados). Ledgers financeiros e de quantidades de ata também são imutáveis por trigger.
- Um superusuário do banco pode desabilitar triggers: para maior resistência, exportar periodicamente os logs para armazenamento externo protegido (WORM/SIEM). Não há promessa de imutabilidade absoluta.

## Implantação (homologação)
- `deploy/docker-compose.yml`: banco sem porta pública, API sem porta pública, web (Nginx sem privilégios) em `127.0.0.1:8080` para ser publicado **somente** por reverse proxy TLS institucional. Health checks em `/health`.
- Variáveis obrigatórias validadas na inicialização (falha cedo se faltarem segredos). Em produção `COOKIE_SECURE=true` é exigido.
- Backup diário de banco **e** arquivos: `deploy/backup.sh` (com SHA256SUMS); restauração: `deploy/restore.sh`. Testar a restauração periodicamente. Retenção e descarte conforme política institucional.
- Dados demonstrativos são fictícios, marcados com `[DEMO]` e e-mails `.invalid`; o seed demonstrativo é desativado em produção.
- Não há provedor de nuvem, SIAFI ou SEI presumidos.
