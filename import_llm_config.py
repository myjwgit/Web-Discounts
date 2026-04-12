import sys

from run_backend import BACKEND_DIR, ENV_FILE, build_env_updates, info, write_dotenv


def read_multiline_input() -> str:
    if sys.stdin.isatty():
        print("Paste the Gemini curl command or API key. Submit one empty line to finish.")
        lines = []
        while True:
            try:
                line = input()
            except EOFError:
                break
            if not line.strip():
                break
            lines.append(line)
        return "\n".join(lines).strip()

    return sys.stdin.read().strip()


def main() -> None:
    raw = read_multiline_input()
    if not raw:
        raise SystemExit("No input provided.")

    updates = build_env_updates(raw)
    if not updates.get("LLM_API_KEY"):
        raise SystemExit("Could not parse a valid Gemini API key from the provided input.")

    BACKEND_DIR.mkdir(parents=True, exist_ok=True)
    write_dotenv(ENV_FILE, updates)
    info(f"Saved LLM config to {ENV_FILE}")


if __name__ == "__main__":
    main()
