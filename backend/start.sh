#!/bin/sh
LOG_FILE="/tmp/studenthelper-startup.log"
: > "$LOG_FILE"

log() {
  printf "%s
" "$1"
  printf "%s
" "$1" >> "$LOG_FILE"
}

log "[entrypoint] StudentHelper container starting"
log "[entrypoint] PORT=${PORT:-8080}"
log "[entrypoint] SERVE_FRONTEND=${SERVE_FRONTEND:-true}"
log "[entrypoint] DB_PROVIDER=${DB_PROVIDER:-postgres}"

if [ -n "${DATABASE_URL:-}" ]; then
  log "[entrypoint] DATABASE_URL=set"
else
  log "[entrypoint] DATABASE_URL=missing"
fi

log "[entrypoint] DB_SSL_MODE=${DB_SSL_MODE:-require}"
log "[entrypoint] LLM_PROVIDER=${LLM_PROVIDER:-gemini}"

if [ -n "${LLM_API_KEY:-}" ] || [ -n "${LLM_GEMINI_CURL:-}" ]; then
  log "[entrypoint] LLM_API_KEY=set"
else
  log "[entrypoint] LLM_API_KEY=missing"
fi

log "[entrypoint] CORS_ORIGIN=${CORS_ORIGIN:-*}"

if [ "${DB_PROVIDER:-postgres}" = "postgres" ] && [ -z "${DATABASE_URL:-}" ]; then
  log "[entrypoint] ERROR: DB_PROVIDER=postgres but DATABASE_URL is missing"
fi

if [ "${DB_PROVIDER:-postgres}" = "sqlite" ]; then
  log "[entrypoint] WARNING: sqlite selected; remote Postgres is recommended for Back4App"
fi

log "[entrypoint] Launching npm start"
npm start >> "$LOG_FILE" 2>&1
status=$?
log "[entrypoint] Process exited with status $status"
log "[entrypoint] Dumping startup log before exit:"
cat "$LOG_FILE" || true
exit $status
