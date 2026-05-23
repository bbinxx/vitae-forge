"""
src/api/tracker.py
FastAPI router for job application tracking.

Key design decision (per user request):
  When a resume PDF is assigned to an application, an immutable copy is
  archived to dist/archived/{app_id}/ so the exact version sent is always
  preserved, even if the same recipe is rebuilt later.
"""
import sys
import uuid
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse

from src.core.config import (
    ROOT, DIST_DIR, load_applications, save_applications,
)

router = APIRouter(prefix="/applications", tags=["tracker"])

BUILD_PY     = ROOT / "src" / "core" / "build.py"
ARCHIVE_DIR  = DIST_DIR / "archived"          # immutable resume copies
ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)

STATUS_OPTIONS = [
    "Bookmarked", "Applied", "Screening",
    "Interview", "Offer", "Rejected", "Withdrawn",
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_app(data: dict, app_id: str) -> dict | None:
    for app in data["applications"]:
        if app["id"] == app_id:
            return app
    return None


def _archive_pdf(app_id: str, pdf_filename: str) -> str | None:
    """
    Copy `dist/{pdf_filename}` into `dist/archived/{app_id}/`.
    Returns the relative archive path (for storage in the DB),
    or None if the source file doesn't exist.
    """
    src = DIST_DIR / pdf_filename
    if not src.exists():
        return None
    dest_dir = ARCHIVE_DIR / app_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / pdf_filename
    shutil.copy2(src, dest)
    return str(dest.relative_to(DIST_DIR))   # e.g. "archived/abc123/BIBIN_RAJU_BC.pdf"


def _timeline_event(status: str, note: str = "") -> dict:
    return {
        "status": status,
        "date": datetime.now().isoformat(),
        "note": note,
    }


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("")
def list_applications():
    return load_applications()


@router.post("")
async def create_application(request: Request):
    body = await request.json()
    data = load_applications()

    app_id  = str(uuid.uuid4())
    status  = body.get("status", "Bookmarked")
    pdf     = body.get("assigned_pdf", "")

    # Archive the resume if one is already being assigned at creation time
    archived_path = ""
    if pdf:
        archived_path = _archive_pdf(app_id, pdf) or ""

    new_app = {
        "id":             app_id,
        "company":        body.get("company", ""),
        "role":           body.get("role", ""),
        "location":       body.get("location", ""),
        "job_url":        body.get("job_url", ""),
        "status":         status,
        "assigned_resume": body.get("assigned_resume", ""),   # recipe key
        "assigned_pdf":   pdf,                                 # live filename
        "archived_pdf":   archived_path,                       # immutable copy path
        "notes":          body.get("notes", ""),
        "deadline":       body.get("deadline", ""),
        "salary_range":   body.get("salary_range", ""),
        "contact_name":   body.get("contact_name", ""),
        "contact_email":  body.get("contact_email", ""),
        "created_at":     datetime.now().isoformat(),
        "updated_at":     datetime.now().isoformat(),
        "timeline": [_timeline_event(status, "Application created")],
    }
    data["applications"].append(new_app)
    save_applications(data)
    return new_app


@router.put("/{app_id}")
async def update_application(app_id: str, request: Request):
    body = await request.json()
    data = load_applications()
    app  = _get_app(data, app_id)
    if not app:
        raise HTTPException(404, "Application not found")

    old_status = app.get("status")
    new_status = body.get("status", old_status)
    old_pdf    = app.get("assigned_pdf", "")
    new_pdf    = body.get("assigned_pdf", old_pdf)

    # Archive new PDF if the assignment changed
    if new_pdf and new_pdf != old_pdf:
        archived = _archive_pdf(app_id, new_pdf)
        if archived:
            app["archived_pdf"] = archived

    # Update scalar fields
    for field in [
        "company", "role", "location", "job_url", "status",
        "assigned_resume", "assigned_pdf", "notes", "deadline",
        "salary_range", "contact_name", "contact_email",
    ]:
        if field in body:
            app[field] = body[field]

    app["updated_at"] = datetime.now().isoformat()

    # Record timeline event on status change
    if old_status != new_status:
        if "timeline" not in app:
            app["timeline"] = []
        app["timeline"].append(
            _timeline_event(new_status, body.get("timeline_note", f"Status → {new_status}"))
        )

    save_applications(data)
    return app


@router.delete("/{app_id}")
def delete_application(app_id: str):
    data = load_applications()
    data["applications"] = [a for a in data["applications"] if a["id"] != app_id]
    save_applications(data)
    return {"ok": True}


# ── Timeline ──────────────────────────────────────────────────────────────────

@router.post("/{app_id}/timeline")
async def add_timeline_event(app_id: str, request: Request):
    body = await request.json()
    data = load_applications()
    app  = _get_app(data, app_id)
    if not app:
        raise HTTPException(404, "Application not found")

    event = {
        "status": body.get("status", app.get("status", "")),
        "date":   body.get("date", datetime.now().isoformat()),
        "note":   body.get("note", ""),
    }
    app.setdefault("timeline", []).append(event)
    app["updated_at"] = datetime.now().isoformat()
    save_applications(data)
    return event


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats/summary")
def get_stats():
    data = load_applications()
    apps = data["applications"]
    by_status = {s: 0 for s in STATUS_OPTIONS}
    for app in apps:
        s = app.get("status", "Bookmarked")
        if s in by_status:
            by_status[s] += 1
    return {
        "total":     len(apps),
        "by_status": by_status,
        "recent":    sorted(apps, key=lambda x: x.get("updated_at", ""), reverse=True)[:5],
    }


# ── Archived resume download ──────────────────────────────────────────────────

@router.get("/{app_id}/archived-resume")
def download_archived_resume(app_id: str):
    """Download the exact PDF copy that was archived for this application."""
    data = load_applications()
    app  = _get_app(data, app_id)
    if not app:
        raise HTTPException(404, "Application not found")

    archived = app.get("archived_pdf", "")
    if not archived:
        raise HTTPException(404, "No archived resume for this application")

    file_path = DIST_DIR / archived
    if not file_path.exists():
        raise HTTPException(404, "Archived file not found on disk")

    return FileResponse(path=file_path, filename=file_path.name)


# ── Build & auto-assign ───────────────────────────────────────────────────────

@router.get("/{app_id}/build/{role}")
def build_and_assign(app_id: str, role: str):
    """
    Stream-build a recipe, then auto-assign + archive the resulting PDF
    to this application.
    """
    def stream():
        cmd  = [sys.executable, str(BUILD_PY), role]
        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, cwd=str(ROOT),
        )
        for line in proc.stdout:
            yield line
        proc.wait()

        # Find the built PDF (prefer non-photo variant)
        candidates   = list(DIST_DIR.glob(f"*{role.upper()}*.pdf")) + \
                       list(DIST_DIR.glob(f"*{role}*.pdf"))
        candidates   = [p for p in candidates if "archived" not in str(p)]
        non_photo    = [p for p in candidates if "_X" not in p.name]
        chosen       = (non_photo or candidates)
        if not chosen:
            yield "\n⚠ Could not find built PDF to assign.\n"
            return

        chosen = chosen[0]

        data = load_applications()
        app  = _get_app(data, app_id)
        if not app:
            yield "\n⚠ Application not found in DB.\n"
            return

        archived = _archive_pdf(app_id, chosen.name)
        app["assigned_resume"] = role
        app["assigned_pdf"]    = chosen.name
        app["archived_pdf"]    = archived or ""
        app["updated_at"]      = datetime.now().isoformat()
        app.setdefault("timeline", []).append(
            _timeline_event(app.get("status", ""), f"Resume built & assigned: {chosen.name}")
        )
        save_applications(data)
        yield f"\n✅ Archived & assigned → {archived or chosen.name}\n"

    return StreamingResponse(stream(), media_type="text/plain")
