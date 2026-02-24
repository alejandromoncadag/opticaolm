#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 /ruta/al/backup.dump [db_destino]"
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/backend/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

BACKUP_FILE="$1"
DB_TARGET="${2:-${DB_NAME:-eyecare}}"
DB_CONNINFO="${DB_CONNINFO:-}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"

find_bin() {
  local cmd="$1"
  local candidate
  candidate="$(command -v "$cmd" || true)"
  if [[ -n "$candidate" ]]; then
    echo "$candidate"
    return 0
  fi
  for candidate in \
    "/opt/homebrew/bin/$cmd" \
    "/usr/local/bin/$cmd" \
    "/Applications/Postgres.app/Contents/Versions/latest/bin/$cmd"
  do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

PG_RESTORE_BIN="$(find_bin pg_restore || true)"
PSQL_BIN="$(find_bin psql || true)"
if [[ -z "$PG_RESTORE_BIN" || -z "$PSQL_BIN" ]]; then
  echo "ERROR: pg_restore o psql no encontrados." >&2
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "ERROR: no existe archivo $BACKUP_FILE" >&2
  exit 1
fi

if [[ -n "$DB_PASSWORD" ]]; then
  export PGPASSWORD="$DB_PASSWORD"
fi

if [[ -z "$DB_CONNINFO" ]]; then
  CONN_ARGS=(--host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER")
else
  CONN_ARGS=("$DB_CONNINFO")
fi

echo "==> Restaurando backup en DB destino: $DB_TARGET"

if [[ "$BACKUP_FILE" == *.dump ]]; then
  if [[ -z "$DB_CONNINFO" ]]; then
    "$PG_RESTORE_BIN" \
      --clean \
      --if-exists \
      --no-owner \
      --no-privileges \
      --dbname="$DB_TARGET" \
      "${CONN_ARGS[@]}" \
      "$BACKUP_FILE"
  else
    "$PG_RESTORE_BIN" \
      --clean \
      --if-exists \
      --no-owner \
      --no-privileges \
      --dbname="$DB_CONNINFO" \
      "$BACKUP_FILE"
  fi
elif [[ "$BACKUP_FILE" == *.sql.gz ]]; then
  if [[ -z "$DB_CONNINFO" ]]; then
    gunzip -c "$BACKUP_FILE" | "$PSQL_BIN" "${CONN_ARGS[@]}" --dbname="$DB_TARGET"
  else
    gunzip -c "$BACKUP_FILE" | "$PSQL_BIN" "$DB_CONNINFO"
  fi
else
  echo "ERROR: formato no soportado. Usa .dump o .sql.gz" >&2
  exit 1
fi

echo "OK: restore completado."
