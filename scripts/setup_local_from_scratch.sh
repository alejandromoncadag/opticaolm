#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

# Optional: load local env values if present.
if [[ -f "$BACKEND_DIR/.env" ]]; then
  # shellcheck disable=SC1090
  source "$BACKEND_DIR/.env"
fi

DB_NAME="${DB_NAME:-eyecare}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-$USER}"
DB_PASSWORD="${DB_PASSWORD:-}"

PSQL_BIN="${PSQL_BIN:-$(command -v psql || true)}"
if [[ -z "$PSQL_BIN" ]]; then
  for candidate in /opt/homebrew/bin/psql /usr/local/bin/psql /Applications/Postgres.app/Contents/Versions/latest/bin/psql; do
    if [[ -x "$candidate" ]]; then
      PSQL_BIN="$candidate"
      break
    fi
  done
fi
if [[ -z "$PSQL_BIN" ]]; then
  echo "ERROR: psql not found. Install PostgreSQL client or set PSQL_BIN=/path/to/psql" >&2
  exit 1
fi

PASS_PART=""
if [[ -n "$DB_PASSWORD" ]]; then
  export PGPASSWORD="$DB_PASSWORD"
  PASS_PART=" password=$DB_PASSWORD"
fi

if [[ -z "${DB_CONNINFO:-}" ]]; then
  export DB_CONNINFO="host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER$PASS_PART"
fi

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv/bin/python}"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="$(command -v python3)"
fi

echo "[1/4] Creating database if missing: $DB_NAME"
ADMIN_CONNINFO="host=$DB_HOST port=$DB_PORT dbname=postgres user=$DB_USER$PASS_PART"
"$PSQL_BIN" "$ADMIN_CONNINFO" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$DB_NAME') THEN
    EXECUTE 'CREATE DATABASE "$DB_NAME"';
  END IF;
END
\$\$;
SQL

echo "[2/4] Applying base schema"
"$PSQL_BIN" "$DB_CONNINFO" -v ON_ERROR_STOP=1 -f "$BACKEND_DIR/scripts/migrations/000_init_core_schema.sql"

echo "[3/4] Applying runtime migrations (from FastAPI code)"
(
  cd "$BACKEND_DIR"
  "$PYTHON_BIN" scripts/apply_runtime_migrations.py
)

echo "[4/4] Seeding minimal data (sucursales + admin)"
(
  cd "$BACKEND_DIR"
  "$PYTHON_BIN" scripts/seed_minimo.py
)

echo "Done. Local DB is ready."
