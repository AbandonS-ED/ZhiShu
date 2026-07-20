"""ZhiShu SmartHub Frontend Launcher

Usage:
- Double-click SmartHub-Frontend.exe to start Next.js production server in standalone mode
- Listens on port 3000
- Auto-retries on port conflict (3000 -> 3001 -> ...)
- Auto-opens default browser after start

Build:
    pyinstaller --onefile --name SmartHub-Frontend frontend_launcher.py
    Then copy frontend/.next/standalone/ to the same directory as the exe
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
BASE_PORT = 3000
MAX_PORT_TRY = 10


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
    """PyInstaller bundle mode: exe is alongside .next/standalone/.
    Dev mode (python frontend_launcher.py): script dir is project root.
    """
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


def find_node() -> str:
    """Explicitly locate the node executable.

    PyInstaller bundle does NOT inherit system PATH, so subprocess.Popen
    cannot use ['node', ...] - we must pass the full path.
    """
    node = shutil.which("node")
    if node:
        return node

    candidates = [
        r"C:\Program Files\nodejs\node.exe",
        r"C:\Program Files (x86)\nodejs\node.exe",
        os.path.expandvars(r"%APPDATA%\nvm\v\current\node.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\nodejs\node.exe"),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c

    raise RuntimeError(
        "Node.js not found!\n"
        "  Please install Node.js 18+ and add to PATH: https://nodejs.org/\n"
        "  IMPORTANT: Check 'Add to PATH' during install"
    )


def main() -> int:
    _setup_windows_console_encoding()
    base = get_base_dir()
    standalone_dir = base / ".next" / "standalone"
    server_js = standalone_dir / "server.js"

    print("=" * 60)
    print("  ZhiShu SmartHub - Frontend Launcher v1.0")
    print("=" * 60)

    if not server_js.exists():
        print(f"[ERROR] Cannot find {server_js}")
        print("        Make sure .next/standalone/ was copied next to the exe")
        input("\nPress Enter to exit...")
        return 1

    try:
        node_path = find_node()
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
    env["PORT"] = str(port)
    env["HOSTNAME"] = HOST
    env["NODE_ENV"] = "production"

    print(f"[1/3] Node.js       {node_path}")
    print(f"[2/3] Starting      http://localhost:{port}")
    print(f"[3/3] Workdir       {standalone_dir}")
    print("-" * 60)
    print(f"  URL:           http://localhost:{port}")
    print(f"  Close window = stop service")
    print("=" * 60)

    process = subprocess.Popen(
        [node_path, str(server_js)],
        cwd=str(standalone_dir),
        env=env,
        stdout=None,
        stderr=None,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
    )

    time.sleep(4)

    if process.poll() is None:
        try:
            webbrowser.open(f"http://localhost:{port}")
        except Exception:
            pass
    else:
        print("[ERROR] Service failed to start. Check Node.js version (need 18+)")
        input("\nPress Enter to exit...")
        return 1

    try:
        process.wait()
    except KeyboardInterrupt:
        process.terminate()

    return 0


if __name__ == "__main__":
    sys.exit(main())