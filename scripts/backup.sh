#!/bin/bash
# TUSOME Database Backup Script
# Usage: ./scripts/backup.sh [tenant_id]
# Requires: pg_dump, SUPABASE_DB_URL environment variable

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_URL="${SUPABASE_DB_URL:-}"

if [ -z "$DB_URL" ]; then
  echo "ERROR: SUPABASE_DB_URL is not set"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

if [ -n "${1:-}" ]; then
  # Tenant-scoped backup
  TENANT_ID="$1"
  FILENAME="tusome_backup_${TENANT_ID}_${TIMESTAMP}.sql"
  echo "Backing up tenant $TENANT_ID..."
  pg_dump "$DB_URL" --table='public.*' --data-only --where="tenant_id = '$TENANT_ID'" -f "$BACKUP_DIR/$FILENAME"
else
  # Full backup
  FILENAME="tusome_backup_full_${TIMESTAMP}.sql"
  echo "Backing up full database..."
  pg_dump "$DB_URL" -f "$BACKUP_DIR/$FILENAME"
fi

echo "Backup saved to $BACKUP_DIR/$FILENAME"
echo "Size: $(du -h "$BACKUP_DIR/$FILENAME" | cut -f1)"