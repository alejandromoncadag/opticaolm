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
OFFSITE_TARGETS="${OFFSITE_TARGETS:-icloud}"
ICLOUD_DIR="${ICLOUD_DIR:-$HOME/Library/Mobile Documents/com~apple~CloudDocs/OpticaOLM/backups}"
GDRIVE_DIR="${GDRIVE_DIR:-}"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

detect_google_drive_dir() {
  local cloud_root="$HOME/Library/CloudStorage"
  local first_match=""
  if [[ -d "$cloud_root" ]]; then
    first_match="$(find "$cloud_root" -maxdepth 1 -type d -name 'GoogleDrive*' | head -n 1 || true)"
  fi
  if [[ -z "$first_match" ]]; then
    echo ""
    return 0
  fi
  if [[ -d "$first_match/My Drive" ]]; then
    echo "$first_match/My Drive/OpticaOLM/backups"
    return 0
  fi
  if [[ -d "$first_match/Mi unidad" ]]; then
    echo "$first_match/Mi unidad/OpticaOLM/backups"
    return 0
  fi
  echo "$first_match/OpticaOLM/backups"
}

latest_dump() {
  find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.dump' -size +0c | sort | tail -n 1
}

DUMP_FILE="${1:-}"
if [[ -z "$DUMP_FILE" ]]; then
  DUMP_FILE="$(latest_dump)"
fi

if [[ -z "$DUMP_FILE" || ! -f "$DUMP_FILE" ]]; then
  log "ERROR: no se encontro dump para copia offsite."
  exit 1
fi

BASE_PATH="${DUMP_FILE%.dump}"
FILES_TO_COPY=("$DUMP_FILE")
if [[ -f "${BASE_PATH}_schema.sql.gz" ]]; then
  FILES_TO_COPY+=("${BASE_PATH}_schema.sql.gz")
fi
if [[ -f "${BASE_PATH}_manifest.txt" ]]; then
  FILES_TO_COPY+=("${BASE_PATH}_manifest.txt")
fi

IFS=',' read -r -a TARGETS <<< "$OFFSITE_TARGETS"
if [[ -z "$GDRIVE_DIR" ]]; then
  GDRIVE_DIR="$(detect_google_drive_dir)"
fi

copy_to_dir() {
  local target_name="$1"
  local target_dir="$2"
  if [[ -z "$target_dir" ]]; then
    log "WARN: destino $target_name no configurado."
    return 1
  fi
  mkdir -p "$target_dir" || {
    log "ERROR: no se pudo crear carpeta destino $target_name: $target_dir"
    return 1
  }
  local f
  for f in "${FILES_TO_COPY[@]}"; do
    cp -f "$f" "$target_dir/" || {
      log "ERROR: fallo copia a $target_name ($f -> $target_dir)"
      return 1
    }
  done
  log "OK: copia offsite $target_name en $target_dir"
  return 0
}

failures=0
copied=0
target_raw=""
for target_raw in "${TARGETS[@]}"; do
  target="$(echo "$target_raw" | tr '[:upper:]' '[:lower:]' | xargs)"
  [[ -z "$target" ]] && continue
  case "$target" in
    icloud)
      if copy_to_dir "iCloud" "$ICLOUD_DIR"; then
        copied=$((copied + 1))
      else
        failures=$((failures + 1))
      fi
      ;;
    gdrive|google_drive|googledrive)
      if copy_to_dir "GoogleDrive" "$GDRIVE_DIR"; then
        copied=$((copied + 1))
      else
        failures=$((failures + 1))
      fi
      ;;
    *)
      log "WARN: target offsite desconocido: $target"
      failures=$((failures + 1))
      ;;
  esac
done

if [[ "$copied" -eq 0 ]]; then
  log "ERROR: no se pudo copiar a ningun destino offsite."
  exit 1
fi

if [[ "$failures" -gt 0 ]]; then
  log "WARN: algunas copias offsite fallaron (fallas=$failures, exitos=$copied)."
  exit 1
fi

log "OK: offsite_copy completado (destinos=$copied)."
