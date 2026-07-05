"""
src/app.py — Vitae Forge · FastAPI Application Entry Point
==========================================================
All routers are registered here. Run via:
    uvicorn src.app:app --host 127.0.0.1 --port 5050 --reload
"""
import os
import json
import subprocess
import tempfile
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from jose import jwt, JWTError

from src.core.config import DIST_DIR, STATIC_DIR, ROOT, ensure_dirs, find_pdflatex
from src.api.auth import SECRET_KEY, ALGORITHM
from src.services.resume_service import get_full_config

# Ensure required directories exist before mounting
ensure_dirs()

# ── Precomputed Paths ──────────────────────────────────────────────────────────
_LOGIN_FILE = ROOT / "templates" / "login.html"
_HTML_FILE  = ROOT / "templates" / "studio.html"


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Vitae Forge Starting Up...")
    from src.db import db
    try:
        db.list_users()
        print("DB connected successfully. Cloud sync is ACTIVE.")
    except Exception as e:
        print(f"DB connection error: {e}")
    yield
    print("Vitae Forge Shutting Down.")


app = FastAPI(
    title="Vitae Forge",
    description="Multi-tenant LaTeX resume builder and job application tracker.",
    version="2.2.0",
    lifespan=lifespan,
)

@app.middleware("http")
async def cookie_auth_middleware(request: Request, call_next):
    path = request.url.path
    if path.startswith("/static/") or path.startswith("/.well-known"):
        return await call_next(request)

    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    elif request.query_params.get("token"):
        token = request.query_params.get("token")

    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            request.state.user_id = payload.get("sub")
        except JWTError:
            pass

    passcode_hash = os.environ.get("PASSCODE_HASH")
    passcode_enabled = os.environ.get("PASSCODE_ENABLED", "true").lower()

    if path in ("/api/auth/login", "/api/auth/register", "/health", "/manifest.json", "/sw.js") or path == "/api/preview-pdf" or path.startswith("/share/") or path == "/" or path == "/login":
        return await call_next(request)

    if not passcode_hash or passcode_enabled == "false":
        return await call_next(request)

    if getattr(request.state, "user_id", None):
        return await call_next(request)

    return Response(content="Unauthorized", status_code=401)

# ── Static mounts ─────────────────────────────────────────────────────────────
if DIST_DIR.exists():
    app.mount("/pdf", StaticFiles(directory=str(DIST_DIR)), name="pdf")

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

from src.api.auth import router as auth_router
from src.api.studio  import router as studio_router
from src.api.tracker import router as tracker_router
from src.api.library import router as library_router

app.include_router(auth_router)
app.include_router(studio_router)
app.include_router(tracker_router)
app.include_router(library_router)

# ── Live PDF Preview Endpoint ──────────────────────────────────────────────────

@app.post("/api/preview-pdf")
async def preview_pdf(request: Request):
    """Generate a temporary preview PDF from a JSON config (no file save)."""
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
            
        from src.core.config import TEMPLATE_PLAIN, TEMPLATE_PHOTO, TEMPLATE_COVER_LETTER
        
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
        
        pdf_bytes = None

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp = Path(tmp_dir)
            tmp_config_path = tmp / "config.json"
            with open(tmp_config_path, "w") as f:
                json.dump(full_config, f)

            template_content = body.get("template_content")

            if template_content:
                tmp_tpl_path = tmp / "custom_template.tex"
                tmp_tpl_path.write_text(template_content)
                template = tmp_tpl_path
            else:
                if preview_type == "cover_letter":
                    template = TEMPLATE_COVER_LETTER
                elif include_photo:
                    template = TEMPLATE_PHOTO
                else:
                    template = TEMPLATE_PLAIN

            from src.core.config import PROFILE_PHOTO
            if include_photo and not PROFILE_PHOTO.exists():
                try:
                    from src.core.upload import get_r2_client, BUCKET
                    client = get_r2_client()
                    if client:
                        import io
                        buf = io.BytesIO()
                        client.download_fileobj(BUCKET, "profile-photo.jpg", buf)
                        PROFILE_PHOTO.parent.mkdir(parents=True, exist_ok=True)
                        PROFILE_PHOTO.write_bytes(buf.getvalue())
                except Exception:
                    pass

            photo_path = str(PROFILE_PHOTO) if (include_photo and PROFILE_PHOTO.exists()) else None

            from src.core.generate import generate_resume

            tmp_tex_path = tmp / "output.tex"
            generate_resume(str(tmp_config_path), str(template), str(tmp_tex_path), photo_path=photo_path)

            pdflatex_cmd = find_pdflatex()
            if not pdflatex_cmd:
                raise HTTPException(
                    status_code=400,
                    detail="LaTeX compiler 'pdflatex' not found on system. Please install TeX Live or compile downloaded TeX bundle in Overleaf."
                )

            pdf_file = tmp / "output.pdf"
            subprocess.run(
                [pdflatex_cmd, "-interaction=nonstopmode", "-output-directory", str(tmp), "output.tex"],
                cwd=str(tmp), capture_output=True, timeout=30
            )

            if not pdf_file.exists():
                raise HTTPException(500, "PDF generation failed — no output file produced.")

            pdf_bytes = pdf_file.read_bytes()
            # Temp dir is auto-cleaned on exit from context manager

        if pdf_bytes:
            from fastapi.responses import Response
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"inline; filename={pdf_name}"}
            )
        raise HTTPException(500, "PDF generation failed.")
    
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON in request body")
    except Exception as e:
        print(f"Preview error: {e}")
        raise HTTPException(500, f"Preview generation failed: {str(e)}")

# ── Health & UI Entry Points ────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    """Simple health check endpoint for cloud platform probes."""
    return {"status": "ok", "version": "2.2.0"}

@app.get("/manifest.json")
def get_manifest():
    return FileResponse(STATIC_DIR / "manifest.json", media_type="application/manifest+json")

@app.get("/sw.js")
def get_sw():
    return FileResponse(STATIC_DIR / "sw.js", media_type="application/javascript")

@app.get("/", response_class=HTMLResponse)
def index():
    html = _HTML_FILE.read_text()
    
    # Preload data for instant render - disabled or handled via API
    try:
        script = f"<script>window.__PRELOADED_APPS__ = []; window.__PRELOADED_FILES__ = [];</script>"
        html = html.replace("</head>", f"{script}\n</head>")
    except Exception as e:
        print(f"Preload error: {e}")
        
    return html

@app.get("/login", response_class=HTMLResponse)
def login_page():
    return _LOGIN_FILE.read_text()
