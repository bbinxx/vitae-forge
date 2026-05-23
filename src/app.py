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
