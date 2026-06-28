#!/bin/bash
# Resume Studio — Start Script (EndeavourOS / Arch / Linux / macOS)
# Uses explicit venv/bin/python paths to avoid Arch PEP 668 + broken-venv issues.
set -euo pipefail
cd "$(dirname "$0")"

VENV_DIR="venv"
VENV_PYTHON="$VENV_DIR/bin/python"

# ── Resolve python3 ───────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "❌ python3 not found. Install via: sudo pacman -S python"
    exit 1
fi

SYS_PYTHON="$(command -v python3)"
SYS_VERSION="$($SYS_PYTHON --version 2>&1)"
echo "🐍 System Python: $SYS_VERSION"

SYS_VER=$($SYS_PYTHON -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")

# ── Detect stale venv (Python version mismatch) ───────────────────────────────
if [ -f "$VENV_DIR/pyvenv.cfg" ]; then
    VENV_VER=$(grep "^version" "$VENV_DIR/pyvenv.cfg" | cut -d' ' -f3 | cut -d'.' -f1-2)
    if [ "$VENV_VER" != "$SYS_VER" ]; then
        echo "⚠️  Venv was Python $VENV_VER but system is $SYS_VER — recreating venv..."
        rm -rf "$VENV_DIR"
    fi
fi

# ── Create venv if missing ────────────────────────────────────────────────────
if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Creating virtual environment (Python $SYS_VER)..."
    $SYS_PYTHON -m venv "$VENV_DIR"
fi

# ── Install deps via explicit venv Python (bypasses Arch PEP 668 entirely) ───
echo "⬆️  Upgrading pip..."
"$VENV_PYTHON" -m pip install --upgrade pip --quiet

echo "📦 Installing dependencies..."
"$VENV_PYTHON" -m pip install -r requirements.txt

# ── Load .env just before launching (keeps pip clean) ────────────────────────
if [ -f .env ]; then
    echo "🔑 Loading environment from .env..."
    set -a
    source .env
    set +a
fi

# ── Launch ────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "  🚀 Resume Studio  →  http://127.0.0.1:5050  "
echo "═══════════════════════════════════════════════"
echo ""

"$VENV_PYTHON" -m uvicorn src.app:app --host 127.0.0.1 --port 5050 --reload
