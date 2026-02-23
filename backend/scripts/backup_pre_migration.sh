#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-eyecare}"
DB_USER="${DB_USER:-alejandromoncadag}"
OUT_DIR="${1:-$HOME/Desktop/opticaolm_backups}"
STAMP="$(date +%Y%m%d_%H%M%S)"

PG_DUMP_BIN="${PG_DUMP_BIN:-$(command -v pg_dump || true)}"
if [[ -z "$PG_DUMP_BIN" ]]; then
  for candidate in /opt/homebrew/bin/pg_dump /usr/local/bin/pg_dump /Applications/Postgres.app/Contents/Versions/latest/bin/pg_dump; do
    if [[ -x "$candidate" ]]; then
      PG_DUMP_BIN="$candidate"
      break
    fi
  done
fi
if [[ -z "$PG_DUMP_BIN" ]]; then
  echo "ERROR: pg_dump no encontrado. Instala cliente de PostgreSQL o define PG_DUMP_BIN=/ruta/pg_dump" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
DUMP_FILE="$OUT_DIR/${DB_NAME}_pre_legacy_${STAMP}.dump"
SCHEMA_FILE="$OUT_DIR/${DB_NAME}_pre_legacy_${STAMP}_schema.sql"

cat <<EOF
Generando backup...
  DB: $DB_NAME
  Usuario: $DB_USER
  Host: $DB_HOST:$DB_PORT
  Dump: $DUMP_FILE
  Schema: $SCHEMA_FILE
EOF

"$PG_DUMP_BIN" \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$DUMP_FILE" \
  "$DB_NAME"

"$PG_DUMP_BIN" \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --file="$SCHEMA_FILE" \
  "$DB_NAME"

echo "Backup completado."
