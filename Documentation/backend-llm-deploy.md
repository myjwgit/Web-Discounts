# Backend and LLM Deployment Notes

This project includes a backend in `backend/` that reads both LLM settings and database settings from runtime environment variables.

## Backend Endpoints

- `GET /api/health`
- `GET /api/runtime-config`
- `POST /api/chat`
- `POST /api/recommend`

## Runtime Variables

Configure these in one of three places:
- local `backend/.env`
- Docker `environment` or `env_file`
- deployment platform environment settings

## Database Variables

```env
DB_PROVIDER=sqlite
DATABASE_URL=
DB_SSL_MODE=require
```

### SQLite mode

Use the default local setup:

```env
DB_PROVIDER=sqlite
```

This stores cache, logs, and lightweight memory in `backend/data/studenthelper.db`.

### Supabase / Postgres mode

Use this for Docker or hosted deployments:

```env
DB_PROVIDER=postgres
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project.supabase.co:5432/postgres
DB_SSL_MODE=require
```

Notes:
- keep the real password only in `.env`, Docker secrets, or platform secrets
- do not commit connection strings with real passwords
- `DB_SSL_MODE=require` is the correct default for Supabase

## LLM Variables

```env
PORT=8080
CORS_ORIGIN=http://127.0.0.1:4173
LLM_PROVIDER=gemini
LLM_API_KEY=your-key-here
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta
LLM_MODEL=gemini-2.0-flash
LLM_TEMPERATURE=0.2
LLM_SYSTEM_PROMPT=You are StudentHelper backend assistant.
```

## Docker Compose

Create `backend/.env` from `.env.example`, then run:

```bash
docker compose up --build
```

Example `backend/.env` for Supabase:

```env
PORT=8080
CORS_ORIGIN=http://127.0.0.1:4173
DB_PROVIDER=postgres
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project.supabase.co:5432/postgres
DB_SSL_MODE=require
LLM_PROVIDER=gemini
LLM_API_KEY=your-key-here
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta
LLM_MODEL=gemini-2.0-flash
LLM_TEMPERATURE=0.2
LLM_SYSTEM_PROMPT=You are StudentHelper backend assistant.
```

## Health Check

`GET /api/health` now reports the active database provider:
- `sqlite`
- `postgres`

This makes it easy to confirm whether Docker or hosted deployment is actually using Supabase.

## GitHub Settings

If you want GitHub Actions or hosted deploy platforms to use secrets during future deploy workflows, store them here:

- `Settings -> Secrets and variables -> Actions`

Recommended secrets:
- `LLM_API_KEY`
- `DATABASE_URL`

Recommended variables:
- `DB_PROVIDER`
- `DB_SSL_MODE`
- `LLM_PROVIDER`
- `LLM_BASE_URL`
- `LLM_MODEL`
- `LLM_TEMPERATURE`
- `LLM_SYSTEM_PROMPT`
- `CORS_ORIGIN`

## Why this setup is useful

This keeps the backend flexible:
- switch between SQLite and Supabase without code changes
- keep local development simple with SQLite
- deploy Docker containers against hosted Postgres
- keep secrets out of the repository
- preserve the same API contract across environments

## Security note

Do not commit or paste real API keys, publishable keys, service keys, or database passwords into source files, workflow files, or chat logs.
Rotate any key that was exposed publicly and store the replacement in environment variables or platform secrets.
