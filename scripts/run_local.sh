#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv/bin/python}"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="$(command -v python3)"
fi

cleanup() {
  if [[ -n "${BACK_PID:-}" ]] && kill -0 "$BACK_PID" 2>/dev/null; then
    kill "$BACK_PID" 2>/dev/null || true
  fi
  if [[ -n "${FRONT_PID:-}" ]] && kill -0 "$FRONT_PID" 2>/dev/null; then
    kill "$FRONT_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "Starting backend on http://$BACKEND_HOST:$BACKEND_PORT ..."
(
  cd "$BACKEND_DIR"
  "$PYTHON_BIN" -m uvicorn main:app --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT"
) &
BACK_PID=$!

echo "Starting frontend on http://$FRONTEND_HOST:$FRONTEND_PORT ..."
(
  cd "$FRONTEND_DIR"
  npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT"
) &
FRONT_PID=$!

echo "Backend PID: $BACK_PID | Frontend PID: $FRONT_PID"
echo "Press Ctrl+C to stop both."

sleep 1
if ! kill -0 "$BACK_PID" 2>/dev/null; then
  echo "ERROR: backend failed to start. Verify BACKEND_PORT or existing process on that port." >&2
  exit 1
fi
if ! kill -0 "$FRONT_PID" 2>/dev/null; then
  echo "ERROR: frontend failed to start. Verify FRONTEND_PORT." >&2
  exit 1
fi

wait -n "$BACK_PID" "$FRONT_PID"
