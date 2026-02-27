#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
BACKUP_SCRIPT="$REPO_ROOT/scripts/backup.sh"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
LOG_DIR="$BACKUP_DIR/logs"
BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-$REPO_ROOT/scripts/.env.backup}"
OFFSITE_ENABLED="${OFFSITE_ENABLED:-true}"
OFFSITE_TARGETS="${OFFSITE_TARGETS:-icloud}"
ICLOUD_DIR="${ICLOUD_DIR:-$HOME/Library/Mobile Documents/com~apple~CloudDocs/OpticaOLM/backups}"
GDRIVE_DIR="${GDRIVE_DIR:-}"
KEEP_RECENT="${KEEP_RECENT:-14}"
KEEP_WEEKLY="${KEEP_WEEKLY:-12}"
KEEP_MONTHLY="${KEEP_MONTHLY:-12}"
RUN_RESTORE_TEST="${RUN_RESTORE_TEST:-false}"

LABEL="${LABEL:-com.opticaolm.backup}"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
RUN_AT_LOAD="${RUN_AT_LOAD:-false}"

# Defaults: diario 03:00 (sin weekday). Si pasas weekday 0..6, queda semanal.
WEEKDAY="${1:-*}" # *=diario, 0=domingo ... 6=sabado
HOUR="${2:-3}"
MINUTE="${3:-0}"

mkdir -p "$LOG_DIR"

RUN_AT_LOAD_TAG="<false/>"
if [[ "$RUN_AT_LOAD" == "true" ]]; then
  RUN_AT_LOAD_TAG="<true/>"
fi

WEEKDAY_TAG=""
if [[ "$WEEKDAY" != "*" ]]; then
  WEEKDAY_TAG=$(cat <<EOW
      <key>Weekday</key>
      <integer>${WEEKDAY}</integer>
EOW
)
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
      <string>${BACKUP_SCRIPT}</string>
    </array>

    <key>EnvironmentVariables</key>
    <dict>
      <key>BACKUP_DIR</key>
      <string>${BACKUP_DIR}</string>
      <key>BACKUP_ENV_FILE</key>
      <string>${BACKUP_ENV_FILE}</string>
      <key>OFFSITE_ENABLED</key>
      <string>${OFFSITE_ENABLED}</string>
      <key>OFFSITE_TARGETS</key>
      <string>${OFFSITE_TARGETS}</string>
      <key>ICLOUD_DIR</key>
      <string>${ICLOUD_DIR}</string>
      <key>GDRIVE_DIR</key>
      <string>${GDRIVE_DIR}</string>
      <key>KEEP_RECENT</key>
      <string>${KEEP_RECENT}</string>
      <key>KEEP_WEEKLY</key>
      <string>${KEEP_WEEKLY}</string>
      <key>KEEP_MONTHLY</key>
      <string>${KEEP_MONTHLY}</string>
      <key>RUN_RESTORE_TEST</key>
      <string>${RUN_RESTORE_TEST}</string>
    </dict>

    <key>StartCalendarInterval</key>
    <dict>
${WEEKDAY_TAG}
      <key>Hour</key>
      <integer>${HOUR}</integer>
      <key>Minute</key>
      <integer>${MINUTE}</integer>
    </dict>

    <key>RunAtLoad</key>
    ${RUN_AT_LOAD_TAG}
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/launchd_backup.out.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/launchd_backup.err.log</string>
  </dict>
</plist>
EOF

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load "$PLIST_PATH"

echo "OK: launchd configurado."
echo "Plist: $PLIST_PATH"
echo "Horario: weekday=$WEEKDAY hour=$HOUR minute=$MINUTE"
echo "RunAtLoad: $RUN_AT_LOAD"
echo "Offsite: enabled=$OFFSITE_ENABLED targets=$OFFSITE_TARGETS"
echo "Backup env file: $BACKUP_ENV_FILE"
echo "Retention: recent=$KEEP_RECENT weekly=$KEEP_WEEKLY monthly=$KEEP_MONTHLY"
echo "Restore test post-backup: $RUN_RESTORE_TEST"
echo "Ver estado: launchctl list | grep ${LABEL}"
