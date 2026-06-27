"""
src/app.py — Resume Studio · FastAPI Application Entry Point
============================================================
All routers are registered here. Run via:
    uvicorn src.app:app --host 127.0.0.1 --port 5050 --reload
"""
import os
import secrets
import json
import io
import tempfile
import subprocess
from pathlib import Path

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from src.core.config import DIST_DIR, STATIC_DIR, ROOT, ensure_dirs, load_resume_config, find_pdflatex

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
    from src.core.firebase import get_firebase_db
    db = get_firebase_db()
    if db:
        print("🔥 Firebase DB connected successfully! Cloud sync is ACTIVE.")
    else:
        print("⚠️  Firebase DB NOT connected. Operating in LOCAL ONLY mode.")

SESSION_TOKEN = secrets.token_hex(16)

@app.middleware("http")
async def cookie_auth_middleware(request: Request, call_next):
    passcode_hash = os.environ.get("PASSCODE_HASH")
    passcode_enabled = os.environ.get("PASSCODE_ENABLED", "true").lower()
    if not passcode_hash or passcode_enabled == "false":
        return await call_next(request)
        
    path = request.url.path
    if path == "/api/login" or path == "/api/preview-pdf" or path.startswith("/static/") or path.startswith("/share/"):
        return await call_next(request)
        
    auth_cookie = request.cookies.get("resume_auth")
    if auth_cookie == SESSION_TOKEN:
        return await call_next(request)
        
    # If not authenticated
    if path != "/":
        return Response(content="Unauthorized", status_code=401)
        
    # Serve login page for root
    return HTMLResponse(_LOGIN_FILE.read_text())

class LoginRequest(BaseModel):
    passcode: str

@app.post("/api/login")
def login(req: LoginRequest, response: Response):
    passcode_hash = os.environ.get("PASSCODE_HASH")
    if not passcode_hash:
        return {"ok": True}
        
    import bcrypt
    try:
        if bcrypt.checkpw(req.passcode.encode("utf-8"), passcode_hash.encode("utf-8")):
            response.set_cookie(key="resume_auth", value=SESSION_TOKEN, httponly=True, max_age=86400)
            return {"ok": True}
    except Exception as e:
        print(f"Auth check error: {e}")
        pass
        
    raise HTTPException(status_code=401, detail="Invalid passcode")

# ── Static mounts ─────────────────────────────────────────────────────────────
if DIST_DIR.exists():
    app.mount("/pdf", StaticFiles(directory=str(DIST_DIR)), name="pdf")

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# ── API Routers ───────────────────────────────────────────────────────────────
from src.api.studio  import router as studio_router
from src.api.tracker import router as tracker_router

app.include_router(studio_router)
app.include_router(tracker_router)

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
        
        from src.core.config import TEMPLATE_PLAIN, TEMPLATE_PHOTO, TEMPLATE_COVER_LETTER, PROFILE_PHOTO
        
        main_config = load_resume_config()
        
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
            elif include_photo:
                template = TEMPLATE_PHOTO
            else:
                template = TEMPLATE_PLAIN
            
            from src.core.generate import generate_resume
            
            with tempfile.NamedTemporaryFile("w", suffix=".tex", delete=False, dir=Path(tmp_pdf_path).parent) as tmp_tex:
                tmp_tex_path = tmp_tex.name
                
            generate_resume(
                tmp_config_path, str(template), tmp_tex_path,
                photo_path=str(PROFILE_PHOTO) if include_photo else None,
            )
            
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
    
    # Preload data for instant render
    try:
        from src.core.firebase import get_all_applications
        from src.api.studio import list_files
        
        apps = get_all_applications()
        files = list_files()
        
        script = f"<script>window.__PRELOADED_APPS__ = {json.dumps(apps)}; window.__PRELOADED_FILES__ = {json.dumps(files)};</script>"
        html = html.replace("</head>", f"{script}\n</head>")
    except Exception as e:
        print(f"Preload error: {e}")
        
    return html
