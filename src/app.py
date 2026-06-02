"""
src/app.py — Resume Studio · FastAPI Application Entry Point
============================================================
All routers are registered here. Run via:
    uvicorn src.app:app --host 127.0.0.1 --port 5050 --reload
"""
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from src.core.config import DIST_DIR, STATIC_DIR, ROOT, ensure_dirs

# Ensure required directories exist before mounting
ensure_dirs()

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

import os
import secrets
from fastapi import Request, Response, HTTPException
from pydantic import BaseModel
from fastapi.responses import HTMLResponse

SESSION_TOKEN = secrets.token_hex(16)

@app.middleware("http")
async def cookie_auth_middleware(request: Request, call_next):
    passcode_hash = os.environ.get("PASSCODE_HASH")
    if not passcode_hash:
        return await call_next(request)
        
    path = request.url.path
    if path == "/api/login" or path.startswith("/static/") or path.startswith("/share/"):
        return await call_next(request)
        
    auth_cookie = request.cookies.get("resume_auth")
    if auth_cookie == SESSION_TOKEN:
        return await call_next(request)
        
    # If not authenticated
    if path != "/":
        return Response(content="Unauthorized", status_code=401)
        
    # Serve login page for root
    _LOGIN_FILE = ROOT / "templates" / "login.html"
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
from fastapi.responses import StreamingResponse
import json
import io

@app.post("/api/preview-pdf")
async def preview_pdf(request: Request):
    """Generate a temporary preview PDF from a JSON config (no file save)."""
    try:
        body = await request.json()
        config = body.get("config", {})
        pdf_name = body.get("pdf_name", "preview.pdf")
        
        if not config:
            raise HTTPException(400, "Missing 'config' in request body")
        
        # Import build functions
        from src.core.build import build_variant
        from src.core.config import TEMPLATE_PHOTO, TEMPLATE_PLAIN, PROFILE_PHOTO
        import tempfile
        
        # Load main config to merge personal/library
        from src.core.config import RESUME_CONFIG
        main_config = json.loads(RESUME_CONFIG.read_text())
        
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
            # Use build_variant directly to generate PDF to a specific path
            # This is a simplified preview — no R2 upload, no photo
            from pathlib import Path
            import subprocess
            
            template = TEMPLATE_PLAIN
            
            # Generate TeX from config
            from src.core.generate import generate_resume
            
            with tempfile.NamedTemporaryFile("w", suffix=".tex", delete=False, dir=Path(tmp_pdf_path).parent) as tmp_tex:
                tmp_tex_path = tmp_tex.name
                
            generate_resume(tmp_config_path, str(template), tmp_tex_path)
            
            # Compile TeX to PDF
            import shutil
            import os
            import glob
            
            pdflatex_cmd = shutil.which("pdflatex")
            if not pdflatex_cmd:
                # Fallback to TinyTeX if installed locally
                tinytex_paths = glob.glob(os.path.expanduser("~/.TinyTeX/bin/*/pdflatex"))
                if tinytex_paths:
                    pdflatex_cmd = tinytex_paths[0]
            
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
            # Cleanup temp files
            import os
            try:
                os.unlink(tmp_config_path)
                if Path(tmp_pdf_path).exists():
                    os.unlink(tmp_pdf_path)
            except:
                pass
    
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON in request body")
    except Exception as e:
        print(f"Preview error: {e}")
        raise HTTPException(500, f"Preview generation failed: {str(e)}")

# ── UI Entry Point ────────────────────────────────────────────────────────────
_HTML_FILE = ROOT / "templates" / "studio.html"

@app.get("/", response_class=HTMLResponse)
def index():
    html = _HTML_FILE.read_text()
    
    # Preload data for instant render
    import json
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
