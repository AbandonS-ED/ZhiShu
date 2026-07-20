"""ZhiShu SmartHub Backend Launcher

Usage:
- Double-click SmartHub-Backend.exe to start FastAPI production service (uvicorn)
- Listens on port 8001
- Auto-detects Python environment + auto-installs missing dependencies via pip
- Loads .env from the same directory
- Auto-retries on port conflict (8001 -> 8002 -> ...)

Build:
    pyinstaller --onefile --name SmartHub-Backend backend_launcher.py
    Then copy backend/app/ source + backend/.env to the same directory as the exe
"""

import os
import shutil
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

HOST = "0.0.0.0"
BASE_PORT = 8001
MAX_PORT_TRY = 10

REQUIRED_PKGS = [
    "fastapi",
    "uvicorn",
    "sqlalchemy",
    "asyncpg",
    "redis",
    "pydantic",
    "pydantic-settings",
    "langgraph",
    "langchain",
    "httpx",
    "psycopg2-binary",
    "bcrypt",
    "psutil",
    "python-dotenv",
]


def _setup_windows_console_encoding() -> None:
    """Force Windows console to UTF-8 so Chinese prints correctly."""
    if sys.platform == "win32":
        try:
            import ctypes
            ctypes.windll.kernel32.SetConsoleOutputCP(65001)
            ctypes.windll.kernel32.SetConsoleCP(65001)
        except Exception:
            os.system("chcp 65001 >nul 2>&1")


def get_base_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def find_free_port(start: int = BASE_PORT, max_try: int = MAX_PORT_TRY) -> int:
    for port in range(start, start + max_try):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((HOST, port))
                return port
            except OSError:
                continue
    raise RuntimeError(
        f"Ports {start}-{start + max_try - 1} all occupied. "
        f"Please close the occupying process and retry."
    )


def find_python() -> str:
    py = shutil.which("python")
    if py:
        return py
    py = shutil.which("py")
    if py:
        return py
    raise RuntimeError(
        "Python not found!\n"
        "  Please install Python 3.11+ and add to PATH: https://www.python.org/\n"
        "  IMPORTANT: Check 'Add Python to PATH' during install"
    )


def check_and_install_deps(python: str) -> None:
    """Check core deps; install missing ones via Tsinghua mirror."""
    print("[Check] Verifying dependencies...")
    missing = []
    for pkg in REQUIRED_PKGS:
        mod_name = pkg.split("[")[0].replace("-", "_")
        try:
            subprocess.run(
                [python, "-c", f"import {mod_name}"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=10,
            )
        except Exception:
            missing.append(pkg)

    if not missing:
        print("[Check] All dependencies present")
        return

    print(f"[Check] Missing {len(missing)} deps: {', '.join(missing)}")
    print("[Check] Installing via Tsinghua mirror (~1-3 min)...")

    cmd = [
        python, "-m", "pip", "install",
        "-i", "https://pypi.tuna.tsinghua.edu.cn/simple",
        "--disable-pip-version-check",
        *missing,
    ]
    result = subprocess.run(cmd, cwd=str(get_base_dir()))
    if result.returncode != 0:
        raise RuntimeError(
            f"Dependency install failed (exit code {result.returncode}). "
            f"Please check network and retry."
        )

    print("[Check] Dependencies installed")


def main() -> int:
    _setup_windows_console_encoding()
    base = get_base_dir()
    app_dir = base / "app"
    env_file = base / ".env"

    print("=" * 60)
    print("  ZhiShu SmartHub - Backend Launcher v1.0")
    print("=" * 60)

    if not app_dir.is_dir():
        print(f"[ERROR] Cannot find {app_dir}")
        print("        Make sure backend/app/ was copied next to the exe")
        input("\nPress Enter to exit...")
        return 1

    if not env_file.is_file():
        print(f"[WARN] .env not found: {env_file}")
        print("       Using default config (MiMo v2.5 + async DB)")

    try:
        python = find_python()
    except RuntimeError as e:
        print(f"[ERROR] {e}")
        input("\nPress Enter to exit...")
        return 1

    try:
        check_and_install_deps(python)
    except RuntimeError as e:
        print(f"[ERROR] {e}")
        input("\nPress Enter to exit...")
        return 1

    try:
        port = find_free_port()
    except RuntimeError as e:
        print(f"[ERROR] {e}")
        input("\nPress Enter to exit...")
        return 1

    env = os.environ.copy()
    env["PYTHONPATH"] = str(base) + os.pathsep + env.get("PYTHONPATH", "")

    cmd = [
        python, "-m", "uvicorn",
        "app.main:app",
        "--host", HOST,
        "--port", str(port),
    ]

    print(f"[1/3] Python         {python}")
    print(f"[2/3] Workdir        {base}")
    print(f"[3/3] Listening on   http://localhost:{port}")
    print(f"        Swagger UI:  http://localhost:{port}/docs")
    print("-" * 60)
    print(f"  Close window = stop service")
    print("=" * 60)

    process = subprocess.Popen(
        cmd,
        cwd=str(base),
        env=env,
        stdout=None,
        stderr=None,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
    )

    try:
        process.wait()
    except KeyboardInterrupt:
        process.terminate()

    return 0


if __name__ == "__main__":
    sys.exit(main())