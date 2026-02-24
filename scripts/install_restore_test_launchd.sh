#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
RESTORE_TEST_SCRIPT="$REPO_ROOT/scripts/restore_test.sh"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
LOG_DIR="$BACKUP_DIR/logs"

LABEL="${LABEL:-com.opticaolm.restoretest}"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"

# Uso:
#   ./scripts/install_restore_test_launchd.sh weekly 1 4 15
#   ./scripts/install_restore_test_launchd.sh monthly 1 4 15
MODE="${1:-monthly}"  # weekly|monthly
DAY_OR_WEEKDAY="${2:-1}"
HOUR="${3:-4}"
MINUTE="${4:-15}"
RUN_AT_LOAD="${RUN_AT_LOAD:-false}"

mkdir -p "$LOG_DIR"

if [[ "$RUN_AT_LOAD" == "true" ]]; then
  RUN_AT_LOAD_TAG="<true/>"
else
  RUN_AT_LOAD_TAG="<false/>"
fi

if [[ "$MODE" == "weekly" ]]; then
  CALENDAR_TAGS="
    <key>Weekday</key>
    <integer>${DAY_OR_WEEKDAY}</integer>
    <key>Hour</key>
    <integer>${HOUR}</integer>
    <key>Minute</key>
    <integer>${MINUTE}</integer>
  "
elif [[ "$MODE" == "monthly" ]]; then
  CALENDAR_TAGS="
    <key>Day</key>
    <integer>${DAY_OR_WEEKDAY}</integer>
    <key>Hour</key>
    <integer>${HOUR}</integer>
    <key>Minute</key>
    <integer>${MINUTE}</integer>
  "
else
  echo "ERROR: modo invalido. Usa weekly o monthly." >&2
  exit 1
fi

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>${RESTORE_TEST_SCRIPT}</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
      <key>BACKUP_DIR</key>
      <string>${BACKUP_DIR}</string>
      <key>DROP_RESTORE_DB</key>
      <string>true</string>
    </dict>
    <key>StartCalendarInterval</key>
    <dict>
      ${CALENDAR_TAGS}
    </dict>
    <key>RunAtLoad</key>
    ${RUN_AT_LOAD_TAG}
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/launchd_restoretest.out.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/launchd_restoretest.err.log</string>
  </dict>
</plist>
EOF

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load "$PLIST_PATH"

echo "OK: launchd restore test configurado."
echo "Plist: $PLIST_PATH"
echo "Modo: $MODE  day/weekday=$DAY_OR_WEEKDAY  hour=$HOUR  minute=$MINUTE"
echo "RunAtLoad: $RUN_AT_LOAD"
echo "Ver estado: launchctl list | grep ${LABEL}"
