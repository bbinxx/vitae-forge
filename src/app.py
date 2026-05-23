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

# ── UI Entry Point ────────────────────────────────────────────────────────────
_HTML_FILE = ROOT / "templates" / "studio.html"

@app.get("/", response_class=HTMLResponse)
def index():
    return _HTML_FILE.read_text()
