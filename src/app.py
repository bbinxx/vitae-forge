"""
src/app.py — Vitae Forge · FastAPI Application Entry Point
==========================================================
All routers are registered here. Run via:
    uvicorn src.app:app --host 127.0.0.1 --port 5050 --reload
"""
import os
import json
import tempfile
import subprocess
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
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
    version="2.0.0",
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

    if path in ("/api/auth/login", "/api/auth/register") or path == "/api/preview-pdf" or path.startswith("/share/") or path == "/" or path == "/login":
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
            
        from src.core.config import TEMPLATE_PLAIN, TEMPLATE_COVER_LETTER
        
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
        
        # Write temp JSON config
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
            json.dump(full_config, tmp)
            tmp_config_path = tmp.name
        
        # Build PDF to temp file
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_pdf:
            tmp_pdf_path = tmp_pdf.name
        
        try:
            if preview_type == "cover_letter":
                template = TEMPLATE_COVER_LETTER
            else:
                template = TEMPLATE_PLAIN
            
            from src.core.generate import generate_resume
            
            with tempfile.NamedTemporaryFile("w", suffix=".tex", delete=False, dir=Path(tmp_pdf_path).parent) as tmp_tex:
                tmp_tex_path = tmp_tex.name
                
            generate_resume(tmp_config_path, str(template), tmp_tex_path)
            
            # Compile TeX to PDF
            pdflatex_cmd = find_pdflatex()
            if not pdflatex_cmd:
                raise HTTPException(
                    status_code=400,
                    detail="LaTeX compiler 'pdflatex' not found on system. Please install TeX Live or compile downloaded TeX bundle in Overleaf."
                )

            try:
                subprocess.run(
                    [pdflatex_cmd, "-interaction=nonstopmode", "-output-directory", str(Path(tmp_pdf_path).parent), tmp_tex_path],
                    capture_output=True,
                    timeout=30
                )
                pdf_file = Path(tmp_tex_path).with_suffix(".pdf")
                if pdf_file.exists():
                    # Stream the PDF back
                    def iterfile():
                        with open(pdf_file, "rb") as f:
                            for chunk in iter(lambda: f.read(8192), b""):
                                yield chunk
                    
                    return StreamingResponse(
                        iterfile(),
                        media_type="application/pdf",
                        headers={"Content-Disposition": f"inline; filename={pdf_name}"}
                    )
            except Exception as e:
                print(f"LaTeX compilation error: {e}")
                raise HTTPException(500, f"PDF generation failed: {str(e)}")
        finally:
            try:
                os.unlink(tmp_config_path)
                if Path(tmp_pdf_path).exists():
                    os.unlink(tmp_pdf_path)
            except Exception:
                pass
    
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON in request body")
    except Exception as e:
        print(f"Preview error: {e}")
        raise HTTPException(500, f"Preview generation failed: {str(e)}")

# ── UI Entry Point ────────────────────────────────────────────────────────────

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
