#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UV_VENV="$ROOT/.venv-launcher"
UV_PYTHON="$UV_VENV/bin/python"
LAUNCHER="$ROOT/run_backend.py"
PYTHON_BIN="${PYTHON_BIN:-}"

if [[ -z "$PYTHON_BIN" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python)"
  else
    echo "[ERROR] python3 or python was not found in PATH."
    exit 1
  fi
fi

if ! "$PYTHON_BIN" -m uv --version >/dev/null 2>&1; then
  echo "[INFO] uv not found in the current Python environment. Installing uv..."
  "$PYTHON_BIN" -m pip install uv
fi

if [[ ! -f "$LAUNCHER" ]]; then
  echo "[ERROR] Launcher not found: $LAUNCHER"
  exit 1
fi

if [[ ! -x "$UV_PYTHON" ]]; then
  echo "[INFO] Creating isolated launcher environment with uv..."
  "$PYTHON_BIN" -m uv venv "$UV_VENV"
fi

echo "[INFO] Using isolated Python: $UV_PYTHON"
"$UV_PYTHON" --version

echo "[INFO] Starting backend through Python launcher..."
exec "$UV_PYTHON" "$LAUNCHER"
