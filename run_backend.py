import os
import re
import shutil
import socket
import subprocess
import sys
from getpass import getpass
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
SERVER_JS = BACKEND_DIR / "src" / "server.js"
ENV_FILE = BACKEND_DIR / ".env"
LOCK_FILE = BACKEND_DIR / "package-lock.json"
DEFAULT_PORT = "8080"


def fail(message: str, code: int = 1) -> None:
    print(f"[ERROR] {message}")
    raise SystemExit(code)


def info(message: str) -> None:
    print(f"[INFO] {message}")


def warn(message: str) -> None:
    print(f"[WARN] {message}")


def load_dotenv(path: Path) -> dict:
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


def write_dotenv(path: Path, updates: dict) -> None:
    existing_lines = []
    if path.exists():
        existing_lines = path.read_text(encoding="utf-8").splitlines()

    remaining = dict(updates)
    written_lines = []
    for raw_line in existing_lines:
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in raw_line:
            written_lines.append(raw_line)
            continue

        key, _value = raw_line.split("=", 1)
        key = key.strip()
        if key in remaining:
            written_lines.append(f"{key}={remaining.pop(key)}")
        else:
            written_lines.append(raw_line)

    for key, value in remaining.items():
        written_lines.append(f"{key}={value}")

    path.write_text("\n".join(written_lines).rstrip() + "\n", encoding="utf-8")


def parse_gemini_curl(raw: str):
    source = " ".join(raw.splitlines()).strip()
    if "generativelanguage.googleapis.com" not in source:
        return None

    key_match = re.search(r"X-goog-api-key:\s*([^\"'\s]+)", source, re.IGNORECASE)
    model_match = re.search(r"/models/([^:'\"\s]+)(?::generateContent)?", source, re.IGNORECASE)
    base_match = re.search(r"https://generativelanguage\.googleapis\.com/[^/\"'\s]+", source, re.IGNORECASE)

    return {
        "LLM_PROVIDER": "gemini",
        "LLM_API_KEY": key_match.group(1).strip() if key_match else "",
        "LLM_BASE_URL": (base_match.group(0).strip() if base_match else "https://generativelanguage.googleapis.com/v1beta").rstrip("/"),
        "LLM_MODEL": model_match.group(1).strip() if model_match else "gemini-2.0-flash",
        "LLM_GEMINI_CURL": raw.strip(),
    }


def build_env_updates(raw: str) -> dict:
    parsed = parse_gemini_curl(raw)
    if parsed:
        return parsed

    value = raw.strip()
    if not value:
        return {}

    return {"LLM_API_KEY": value}


def prompt_for_runtime_config() -> dict:
    if not sys.stdin.isatty():
        return {}

    print("[INFO] No backend LLM config was found in environment or .env.")
    first_line = input("LLM config is missing. Paste either the API key only, or the full Gemini curl command for this local session: ").strip()
    if not first_line:
        return {}

    if not first_line.lower().startswith("curl "):
        return {"LLM_API_KEY": first_line}

    print("[INFO] Detected curl input. Paste the remaining lines, then submit one empty line to finish.")
    lines = [first_line]
    while True:
        next_line = input()
        if not next_line.strip():
            break
        lines.append(next_line)

    parsed = parse_gemini_curl("\n".join(lines))
    return parsed or {}


def maybe_save_runtime_config(runtime_config: dict) -> None:
    if not runtime_config or not sys.stdin.isatty():
        return

    should_save = input("Save this LLM config into backend/.env for future runs? [y/N]: ").strip().lower()
    if should_save not in {"y", "yes"}:
        return

    ENV_FILE.parent.mkdir(parents=True, exist_ok=True)
    write_dotenv(ENV_FILE, {key: value for key, value in runtime_config.items() if value})
    info(f"Saved LLM config to {ENV_FILE}")


def database_url_needs_password(value: str) -> bool:
    normalized = (value or "").strip()
    if not normalized:
        return False
    return "[YOUR-PASSWORD]" in normalized or ":@db." in normalized or ":@localhost" in normalized


def inject_database_password(database_url: str, password: str) -> str:
    if not database_url or not password:
        return database_url
    if "[YOUR-PASSWORD]" in database_url:
        return database_url.replace("[YOUR-PASSWORD]", password)
    return re.sub(r":(?=@)", f":{password}", database_url, count=1)


def prompt_for_database_config(dotenv_values: dict) -> dict:
    if not sys.stdin.isatty():
        return {}

    provider = (os.environ.get("DB_PROVIDER") or dotenv_values.get("DB_PROVIDER") or "").strip().lower()
    database_url = os.environ.get("DATABASE_URL") or dotenv_values.get("DATABASE_URL") or ""
    if provider != "postgres" or not database_url_needs_password(database_url):
        return {}

    print("[INFO] Postgres database is configured, but the password is missing from DATABASE_URL.")
    password = getpass("Enter the Supabase/Postgres database password: ").strip()
    if not password:
        return {}

    updated_url = inject_database_password(database_url, password)
    updates = {"DATABASE_URL": updated_url}

    should_save = input("Save this DATABASE_URL into backend/.env for future runs? [y/N]: ").strip().lower()
    if should_save in {"y", "yes"}:
        ENV_FILE.parent.mkdir(parents=True, exist_ok=True)
        write_dotenv(ENV_FILE, updates)
        info(f"Saved DATABASE_URL to {ENV_FILE}")

    return updates


def resolve_command(env_name: str, candidates: list[str]) -> str:
    env_value = os.environ.get(env_name)
    if env_value:
        return env_value

    for candidate in candidates:
        resolved = shutil.which(candidate)
        if resolved:
            return resolved

    fail(f"Required command not found for {env_name}: tried {', '.join(candidates)}")
    return ""


def ensure_paths() -> None:
    if not BACKEND_DIR.exists():
        fail(f"Backend directory not found: {BACKEND_DIR}")
    if not SERVER_JS.exists():
        fail(f"Server file not found: {SERVER_JS}")
    if not LOCK_FILE.exists():
        fail(f"package-lock.json not found: {LOCK_FILE}")
    if not ENV_FILE.exists():
        warn(f".env not found at {ENV_FILE}")


def port_in_use(port: str) -> bool:
    try:
        port_number = int(port)
    except ValueError:
        return False

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(("127.0.0.1", port_number)) == 0


def run_checked(command, cwd=None, env=None) -> None:
    completed = subprocess.run(command, cwd=cwd, env=env)
    if completed.returncode != 0:
        raise SystemExit(completed.returncode)


def main() -> None:
    ensure_paths()

    node_cmd = resolve_command("NODE_CMD", ["node"])
    npm_cmd = resolve_command("NPM_CMD", ["npm"])

    dotenv_values = load_dotenv(ENV_FILE)
    port = os.environ.get("PORT") or dotenv_values.get("PORT") or DEFAULT_PORT
    if port_in_use(port):
        fail(f"Port {port} is already in use. Stop the existing process or change PORT in {ENV_FILE}.")

    info(f"Using Node: {node_cmd}")
    run_checked([node_cmd, "-v"])

    info(f"Using npm: {npm_cmd}")
    run_checked([npm_cmd, "-v"])

    runtime_config = {}
    env_key = os.environ.get("LLM_API_KEY") or dotenv_values.get("LLM_API_KEY", "")
    env_curl = os.environ.get("LLM_GEMINI_CURL") or dotenv_values.get("LLM_GEMINI_CURL", "")
    if env_curl:
        runtime_config = parse_gemini_curl(env_curl) or {}
    elif env_key:
        runtime_config = {"LLM_API_KEY": env_key}

    if not runtime_config.get("LLM_API_KEY"):
        runtime_config = prompt_for_runtime_config()
        if runtime_config.get("LLM_API_KEY"):
            maybe_save_runtime_config(runtime_config)

    database_runtime_config = prompt_for_database_config(dotenv_values)

    info("Installing backend dependencies with npm ci...")
    run_checked([npm_cmd, "ci"], cwd=str(BACKEND_DIR))

    child_env = os.environ.copy()
    for key, value in dotenv_values.items():
        child_env.setdefault(key, value)
    for key, value in runtime_config.items():
        if value:
            child_env[key] = value
    for key, value in database_runtime_config.items():
        if value:
            child_env[key] = value

    info("Starting backend server...")
    run_checked([node_cmd, str(SERVER_JS)], cwd=str(BACKEND_DIR), env=child_env)


if __name__ == "__main__":
    main()
