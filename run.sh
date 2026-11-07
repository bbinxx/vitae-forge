#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Vitae Forge — Universal Start Script
# Works on: Linux, macOS, WSL2, Render, Railway, any Debian/Ubuntu server
#
# Usage:
#   ./run.sh          → Development mode (hot-reload + Vite watch)
#   ./run.sh dev      → Same as above
#   ./run.sh prod     → Production mode (build once, no watcher)
#   ./run.sh build    → Build frontend only, no server
#   ./run.sh clean    → Remove venv + node_modules + logs + dist
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Resolve script directory (works even with symlinks) ───────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MODE="${1:-dev}"

# ── Colour helpers ─────────────────────────────────────────────────────────────
if [ -t 1 ] && command -v tput &>/dev/null && tput colors &>/dev/null; then
    C_RESET="$(tput sgr0)"
    C_RED="$(tput setaf 1)"
    C_GREEN="$(tput setaf 2)"
    C_YELLOW="$(tput setaf 3)"
    C_CYAN="$(tput setaf 6)"
    C_BOLD="$(tput bold)"
else
    C_RESET="" C_RED="" C_GREEN="" C_YELLOW="" C_CYAN="" C_BOLD=""
fi

info()    { echo "${C_CYAN}${C_BOLD}ℹ  $*${C_RESET}"; }
success() { echo "${C_GREEN}✅ $*${C_RESET}"; }
warn()    { echo "${C_YELLOW}⚠  $*${C_RESET}"; }
error()   { echo "${C_RED}❌ $*${C_RESET}" >&2; }
fatal()   { error "$*"; exit 1; }
step()    { echo "${C_BOLD}── $*${C_RESET}"; }

# ── Constants ─────────────────────────────────────────────────────────────────
VENV_DIR="venv"
VENV_PYTHON="$VENV_DIR/bin/python"
VENV_PIP="$VENV_DIR/bin/pip"
LOG_DIR="logs"
FRONTEND_LOG="$LOG_DIR/frontend.log"
BACKEND_LOG="$LOG_DIR/backend.log"
BACKEND_PORT="${PORT:-5050}"        # $PORT overrides (Render/Railway use it)
BACKEND_HOST="${HOST:-127.0.0.1}"   # 0.0.0.0 in container/cloud environments
MIN_PYTHON_MAJOR=3
MIN_PYTHON_MINOR=10
MIN_NODE_MAJOR=18

# ── Log setup ─────────────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"
> "$FRONTEND_LOG"
> "$BACKEND_LOG"

# ── Clean mode ────────────────────────────────────────────────────────────────
if [ "$MODE" = "clean" ]; then
    info "Cleaning build artefacts..."
    rm -rf "$VENV_DIR" frontend/node_modules frontend/dist "$LOG_DIR"
    success "Clean complete."
    exit 0
fi

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — Python environment
# ═══════════════════════════════════════════════════════════════════════════════
step "Python environment"

# Find a compatible Python interpreter (python3, python3.12, python3.11, etc.)
find_python() {
    local candidates=(python3 python3.13 python3.12 python3.11 python3.10 python)
    for cmd in "${candidates[@]}"; do
        if command -v "$cmd" &>/dev/null; then
            local major minor
            major=$("$cmd" -c "import sys; print(sys.version_info.major)" 2>/dev/null) || continue
            minor=$("$cmd" -c "import sys; print(sys.version_info.minor)" 2>/dev/null) || continue
            if [ "$major" -ge "$MIN_PYTHON_MAJOR" ] && [ "$minor" -ge "$MIN_PYTHON_MINOR" ]; then
                echo "$cmd"
                return 0
            fi
        fi
    done
    return 1
}

SYS_PYTHON=$(find_python) || fatal "Python ${MIN_PYTHON_MAJOR}.${MIN_PYTHON_MINOR}+ not found.
Install it via:
  Ubuntu/Debian : sudo apt install python3.11
  macOS         : brew install python@3.11
  Arch          : sudo pacman -S python"

SYS_VER=$("$SYS_PYTHON" -c "import sys; v=sys.version_info; print(f'{v.major}.{v.minor}')")
info "Using Python $SYS_VER ($SYS_PYTHON)"

# Recreate venv if Python version changed or venv is missing/corrupt
should_recreate_venv() {
    [ ! -d "$VENV_DIR" ] && return 0
    [ ! -f "$VENV_DIR/pyvenv.cfg" ] && return 0
    [ ! -f "$VENV_PYTHON" ] && return 0
    local venv_ver
    venv_ver=$("$VENV_PYTHON" -c "import sys; v=sys.version_info; print(f'{v.major}.{v.minor}')" 2>/dev/null) || return 0
    [ "$venv_ver" != "$SYS_VER" ] && return 0
    return 1
}

if should_recreate_venv; then
    if [ -d "$VENV_DIR" ]; then
        warn "Venv Python version mismatch — recreating..."
        rm -rf "$VENV_DIR"
    else
        info "Creating virtual environment..."
    fi
    "$SYS_PYTHON" -m venv "$VENV_DIR" || fatal "Failed to create virtual environment."
    success "Virtual environment created (Python $SYS_VER)"
fi

# Upgrade pip silently and install dependencies
info "Verifying Python dependencies..."
"$VENV_PIP" install --upgrade pip --quiet --disable-pip-version-check

if [ -f requirements.txt ]; then
    # Use --no-deps on subsequent installs to speed up; full install handles new deps
    "$VENV_PIP" install -r requirements.txt --quiet --disable-pip-version-check \
        || fatal "pip install failed. Check requirements.txt and your internet connection."
    success "Python dependencies OK"
else
    warn "requirements.txt not found — skipping Python dependency install."
fi

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — Environment variables
# ═══════════════════════════════════════════════════════════════════════════════
step "Environment"

if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
    info "Loaded .env"
else
    warn ".env file not found — using system environment variables only."
    info "Tip: Copy .env.example to .env and fill in your values."
fi

# Auto-detect cloud environment → bind to 0.0.0.0
if [ -n "${RENDER:-}" ] || [ -n "${RAILWAY_ENVIRONMENT:-}" ] || [ -n "${HEROKU_APP_NAME:-}" ]; then
    BACKEND_HOST="0.0.0.0"
    info "Cloud environment detected → host set to 0.0.0.0"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — Node / Frontend
# ═══════════════════════════════════════════════════════════════════════════════
HAS_FRONTEND=false
HAS_NPM=false

if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
    HAS_FRONTEND=true

    if command -v npm &>/dev/null; then
        NODE_VER=$(node --version 2>/dev/null | sed 's/v//' | cut -d'.' -f1)
        if [ -n "$NODE_VER" ] && [ "$NODE_VER" -ge "$MIN_NODE_MAJOR" ] 2>/dev/null; then
            HAS_NPM=true
        else
            warn "Node.js ${MIN_NODE_MAJOR}+ required (found v${NODE_VER:-?}). Frontend will not be built."
            warn "Install: https://nodejs.org  or  nvm install --lts"
        fi
    else
        warn "npm not found. Frontend will not be built."
        warn "Install Node.js ${MIN_NODE_MAJOR}+: https://nodejs.org"
    fi
fi

install_npm_deps() {
    if $HAS_NPM && $HAS_FRONTEND; then
        if [ ! -d "frontend/node_modules" ] || [ "frontend/package.json" -nt "frontend/node_modules/.package-lock.json" ] 2>/dev/null; then
            step "Installing Node dependencies..."
            # Use ci if lock file exists (faster, reproducible), install otherwise
            if [ -f "frontend/package-lock.json" ]; then
                (cd frontend && npm ci --silent) \
                    || (warn "npm ci failed — falling back to npm install" && cd frontend && npm install --silent)
            else
                (cd frontend && npm install --silent)
            fi
            success "Node dependencies installed"
        else
            info "Node dependencies up-to-date"
        fi
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — Port conflict check
# ═══════════════════════════════════════════════════════════════════════════════
check_port() {
    local port="$1"
    if command -v lsof &>/dev/null; then
        if lsof -iTCP:"$port" -sTCP:LISTEN -t &>/dev/null; then
            warn "Port $port is already in use."
            warn "Kill the process with:  lsof -ti:$port | xargs kill -9"
            fatal "Cannot start — port $port occupied."
        fi
    elif command -v ss &>/dev/null; then
        if ss -tlnp | grep -q ":$port "; then
            fatal "Port $port is already in use."
        fi
    fi
    # If neither tool is available, skip check silently
}

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — Process cleanup
# ═══════════════════════════════════════════════════════════════════════════════
cleanup() {
    local exit_code=$?
    echo ""
    info "Stopping all services..."
    # Kill all background jobs spawned by this script
    jobs -p 2>/dev/null | xargs -r kill 2>/dev/null || true
    wait 2>/dev/null || true
    if [ $exit_code -eq 0 ]; then
        success "Shutdown complete."
    fi
}
trap cleanup EXIT INT TERM

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — Build-only mode
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$MODE" = "build" ]; then
    install_npm_deps
    if $HAS_NPM && $HAS_FRONTEND; then
        step "Building React SPA..."
        (cd frontend && npm run build) && success "Frontend build complete." \
            || fatal "Frontend build failed. See output above."
    else
        warn "Frontend not available — nothing to build."
    fi
    exit 0
fi

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 7 — DEV mode
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$MODE" = "dev" ]; then
    check_port "$BACKEND_PORT"
    install_npm_deps

    if $HAS_NPM && $HAS_FRONTEND; then
        step "Starting React Vite watcher (background)..."
        (cd frontend && npm run build -- --watch) > "$FRONTEND_LOG" 2>&1 &
        FRONTEND_PID=$!
        info "React watcher PID: $FRONTEND_PID  →  tail $FRONTEND_LOG"
    fi

    step "Starting FastAPI dev server (hot-reload)..."
    "$VENV_PYTHON" -m uvicorn backend.app:app \
        --host "$BACKEND_HOST" \
        --port "$BACKEND_PORT" \
        --reload \
        --reload-dir backend \
        --log-level info \
        > "$BACKEND_LOG" 2>&1 &
    BACKEND_PID=$!
    info "Backend PID: $BACKEND_PID  →  tail $BACKEND_LOG"

    # Wait briefly to catch immediate crashes
    sleep 2
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        error "Backend failed to start. Last 20 lines of log:"
        tail -20 "$BACKEND_LOG" >&2
        exit 1
    fi

    echo ""
    echo "${C_BOLD}═══════════════════════════════════════════════════════${C_RESET}"
    echo "  ${C_GREEN}${C_BOLD}🚀 Vitae Forge (DEV)${C_RESET}  →  ${C_CYAN}http://${BACKEND_HOST}:${BACKEND_PORT}${C_RESET}"
    echo "  ${C_YELLOW}Hot-reload active. Ctrl+C to stop.${C_RESET}"
    echo "${C_BOLD}═══════════════════════════════════════════════════════${C_RESET}"
    echo ""

    tail -n 0 -f "$BACKEND_LOG" "$FRONTEND_LOG"
    exit 0
fi

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 8 — PROD mode
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$MODE" = "prod" ]; then
    install_npm_deps

    if $HAS_NPM && $HAS_FRONTEND; then
        step "Building React SPA (production)..."
        (cd frontend && npm run build) > "$FRONTEND_LOG" 2>&1 \
            || { error "Frontend build failed:"; tail -20 "$FRONTEND_LOG" >&2; exit 1; }
        success "Frontend build complete."
    fi

    check_port "$BACKEND_PORT"

    step "Starting FastAPI production server..."
    # Workers: use $WEB_CONCURRENCY (Heroku/Render convention) or 2×CPU+1 heuristic
    WORKERS="${WEB_CONCURRENCY:-}"
    if [ -z "$WORKERS" ]; then
        if command -v nproc &>/dev/null; then
            WORKERS=$(( $(nproc) * 2 + 1 ))
        elif command -v sysctl &>/dev/null; then
            WORKERS=$(( $(sysctl -n hw.ncpu 2>/dev/null || echo 2) * 2 + 1 ))
        else
            WORKERS=3
        fi
    fi
    # Cap at 8 to avoid runaway on large machines
    [ "$WORKERS" -gt 8 ] && WORKERS=8
    info "Workers: $WORKERS"

    # Use gunicorn + uvicorn workers if available (recommended for prod)
    if "$VENV_PYTHON" -c "import gunicorn" 2>/dev/null; then
        "$VENV_DIR/bin/gunicorn" backend.app:app \
            --worker-class uvicorn.workers.UvicornWorker \
            --workers "$WORKERS" \
            --bind "${BACKEND_HOST}:${BACKEND_PORT}" \
            --timeout 120 \
            --graceful-timeout 30 \
            --access-logfile - \
            --error-logfile - \
            > "$BACKEND_LOG" 2>&1 &
    else
        # Fallback to uvicorn directly
        warn "gunicorn not installed — using uvicorn (single process)."
        warn "For production, add 'gunicorn' to requirements.txt."
        "$VENV_PYTHON" -m uvicorn backend.app:app \
            --host "$BACKEND_HOST" \
            --port "$BACKEND_PORT" \
            --workers "$WORKERS" \
            > "$BACKEND_LOG" 2>&1 &
    fi
    BACKEND_PID=$!

    sleep 2
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        error "Backend failed to start. Last 20 lines of log:"
        tail -20 "$BACKEND_LOG" >&2
        exit 1
    fi

    echo ""
    echo "${C_BOLD}═══════════════════════════════════════════════════════${C_RESET}"
    echo "  ${C_GREEN}${C_BOLD}🌟 Vitae Forge (PROD)${C_RESET}  →  ${C_CYAN}http://${BACKEND_HOST}:${BACKEND_PORT}${C_RESET}"
    echo "  Workers: $WORKERS  |  Ctrl+C to stop."
    echo "${C_BOLD}═══════════════════════════════════════════════════════${C_RESET}"
    echo ""

    tail -n 0 -f "$BACKEND_LOG"
    exit 0
fi

# ── Unknown mode ───────────────────────────────────────────────────────────────
fatal "Unknown mode: '$MODE'. Valid modes: dev | prod | build | clean"
