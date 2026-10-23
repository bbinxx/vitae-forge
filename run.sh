
#!/usr/bin/env bash
# Resume Studio — portable Linux launcher
# Usage: ./run.sh [dev|prod]

set -Eeuo pipefail
umask 027

# Always operate from the directory containing this script.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR"

MODE="${1:-dev}"
case "$MODE" in
    dev|prod) ;;
    *)
        echo "Usage: $0 [dev|prod]" >&2
        exit 2
        ;;
esac

# Refuse root execution to prevent root-owned project files.
if [[ "${EUID}" -eq 0 ]]; then
    echo "ERROR: Do not run this script with sudo." >&2
    echo "Run: ./run.sh ${MODE}" >&2
    exit 1
fi

# Configuration can be overridden through environment variables.
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-5050}"
PIP_TIMEOUT="${PIP_TIMEOUT:-180}"
PIP_RETRIES="${PIP_RETRIES:-10}"

VENV_DIR="${VENV_DIR:-$SCRIPT_DIR/venv}"
LOG_DIR="${LOG_DIR:-$SCRIPT_DIR/logs}"
VENV_PYTHON="$VENV_DIR/bin/python"

FRONTEND_DIR="$SCRIPT_DIR/frontend"
FRONTEND_LOG="$LOG_DIR/frontend.log"
BACKEND_LOG="$LOG_DIR/backend.log"

FRONTEND_PID=""
BACKEND_PID=""
TAIL_PID=""

info() { printf '\n[INFO] %s\n' "$*"; }
warn() { printf '\n[WARN] %s\n' "$*" >&2; }
die()  { printf '\n[ERROR] %s\n' "$*" >&2; exit 1; }

command -v python3 >/dev/null 2>&1 ||
    die "Python 3 is required. Install Python 3 and venv support."

SYS_PYTHON="$(command -v python3)"
SYS_VERSION="$("$SYS_PYTHON" -c \
    'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"

# Prepare logs without requiring elevated permissions.
mkdir -p "$LOG_DIR" ||
    die "Cannot create log directory: $LOG_DIR"

touch "$FRONTEND_LOG" "$BACKEND_LOG" ||
    die "Cannot write to log directory: $LOG_DIR"

# Avoid accidentally using a virtual environment created by another
# Python minor version.
if [[ -f "$VENV_DIR/pyvenv.cfg" ]]; then
    VENV_VERSION="$("$VENV_PYTHON" -c \
        'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' \
        2>/dev/null || true)"

    if [[ "$VENV_VERSION" != "$SYS_VERSION" ]]; then
        warn "Virtual environment Python version differs from system Python."
        warn "Recreating: $VENV_DIR"

        [[ -O "$VENV_DIR/pyvenv.cfg" ]] ||
            die "Virtual environment is not owned by the current user: $VENV_DIR"

        rm -rf -- "$VENV_DIR"
    fi
fi

# Create the virtual environment if required.
if [[ ! -x "$VENV_PYTHON" ]]; then
    info "Creating Python virtual environment using Python $SYS_VERSION"

    if ! "$SYS_PYTHON" -m venv "$VENV_DIR"; then
        die "Could not create venv. On Ubuntu/Debian, install python3-venv for your Python version."
    fi
fi

# Verify that the environment is usable.
"$VENV_PYTHON" -c 'import sys; print("Using:", sys.executable)' ||
    die "Python virtual environment is unusable."

[[ -f "$SCRIPT_DIR/requirements.txt" ]] ||
    die "requirements.txt not found in $SCRIPT_DIR"

# Don't upgrade pip on every launch. Retry slow or intermittent downloads.
info "Checking and installing Python dependencies..."

PIP_DISABLE_PIP_VERSION_CHECK=1 \
"$VENV_PYTHON" -m pip install \
    --disable-pip-version-check \
    --retries "$PIP_RETRIES" \
    --timeout "$PIP_TIMEOUT" \
    -r "$SCRIPT_DIR/requirements.txt" ||
    die "Python dependency installation failed. Check connectivity and pip output."

# Load application environment variables.
if [[ -f "$SCRIPT_DIR/.env" ]]; then
    info "Loading application environment from .env"
    set -a
    # .env is a shell file for this launcher; only load trusted files.
    source "$SCRIPT_DIR/.env"
    set +a
fi

# Track child processes and clean them up when the launcher exits.
cleanup() {
    local exit_code=$?
    trap - EXIT INT TERM

    info "Stopping Resume Studio..."

    for pid in "$TAIL_PID" "$FRONTEND_PID" "$BACKEND_PID"; do
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done

    for pid in "$TAIL_PID" "$FRONTEND_PID" "$BACKEND_PID"; do
        if [[ -n "$pid" ]]; then
            wait "$pid" 2>/dev/null || true
        fi
    done

    exit "$exit_code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Start the frontend if the project includes one.
if [[ -d "$FRONTEND_DIR" ]]; then
    if ! command -v npm >/dev/null 2>&1; then
        warn "npm is not installed; skipping frontend."
        warn "Install Node.js/npm to enable frontend builds."
    else
        if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
            info "Installing frontend dependencies..."

            if [[ -f "$FRONTEND_DIR/package-lock.json" ]]; then
                (cd "$FRONTEND_DIR" && npm ci) ||
                    die "npm ci failed."
            elif [[ -f "$FRONTEND_DIR/package.json" ]]; then
                (cd "$FRONTEND_DIR" && npm install) ||
                    die "npm install failed."
            else
                warn "No package.json found; skipping frontend."
            fi
        fi

        if [[ -f "$FRONTEND_DIR/package.json" ]]; then
            if [[ "$MODE" == "dev" ]]; then
                info "Starting frontend build watcher..."

                (
                    cd "$FRONTEND_DIR"
                    exec npm run build -- --watch
                ) >>"$FRONTEND_LOG" 2>&1 &
                FRONTEND_PID=$!
            else
                info "Building frontend for production..."

                (
                    cd "$FRONTEND_DIR"
                    npm run build
                ) >"$FRONTEND_LOG" 2>&1 ||
                    die "Frontend production build failed. See $FRONTEND_LOG"

                info "Frontend build completed."
            fi
        fi
    fi
fi

# Verify the application entry point before starting the backend.
[[ -f "$SCRIPT_DIR/backend/app.py" ]] ||
    die "backend/app.py not found; expected backend.app:app."

if [[ "$MODE" == "dev" ]]; then
    info "Starting FastAPI in development mode..."
    RELOAD_ARGS=(--reload)
else
    info "Starting FastAPI in production mode..."
    RELOAD_ARGS=()
fi

(
    cd "$SCRIPT_DIR"
    exec "$VENV_PYTHON" -m uvicorn backend.app:app \
        --host "$HOST" \
        --port "$PORT" \
        "${RELOAD_ARGS[@]}"
) >>"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

# Give the backend a moment to report immediate startup errors.
sleep 2

if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    tail -n 60 "$BACKEND_LOG" >&2
    die "Backend exited during startup. See $BACKEND_LOG"
fi

cat <<EOF

===============================================================
 Resume Studio
 Mode:       $MODE
 Backend:    http://$HOST:$PORT
 Backend log: $BACKEND_LOG
 Frontend log: $FRONTEND_LOG
===============================================================
 Press Ctrl+C to stop the services.
EOF

# Follow logs and detect if the backend exits unexpectedly.
tail -n 50 -F "$FRONTEND_LOG" "$BACKEND_LOG" &
TAIL_PID=$!

while kill -0 "$BACKEND_PID" 2>/dev/null; do
    sleep 2
done

warn "Backend process has stopped."
tail -n 60 "$BACKEND_LOG" >&2
exit 1
