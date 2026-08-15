#!/bin/bash
# Resume Studio — Start Script (Dev & Prod mode with Log Tailing)
set -e
cd "$(dirname "$0")"

MODE="${1:-dev}" # Default to 'dev'. Use './run.sh prod' for production.

VENV_DIR="venv"
VENV_PYTHON="$VENV_DIR/bin/python"
LOG_DIR="logs"

# ── Setup Logs ────────────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"
FRONTEND_LOG="$LOG_DIR/frontend.log"
BACKEND_LOG="$LOG_DIR/backend.log"

> "$FRONTEND_LOG"
> "$BACKEND_LOG"

# ── Python Venv Setup ─────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "❌ python3 not found. Please install python3."
    exit 1
fi
SYS_PYTHON="$(command -v python3)"
SYS_VERSION="$($SYS_PYTHON --version 2>&1)"

if [ -f "$VENV_DIR/pyvenv.cfg" ]; then
    VENV_VER=$(grep "^version" "$VENV_DIR/pyvenv.cfg" | cut -d' ' -f3 | cut -d'.' -f1-2)
    SYS_VER=$($SYS_PYTHON -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    if [ "$VENV_VER" != "$SYS_VER" ]; then
        echo "⚠️  Venv Python version mismatch — recreating venv..."
        rm -rf "$VENV_DIR"
    fi
fi

if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Creating virtual environment ($SYS_VERSION)..."
    $SYS_PYTHON -m venv "$VENV_DIR"
fi

echo "📦 Verifying backend dependencies..."
"$VENV_PYTHON" -m pip install --upgrade pip --quiet
"$VENV_PYTHON" -m pip install -r requirements.txt --quiet

# ── Load .env ─────────────────────────────────────────────────────────────────
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# ── Process Cleanup Trap ──────────────────────────────────────────────────────
cleanup() {
    echo -e "\n🛑 Stopping all services..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup EXIT INT TERM

# ── Launch Modes ──────────────────────────────────────────────────────────────
if [ "$MODE" = "dev" ]; then
    echo "⚡ Starting in DEV mode (Single-Server)..."
    
    if command -v npm &>/dev/null && [ -d "frontend" ]; then
        if [ ! -d "frontend/node_modules" ]; then
            echo "📦 Installing React npm dependencies..."
            (cd frontend && npm install --silent)
        fi
        echo "⚛️  Starting React Auto-Builder (background)..."
        # --watch tells Vite to auto-rebuild to dist/ whenever React files change
        (cd frontend && npm run build -- --watch) > "$FRONTEND_LOG" 2>&1 &
    fi

    echo "🚀 Starting FastAPI Backend Server (background)..."
    "$VENV_PYTHON" -m uvicorn backend.app:app --host 127.0.0.1 --port 5050 --reload > "$BACKEND_LOG" 2>&1 &

else
    echo "🌟 Starting in PROD mode (Single-Server)..."
    
    if command -v npm &>/dev/null && [ -d "frontend" ]; then
        if [ ! -d "frontend/node_modules" ]; then
            echo "📦 Installing React npm dependencies..."
            (cd frontend && npm install --silent)
        fi
        echo "⚛️  Building React SPA bundle..."
        (cd frontend && npm run build) > "$FRONTEND_LOG" 2>&1
        echo "✅ React build complete."
    fi

    echo "🚀 Starting FastAPI Backend Server (background)..."
    "$VENV_PYTHON" -m uvicorn backend.app:app --host 127.0.0.1 --port 5050 > "$BACKEND_LOG" 2>&1 &
fi

# ── Console Dashboard ─────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  🚀 Resume Studio Single-Server →  http://127.0.0.1:5050"
echo "  👀 Streaming logs... Press Ctrl+C to stop."
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Tail logs infinitely
tail -f "$FRONTEND_LOG" "$BACKEND_LOG"
