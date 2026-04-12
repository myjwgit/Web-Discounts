from getpass import getpass

from run_backend import ENV_FILE, info, load_dotenv, write_dotenv

DEFAULT_TEMPLATE = 'postgresql://postgres:[YOUR-PASSWORD]@db.nyckmjpyukgguimpmoww.supabase.co:5432/postgres'


def build_database_url(template: str, password: str) -> str:
    if '[YOUR-PASSWORD]' in template:
        return template.replace('[YOUR-PASSWORD]', password)
    marker = '://postgres:'
    if marker in template and '@' in template:
        left, right = template.split('@', 1)
        if left.endswith(':'):
            return f'{left}{password}@{right}'
    return template


def prompt_for_password() -> str:
    print('Password input modes:')
    print('1. Hidden input (recommended)')
    print('2. Visible paste mode')
    mode = input('Choose password input mode [1/2]: ').strip() or '1'

    if mode == '2':
        print('Paste the database password below. It will be visible on screen.')
        return input('Database password: ').strip()

    return getpass('Enter the database password: ').strip()


def main() -> None:
    dotenv_values = load_dotenv(ENV_FILE)
    template = (dotenv_values.get('DATABASE_URL') or DEFAULT_TEMPLATE).strip()

    print('Supabase/Postgres DATABASE_URL importer')
    print(f'Template: {template}')
    print('Press Enter to use the template above, or paste another DATABASE_URL template.')
    entered = input('DATABASE_URL template: ').strip()
    if entered:
        template = entered

    if '[YOUR-PASSWORD]' not in template:
        print('Template does not contain [YOUR-PASSWORD]. Password will be inserted only if the URL ends with postgres:@host style.')

    password = prompt_for_password()
    if not password:
        raise SystemExit('No password entered.')

    database_url = build_database_url(template, password)
    updates = {
        'DB_PROVIDER': 'postgres',
        'DB_SSL_MODE': 'require',
        'DATABASE_URL': database_url,
    }

    ENV_FILE.parent.mkdir(parents=True, exist_ok=True)
    write_dotenv(ENV_FILE, updates)
    info(f'Saved DATABASE_URL to {ENV_FILE}')
    print('DB_PROVIDER=postgres and DB_SSL_MODE=require were also written.')


if __name__ == '__main__':
    main()
