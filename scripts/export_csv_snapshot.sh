#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="${ENV_FILE:-$REPO_ROOT/scripts/.env.export_csv}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

API_URL="${OPTICA_API_URL:-https://opticaolm-production.up.railway.app}"
ADMIN_USER="${OPTICA_ADMIN_USER:-admin}"
ADMIN_PASS="${OPTICA_ADMIN_PASS:-}"
if [[ -z "$ADMIN_PASS" ]]; then
  echo "ERROR: falta OPTICA_ADMIN_PASS (configura $ENV_FILE)." >&2
  exit 1
fi

OUTPUT_DIR="${OUTPUT_DIR:-$HOME/Desktop/opticaolm_exports}"
LOG_DIR="${LOG_DIR:-$OUTPUT_DIR/logs}"
TMP_DIR="${TMP_DIR:-$OUTPUT_DIR/.tmp}"
mkdir -p "$OUTPUT_DIR" "$LOG_DIR" "$TMP_DIR"

KEEP_DAYS="${KEEP_DAYS:-30}"
MAX_TOTAL_MB="${MAX_TOTAL_MB:-1024}"
MIN_FREE_GB="${MIN_FREE_GB:-3}"
DELIMITER="${DELIMITER:-comma}"
SUCURSAL_ID="${SUCURSAL_ID:-all}"
EXPORT_TYPES="${EXPORT_TYPES:-consultas,ventas,pacientes,historias_clinicas,sucursales}"
SPLIT_BY_SUCURSAL="${SPLIT_BY_SUCURSAL:-true}"

# month | daily | custom
RANGE_MODE="${RANGE_MODE:-month}"
CUSTOM_DESDE="${CUSTOM_DESDE:-}"
CUSTOM_HASTA="${CUSTOM_HASTA:-}"

stamp="$(date +%Y%m%d_%H%M%S)"
run_dir="$OUTPUT_DIR/$stamp"
mkdir -p "$run_dir"

log_file="$LOG_DIR/export_$stamp.log"
exec > >(tee -a "$log_file") 2>&1

echo "==> CSV export run: $stamp"
echo "API: $API_URL"
echo "Output: $run_dir"

df_line="$(df -k "$HOME" | tail -n 1)"
free_kb="$(echo "$df_line" | awk '{print $4}')"
min_kb=$(( MIN_FREE_GB * 1024 * 1024 ))
if (( free_kb < min_kb )); then
  echo "ERROR: espacio libre insuficiente. Libre actual: $((free_kb / 1024 / 1024)) GB, mínimo requerido: $MIN_FREE_GB GB" >&2
  exit 1
fi

if [[ "$RANGE_MODE" == "daily" ]]; then
  desde="$(date +%F)"
  hasta="$desde"
elif [[ "$RANGE_MODE" == "custom" ]]; then
  if [[ -z "$CUSTOM_DESDE" || -z "$CUSTOM_HASTA" ]]; then
    echo "ERROR: RANGE_MODE=custom requiere CUSTOM_DESDE y CUSTOM_HASTA (YYYY-MM-DD)." >&2
    exit 1
  fi
  desde="$CUSTOM_DESDE"
  hasta="$CUSTOM_HASTA"
else
  desde="$(date +%Y-%m-01)"
  hasta="$(date +%F)"
fi

echo "Rango: $desde -> $hasta (modo=$RANGE_MODE)"

LOGIN_PAYLOAD="$(python3 - <<PY
import json
print(json.dumps({"username": "$ADMIN_USER", "password": "$ADMIN_PASS"}))
PY
)"

login_resp="$(curl -sS -f "$API_URL/login" -H 'Content-Type: application/json' -d "$LOGIN_PAYLOAD")"
token="$(echo "$login_resp" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("access_token",""))')"
if [[ -z "$token" ]]; then
  echo "ERROR: login falló, sin access_token." >&2
  exit 1
fi

IFS=',' read -r -a tipos <<< "$EXPORT_TYPES"

requires_range() {
  case "$1" in
    consultas|ventas|pacientes|historias_clinicas) return 0 ;;
    *) return 1 ;;
  esac
}

is_global_type() {
  case "$1" in
    sucursales|diccionario_columnas_fisico) return 0 ;;
    *) return 1 ;;
  esac
}

sucursal_label() {
  case "$1" in
    1) echo "EdoMex" ;;
    2) echo "Playa" ;;
    *) echo "Sucursal_$1" ;;
  esac
}

download_tipo() {
  local tipo="$1"
  local sid="$2"
  local dest_dir="$3"
  local local_prefix="$4"

  local query="delimiter=$DELIMITER"
  if ! is_global_type "$tipo"; then
    query="$query&sucursal_id=$sid"
  fi
  if requires_range "$tipo"; then
    query="$query&desde=$desde&hasta=$hasta"
  fi

  local url="$API_URL/export/$tipo.csv?$query"
  local out_csv="$dest_dir/${local_prefix}${tipo}.csv"

  echo "Descargando: ${local_prefix}${tipo} (sucursal=$sid)"
  curl -sS -fL --retry 2 --retry-delay 1 "$url" \
    -H "Authorization: Bearer $token" \
    -o "$out_csv"

  gzip -f -9 "$out_csv"
  echo "OK: ${local_prefix}${tipo}.csv.gz"
}

for raw_tipo in "${tipos[@]}"; do
  tipo="$(echo "$raw_tipo" | xargs)"
  [[ -z "$tipo" ]] && continue

  if is_global_type "$tipo"; then
    mkdir -p "$run_dir/common"
    download_tipo "$tipo" "all" "$run_dir/common" ""
    continue
  fi

  if [[ "$SPLIT_BY_SUCURSAL" == "true" && "$SUCURSAL_ID" == "all" ]]; then
    for sid in 1 2; do
      label="$(sucursal_label "$sid")"
      dest="$run_dir/sucursal_${sid}_${label}"
      mkdir -p "$dest"
      download_tipo "$tipo" "$sid" "$dest" ""
    done
  else
    mkdir -p "$run_dir"
    download_tipo "$tipo" "$SUCURSAL_ID" "$run_dir" ""
  fi
done

manifest="$run_dir/_manifest.txt"
{
  echo "timestamp=$stamp"
  echo "api_url=$API_URL"
  echo "sucursal_id=$SUCURSAL_ID"
  echo "split_by_sucursal=$SPLIT_BY_SUCURSAL"
  echo "range_mode=$RANGE_MODE"
  echo "desde=$desde"
  echo "hasta=$hasta"
  echo "types=$EXPORT_TYPES"
} > "$manifest"

# Retención por días (si KEEP_DAYS <= 0, no borra por antigüedad)
if (( KEEP_DAYS > 0 )); then
  find "$OUTPUT_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime +"$KEEP_DAYS" -exec rm -rf {} + || true
else
  echo "Retención por antigüedad desactivada (KEEP_DAYS=$KEEP_DAYS)."
fi

# Tope total de tamaño (MB): borra snapshots más viejos.
# Si MAX_TOTAL_MB <= 0, se desactiva esta limpieza por tamaño.
if (( MAX_TOTAL_MB > 0 )); then
  max_kb=$(( MAX_TOTAL_MB * 1024 ))
  current_kb="$(du -sk "$OUTPUT_DIR" | awk '{print $1}')"
  if (( current_kb > max_kb )); then
    echo "Aplicando tope: ${MAX_TOTAL_MB}MB (actual=$((current_kb/1024))MB)"
    while (( current_kb > max_kb )); do
      oldest="$(find "$OUTPUT_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' | sort | head -n 1)"
      if [[ -z "$oldest" ]]; then
        break
      fi
      echo "Borrando snapshot antiguo: $oldest"
      rm -rf "$oldest"
      current_kb="$(du -sk "$OUTPUT_DIR" | awk '{print $1}')"
    done
  fi
else
  echo "Tope por tamaño desactivado (MAX_TOTAL_MB=$MAX_TOTAL_MB)."
fi

# Retención de logs
if (( KEEP_DAYS > 0 )); then
  find "$LOG_DIR" -type f -name 'export_*.log' -mtime +"$KEEP_DAYS" -delete || true
fi

final_kb="$(du -sk "$OUTPUT_DIR" | awk '{print $1}')"
echo "OK: export completado. Uso total carpeta: $((final_kb/1024)) MB"
