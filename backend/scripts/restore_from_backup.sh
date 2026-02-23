#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 /ruta/al/backup.dump [db_destino]"
  exit 1
fi

DUMP_FILE="$1"
DB_TARGET="${2:-eyecare}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-alejandromoncadag}"

PG_RESTORE_BIN="${PG_RESTORE_BIN:-$(command -v pg_restore || true)}"
if [[ -z "$PG_RESTORE_BIN" ]]; then
  for candidate in /opt/homebrew/bin/pg_restore /usr/local/bin/pg_restore /Applications/Postgres.app/Contents/Versions/latest/bin/pg_restore; do
    if [[ -x "$candidate" ]]; then
      PG_RESTORE_BIN="$candidate"
      break
    fi
  done
fi
if [[ -z "$PG_RESTORE_BIN" ]]; then
  echo "ERROR: pg_restore no encontrado. Instala cliente de PostgreSQL o define PG_RESTORE_BIN=/ruta/pg_restore" >&2
  exit 1
fi

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "No existe dump: $DUMP_FILE"
  exit 1
fi

cat <<EOF
Restaurando backup...
  Dump: $DUMP_FILE
  Destino: $DB_TARGET
  Host: $DB_HOST:$DB_PORT
  Usuario: $DB_USER
EOF

"$PG_RESTORE_BIN" \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_TARGET" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "$DUMP_FILE"

echo "Restore completado."
