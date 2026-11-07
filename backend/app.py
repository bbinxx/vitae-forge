"""
backend/app.py — Vitae Forge · FastAPI Application Entry Point
=============================================================
All routers are registered here. Run via:
    uvicorn backend.app:app --host 127.0.0.1 --port 5050 --reload
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from jose import jwt, JWTError

from backend.core.config import DIST_DIR, ASSETS_DIR, ROOT, ensure_dirs
from backend.api.auth import SECRET_KEY, ALGORITHM, router as auth_router
from backend.api.studio import router as studio_router
from backend.api.tracker import router as tracker_router
from backend.api.library import router as library_router
from backend.api.checkpoints import router as checkpoints_router
from backend.api.preview import router as preview_router

# Ensure required output directories exist before mounting
ensure_dirs()

# ── Lifespan (replaces deprecated @app.on_event) ──────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown logic."""
    print("🚀 Vitae Forge starting up...")
    from backend.db import db
    try:
        db.list_users()
        print("🔥 DB connected successfully. Cloud sync is ACTIVE.")
    except Exception as exc:
        print(f"⚠️  DB connection warning: {exc}")
    yield
    # Shutdown — nothing to clean up currently


app = FastAPI(
    title="Vitae Forge",
    description="Resume management, building, and application tracking system.",
    version="7.0.0",
    lifespan=lifespan,
)

# ── Exception Handlers ─────────────────────────────────────────────────────────

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"ok": False, "detail": exc.detail, "error_type": "http_error", "code": exc.status_code},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = errors[0].get("msg") if errors else "Invalid request payload"
    field = ".".join(str(loc) for loc in errors[0].get("loc", [])) if errors else ""
    detail = f"Validation Warning ({field}): {msg}" if field else f"Validation Warning: {msg}"
    return JSONResponse(
        status_code=422,
        content={"ok": False, "detail": detail, "errors": errors, "error_type": "validation_warning", "code": 422},
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"ok": False, "detail": f"Server Exception: {str(exc)}", "error_type": "server_error", "code": 500},
    )

# ── Authentication Middleware ──────────────────────────────────────────────────

# Route prefixes that are always public (no auth required)
_PUBLIC_PREFIXES = (
    "/api/auth/",
    "/api/preview-pdf",
    "/assets/",
    "/user-assets/",
    "/share/",
    "/pdf/",
    "/.well-known/",
)
_PUBLIC_EXACT = {"/", "/login", "/favicon.ico"}

# Route prefixes/paths that should return JSON 401 (not redirect to /login)
_API_PREFIXES = (
    "/api/",
    "/applications",
    "/bookmarks",
    "/compile-direct",
    "/save-config",
    "/get-config",
    "/list-files",
    "/download-all-pdfs",
    "/download-workspace-archive",
    "/snapshot-resume",
)

@app.middleware("http")
async def cookie_auth_middleware(request: Request, call_next):
    # 1. Resolve token from Bearer header or cookie
    auth_header = request.headers.get("Authorization", "")
    token = (
        auth_header.split(" ", 1)[1]
        if auth_header.startswith("Bearer ")
        else request.cookies.get("auth_token")
    )

    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            request.state.user_id = payload.get("sub")
        except JWTError:
            pass  # Invalid token — treat as unauthenticated

    # 2. If auth is not enforced globally, pass through
    auth_required = os.environ.get("AUTH_REQUIRED", "false").lower() == "true"
    if not auth_required:
        return await call_next(request)

    path = request.url.path

    # 3. Check public routes
    is_public = path in _PUBLIC_EXACT or any(path.startswith(p) for p in _PUBLIC_PREFIXES)
    if is_public:
        return await call_next(request)

    # 4. Check authentication
    if not getattr(request.state, "user_id", None):
        is_api_request = (
            any(path.startswith(p) for p in _API_PREFIXES)
            or "application/json" in request.headers.get("accept", "").lower()
            or request.headers.get("x-requested-with") == "XMLHttpRequest"
        )
        if is_api_request:
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)
        return RedirectResponse("/login")

    return await call_next(request)

# ── Static File Mounts ─────────────────────────────────────────────────────────

DIST_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/pdf", StaticFiles(directory=str(DIST_DIR)), name="pdf")

ASSETS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/user-assets", StaticFiles(directory=str(ASSETS_DIR)), name="user_assets")

_REACT_DIST_DIR = ROOT / "frontend" / "dist"
_REACT_ASSETS_DIR = _REACT_DIST_DIR / "assets"
_REACT_ASSETS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/assets", StaticFiles(directory=str(_REACT_ASSETS_DIR)), name="react_assets")

# ── Router Registrations ───────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(preview_router)
app.include_router(studio_router)
app.include_router(tracker_router)
app.include_router(library_router)
app.include_router(checkpoints_router)

# ── React SPA Entry Points ─────────────────────────────────────────────────────

_REACT_INDEX_FILE = ROOT / "frontend" / "dist" / "index.html"

def _serve_spa() -> HTMLResponse:
    """Return the React SPA or a friendly error if not yet built."""
    if _REACT_INDEX_FILE.exists():
        return HTMLResponse(
            content=_REACT_INDEX_FILE.read_text(),
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
        )
    return HTMLResponse(
        "<h1>Frontend not built.</h1><p>Run: <code>cd frontend && npm run build</code></p>",
        status_code=503,
    )

@app.get("/login", response_class=HTMLResponse)
def login_page():
    return _serve_spa()

@app.get("/{full_path:path}", response_class=HTMLResponse)
def serve_react_app(full_path: str):
    return _serve_spa()
