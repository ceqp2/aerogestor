#!/usr/bin/env sh
# Restauração de um backup gerado por backup.sh. TESTE periodicamente em ambiente separado.
# Uso: ./restore.sh /var/backups/aerogest/20261009T020000Z
set -eu
ORIGEM="$1"
PROJETO="${COMPOSE_PROJECT:-aerogest}"
( cd "$ORIGEM" && sha256sum -c SHA256SUMS )
docker compose -p "$PROJETO" exec -T db pg_restore -U aerogest -d aerogest --clean --if-exists < "$ORIGEM/banco.dump"
docker compose -p "$PROJETO" exec -T api sh -c 'rm -rf /app/storage/* && tar -C /app/storage -xzf -' < "$ORIGEM/arquivos.tar.gz"
echo "Restauração concluída. Verifique: GET /health e download de um documento (o hash SHA-256 é conferido a cada download)."
