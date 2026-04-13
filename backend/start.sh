#!/bin/sh
set -eu

echo "[entrypoint] StudentHelper container starting"
echo "[entrypoint] PORT=${PORT:-8080}"
echo "[entrypoint] SERVE_FRONTEND=${SERVE_FRONTEND:-true}"
echo "[entrypoint] DB_PROVIDER=${DB_PROVIDER:-postgres}"

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] DATABASE_URL=set"
else
  echo "[entrypoint] DATABASE_URL=missing"
fi

echo "[entrypoint] DB_SSL_MODE=${DB_SSL_MODE:-require}"
echo "[entrypoint] LLM_PROVIDER=${LLM_PROVIDER:-gemini}"

if [ -n "${LLM_API_KEY:-}" ] || [ -n "${LLM_GEMINI_CURL:-}" ]; then
  echo "[entrypoint] LLM_API_KEY=set"
else
  echo "[entrypoint] LLM_API_KEY=missing"
fi

echo "[entrypoint] CORS_ORIGIN=${CORS_ORIGIN:-*}"

if [ "${DB_PROVIDER:-postgres}" = "postgres" ] && [ -z "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] ERROR: DB_PROVIDER=postgres but DATABASE_URL is missing" >&2
fi

if [ "${DB_PROVIDER:-postgres}" = "sqlite" ]; then
  echo "[entrypoint] WARNING: sqlite selected; remote Postgres is recommended for Back4App" >&2
fi

echo "[entrypoint] Launching npm start"
exec npm start
