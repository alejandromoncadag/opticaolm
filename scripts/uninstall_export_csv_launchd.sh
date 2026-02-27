#!/usr/bin/env bash
set -euo pipefail

LABEL="${LABEL:-com.opticaolm.csv_export}"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
rm -f "$PLIST_PATH"

echo "OK: launchd export desinstalado (${LABEL})."
