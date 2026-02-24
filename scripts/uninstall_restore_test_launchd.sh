#!/usr/bin/env bash
set -euo pipefail

LABEL="${LABEL:-com.opticaolm.restoretest}"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"

if [[ -f "$PLIST_PATH" ]]; then
  launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
  rm -f "$PLIST_PATH"
  echo "OK: launchd restore test desinstalado (${LABEL})."
else
  echo "No existe ${PLIST_PATH}"
fi
