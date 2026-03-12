#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DB_HOST:-}" || -z "${DB_USER:-}" || -z "${DB_NAME:-}" || -z "${ENCRYPTION_KEY:-}" ]]; then
  echo "Missing one of DB_HOST, DB_USER, DB_NAME, ENCRYPTION_KEY"
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./tmp/backups}"
DATE="$(date +%Y%m%d_%H%M%S)"
PLAIN_FILE="$BACKUP_DIR/backup_$DATE.dump.gz"
ENCRYPTED_FILE="$PLAIN_FILE.enc"

mkdir -p "$BACKUP_DIR"

PGPASSWORD="${DB_PASSWORD:-}" pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -F c -Z 9 -f "$PLAIN_FILE"
openssl enc -aes-256-cbc -salt -pbkdf2 -in "$PLAIN_FILE" -out "$ENCRYPTED_FILE" -k "$ENCRYPTION_KEY"
rm -f "$PLAIN_FILE"

echo "Encrypted backup written to $ENCRYPTED_FILE"
