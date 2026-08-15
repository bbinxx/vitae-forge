"""
backend/app.py — Resume Studio · FastAPI Application Entry Point
============================================================
All routers are registered here. Run via:
    uvicorn backend.app:app --host 127.0.0.1 --port 5050 --reload
"""
import os
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

app = FastAPI(
    title="Resume Studio",
    description="Resume management, building, and application tracking system.",
    version="7.0.0",
)

# ── Exception Handlers ─────────────────────────────────────────────────────────

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"ok": False, "detail": exc.detail, "error_type": "http_error", "code": exc.status_code}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = errors[0].get("msg") if errors else "Invalid request payload"
    field = ".".join([str(loc) for loc in errors[0].get("loc", [])]) if errors else ""
    detail = f"Validation Warning ({field}): {msg}" if field else f"Validation Warning: {msg}"
    return JSONResponse(
        status_code=422,
        content={"ok": False, "detail": detail, "errors": errors, "error_type": "validation_warning", "code": 422}
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"ok": False, "detail": f"Server Exception: {str(exc)}", "error_type": "server_error", "code": 500}
    )

@app.on_event("startup")
def startup_event():
    print("🚀 Resume Studio Starting Up...")
    from backend.db import db
    try:
        db.list_users()
        print("🔥 DB connected successfully! Cloud sync is ACTIVE.")
    except Exception as e:
        print(f"⚠️  DB connection error: {e}")

# ── Authentication Middleware ──────────────────────────────────────────────────

@app.middleware("http")
async def cookie_auth_middleware(request: Request, call_next):
    # 1. Extract Bearer token or cookie token if present
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    else:
        token = request.cookies.get("auth_token")

    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            request.state.user_id = payload.get("sub")
        except JWTError:
            pass

    # 2. Determine if strict authentication is required for this route
    passcode_hash = os.environ.get("PASSCODE_HASH")
    passcode = os.environ.get("PASSCODE")
    passcode_enabled = os.environ.get("PASSCODE_ENABLED", "true").lower() == "true"
    auth_required = os.environ.get("AUTH_REQUIRED", "false").lower() == "true"

    is_strict = (auth_required or (passcode_enabled and bool(passcode_hash or passcode)))

    if not is_strict:
        return await call_next(request)

    path = request.url.path
    is_public = (
        path.startswith("/api/auth/") or 
        path == "/api/preview-pdf" or 
        path.startswith("/assets/") or 
        path.startswith("/user-assets/") or 
        path.startswith("/share/") or 
        path.startswith("/pdf/") or
        path in {"/", "/login", "/favicon.ico"} or 
        path.startswith("/.well-known/")
    )

    if not is_public and not getattr(request.state, "user_id", None):
        is_api = (
            path.startswith("/api/") or
            "application/json" in request.headers.get("accept", "").lower() or
            request.headers.get("x-requested-with") == "XMLHttpRequest" or
            path in {"/list-files", "/get-config", "/applications", "/bookmarks", "/compile-direct", "/save-config", "/download-all-pdfs", "/download-workspace-archive", "/snapshot-resume"} or
            path.startswith("/bookmarks/") or path.startswith("/applications/") or path.startswith("/snapshot-resume/")
        )
        if is_api:
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

# ── React SPA Entry Points ──────────────────────────────────────────────────

_REACT_INDEX_FILE = ROOT / "frontend" / "dist" / "index.html"

@app.get("/login", response_class=HTMLResponse)
def login_page():
    if _REACT_INDEX_FILE.exists():
        return HTMLResponse(
            content=_REACT_INDEX_FILE.read_text(),
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"}
        )
    return HTMLResponse("<h1>Frontend not built. Run: cd frontend && npm run build</h1>", status_code=503)

@app.get("/{full_path:path}", response_class=HTMLResponse)
def serve_react_app(full_path: str):
    if _REACT_INDEX_FILE.exists():
        return HTMLResponse(
            content=_REACT_INDEX_FILE.read_text(),
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"}
        )
    return HTMLResponse("<h1>Frontend not built. Run: cd frontend && npm run build</h1>", status_code=503)
