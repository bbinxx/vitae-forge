"""
src/app.py — Resume Studio · FastAPI Application Entry Point
============================================================
All routers are registered here. Run via:
    uvicorn src.app:app --host 127.0.0.1 --port 5050 --reload
"""
import os
import json
import tempfile
import subprocess
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, Response, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from jose import jwt, JWTError

from src.core.config import (
    DIST_DIR, STATIC_DIR, ASSETS_DIR, ROOT, ensure_dirs, find_pdflatex, PROFILE_PHOTO,
)
from src.api.auth import SECRET_KEY, ALGORITHM
from src.services.resume_service import get_full_config

# Ensure required directories exist before mounting
ensure_dirs()

# ── Precomputed Paths ──────────────────────────────────────────────────────────
_LOGIN_FILE = ROOT / "templates" / "login.html"
_HTML_FILE  = ROOT / "templates" / "studio.html"

app = FastAPI(
    title="Resume Studio",
    description="Resume management, building, and application tracking system.",
    version="7.0.0",
)

@app.on_event("startup")
def startup_event():
    print("🚀 Resume Studio Starting Up...")
    # Trigger DB initialization
    from src.db import db
    try:
        # Just a ping to ensure initialization
        db.list_users()
        print("🔥 DB connected successfully! Cloud sync is ACTIVE.")
    except Exception as e:
        print(f"⚠️  DB connection error: {e}")

@app.middleware("http")
async def cookie_auth_middleware(request: Request, call_next):
    passcode_hash = os.environ.get("PASSCODE_HASH")
    passcode_enabled = os.environ.get("PASSCODE_ENABLED", "true").lower()
    if not passcode_hash or passcode_enabled == "false":
        return await call_next(request)
        
    path = request.url.path
    if (path.startswith("/api/auth/") or path == "/api/preview-pdf" or 
        path.startswith("/static/") or path.startswith("/share/") or 
        path.startswith("/pdf/") or
        path == "/" or path == "/login" or path == "/favicon.ico" or 
        path.startswith("/.well-known/")):
        return await call_next(request)
        
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    else:
        token = request.cookies.get("auth_token")

    if not token:
        # For API requests, return 401. For page requests, redirect.
        if path.startswith("/api/"):
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)
        return RedirectResponse("/login")
        
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        request.state.user_id = payload.get("sub")
    except JWTError:
        if path.startswith("/api/"):
            return JSONResponse({"detail": "Invalid or expired token"}, status_code=401)
        return RedirectResponse("/login")

    return await call_next(request)

# Ensure dist directory exists before mounting
DIST_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/pdf", StaticFiles(directory=str(DIST_DIR)), name="pdf")

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

ASSETS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

from src.api.auth import router as auth_router
from src.api.studio  import router as studio_router
from src.api.tracker import router as tracker_router
from src.api.library import router as library_router
from src.api.checkpoints import router as checkpoints_router

app.include_router(auth_router)
app.include_router(studio_router)
app.include_router(tracker_router)
app.include_router(library_router)
app.include_router(checkpoints_router)

# ── Live PDF Preview Endpoint ──────────────────────────────────────────────────

@app.post("/api/preview-pdf")
async def preview_pdf(request: Request):
    """Generate a temporary preview PDF from a JSON config (no file save)."""
    from src.core.config import TEMPLATE_PLAIN, TEMPLATE_PHOTO, TEMPLATE_COVER_LETTER

    try:
        body = await request.json()
        config = body.get("config", {})
        pdf_name = body.get("pdf_name", "preview.pdf")
        preview_type = body.get("type", "resume")
        include_photo = body.get("include_photo", False)

        if not config:
            raise HTTPException(400, "Missing 'config' in request body")

        # Need user_id for preview, try to get from header
        user_id = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                payload = jwt.decode(auth_header.split(" ")[1], SECRET_KEY, algorithms=[ALGORITHM])
                user_id = payload.get("sub")
            except JWTError:
                pass

        if not user_id:
            raise HTTPException(401, "Not authenticated")

        main_config = get_full_config(user_id)

        full_config = {
            "personal": main_config.get("personal", {}),
            "library": main_config.get("library", {}),
        }

        # Recursively merge library from custom config
        if "library" in config:
            for lib_type, lib_items in config.get("library", {}).items():
                if lib_type not in full_config["library"]:
                    full_config["library"][lib_type] = {}
                full_config["library"][lib_type].update(lib_items)

        # Merge everything else
        v_data = {k: v for k, v in config.items() if k != "library"}
        full_config.update(v_data)

        if preview_type == "cover_letter":
            template = TEMPLATE_COVER_LETTER
        elif include_photo:
            template = TEMPLATE_PHOTO
        else:
            template = TEMPLATE_PLAIN

        pdflatex_cmd = find_pdflatex()
        if not pdflatex_cmd:
            raise HTTPException(
                status_code=400,
                detail="LaTeX compiler 'pdflatex' not found on system. Please install TeX Live or compile downloaded TeX bundle in Overleaf."
            )

        from src.core.generate import generate_resume

        # All temp artefacts live in one directory so cleanup is complete.
        with tempfile.TemporaryDirectory(prefix="resume_preview_") as tmp_dir:
            tmp_dir_path = Path(tmp_dir)
            tmp_config_path = tmp_dir_path / "config.json"
            tmp_tex_path = tmp_dir_path / "resume.tex"

            with open(tmp_config_path, "w") as f:
                json.dump(full_config, f)

            generate_resume(
                str(tmp_config_path), str(template), str(tmp_tex_path),
                photo_path=str(PROFILE_PHOTO) if include_photo else None,
            )

            proc = subprocess.run(
                [pdflatex_cmd, "-interaction=nonstopmode", "-output-directory", tmp_dir, str(tmp_tex_path)],
                capture_output=True, timeout=30,
            )

            pdf_file = tmp_tex_path.with_suffix(".pdf")
            if not pdf_file.exists():
                detail = "PDF compilation failed."
                log = (tmp_tex_path.with_suffix(".log").read_text(errors="ignore") if tmp_tex_path.with_suffix(".log").exists() else "")
                if proc.returncode != 0 and log:
                    tail = "\n".join(l for l in log.splitlines()[-15:] if "error" in l.lower() or "!" in l)
                    detail = f"{detail} {tail}"
                raise HTTPException(500, detail)

            return Response(
                content=pdf_file.read_bytes(),
                media_type="application/pdf",
                headers={"Content-Disposition": f'inline; filename="{pdf_name}"'},
            )

    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON in request body")
    except Exception as e:
        print(f"Preview error: {e}")
        raise HTTPException(500, f"Preview generation failed: {str(e)}")

# ── UI Entry Point ────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def index():
    return _HTML_FILE.read_text()

@app.get("/login", response_class=HTMLResponse)
def login_page():
    return _LOGIN_FILE.read_text()
