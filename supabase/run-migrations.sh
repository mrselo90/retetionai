#!/bin/bash
# Runs all Supabase migrations in order against DATABASE_URL.
# Idempotent: uses a migration tracking table so each file runs at most once.
#
# Usage:
#   DATABASE_URL="postgres://..." ./supabase/run-migrations.sh

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set."
  exit 1
fi

MIGRATIONS_DIR="$(cd "$(dirname "$0")/migrations" && pwd)"

# Create migration tracking table if it doesn't exist
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public._migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

echo "Checking for pending migrations..."

APPLIED=0
SKIPPED=0

for file in "$MIGRATIONS_DIR"/*.sql; do
  filename=$(basename "$file")

  already=$(psql "$DATABASE_URL" -tAc "SELECT 1 FROM public._migrations WHERE filename = '$filename' LIMIT 1;" 2>/dev/null || echo "")

  if [ "$already" = "1" ]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "Applying: $filename"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO public._migrations (filename) VALUES ('$filename');"
  APPLIED=$((APPLIED + 1))
done

echo "Migrations complete. Applied: $APPLIED, Skipped (already applied): $SKIPPED"
