@echo off
setlocal

set "ROOT=D:\codex\webdiscount"
set "UV_VENV=%ROOT%\.venv-launcher"
set "UV_PYTHON=%UV_VENV%\Scripts\python.exe"
set "LAUNCHER=%ROOT%\run_backend.py"

python -m uv --version >nul 2>nul
if errorlevel 1 (
  echo [INFO] uv not found in the current Python environment. Installing uv...
  python -m pip install uv
  if errorlevel 1 (
    echo [ERROR] Failed to install uv.
    exit /b 1
  )
)

if not exist "%LAUNCHER%" (
  echo [ERROR] Launcher not found: %LAUNCHER%
  exit /b 1
)

if not exist "%UV_PYTHON%" (
  echo [INFO] Creating isolated launcher environment with uv...
  python -m uv venv "%UV_VENV%"
  if errorlevel 1 (
    echo [ERROR] Failed to create uv virtual environment.
    exit /b 1
  )
)

echo [INFO] Using isolated Python: %UV_PYTHON%
"%UV_PYTHON%" --version
if errorlevel 1 exit /b 1

echo [INFO] Starting backend through Python launcher...
"%UV_PYTHON%" "%LAUNCHER%"
exit /b %ERRORLEVEL%
