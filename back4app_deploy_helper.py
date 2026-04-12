from pathlib import Path


ROOT = Path(__file__).resolve().parent
BACKEND_ENV = ROOT / "backend" / ".env"


def load_env_file(path: Path) -> dict:
    values = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()

    return values


def mask_secret(value: str) -> str:
    if not value:
        return "(not set)"
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}...{value[-4:]}"


def main() -> None:
    env_values = load_env_file(BACKEND_ENV)

    print("Back4App Backend Deployment Helper")
    print("=" * 36)
    print()
    print("Project paths:")
    print(f"- Workspace: {ROOT}")
    print(f"- Backend env: {BACKEND_ENV}")
    print()

    db_provider = env_values.get("DB_PROVIDER", "sqlite")
    database_url = env_values.get("DATABASE_URL", "")
    llm_provider = env_values.get("LLM_PROVIDER", "gemini")
    llm_api_key = env_values.get("LLM_API_KEY", "")

    print("Detected local backend config:")
    print(f"- DB_PROVIDER: {db_provider}")
    print(f"- DATABASE_URL: {mask_secret(database_url)}")
    print(f"- DB_SSL_MODE: {env_values.get('DB_SSL_MODE', '(not set)')}")
    print(f"- LLM_PROVIDER: {llm_provider}")
    print(f"- LLM_API_KEY: {mask_secret(llm_api_key)}")
    print(f"- LLM_MODEL: {env_values.get('LLM_MODEL', '(not set)')}")
    print(f"- PORT: {env_values.get('PORT', '8080')}")
    print(f"- CORS_ORIGIN: {env_values.get('CORS_ORIGIN', '(not set)')}")
    print()

    print("Back4App deployment steps:")
    print("1. Push this repository to GitHub.")
    print("2. In Back4App Containers, create a new app from the GitHub repository.")
    print("3. Set the app root or docker context to the backend directory if Back4App asks for it.")
    print("4. If using Docker, point Back4App to backend/Dockerfile.")
    print("5. Add the environment variables listed below in the Back4App dashboard.")
    print("6. Deploy, then open /api/health to confirm databaseProvider and llm settings.")
    print()

    print("Recommended Back4App environment variables:")
    print("PORT=8080")
    print(f"CORS_ORIGIN={env_values.get('CORS_ORIGIN', 'https://your-frontend-domain')}")
    print(f"DB_PROVIDER={db_provider}")
    if db_provider == "postgres":
        print("DATABASE_URL=<your-supabase-postgres-url>")
        print(f"DB_SSL_MODE={env_values.get('DB_SSL_MODE', 'require')}")
    else:
        print("DATABASE_URL=(leave empty for sqlite)")
        print("DB_SSL_MODE=require")
    print(f"LLM_PROVIDER={llm_provider}")
    print("LLM_API_KEY=<your-gemini-key>")
    print(f"LLM_BASE_URL={env_values.get('LLM_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta')}")
    print(f"LLM_MODEL={env_values.get('LLM_MODEL', 'gemini-flash-latest')}")
    print(f"LLM_TEMPERATURE={env_values.get('LLM_TEMPERATURE', '0.2')}")
    print(f"LLM_SYSTEM_PROMPT={env_values.get('LLM_SYSTEM_PROMPT', 'You are StudentHelper backend assistant.')}")
    print()

    print("Post-deploy checks:")
    print("1. Open https://<your-back4app-url>/api/health")
    print("2. Confirm:")
    print("   - ok = true")
    print("   - data.provider matches your target database")
    print("   - llm.hasApiKey = true")
    print("3. Test POST /api/recommend with a known query.")
    print("4. Update the frontend API base URL to the Back4App backend URL.")
    print()

    print("Important:")
    print("- Rotate any API keys or database passwords that were pasted into chat.")
    print("- Do not commit real secrets to the repository.")


if __name__ == "__main__":
    main()
