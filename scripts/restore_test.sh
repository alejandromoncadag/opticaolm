#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/backend/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-eyecare}"
TEST_DB="${TEST_DB:-${DB_NAME}_restore_test}"
MAINTENANCE_DB="${MAINTENANCE_DB:-postgres}"
DROP_RESTORE_DB="${DROP_RESTORE_DB:-true}"

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

PSQL_BIN="$(find_bin psql || true)"
PG_RESTORE_BIN="$(find_bin pg_restore || true)"
if [[ -z "$PSQL_BIN" || -z "$PG_RESTORE_BIN" ]]; then
  echo "ERROR: psql/pg_restore no encontrados." >&2
  exit 1
fi

if [[ -n "$DB_PASSWORD" ]]; then
  export PGPASSWORD="$DB_PASSWORD"
fi

LATEST_DUMP="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.dump' -size +0c | sort | tail -n 1)"
if [[ -z "$LATEST_DUMP" ]]; then
  echo "ERROR: no hay backups .dump en $BACKUP_DIR" >&2
  exit 1
fi

PSQL_ARGS=(--host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" --no-psqlrc -v ON_ERROR_STOP=1)

cleanup_db() {
  "$PSQL_BIN" "${PSQL_ARGS[@]}" --dbname="$MAINTENANCE_DB" \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TEST_DB' AND pid <> pg_backend_pid();" \
    -c "DROP DATABASE IF EXISTS \"$TEST_DB\";" >/dev/null
}

echo "==> Restore test"
echo "Dump: $LATEST_DUMP"
echo "DB temporal: $TEST_DB"

cleanup_db
"$PSQL_BIN" "${PSQL_ARGS[@]}" --dbname="$MAINTENANCE_DB" -c "CREATE DATABASE \"$TEST_DB\";" >/dev/null

"$PG_RESTORE_BIN" \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$TEST_DB" \
  "$LATEST_DUMP" >/dev/null

echo "==> Checks basicos"
"$PSQL_BIN" "${PSQL_ARGS[@]}" --dbname="$TEST_DB" -c "\dt core.*"

missing="$(
  "$PSQL_BIN" "${PSQL_ARGS[@]}" --dbname="$TEST_DB" -At -c "
    WITH required(tbl) AS (
      VALUES
        ('core.sucursales'),
        ('core.pacientes'),
        ('core.consultas'),
        ('core.ventas'),
        ('core.historias_clinicas')
    )
    SELECT COALESCE(string_agg(tbl, ','), '')
    FROM required
    WHERE to_regclass(tbl) IS NULL;
  "
)"
if [[ -n "$missing" ]]; then
  echo "ERROR: faltan tablas clave en restore test: $missing" >&2
  exit 1
fi

for tbl in core.sucursales core.pacientes core.consultas core.ventas core.historias_clinicas; do
  count="$("$PSQL_BIN" "${PSQL_ARGS[@]}" --dbname="$TEST_DB" -At -c "SELECT COUNT(*) FROM $tbl;")"
  echo "OK: $tbl -> $count filas"
done

if [[ "$DROP_RESTORE_DB" == "true" ]]; then
  cleanup_db
  echo "OK: restore test completado y DB temporal eliminada."
else
  echo "OK: restore test completado. DB temporal conservada: $TEST_DB"
fi
