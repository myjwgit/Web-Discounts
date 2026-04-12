from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_ENV = ROOT / 'backend' / '.env'
INDEX_HTML = ROOT / 'FrontEnd' / 'html' / 'index.html'


def load_env_file(path: Path) -> dict:
    values = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip()
    return values


def read_backend_meta(path: Path) -> dict:
    values = {
        'studenthelper-api-base': '(not found)',
        'studenthelper-backend-enabled': '(not found)',
    }
    if not path.exists():
        return values

    text = path.read_text(encoding='utf-8')
    for name in values:
        marker = f'<meta name="{name}" content="'
        start = text.find(marker)
        if start == -1:
            continue
        start += len(marker)
        end = text.find('"', start)
        if end != -1:
            values[name] = text[start:end]
    return values


def mask_secret(value: str) -> str:
    if not value:
        return '(not set)'
    if len(value) <= 8:
        return '*' * len(value)
    return f'{value[:4]}...{value[-4:]}'


def print_section(title: str) -> None:
    print()
    print(title)
    print('-' * len(title))


def main() -> None:
    env_values = load_env_file(BACKEND_ENV)
    meta_values = read_backend_meta(INDEX_HTML)

    print('GitHub Pages + Backend Config Helper')
    print('===================================')
    print(f'Workspace: {ROOT}')

    print_section('Current Local State')
    print(f'Index API base meta: {meta_values["studenthelper-api-base"]}')
    print(f'Index backend mode meta: {meta_values["studenthelper-backend-enabled"]}')
    print(f'DB_PROVIDER: {env_values.get("DB_PROVIDER", "(not set)")}')
    print(f'DATABASE_URL: {mask_secret(env_values.get("DATABASE_URL", ""))}')
    print(f'DB_SSL_MODE: {env_values.get("DB_SSL_MODE", "(not set)")}')
    print(f'LLM_PROVIDER: {env_values.get("LLM_PROVIDER", "(not set)")}')
    print(f'LLM_API_KEY: {mask_secret(env_values.get("LLM_API_KEY", ""))}')
    print(f'LLM_MODEL: {env_values.get("LLM_MODEL", "(not set)")}')
    print(f'CORS_ORIGIN: {env_values.get("CORS_ORIGIN", "(not set)")}')

    print_section('What GitHub Pages Can And Cannot Do')
    print('GitHub Pages can host only the static frontend.')
    print('GitHub Pages cannot run your Node backend, database, or LLM calls.')
    print('So you need:')
    print('1. GitHub Pages for the frontend')
    print('2. A remote backend host such as Back4App, Render, Railway, Fly.io, or VPS')
    print('3. Remote environment variables for LLM and database config')

    print_section('GitHub Pages Frontend Settings')
    print('In GitHub repository settings:')
    print('1. Open Settings -> Pages')
    print('2. Set Source to GitHub Actions')
    print('3. Deploy FrontEnd/html as the static site')
    print('Recommended frontend mode settings:')
    print(' - studenthelper-backend-enabled = true  (if remote backend is live)')
    print(' - studenthelper-backend-enabled = false (if you want pure static demo mode)')
    print(' - studenthelper-api-base = https://your-backend-domain')

    print_section('Remote Backend Environment Variables')
    print('Configure these on your backend host, not on GitHub Pages:')
    print('PORT=8080')
    print('CORS_ORIGIN=https://<your-github-pages-domain>')
    print(f'LLM_PROVIDER={env_values.get("LLM_PROVIDER", "gemini")}')
    print('LLM_API_KEY=<your-rotated-gemini-key>')
    print(f'LLM_BASE_URL={env_values.get("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")}')
    print(f'LLM_MODEL={env_values.get("LLM_MODEL", "gemini-flash-latest")}')
    print(f'LLM_TEMPERATURE={env_values.get("LLM_TEMPERATURE", "0.2")}')
    print(f'LLM_SYSTEM_PROMPT={env_values.get("LLM_SYSTEM_PROMPT", "You are StudentHelper backend assistant.")}')
    print(f'DB_PROVIDER={env_values.get("DB_PROVIDER", "sqlite")}')
    if env_values.get('DB_PROVIDER', 'sqlite') == 'postgres':
        print('DATABASE_URL=<your-remote-postgres-or-supabase-url>')
        print(f'DB_SSL_MODE={env_values.get("DB_SSL_MODE", "require")}')
    else:
        print('DATABASE_URL=(leave empty for local SQLite on the host)')
        print('DB_SSL_MODE=require')
    print('ADMIN_REVIEW_PASSWORD=<review-password>')

    print_section('GitHub Secrets And Variables')
    print('Use GitHub only for build/deploy metadata, not for Pages runtime execution.')
    print('Recommended GitHub Secrets:')
    print(' - BACKEND_URL')
    print(' - optional deploy tokens for your backend host')
    print('Recommended GitHub Variables:')
    print(' - FRONTEND_BACKEND_ENABLED=true')
    print(' - FRONTEND_API_BASE=https://your-backend-domain')
    print('If your workflow rewrites index.html during deploy, these values can be injected there.')

    print_section('Remote Database Options')
    print('Option A: SQLite on the backend host')
    print(' - simplest setup')
    print(' - good for demo or small projects')
    print(' - no separate cloud database needed')
    print('Option B: Supabase / remote Postgres')
    print(' - better for shared deployment')
    print(' - use DB_PROVIDER=postgres')
    print(' - set DATABASE_URL and DB_SSL_MODE=require')

    print_section('Deployment Checklist')
    print('[ ] Frontend deployed to GitHub Pages')
    print('[ ] Remote backend deployed and reachable')
    print('[ ] Backend /api/health returns ok=true')
    print('[ ] Backend CORS allows your GitHub Pages domain')
    print('[ ] LLM_API_KEY configured on backend host')
    print('[ ] Database configured on backend host')
    print('[ ] Frontend API base points to remote backend')
    print('[ ] Submit flow works')
    print('[ ] Review flow works')

    print_section('Post-Deploy Smoke Tests')
    print('1. Open your GitHub Pages site')
    print('2. Test search and local recommendations')
    print('3. Submit a new resource')
    print('4. Open /api/health on the backend')
    print('5. Approve the resource in reviews.html')
    print('6. Confirm the approved card appears on the homepage')

    print_section('Security Reminder')
    print('Rotate any API keys or database passwords that were pasted into chat or terminal history.')
    print('Do not commit real secrets to the repository.')


if __name__ == '__main__':
    main()
