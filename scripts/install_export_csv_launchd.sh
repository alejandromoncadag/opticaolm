#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
EXPORT_SCRIPT="$REPO_ROOT/scripts/export_csv_snapshot.sh"

LABEL="${LABEL:-com.opticaolm.csv_export}"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="${LOG_DIR:-$HOME/Desktop/opticaolm_exports/logs}"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/scripts/.env.export_csv}"

# Default: diario 22:15
HOUR="${1:-22}"
MINUTE="${2:-15}"
RUN_AT_LOAD="${RUN_AT_LOAD:-false}"

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

RUN_AT_LOAD_TAG="<false/>"
if [[ "$RUN_AT_LOAD" == "true" ]]; then
  RUN_AT_LOAD_TAG="<true/>"
fi

cat > "$PLIST_PATH" <<EOF2
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>${EXPORT_SCRIPT}</string>
    </array>

    <key>EnvironmentVariables</key>
    <dict>
      <key>ENV_FILE</key>
      <string>${ENV_FILE}</string>
    </dict>

    <key>StartCalendarInterval</key>
    <dict>
      <key>Hour</key>
      <integer>${HOUR}</integer>
      <key>Minute</key>
      <integer>${MINUTE}</integer>
    </dict>

    <key>RunAtLoad</key>
    ${RUN_AT_LOAD_TAG}

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/launchd_export.out.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/launchd_export.err.log</string>
  </dict>
</plist>
EOF2

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load "$PLIST_PATH"

echo "OK: export CSV automático configurado."
echo "Plist: $PLIST_PATH"
echo "Horario: ${HOUR}:${MINUTE}"
echo "ENV_FILE: $ENV_FILE"
echo "Estado: launchctl list | grep ${LABEL}"
