#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/backend/.env}"
BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-$REPO_ROOT/scripts/.env.backup}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -f "$BACKUP_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$BACKUP_ENV_FILE"
  set +a
fi

DB_CONNINFO="${DB_CONNINFO:-}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-eyecare}"

BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
LOG_DIR="$BACKUP_DIR/logs"
KEEP_RECENT="${KEEP_RECENT:-14}"
KEEP_WEEKLY="${KEEP_WEEKLY:-12}"
KEEP_MONTHLY="${KEEP_MONTHLY:-12}"
OFFSITE_ENABLED="${OFFSITE_ENABLED:-true}"
RUN_RESTORE_TEST="${RUN_RESTORE_TEST:-false}"
STAMP="$(date +%Y%m%d_%H%M%S)"

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

PG_DUMP_BIN="$(find_bin pg_dump || true)"
if [[ -z "$PG_DUMP_BIN" ]]; then
  echo "ERROR: pg_dump no encontrado. Instala cliente PostgreSQL o define PG_DUMP_BIN." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
mkdir -p "$LOG_DIR"

DUMP_FILE="$BACKUP_DIR/${DB_NAME}_${STAMP}.dump"
SCHEMA_FILE_GZ="$BACKUP_DIR/${DB_NAME}_${STAMP}_schema.sql.gz"
MANIFEST_FILE="$BACKUP_DIR/${DB_NAME}_${STAMP}_manifest.txt"
TMP_DUMP_FILE="${DUMP_FILE}.tmp"
TMP_SCHEMA_FILE_GZ="${SCHEMA_FILE_GZ}.tmp"

cleanup_on_error() {
  rm -f "$TMP_DUMP_FILE" "$TMP_SCHEMA_FILE_GZ"
}
trap cleanup_on_error ERR

if [[ -z "$DB_CONNINFO" ]]; then
  if [[ -n "$DB_PASSWORD" ]]; then
    export PGPASSWORD="$DB_PASSWORD"
  fi
  DB_ARGS=(
    --host="$DB_HOST"
    --port="$DB_PORT"
    --username="$DB_USER"
    "$DB_NAME"
  )
else
  DB_ARGS=("$DB_CONNINFO")
fi

echo "==> Backup PostgreSQL"
echo "Archivo dump: $DUMP_FILE"
echo "Archivo schema: $SCHEMA_FILE_GZ"

"$PG_DUMP_BIN" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="$TMP_DUMP_FILE" \
  "${DB_ARGS[@]}"

"$PG_DUMP_BIN" \
  --schema-only \
  --no-owner \
  --no-privileges \
  "${DB_ARGS[@]}" | gzip -9 > "$TMP_SCHEMA_FILE_GZ"

mv "$TMP_DUMP_FILE" "$DUMP_FILE"
mv "$TMP_SCHEMA_FILE_GZ" "$SCHEMA_FILE_GZ"

{
  echo "timestamp=$STAMP"
  echo "db_name=$DB_NAME"
  echo "dump_file=$DUMP_FILE"
  echo "schema_file_gz=$SCHEMA_FILE_GZ"
  echo "keep_recent=$KEEP_RECENT"
  echo "keep_weekly=$KEEP_WEEKLY"
  echo "keep_monthly=$KEEP_MONTHLY"
} > "$MANIFEST_FILE"

if [[ "$OFFSITE_ENABLED" == "true" ]] && [[ -x "$REPO_ROOT/scripts/offsite_copy.sh" ]]; then
  if ! "$REPO_ROOT/scripts/offsite_copy.sh" "$DUMP_FILE" >> "$LOG_DIR/offsite_copy.log" 2>&1; then
    echo "WARN: fallo copia offsite. Revisa $LOG_DIR/offsite_copy.log"
  fi
fi

# Elimina cualquier dump corrupto (0 bytes).
find "$BACKUP_DIR" -type f -name "*.dump" -size 0 -delete

# Retencion por cantidad:
# - KEEP_RECENT: ultimos N backups
# - KEEP_WEEKLY: 1 por semana para ultimas N semanas
# - KEEP_MONTHLY: 1 por mes para ultimos N meses
python3 - "$BACKUP_DIR" "$DB_NAME" "$KEEP_RECENT" "$KEEP_WEEKLY" "$KEEP_MONTHLY" <<'PY'
import datetime as dt
import re
import sys
from pathlib import Path

backup_dir = Path(sys.argv[1])
db_name = sys.argv[2]
keep_recent = max(0, int(sys.argv[3]))
keep_weekly = max(0, int(sys.argv[4]))
keep_monthly = max(0, int(sys.argv[5]))

pattern = re.compile(rf"^{re.escape(db_name)}_(\d{{8}}_\d{{6}})\.dump$")
entries = []
for p in backup_dir.glob(f"{db_name}_*.dump"):
    m = pattern.match(p.name)
    if not m:
        continue
    ts = m.group(1)
    try:
        parsed = dt.datetime.strptime(ts, "%Y%m%d_%H%M%S")
    except ValueError:
        continue
    entries.append((parsed, ts, p))

entries.sort(key=lambda x: x[0], reverse=True)
if not entries:
    print("retention: no hay backups para procesar")
    raise SystemExit(0)

keep_ts = set()

for parsed, ts, _ in entries[:keep_recent]:
    keep_ts.add(ts)

weekly_keys = []
for parsed, ts, _ in entries:
    y, w, _ = parsed.isocalendar()
    key = (y, w)
    if key in weekly_keys:
        continue
    weekly_keys.append(key)
    keep_ts.add(ts)
    if len(weekly_keys) >= keep_weekly:
        break

monthly_keys = []
for parsed, ts, _ in entries:
    key = (parsed.year, parsed.month)
    if key in monthly_keys:
        continue
    monthly_keys.append(key)
    keep_ts.add(ts)
    if len(monthly_keys) >= keep_monthly:
        break

to_delete = [(parsed, ts, p) for parsed, ts, p in entries if ts not in keep_ts]
deleted = 0
for _, ts, dump_path in to_delete:
    base = backup_dir / f"{db_name}_{ts}"
    for suffix in [".dump", "_schema.sql.gz", "_manifest.txt"]:
        fp = Path(str(base) + suffix)
        if fp.exists():
            fp.unlink()
            deleted += 1

print(
    f"retention: total={len(entries)} keep={len(keep_ts)} deleted_files={deleted} "
    f"(recent={keep_recent}, weekly={keep_weekly}, monthly={keep_monthly})"
)
PY

if [[ "$RUN_RESTORE_TEST" == "true" ]] && [[ -x "$REPO_ROOT/scripts/restore_test.sh" ]]; then
  if ! "$REPO_ROOT/scripts/restore_test.sh" >> "$LOG_DIR/restore_test.log" 2>&1; then
    echo "WARN: restore_test fallo. Revisa $LOG_DIR/restore_test.log"
  fi
fi

echo "OK: backup completado."
