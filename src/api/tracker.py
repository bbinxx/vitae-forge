"""
src/api/tracker.py
FastAPI router for job application tracking.

Key design decisions:
  - All applications are stored in Firebase.
  - Resume versions are stored as subcollections inside applications.
  - Built PDFs and photos are uploaded to R2 and their URLs/keys are saved.
"""
import sys
import csv
import uuid
import re
import subprocess
from datetime import datetime
from io import StringIO
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from src.core.config import ROOT, DIST_DIR
from src.db import db
from src.core.upload import upload_pdf, BUCKET

def get_user_id(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user_id
from src.core.upload import upload_pdf, BUCKET

router = APIRouter(prefix="/applications", tags=["tracker"])

BUILD_PY = ROOT / "src" / "core" / "build.py"

STATUS_OPTIONS = [
    "Bookmarked", "Applied", "Screening",
    "Interview", "Offer", "Rejected", "Withdrawn",
]
PRIORITY_OPTIONS = ["High", "Medium", "Low"]

from src.services.tracker_service import (
    timeline_event,
    sanitize_filename,
    build_display_name,
    default_app
)

_UPDATABLE_FIELDS = [
    "company", "role", "location", "job_url", "status",
    "priority", "job_type", "source", "platform", "tags",
    "assigned_resume", "assigned_pdf", "assigned_version_id", "archived_pdf",
    "resume_template",
    "notes", "job_description", "deadline",
    "salary_range", "contact_name", "contact_email",
    "email",
    "interview_rounds",
]

# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("")
def list_applications(request: Request):
    user_id = get_user_id(request)
    return {"applications": db.get_all_applications(user_id)}

@router.post("")
async def create_application(request: Request):
    user_id = get_user_id(request)
    body = await request.json()
    app_id = str(uuid.uuid4())
    new_app = default_app(app_id, body)
    if new_app.get('resume_template'):
        try:
            display_name = build_display_name(user_id, new_app)
            from src.core.build import build_custom_version
            success = build_custom_version(new_app['resume_template'], display_name, False, user_id=user_id)
            if success:
                new_app['assigned_pdf'] = f"{display_name}.pdf"
        except Exception as e:
            print(f"Error compiling new application resume for {app_id}: {e}")
    db.save_application(user_id, new_app)
    return new_app

@router.put("/{app_id}")
async def update_application(app_id: str, request: Request):
    user_id = get_user_id(request)
    body = await request.json()
    app = db.get_application(user_id, app_id)
    if not app:
        raise HTTPException(404, "Application not found")

    old_status = app.get("status")
    new_status = body.get("status", old_status)

    for field in _UPDATABLE_FIELDS:
        if field in body:
            app[field] = body[field]

    # If a custom template is provided, build a custom PDF
    if "resume_template" in body and body["resume_template"]:
        try:
            include_photo = False
            assigned = app.get("assigned_pdf", "")
            if assigned and "_X" in assigned:
                include_photo = True
            display_name = build_display_name(user_id, app)
            from src.core.build import build_custom_version
            success = build_custom_version(app["resume_template"], display_name, include_photo, user_id=user_id)
            if success:
                suffix_str = "_X" if include_photo else ""
                app["assigned_pdf"] = f"{display_name}{suffix_str}.pdf"
        except Exception as e:
            print(f"Error compiling custom resume for application {app_id}: {e}")

    app["updated_at"] = datetime.now().isoformat()

    if old_status != new_status:
        app.setdefault("timeline", []).append(
            timeline_event(new_status, body.get("timeline_note", f"Status → {new_status}"))
        )

    db.save_application(user_id, app)
    return app

@router.delete("/{app_id}")
def delete_app(app_id: str, request: Request):
    user_id = get_user_id(request)
    db.delete_application(user_id, app_id)
    return {"ok": True}

# ── Bulk Actions ──────────────────────────────────────────────────────────────

@router.post("/bulk-update")
async def bulk_update(request: Request):
    user_id = get_user_id(request)
    body = await request.json()
    ids = body.get("ids", [])
    changes = body.get("changes", {})
    if not ids:
        raise HTTPException(400, "No application IDs provided")

    apps = db.get_all_applications(user_id)
    count = 0
    for app in apps:
        if app["id"] in ids:
            old_status = app.get("status")
            new_status = changes.get("status", old_status)
            for field in _UPDATABLE_FIELDS:
                if field in changes:
                    app[field] = changes[field]
            app["updated_at"] = datetime.now().isoformat()
            if old_status != new_status:
                app.setdefault("timeline", []).append(
                    timeline_event(new_status, f"Bulk update → {new_status}")
                )
            db.save_application(user_id, app)
            count += 1

    return {"ok": True, "updated": count}

# ── Stats & Timeline & Rounds ─────────────────────────────────────────────────

@router.post("/{app_id}/timeline")
async def add_timeline_event(app_id: str, request: Request):
    user_id = get_user_id(request)
    body = await request.json()
    app = db.get_application(user_id, app_id)
    if not app: raise HTTPException(404, "Not found")
    event = {
        "status": body.get("status", app.get("status", "")),
        "date":   body.get("date", datetime.now().isoformat()),
        "note":   body.get("note", ""),
    }
    app.setdefault("timeline", []).append(event)
    app["updated_at"] = datetime.now().isoformat()
    db.save_application(user_id, app)
    return event

@router.post("/{app_id}/interview-rounds")
async def add_interview_round(app_id: str, request: Request):
    user_id = get_user_id(request)
    body = await request.json()
    app = db.get_application(user_id, app_id)
    if not app: raise HTTPException(404, "Not found")
    round_entry = {
        "id": str(uuid.uuid4()),
        "name": body.get("name", "Interview"),
        "type": body.get("type", "Technical"),
        "date": body.get("date", ""),
        "result": body.get("result", "Pending"),
        "notes": body.get("notes", ""),
    }
    app.setdefault("interview_rounds", []).append(round_entry)
    app.setdefault("timeline", []).append(
        timeline_event(app.get("status", "Interview"), f"Interview Round: {round_entry['name']}")
    )
    app["updated_at"] = datetime.now().isoformat()
    db.save_application(user_id, app)
    return round_entry

@router.delete("/{app_id}/interview-rounds/{round_id}")
def delete_interview_round(app_id: str, round_id: str, request: Request):
    user_id = get_user_id(request)
    app = db.get_application(user_id, app_id)
    if not app: raise HTTPException(404, "Not found")
    app["interview_rounds"] = [r for r in app.get("interview_rounds", []) if r.get("id") != round_id]
    app["updated_at"] = datetime.now().isoformat()
    db.save_application(user_id, app)
    return {"ok": True}

@router.get("/stats/summary")
def get_stats(request: Request):
    user_id = get_user_id(request)
    apps = db.get_all_applications(user_id)
    by_status = {s: 0 for s in STATUS_OPTIONS}
    by_priority = {p: 0 for p in PRIORITY_OPTIONS}
    for app in apps:
        s = app.get("status", "Bookmarked")
        p = app.get("priority", "Medium")
        if s in by_status: by_status[s] += 1
        if p in by_priority: by_priority[p] += 1
    return {
        "total": len(apps),
        "by_status": by_status,
        "by_priority": by_priority,
        "recent": sorted(apps, key=lambda x: x.get("updated_at", ""), reverse=True)[:5],
    }

# ── CSV Export ────────────────────────────────────────────────────────────────

@router.get("/export-csv")
def export_csv(request: Request):
    user_id = get_user_id(request)
    apps = db.get_all_applications(user_id)
    fields = [
        "company", "role", "location", "status", "priority",
        "job_type", "source", "salary_range", "deadline",
        "contact_name", "contact_email", "job_url",
        "assigned_pdf", "notes", "created_at", "updated_at",
    ]
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for app in apps:
        row = {f: app.get(f, "") for f in fields}
        if isinstance(row.get("tags"), list):
            row["tags"] = ", ".join(row["tags"])
        writer.writerow(row)
    output.seek(0)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="applications_{timestamp}.csv"'},
    )

# ── Cross-App Archived Resumes ────────────────────────────────────────────────

@router.get("/all-archived-pdfs")
def get_all_archived_pdfs(request: Request):
    user_id = get_user_id(request)
    apps = db.get_all_applications(user_id)
    result = []
    seen = set()
    for app in apps:
        archived = app.get("archived_pdf", "")
        # archived is now an R2 key or filename
        if archived and archived not in seen:
            seen.add(archived)
            result.append({
                "path": archived,
                "filename": Path(archived).name,
                "source_app": app.get("company", ""),
                "source_role": app.get("role", ""),
                "source_app_id": app.get("id", ""),
                "exists": True, # Assume true for R2 links, or we could verify
            })
    return result

# ── Versions & Custom Builds ──────────────────────────────────────────────────

@router.get("/{app_id}/versions")
def list_versions(app_id: str, request: Request):
    user_id = get_user_id(request)
    versions = db.get_app_versions(user_id, app_id)
    return sorted(versions, key=lambda x: x.get("created_at", ""), reverse=True)

@router.post("/{app_id}/versions")
async def create_version(app_id: str, request: Request):
    """Save a custom resume configuration as a specific version for this app."""
    user_id = get_user_id(request)
    body = await request.json()
    app = db.get_application(user_id, app_id)
    if not app: raise HTTPException(404, "Application not found")

    default_name = f"{app.get('company','App')} — {app.get('role','Version')}"
    v_id = str(uuid.uuid4())
    version_data = {
        "id": v_id,
        "name": body.get("name", default_name),
        "base_recipe": body.get("base_recipe", ""),
        "customizations": body.get("customizations", {}),
        "include_photo": body.get("include_photo", False),
        "photo_r2_key": body.get("photo_r2_key", ""),
        "created_at": datetime.now().isoformat(),
        "pdf_r2_key": "",
    }
    db.save_app_version(user_id, app_id, version_data)
    return {"ok": True, "version": version_data}

@router.put("/{app_id}/versions/{v_id}")
async def update_version(app_id: str, v_id: str, request: Request):
    """Update a custom resume configuration version and clear its built PDF key."""
    user_id = get_user_id(request)
    body = await request.json()
    app = db.get_application(user_id, app_id)
    version = db.get_app_version(user_id, app_id, v_id)
    if not app or not version:
        raise HTTPException(404, "Application or version not found")

    version["customizations"] = body.get("customizations", version.get("customizations", {}))
    if "name" in body:
        version["name"] = body["name"]
    version["pdf_r2_key"] = ""  # Needs rebuild
    version["updated_at"] = datetime.now().isoformat()
    
    db.save_app_version(user_id, app_id, version)
    return {"ok": True, "version": version}

@router.post("/{app_id}/photo")
async def upload_custom_photo(app_id: str, request: Request, file: UploadFile = File(...)):
    user_id = get_user_id(request)
    """Upload a custom photo to R2 for an application version."""
    import tempfile
    try:
        content = await file.read()
        suffix = Path(file.filename).suffix
        key = f"photos/{app_id}_{uuid.uuid4().hex[:8]}{suffix}"
        
        with tempfile.NamedTemporaryFile("wb", delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
            
        # We need to upload to R2
        from src.core.upload import get_r2_client, BUCKET
        client = get_r2_client()
        if not client:
            raise HTTPException(500, "R2 not configured")
            
        client.upload_file(tmp_path, BUCKET, key)
        Path(tmp_path).unlink()
        
        return {"ok": True, "photo_r2_key": key}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/{app_id}/versions/{v_id}/build")
def build_version(app_id: str, v_id: str, request: Request):
    """
    Build a PDF from the specified version configuration,
    upload it to R2, and assign it to the application.
    """
    user_id = get_user_id(request)
    app = db.get_application(user_id, app_id)
    version = db.get_app_version(user_id, app_id, v_id)
    if not app or not version:
        raise HTTPException(404, "Application or version not found")

    def stream():
        from src.core.config import find_pdflatex
        pdflatex_cmd = find_pdflatex()
        if not pdflatex_cmd:
            yield "Error: LaTeX compiler 'pdflatex' not found on system. Please install TeX Live or another LaTeX distribution on this system to compile PDFs.\n"
            return

        yield f"Building version {version.get('name')}...\n"
        from src.core.build import build_custom_version
        
        # Merge base recipe with customizations
        from src.services.resume_service import get_full_config
        main_config = get_full_config(user_id)
        base_recipe_key = version.get("base_recipe")
        base_recipe = main_config.get("recipes", {}).get(base_recipe_key, {})
        
        # Apply customizations
        merged_recipe = dict(base_recipe)
        merged_recipe.update(version.get("customizations", {}))
        
        # Fetch photo from R2 if needed
        custom_photo_path = None
        photo_r2_key = version.get("photo_r2_key")
        if version.get("include_photo") and photo_r2_key:
            yield "Downloading custom photo from R2...\n"
            import tempfile
            from src.core.upload import get_r2_client, BUCKET
            client = get_r2_client()
            if client:
                suffix = Path(photo_r2_key).suffix
                with tempfile.NamedTemporaryFile("wb", delete=False, suffix=suffix) as tmp:
                    client.download_fileobj(BUCKET, photo_r2_key, tmp)
                    custom_photo_path = Path(tmp.name)
        
        display_name = build_display_name(user_id, app)
        success = build_custom_version(merged_recipe, display_name, version.get("include_photo"), custom_photo_path, user_id=user_id)
        
        if custom_photo_path:
            custom_photo_path.unlink(missing_ok=True)
            
        if not success:
            yield "Build failed.\n"
            return
            
        # Find the built PDF
        suffix_str = "_X" if version.get("include_photo") else ""
        built_pdf_name = f"{display_name}{suffix_str}.pdf"
        built_pdf_path = DIST_DIR / built_pdf_name
        
        if not built_pdf_path.exists():
            yield "Could not find built PDF.\n"
            return
            
        yield f"Uploading {built_pdf_name} to R2...\n"
        # Upload to R2
        from src.core.upload import get_r2_client, BUCKET
        client = get_r2_client()
        if not client:
            yield "R2 not configured, cannot save to R2.\n"
            return
            
        r2_key = f"resumes/{app_id}/{v_id}.pdf"
        client.upload_file(str(built_pdf_path), BUCKET, r2_key, ExtraArgs={"ContentType": "application/pdf"})
        
        # Update version and app
        version["pdf_r2_key"] = r2_key
        db.save_app_version(user_id, app_id, version)
        
        app["assigned_resume"] = version.get("name")
        app["assigned_pdf"] = built_pdf_name
        app["assigned_version_id"] = v_id
        app["archived_pdf"] = r2_key
        app["updated_at"] = datetime.now().isoformat()
        app.setdefault("timeline", []).append(
            timeline_event(app.get("status", ""), f"Version '{version.get('name')}' built & assigned")
        )
        db.save_application(user_id, app)
        
        yield f"\nSuccessfully built, uploaded to R2 ({r2_key}), and assigned to application.\n"

    return StreamingResponse(stream(), media_type="text/plain")

@router.get("/{app_id}/archived-resume")
def download_archived_resume(app_id: str, request: Request):
    user_id = get_user_id(request)
    app = db.get_application(user_id, app_id)
    if not app: raise HTTPException(404, "Application not found")
    r2_key = app.get("archived_pdf")
    if not r2_key: raise HTTPException(404, "No archived resume")
    
    from src.core.upload import get_r2_client, BUCKET
    client = get_r2_client()
    if not client: raise HTTPException(500, "R2 not configured")
    
    try:
        url = client.generate_presigned_url(
            'get_object', Params={'Bucket': BUCKET, 'Key': r2_key}, ExpiresIn=3600
        )
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url)
    except Exception as e:
        raise HTTPException(500, str(e))

@router.delete("/{app_id}/versions/{v_id}")
def delete_version(app_id: str, v_id: str, request: Request):
    """Delete a custom resume version from an application."""
    user_id = get_user_id(request)
    if db.delete_app_version(user_id, app_id, v_id):
        return {"ok": True}
    raise HTTPException(500, "Failed to delete version")

@router.post("/{app_id}/versions/{v_id}/assign")
def assign_version(app_id: str, v_id: str, request: Request):
    """Set a built version as the application's active assigned resume."""
    user_id = get_user_id(request)
    app = db.get_application(user_id, app_id)
    version = db.get_app_version(user_id, app_id, v_id)
    if not app or not version:
        raise HTTPException(404, "Application or version not found")
        
    r2_key = version.get("pdf_r2_key")
    if not r2_key:
        raise HTTPException(400, "Version has not been built yet (no PDF)")
        
    app["assigned_resume"] = version.get("name")
    app["assigned_pdf"] = Path(r2_key).name if r2_key else ""
    app["assigned_version_id"] = v_id
    app["archived_pdf"] = r2_key
    app["updated_at"] = datetime.now().isoformat()
    app.setdefault("timeline", []).append(
        timeline_event(app.get("status", ""), f"Version '{version.get('name')}' manually assigned")
    )
    db.save_application(user_id, app)
    return {"ok": True, "app": app}

@router.get("/{app_id}/versions/{v_id}/pdf")
def download_version_pdf(app_id: str, v_id: str, request: Request):
    """Redirect to the R2 presigned URL for a specific version's PDF."""
    user_id = get_user_id(request)
    version = db.get_app_version(user_id, app_id, v_id)
    if not version: raise HTTPException(404, "Version not found")
    r2_key = version.get("pdf_r2_key")
    if not r2_key: raise HTTPException(404, "No PDF built for this version")
    
    from src.core.upload import get_r2_client, BUCKET
    client = get_r2_client()
    if not client: raise HTTPException(500, "R2 not configured")
    
    try:
        url = client.generate_presigned_url(
            'get_object', Params={'Bucket': BUCKET, 'Key': r2_key}, ExpiresIn=3600
        )
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url)
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/{app_id}/compile-pdf")
async def compile_pdf(app_id: str, request: Request):
    """Compile and save a PDF from JSON config with role_company naming."""
    user_id = get_user_id(request)
    app = db.get_application(user_id, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    
    try:
        body = await request.json()
        config = body.get("config", {})
        settings = db.get_settings(user_id)
        prefix = settings.get('file_name_prefix', 'YOUR_NAME-') if isinstance(settings, dict) else 'YOUR_NAME-'
        
        fallback_name = f"{prefix}{app['role']}".replace(" ", "_")
        pdf_name = body.get("pdf_name", fallback_name)
        if pdf_name.endswith(".pdf"):
            pdf_name = pdf_name[:-4]
        
        if not config:
            raise HTTPException(400, "Missing 'config' in request body")
        
        # 1. Save the JSON config to application first so edits are never lost
        app["resume_template"] = config
        app["updated_at"] = datetime.now().isoformat()
        db.save_application(user_id, app)

        # 2. Check if LaTeX compiler (pdflatex) is available
        from src.core.config import find_pdflatex
        pdflatex_cmd = find_pdflatex()
        if not pdflatex_cmd:
            raise HTTPException(
                status_code=400,
                detail="LaTeX compiler 'pdflatex' not found on system. The JSON configuration was saved successfully, but the PDF could not be compiled. Please install a LaTeX distribution (like TeX Live) on this system."
            )

        # 3. Build the custom PDF
        from src.core.build import build_custom_version
        success = build_custom_version(config, pdf_name, include_photo=False, user_id=user_id)
        
        if not success:
            # Read build log to surface actual error
            log_dir = ROOT / "logs"
            log_pattern = f"{pdf_name}_build.log"
            log_files = list(log_dir.glob(log_pattern)) if log_dir.exists() else []
            log_tail = ""
            if log_files:
                try:
                    with open(log_files[0], encoding="utf-8", errors="ignore") as lf:
                        lines = lf.readlines()
                        # Find the actual error line
                        err_lines = [l for l in lines if "error" in l.lower() or "fatal" in l.lower() or "not found" in l.lower()]
                        log_tail = " | ".join(err_lines[-3:]).strip() if err_lines else "".join(lines[-5:]).strip()
                except Exception:
                    pass
            detail = f"PDF build failed. {log_tail}" if log_tail else "PDF build failed. Check server logs."
            raise HTTPException(500, detail)
        
        # Update app with assigned PDF
        app["assigned_pdf"] = f"{pdf_name}.pdf"
        
        # Check if cover letter was generated
        cover_letter_name = f"{pdf_name}_Cover_Letter.pdf"
        cover_letter_path = DIST_DIR / cover_letter_name
        if cover_letter_path.exists():
            app["assigned_cover_letter"] = cover_letter_name
        else:
            app.pop("assigned_cover_letter", None)
            
        app["updated_at"] = datetime.now().isoformat()
        db.save_application(user_id, app)
        
        return {
            "ok": True,
            "pdf_name": f"{pdf_name}.pdf",
            "cover_letter": app.get("assigned_cover_letter"),
            "message": f"PDF compiled successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Compile PDF error: {e}")
        raise HTTPException(500, f"PDF compilation failed: {str(e)}")


# ── Job URL Scraper ─────────────────────────────────────────────────────────

class ScrapeRequest(BaseModel):
    url: str

@router.post("/scrape-job-url")
def scrape_job_url(req: ScrapeRequest):
    """
    Fetch a job posting URL, extract visible text, and return it
    along with a ready-to-copy AI prompt.
    """
    import re
    import requests
    from bs4 import BeautifulSoup

    url = req.url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    try:
        resp = requests.get(url, timeout=15, headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            )
        })
        resp.raise_for_status()
    except Exception as e:
        raise HTTPException(400, f"Failed to fetch URL: {e}")

    soup = BeautifulSoup(resp.text, "lxml")

    # Remove script/style tags
    for tag in soup(["script", "style", "noscript", "iframe", "svg", "nav", "footer", "header"]):
        tag.decompose()

    text = soup.get_text(separator="\n")
    # Collapse blank lines
    lines = [re.sub(r'\s+', ' ', l).strip() for l in text.splitlines()]
    lines = [l for l in lines if l]
    visible_text = "\n".join(lines[:500])  # limit to first 500 lines

    if len(visible_text) < 50:
        raise HTTPException(400, "Could not extract meaningful text from that URL.")

    prompt = (
        "You are an AI assistant that extracts job application data from web page text.\n\n"
        "Below is the scraped text from a job posting page.\n"
        "Fill the following JSON with all information you can extract from it.\n"
        "Return ONLY the raw JSON object — no explanations, no markdown, no code blocks.\n\n"
        "--- SCRAPED TEXT ---\n"
        f"{visible_text}\n"
        "--- END SCRAPED TEXT ---\n\n"
        "Use this schema:\n"
        '{\n'
        '  "company": "",\n'
        '  "role": "",\n'
        '  "location": "",\n'
        '  "status": "Bookmarked",\n'
        '  "priority": "Medium",\n'
        '  "platform": "",\n'
        '  "source": "",\n'
        '  "job_type": "",\n'
        '  "salary_range": "",\n'
        '  "deadline": "",\n'
        '  "contact_name": "",\n'
        '  "contact_email": "",\n'
        '  "job_url": "",\n'
        '  "notes": "",\n'
        '  "job_description": "",\n'
        '  "assigned_pdf": "",\n'
        '  "email": {"to": "", "cc": "", "subject": "", "body": ""}\n'
        '}\n\n'
        'Fill in every field you can. If not found, leave empty string.\n'
        "Set status to 'Bookmarked' as default. Set priority based on how well the role matches a Java Developer profile."
    )

    return {
        "text": visible_text,
        "prompt": prompt,
    }
