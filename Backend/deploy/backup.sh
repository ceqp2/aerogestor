#!/usr/bin/env sh
# Backup diário: banco (pg_dump formato custom) + arquivos de documentos (bytes).
# Agende via cron no host autorizado, ex.: 0 2 * * * /opt/aerogest/Backend/deploy/backup.sh
# Retenção e descarte devem seguir a política institucional (não há exclusão automática aqui).
set -eu
DESTINO="${BACKUP_DIR:-/var/backups/aerogest}"
DATA="$(date -u +%Y%m%dT%H%M%SZ)"
PROJETO="${COMPOSE_PROJECT:-aerogest}"
mkdir -p "$DESTINO/$DATA"
docker compose -p "$PROJETO" exec -T db pg_dump -U aerogest -d aerogest -Fc > "$DESTINO/$DATA/banco.dump"
docker compose -p "$PROJETO" exec -T api tar -C /app/storage -czf - . > "$DESTINO/$DATA/arquivos.tar.gz"
( cd "$DESTINO/$DATA" && sha256sum banco.dump arquivos.tar.gz > SHA256SUMS )
echo "Backup concluído em $DESTINO/$DATA"
