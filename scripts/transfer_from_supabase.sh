#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   SUPABASE_DB_URL="postgresql://user:pass@host:5432/db" \
#   TARGET_DB_URL="postgresql://user:pass@host:5432/db" \
#   ./scripts/transfer_from_supabase.sh

if [[ -z "${SUPABASE_DB_URL:-}" || -z "${TARGET_DB_URL:-}" ]]; then
  echo "Set SUPABASE_DB_URL and TARGET_DB_URL" >&2
  exit 1
fi

echo "Exporting from Supabase..."
pg_dump --format=custom --dbname "$SUPABASE_DB_URL" --file supabase-backup.dump

echo "Restoring into target..."
pg_restore --clean --if-exists --no-owner --dbname "$TARGET_DB_URL" supabase-backup.dump

echo "Done. Consider running 'npx prisma migrate dev --name init' to align schema if needed."



