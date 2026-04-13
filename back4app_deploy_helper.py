from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_ENV = ROOT / "backend" / ".env"
BACKEND_DOCKERFILE = ROOT / "backend" / "Dockerfile"
FRONTEND_DIR = ROOT / "FrontEnd" / "html"


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

    print("Back4App Full Web App Deployment Helper")
    print("=" * 41)
    print()
    print("Project paths:")
    print(f"- Workspace: {ROOT}")
    print(f"- Backend env: {BACKEND_ENV}")
    print(f"- Backend Dockerfile: {BACKEND_DOCKERFILE}")
    print(f"- Root Dockerfile: {ROOT / 'Dockerfile'}")
    print(f"- Frontend directory: {FRONTEND_DIR}")
    print()

    db_provider = env_values.get("DB_PROVIDER", "sqlite")
    database_url = env_values.get("DATABASE_URL", "")
    llm_provider = env_values.get("LLM_PROVIDER", "gemini")
    llm_api_key = env_values.get("LLM_API_KEY", "")

    print("Detected local config:")
    print(f"- SERVE_FRONTEND: {env_values.get('SERVE_FRONTEND', 'true')}")
    print(f"- DB_PROVIDER: {db_provider}")
    print(f"- DATABASE_URL: {mask_secret(database_url)}")
    print(f"- DB_SSL_MODE: {env_values.get('DB_SSL_MODE', '(not set)')}")
    print(f"- LLM_PROVIDER: {llm_provider}")
    print(f"- LLM_API_KEY: {mask_secret(llm_api_key)}")
    print(f"- LLM_MODEL: {env_values.get('LLM_MODEL', '(not set)')}")
    print(f"- PORT: {env_values.get('PORT', '8080')}")
    print(f"- CORS_ORIGIN: {env_values.get('CORS_ORIGIN', '(not set)')}")
    print()

    print("Back4App combined deployment steps:")
    print("1. Push this repository to GitHub.")
    print("2. In Back4App Containers, create a new app from the GitHub repository.")
    print("3. If Back4App only gives you a Root directory option, set it to the repository root.")
    print("4. Use the repository-root Dockerfile for combined frontend+backend deployment.")
    print("5. The container will serve both the Node backend and FrontEnd/html as one web app.")
    print("6. Add the environment variables listed below in the Back4App dashboard.")
    print("7. Deploy, then open /api/health and the root URL to verify both API and frontend.")
    print()

    print("Recommended Back4App environment variables:")
    print("PORT=8080")
    print("SERVE_FRONTEND=true")
    print(f"CORS_ORIGIN={env_values.get('CORS_ORIGIN', 'https://your-back4app-domain')}")
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
    print(f"LLM_MODEL={env_values.get('LLM_MODEL', 'gemini-2.0-flash')}")
    print(f"LLM_TEMPERATURE={env_values.get('LLM_TEMPERATURE', '0.2')}")
    print(f"LLM_SYSTEM_PROMPT={env_values.get('LLM_SYSTEM_PROMPT', 'You are StudentHelper backend assistant.')}")
    print(f"ADMIN_REVIEW_PASSWORD={env_values.get('ADMIN_REVIEW_PASSWORD', '<set-one>')}")
    print()

    print("Expected app behavior after deploy:")
    print("- GET / serves the frontend")
    print("- GET /api/health serves backend health")
    print("- Frontend calls same-origin /api endpoints automatically when studenthelper-api-base is empty or still points to localhost")
    print()
    print("Frontend config for combined Back4App deployment:")
    print("- studenthelper-backend-enabled = true")
    print("- studenthelper-api-base = (leave empty, or use the same Back4App origin)")
    print()

    print("Post-deploy checks:")
    print("1. Open https://<your-back4app-url>/")
    print("2. Confirm the StudentHelper homepage loads")
    print("3. Open https://<your-back4app-url>/api/health")
    print("4. Confirm ok = true, hasApiKey = true, and databaseProvider is correct")
    print("5. Test submit flow and AI endpoints")
    print()

    print("Important:")
    print("- Rotate any API keys or database passwords that were pasted into chat.")
    print("- Do not commit real secrets to the repository.")


if __name__ == "__main__":
    main()
