from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
BACKEND_ENV = ROOT / 'backend' / '.env'
BACKEND_ENV_EXAMPLE = ROOT / 'backend' / '.env.example'
INDEX_HTML = ROOT / 'FrontEnd' / 'html' / 'index.html'
OUTPUT_DIR = ROOT / 'Documentation'
OUTPUT_DIR.mkdir(exist_ok=True)
GITHUB_ENV_TEMPLATE = OUTPUT_DIR / 'github-pages-runtime-config.md'


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


def write_env_file(path: Path, values: dict) -> None:
    lines = [f'{key}={value}' for key, value in values.items()]
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def read_meta_values(path: Path) -> dict:
    values = {
        'studenthelper-api-base': '',
        'studenthelper-backend-enabled': 'auto',
    }
    if not path.exists():
        return values
    text = path.read_text(encoding='utf-8')
    for name in values:
        match = re.search(rf'<meta name="{re.escape(name)}" content="([^"]*)" ?/>', text)
        if match:
            values[name] = match.group(1)
    return values


def write_meta_values(path: Path, api_base: str, backend_enabled: str) -> None:
    text = path.read_text(encoding='utf-8')
    replacements = {
        'studenthelper-api-base': api_base,
        'studenthelper-backend-enabled': backend_enabled,
    }
    for name, value in replacements.items():
        pattern = rf'(<meta name="{re.escape(name)}" content=")([^"]*)(" ?/>)'
        text, count = re.subn(pattern, rf'\g<1>{value}\g<3>', text, count=1)
        if count == 0:
            insertion = f'  <meta name="{name}" content="{value}" />\n'
            text = text.replace('</head>', insertion + '</head>')
    path.write_text(text, encoding='utf-8')


def ask(prompt: str, default: str = '') -> str:
    suffix = f' [{default}]' if default else ''
    value = input(f'{prompt}{suffix}: ').strip()
    return value if value else default


def ask_yes_no(prompt: str, default: bool = True) -> bool:
    default_text = 'Y/n' if default else 'y/N'
    value = input(f'{prompt} [{default_text}]: ').strip().lower()
    if not value:
        return default
    return value in {'y', 'yes'}


def choose(prompt: str, options: list[tuple[str, str]], default_key: str) -> str:
    print(prompt)
    for key, label in options:
        marker = ' (default)' if key == default_key else ''
        print(f'  {key}. {label}{marker}')
    while True:
        value = input('Choose: ').strip().lower()
        if not value:
            return default_key
        for key, _ in options:
            if value == key:
                return key
        print('Invalid choice. Try again.')


def build_runtime_summary(frontend_api_base: str, backend_enabled: str, env_values: dict) -> str:
    github_pages_domain = 'https://<your-username>.github.io/<repo-name>/'
    return f'''# GitHub Pages Runtime Config

## Frontend
- studenthelper-api-base = {frontend_api_base or '(empty)'}
- studenthelper-backend-enabled = {backend_enabled}

## Backend Env
- PORT = {env_values.get('PORT', '8080')}
- CORS_ORIGIN = {env_values.get('CORS_ORIGIN', github_pages_domain)}
- DB_PROVIDER = {env_values.get('DB_PROVIDER', 'sqlite')}
- DATABASE_URL = {'(set)' if env_values.get('DATABASE_URL') else '(empty)'}
- DB_SSL_MODE = {env_values.get('DB_SSL_MODE', 'require')}
- LLM_PROVIDER = {env_values.get('LLM_PROVIDER', 'gemini')}
- LLM_API_KEY = {'(set)' if env_values.get('LLM_API_KEY') else '(missing)'}
- LLM_BASE_URL = {env_values.get('LLM_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta')}
- LLM_MODEL = {env_values.get('LLM_MODEL', 'gemini-2.0-flash')}
- LLM_TEMPERATURE = {env_values.get('LLM_TEMPERATURE', '0.2')}
- LLM_SYSTEM_PROMPT = {env_values.get('LLM_SYSTEM_PROMPT', 'You are StudentHelper backend assistant.')}
- ADMIN_REVIEW_PASSWORD = {'(set)' if env_values.get('ADMIN_REVIEW_PASSWORD') else '(missing)'}

## GitHub Variables
- FRONTEND_API_BASE = {frontend_api_base or '(empty)'}
- FRONTEND_BACKEND_ENABLED = {backend_enabled}

## GitHub Secrets
- Do not put runtime LLM or database secrets into GitHub Pages.
- Put real backend secrets only on the backend host.
- Optional deployment secret examples:
  - BACKEND_URL
  - platform deploy token

## Checklist
- [ ] Settings -> Pages -> Source = GitHub Actions
- [ ] github-pages environment allows this branch
- [ ] Backend host is reachable
- [ ] /api/health works remotely
- [ ] CORS_ORIGIN matches your Pages URL
- [ ] Frontend points to the correct backend URL
'''


def main() -> None:
    print('GitHub Pages Interactive Config Wizard')
    print('====================================')
    print(f'Workspace: {ROOT}')

    env_values = load_env_file(BACKEND_ENV_EXAMPLE)
    env_values.update(load_env_file(BACKEND_ENV))
    meta_values = read_meta_values(INDEX_HTML)

    mode = choose(
        'Select deployment mode:',
        [
            ('1', 'Pure static GitHub Pages demo (no remote backend)'),
            ('2', 'GitHub Pages + remote backend API'),
        ],
        '1' if meta_values.get('studenthelper-backend-enabled', 'auto') == 'false' else '2',
    )

    if mode == '1':
        frontend_api_base = ''
        backend_enabled = 'false'
        print('\nStatic mode selected. Frontend will stay local-only on GitHub Pages.')
    else:
        backend_enabled = ask('Frontend backend mode', meta_values.get('studenthelper-backend-enabled') or 'true')
        frontend_api_base = ask('Frontend API base URL', meta_values.get('studenthelper-api-base') or 'https://your-backend-domain')
        env_values['CORS_ORIGIN'] = ask('Backend CORS_ORIGIN', env_values.get('CORS_ORIGIN', 'https://<your-username>.github.io/<repo-name>/'))
        env_values['DB_PROVIDER'] = 'sqlite' if choose(
            'Choose backend database provider:',
            [('1', 'SQLite on backend host'), ('2', 'Remote Postgres / Supabase')],
            '1' if env_values.get('DB_PROVIDER', 'sqlite') == 'sqlite' else '2',
        ) == '1' else 'postgres'
        if env_values['DB_PROVIDER'] == 'postgres':
            env_values['DATABASE_URL'] = ask('DATABASE_URL', env_values.get('DATABASE_URL', 'postgresql://postgres:[YOUR-PASSWORD]@host:5432/postgres'))
            env_values['DB_SSL_MODE'] = ask('DB_SSL_MODE', env_values.get('DB_SSL_MODE', 'require'))
        else:
            env_values['DATABASE_URL'] = ''
            env_values['DB_SSL_MODE'] = ask('DB_SSL_MODE', env_values.get('DB_SSL_MODE', 'require'))
        env_values['LLM_PROVIDER'] = ask('LLM_PROVIDER', env_values.get('LLM_PROVIDER', 'gemini'))
        env_values['LLM_BASE_URL'] = ask('LLM_BASE_URL', env_values.get('LLM_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'))
        env_values['LLM_MODEL'] = ask('LLM_MODEL', env_values.get('LLM_MODEL', 'gemini-2.0-flash'))
        env_values['LLM_TEMPERATURE'] = ask('LLM_TEMPERATURE', env_values.get('LLM_TEMPERATURE', '0.2'))
        env_values['LLM_SYSTEM_PROMPT'] = ask('LLM_SYSTEM_PROMPT', env_values.get('LLM_SYSTEM_PROMPT', 'You are StudentHelper backend assistant.'))
        if ask_yes_no('Update LLM_API_KEY placeholder in backend/.env?', False):
            env_values['LLM_API_KEY'] = ask('LLM_API_KEY', env_values.get('LLM_API_KEY', 'replace-me'))
        if ask_yes_no('Update ADMIN_REVIEW_PASSWORD in backend/.env?', False):
            env_values['ADMIN_REVIEW_PASSWORD'] = ask('ADMIN_REVIEW_PASSWORD', env_values.get('ADMIN_REVIEW_PASSWORD', '404 team name not found'))

    if ask_yes_no('Write frontend meta config into index.html?', True):
        write_meta_values(INDEX_HTML, frontend_api_base, backend_enabled)
        print(f'Updated: {INDEX_HTML}')

    if ask_yes_no('Write backend/.env with the current wizard values?', True):
        existing = load_env_file(BACKEND_ENV_EXAMPLE)
        existing.update(load_env_file(BACKEND_ENV))
        existing.update(env_values)
        if mode == '1':
            existing.setdefault('PORT', '8080')
            existing.setdefault('CORS_ORIGIN', 'http://127.0.0.1:4173')
        write_env_file(BACKEND_ENV, existing)
        print(f'Updated: {BACKEND_ENV}')

    summary = build_runtime_summary(frontend_api_base, backend_enabled, env_values)
    if ask_yes_no('Write a deployment summary markdown file?', True):
        GITHUB_ENV_TEMPLATE.write_text(summary, encoding='utf-8')
        print(f'Wrote: {GITHUB_ENV_TEMPLATE}')

    print('\nDone.')
    print('Next steps:')
    print('1. Push your frontend changes and workflow updates.')
    print('2. In GitHub -> Settings -> Pages, set Source to GitHub Actions.')
    print('3. In GitHub -> Settings -> Secrets and variables -> Actions -> Variables, set:')
    print(f'   - FRONTEND_API_BASE={frontend_api_base}')
    print(f'   - FRONTEND_BACKEND_ENABLED={backend_enabled}')
    print('4. Configure real backend secrets only on the backend host, not in GitHub Pages.')


if __name__ == '__main__':
    main()
