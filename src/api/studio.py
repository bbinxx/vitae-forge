"""
src/api/studio.py
FastAPI router for resume build, file management, config I/O,
photo upload, and bookmark endpoints.
"""
import sys
import io
import os
import re
import asyncio
import shutil
import zipfile
import subprocess
import time
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from PIL import Image

from src.core.config import (
    ROOT, DIST_DIR, ASSETS_DIR, PROFILE_PHOTO,
)
from src.core.upload import list_r2_objects, upload_pdf, BUCKET
from src.core.build import build_role, build_all, clean

from src.db import db
from src.services.resume_service import get_full_config, save_full_config

_settings_cache: dict[str, tuple[dict, float]] = {}
_SETTINGS_CACHE_TTL = 30

def _get_cached_settings(user_id: str) -> dict:
    now = time.time()
    cached = _settings_cache.get(user_id)
    if cached and (now - cached[1]) < _SETTINGS_CACHE_TTL:
        return cached[0]
    settings = db.get_settings(user_id)
    _settings_cache[user_id] = (settings, now)
    return settings


def get_user_id(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user_id

router = APIRouter()

BUILD_PY = ROOT / "src" / "core" / "build.py"


def _bundle_instructions() -> str:
    return (
        "Vitae Forge — LaTeX Bundle Instructions\n"
        "========================================\n\n"
        "1. Open resume.tex in Overleaf or your local LaTeX editor.\n"
        "2. Ensure you have a LaTeX distribution installed (TeX Live recommended).\n"
        "3. Compile with pdflatex: pdflatex resume.tex\n"
        "4. If using the photo variant, place profile.jpg in the same directory.\n"
        "5. The PDF will be generated in the current directory.\n\n"
        "For issues, visit: https://github.com/[your-github]/vitae-forge\n"
    )


# ── Bookmarks (Saved Resumes) ─────────────────────────────────────────────────
BOOKMARKS_FILE = ROOT / "configs" / "bookmarks.json"

def _load_bookmarks():
    import json
    if BOOKMARKS_FILE.exists():
        try:
            return json.loads(BOOKMARKS_FILE.read_text())
        except Exception:
            return []
    return []

def _save_bookmarks(bookmarks):
    import json
    BOOKMARKS_FILE.parent.mkdir(parents=True, exist_ok=True)
    BOOKMARKS_FILE.write_text(json.dumps(bookmarks, indent=4))

def _sse_emit(step: str, status: str, **kw):
    import json as _json
    obj = {"step": step, "status": status, **kw}
    return f"data: {_json.dumps(obj)}\n\n"

@router.get("/bookmarks")
def list_bookmarks():
    return {"bookmarks": _load_bookmarks()}

class BookmarkCreate(BaseModel):
    name: str
    data: dict
    source_app_id: str = ""

@router.post("/bookmarks")
def create_bookmark(req: BookmarkCreate):
    import uuid
    bookmarks = _load_bookmarks()
    new_bm = {
        "id": str(uuid.uuid4()),
        "name": req.name,
        "data": req.data,
        "source_app_id": req.source_app_id,
        "created_at": datetime.now().isoformat(),
    }
    bookmarks.append(new_bm)
    _save_bookmarks(bookmarks)
    return {"ok": True, "bookmark": new_bm}

@router.delete("/bookmarks/{bm_id}")
def delete_bookmark(bm_id: str):
    bookmarks = _load_bookmarks()
    bookmarks = [b for b in bookmarks if b.get("id") != bm_id]
    _save_bookmarks(bookmarks)
    return {"ok": True}


class DirectCompileRequest(BaseModel):
    config: dict
    name: str
    include_photo: bool = False

@router.post("/compile-direct")
def compile_direct(req: DirectCompileRequest):
    from src.core.build import build_custom_version
    import re as _re
    safe_name = _re.sub(r'[^\w\-_]', '_', req.name)
    suffix = "_X" if req.include_photo else ""
    pdf_bytes = build_custom_version(req.config, safe_name, req.include_photo)
    if not pdf_bytes:
        raise HTTPException(500, "Failed to compile PDF")
    (DIST_DIR / f"{safe_name}{suffix}.pdf").write_bytes(pdf_bytes)
    return {"pdf": f"{safe_name}{suffix}.pdf"}

@router.post("/download-latex-direct")
def download_latex_direct(req: DirectCompileRequest):
    from src.core.build import generate_latex_source
    import re as _re
    safe_name = _re.sub(r'[^\w\-_]', '_', req.name)
    suffix = "_X" if req.include_photo else ""
    latex = generate_latex_source(req.config, safe_name, req.include_photo)
    if not latex:
        raise HTTPException(500, "Failed to generate LaTeX source")
    return StreamingResponse(
        io.BytesIO(latex.encode("utf-8")),
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}{suffix}.tex"'},
    )

@router.post("/download-zip-direct")
def download_zip_direct(req: DirectCompileRequest):
    from src.core.build import generate_latex_source
    import re as _re
    safe_name = _re.sub(r'[^\w\-_]', '_', req.name)
    latex = generate_latex_source(req.config, safe_name, req.include_photo)
    if not latex:
        raise HTTPException(500, "Failed to generate LaTeX source")
    latex = latex.replace("../assets/profile-photo.jpg", "profile.jpg")
    latex = latex.replace(str(PROFILE_PHOTO), "profile.jpg")
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "a", zipfile.ZIP_DEFLATED, False) as zf:
        zf.writestr("resume.tex", latex)
        if PROFILE_PHOTO.exists():
            zf.write(str(PROFILE_PHOTO), "profile.jpg")
        zf.writestr("INSTRUCTIONS.txt", _bundle_instructions())
    zip_buf.seek(0)
    return StreamingResponse(
        zip_buf,
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.zip"'},
    )


@router.post("/upload-photo")
async def upload_photo(file: UploadFile = File(...)):
    """Upload a profile photo directly to R2."""
    try:
        contents = await file.read()
        
        # Upload to R2 for cloud persistence
        from src.core.upload import get_r2_client, BUCKET
        client = get_r2_client()
        if client:
            client.put_object(Bucket=BUCKET, Key="profile-photo.jpg", Body=contents, ContentType="image/jpeg")
        else:
            raise Exception("R2 client not configured")
            
        return {"ok": True, "message": "Photo uploaded successfully"}
    except Exception as e:
        raise HTTPException(500, f"Failed to upload photo: {e}")


@router.get("/photo-status")
def photo_status():
    """Check if a profile photo exists in R2."""
    from src.core.upload import get_r2_client, BUCKET
    client = get_r2_client()
    if client:
        try:
            client.head_object(Bucket=BUCKET, Key="profile-photo.jpg")
            return {"has_photo": True}
        except Exception:
            return {"has_photo": False}
    return {"has_photo": False}


@router.get("/photo")
def serve_photo():
    """Serve the profile photo from R2."""
    from src.core.upload import get_r2_client, BUCKET
    client = get_r2_client()
    if client:
        import io
        try:
            buf = io.BytesIO()
            client.download_fileobj(BUCKET, "profile-photo.jpg", buf)
            return StreamingResponse(io.BytesIO(buf.getvalue()), media_type="image/jpeg")
        except Exception:
            raise HTTPException(404, "Photo not found")
    raise HTTPException(404, "Photo not found")


@router.get("/download/{file_path:path}")
def download_file(file_path: str):
    """Serve a file from DIST_DIR (PDF or LaTeX)."""
    target = DIST_DIR / file_path
    if not target.exists() or not target.is_file():
        raise HTTPException(404, "File not found")
    media_type = "application/pdf" if target.suffix == ".pdf" else "text/plain"
    return FileResponse(str(target), media_type=media_type, filename=target.name)


@router.get("/download-bundle/{file_path:path}")
def download_bundle(file_path: str):
    """Generate a ZIP bundle from a .tex file + profile photo."""
    tex_path = file_path
    if not tex_path.endswith(".tex"):
        tex_path += ".tex"
    target = DIST_DIR / tex_path
    if not target.exists():
        raise HTTPException(404, "LaTeX source not found")
    
    latex = target.read_text()
    latex = latex.replace("../assets/profile-photo.jpg", "profile.jpg")
    latex = latex.replace(str(PROFILE_PHOTO), "profile.jpg")
    
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "a", zipfile.ZIP_DEFLATED, False) as zf:
        zf.writestr("resume.tex", latex)
        if PROFILE_PHOTO.exists():
            zf.write(str(PROFILE_PHOTO), "profile.jpg")
        zf.writestr("INSTRUCTIONS.txt", _bundle_instructions())
    zip_buf.seek(0)
    base_name = Path(tex_path).stem
    return StreamingResponse(
        zip_buf,
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": f'attachment; filename="{base_name}.zip"'},
    )


# ── Config ────────────────────────────────────────────────────────────────────

@router.get("/get-config")
def get_config(request: Request):
    user_id = get_user_id(request)
    return get_full_config(user_id)


@router.post("/save-config")
async def save_config(request: Request):
    user_id = get_user_id(request)
    data = await request.json()
    save_full_config(user_id, data)
    return {"ok": True}

# ── Templates (Cloud) ──────────────────────────────────────────────────────────

@router.get("/api/templates")
def list_custom_templates(request: Request):
    user_id = get_user_id(request)
    return {"templates": db.get_templates(user_id)}

@router.get("/api/templates/{template_id}")
def get_custom_template(template_id: str, request: Request):
    user_id = get_user_id(request)
    tpl = db.get_template(user_id, template_id)
    if not tpl:
        raise HTTPException(404, "Template not found")
    return tpl

@router.post("/api/templates/{template_id}")
async def save_custom_template(template_id: str, request: Request):
    user_id = get_user_id(request)
    data = await request.json()
    data["id"] = template_id
    db.save_template(user_id, data)
    return {"ok": True, "template": data}

@router.delete("/api/templates/{template_id}")
def delete_custom_template(template_id: str, request: Request):
    user_id = get_user_id(request)
    db.delete_template(user_id, template_id)
    return {"ok": True}

# ── Settings (Firebase) ───────────────────────────────────────────────────────

@router.get("/api/settings")
def get_settings_route(request: Request):
    user_id = get_user_id(request)
    return db.get_settings(user_id)

@router.post("/api/settings")
async def save_settings_route(request: Request):
    user_id = get_user_id(request)
    data = await request.json()
    db.save_settings(user_id, data)
    _settings_cache.pop(user_id, None)
    return {"ok": True}

@router.get("/api/settings/pick-folder")
def pick_folder_route():
    import subprocess
    try:
        # Use zenity to open a directory selection dialog on the host (since run.sh is native Linux)
        result = subprocess.run(
            ["zenity", "--file-selection", "--directory", "--title=Select Export Folder"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            folder_path = result.stdout.strip()
            return {"folder": folder_path}
        else:
            return {"folder": None}
    except Exception as e:
        print(f"Failed to open folder picker: {e}")
        return {"folder": None}

def _build_pdf_name(settings: dict, role: str = '') -> str:
    prefix = settings.get('file_name_prefix', 'RESUME-')
    safe = re.sub(r'[^\w\-_]', '_', role or 'resume').strip('_')
    return f"{prefix}{safe}"

@router.post("/api/export-pdf-local")
async def export_pdf_local_route(request: Request):
    user_id = get_user_id(request)
    data = await request.json()
    config = data.get("config")

    settings = _get_cached_settings(user_id)
    export_folder = settings.get("export_folder")

    if not export_folder:
        raise HTTPException(400, "No export folder set. Go to Settings to configure it.")

    pdf_name = data.get("pdf_name") or _build_pdf_name(settings, data.get('role', ''))

    target_dir = Path(export_folder)

    pdf_bytes = None
    if config:
        include_photo = data.get("include_photo", False)
        from src.core.build import build_custom_version
        pdf_bytes = build_custom_version(config, pdf_name, include_photo, user_id=user_id)
    if pdf_bytes:
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / f"{pdf_name}.pdf"
        await asyncio.to_thread(target_path.write_bytes, pdf_bytes)
        return {"ok": True, "path": str(target_path)}

    try:
        from src.core.upload import get_r2_client
        client = get_r2_client()
        if client:
            target_dir.mkdir(parents=True, exist_ok=True)
            target_path = target_dir / f"{pdf_name}.pdf"
            with open(target_path, "wb") as f:
                await asyncio.to_thread(client.download_fileobj, BUCKET, f"pdfs/{pdf_name}.pdf", f)
            return {"ok": True, "path": str(target_path)}
    except Exception:
        pass

    raise HTTPException(404, f"PDF {pdf_name}.pdf not found. Generate it first.")

@router.get("/api/template/{filename}")
def get_template(filename: str):
    tpl_path = ROOT / "templates" / "tex" / filename
    if not tpl_path.exists() or not tpl_path.suffix == ".tex":
        raise HTTPException(404, "Template not found")
    return {"content": tpl_path.read_text(), "filename": filename}

# ── Full User Backup / Restore ────────────────────────────────────────────────

def _base64_file(path: Path) -> str | None:
    try:
        if path.exists() and path.is_file():
            import base64
            with open(path, "rb") as f:
                return base64.b64encode(f.read()).decode()
    except Exception as e:
        print(f"Failed to read {path}: {e}")
    return None


def _r2_download_base64(r2_key: str) -> dict | None:
    from src.core.upload import get_r2_client, BUCKET
    import io, base64
    client = get_r2_client()
    if not client:
        return None
    try:
        buf = io.BytesIO()
        client.download_fileobj(BUCKET, r2_key, buf)
        buf.seek(0)
        ext = Path(r2_key).suffix or ".bin"
        return {
            "filename": Path(r2_key).name,
            "content": base64.b64encode(buf.read()).decode(),
            "encoding": "base64",
        }
    except Exception as e:
        print(f"R2 download failed for {r2_key}: {e}")
    return None


def _load_bookmarks_data():
    return _load_bookmarks()

def _save_bookmarks_data(bookmarks: list):
    _save_bookmarks(bookmarks)


@router.post("/api/export-backup", response_class=StreamingResponse)
def export_backup(request: Request):
    """Export ALL user data as a single JSON backup (incl. base64 images).

    Streams progress events (SSE-style), then sends the full backup JSON
    as the final event with type='file' and the base64-encoded content.
    """
    user_id = get_user_id(request)

    yield _sse_emit("init", "start", message="Starting backup...")

    # 1. Core resume data
    yield _sse_emit("personal", "fetching")
    personal = db.get_personal(user_id)
    yield _sse_emit("personal", "done")

    yield _sse_emit("library", "fetching")
    library = db.get_library(user_id)
    yield _sse_emit("library", "done")

    yield _sse_emit("recipes", "fetching")
    recipes = db.get_recipes(user_id)
    yield _sse_emit("recipes", "done")

    yield _sse_emit("settings", "fetching")
    settings = db.get_settings(user_id)
    yield _sse_emit("settings", "done")

    # 2. Applications with versions
    yield _sse_emit("applications", "fetching")
    apps_raw = db.get_all_applications(user_id)
    applications = []
    for app in apps_raw:
        app_id = app.get("id", "")
        versions = db.get_app_versions(user_id, app_id) if app_id else []
        applications.append({**app, "versions": versions})
    yield _sse_emit("applications", "done", count=len(applications))

    # 3. Checkpoints
    yield _sse_emit("checkpoints", "fetching")
    checkpoint_names = db.list_checkpoints(user_id)
    checkpoints = {}
    for name in checkpoint_names:
        data = db.get_checkpoint(user_id, name)
        if data:
            checkpoints[name] = data
    yield _sse_emit("checkpoints", "done", count=len(checkpoints))

    # 4. Assets — profile photo
    yield _sse_emit("profile_photo", "fetching")
    assets = {}
    photo_b64 = _base64_file(PROFILE_PHOTO)
    if photo_b64:
        assets["profile_photo"] = {
            "filename": "profile-photo.jpg",
            "content": photo_b64,
            "encoding": "base64",
        }
    yield _sse_emit("profile_photo", "done" if photo_b64 else "skipped")

    # 5. All images from R2 (photos, any uploaded images)
    yield _sse_emit("r2_images", "fetching")
    r2_images = {}
    from src.core.upload import get_r2_client, list_r2_objects_all
    r2_objects = list_r2_objects_all()
    image_exts = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".ico"}
    for key in r2_objects:
        ext = Path(key).suffix.lower()
        if ext in image_exts:
            asset = _r2_download_base64(key)
            if asset:
                r2_images[key] = asset
    if r2_images:
        assets["r2_images"] = r2_images
    yield _sse_emit("r2_images", "done", count=len(r2_images))

    # 6. Bookmarks (local file)
    yield _sse_emit("bookmarks", "fetching")
    bookmarks = _load_bookmarks_data()
    yield _sse_emit("bookmarks", "done", count=len(bookmarks))

    # 7. Build final backup (NO user metadata — just pure data)
    yield _sse_emit("finalizing", "start")
    backup = {
        "version": 2,
        "exported_at": datetime.now().isoformat(),
        "data": {
            "personal": personal,
            "library": library,
            "recipes": recipes,
            "settings": settings,
            "applications": applications,
            "checkpoints": checkpoints,
        },
        "assets": assets,
        "bookmarks": bookmarks,
    }

    import json as _json
    json_bytes = _json.dumps(backup, indent=2, default=str).encode("utf-8")
    yield _sse_emit("file", "ready", content=_json.dumps({
        "filename": f"resume_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
        "size": len(json_bytes),
    }))
    yield _sse_emit("data", "complete", payload=backup)


@router.post("/api/import-backup")
async def import_backup(request: Request):
    """Restore ALL user data from a full backup JSON.

    Streams SSE-style progress events during restore.
    """
    user_id = get_user_id(request)
    body = await request.json()

    data = body.get("data", {})
    assets = body.get("assets", {})
    bookmarks = body.get("bookmarks")

    def generate():
        # 1. Core resume data
        yield _sse_emit("personal", "restoring")
        if "personal" in data:
            db.save_personal(user_id, data["personal"])
        yield _sse_emit("personal", "done")

        yield _sse_emit("library", "restoring")
        if "library" in data:
            db.save_library(user_id, data["library"])
        yield _sse_emit("library", "done")

        yield _sse_emit("recipes", "restoring")
        if "recipes" in data:
            db.save_recipes(user_id, data["recipes"])
        yield _sse_emit("recipes", "done")

        yield _sse_emit("settings", "restoring")
        if "settings" in data:
            db.save_settings(user_id, data["settings"])
        yield _sse_emit("settings", "done")

        # 2. Applications → replace all
        yield _sse_emit("applications", "clearing")
        existing_apps = db.get_all_applications(user_id)
        for app in existing_apps:
            app_id = app.get("id")
            if app_id:
                v_docs = db.get_app_versions(user_id, app_id)
                for v in v_docs:
                    v_id = v.get("id")
                    if v_id:
                        db.delete_app_version(user_id, app_id, v_id)
                db.delete_application(user_id, app_id)

        apps_list = data.get("applications", [])
        yield _sse_emit("applications", "restoring", count=len(apps_list))
        for app in apps_list:
            versions = app.pop("versions", [])
            db.save_application(user_id, app)
            app_id = app.get("id", "")
            if app_id:
                for v in versions:
                    db.save_app_version(user_id, app_id, v)
        yield _sse_emit("applications", "done", count=len(apps_list))

        # 3. Checkpoints → replace all
        yield _sse_emit("checkpoints", "clearing")
        existing_cps = db.list_checkpoints(user_id)
        for name in existing_cps:
            db.delete_checkpoint(user_id, name)
        cp_data = data.get("checkpoints", {})
        yield _sse_emit("checkpoints", "restoring", count=len(cp_data))
        for name, cp in cp_data.items():
            db.save_checkpoint(user_id, name, cp)
        yield _sse_emit("checkpoints", "done", count=len(cp_data))

        # 4. Profile photo
        yield _sse_emit("profile_photo", "restoring")
        profile = assets.get("profile_photo", {})
        if profile.get("content") and profile.get("encoding") == "base64":
            import base64
            try:
                raw = base64.b64decode(profile["content"])
                PROFILE_PHOTO.parent.mkdir(parents=True, exist_ok=True)
                with open(PROFILE_PHOTO, "wb") as f:
                    f.write(raw)
                yield _sse_emit("profile_photo", "done")
            except Exception as e:
                yield _sse_emit("profile_photo", "error", message=str(e))
        else:
            yield _sse_emit("profile_photo", "skipped")

        # 5. All R2 images → upload back
        r2_images = assets.get("r2_images", {})
        if r2_images:
            yield _sse_emit("r2_images", "uploading", count=len(r2_images))
            from src.core.upload import get_r2_client, BUCKET
            import base64, io
            r2_client = get_r2_client()
            if r2_client:
                success = 0
                for r2_key, photo in r2_images.items():
                    if photo.get("content") and photo.get("encoding") == "base64":
                        try:
                            raw = base64.b64decode(photo["content"])
                            ct = "image/jpeg"
                            if photo.get("filename", "").endswith(".png"):
                                ct = "image/png"
                            elif photo.get("filename", "").endswith(".gif"):
                                ct = "image/gif"
                            elif photo.get("filename", "").endswith(".webp"):
                                ct = "image/webp"
                            r2_client.upload_fileobj(
                                io.BytesIO(raw), BUCKET, r2_key,
                                ExtraArgs={"ContentType": ct},
                            )
                            success += 1
                        except Exception as e:
                            print(f"Failed to restore {r2_key}: {e}")
                yield _sse_emit("r2_images", "done", count=success)
        else:
            yield _sse_emit("r2_images", "skipped")

        # 6. Bookmarks
        yield _sse_emit("bookmarks", "restoring")
        if bookmarks is not None:
            _save_bookmarks_data(bookmarks)
        yield _sse_emit("bookmarks", "done", count=len(bookmarks or []))

        yield _sse_emit("complete", "done", message="Backup restored successfully")

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/api/r2-backup")
def trigger_r2_backup():
    from src.core.upload import get_r2_client, BUCKET
    client = get_r2_client()
    if not client:
        raise HTTPException(500, "R2 not configured")
        
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"backups/resume_workspace_{timestamp}.zip"
    
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED, False) as zf:
        for f in (ROOT / "configs").glob("*"):
            if f.is_file(): zf.write(str(f), arcname=f"configs/{f.name}")
        for f in (ROOT / "templates").glob("*"):
            if f.is_file(): zf.write(str(f), arcname=f"templates/{f.name}")
    
    zip_buf.seek(0)
    try:
        client.upload_fileobj(zip_buf, BUCKET, filename)
        return {"ok": True, "filename": filename}
    except Exception as e:
        return {"ok": False, "error": str(e)}



# ── File listing ──────────────────────────────────────────────────────────────

@router.get("/list-files")
def list_files(request: Request):
    user_id = get_user_id(request)
    
    r2_objects = list_r2_objects()
    files = []
    
    # Cloud files (R2)
    # Build a lookup map from r2_key -> {company, version_name}
    key_to_meta = {}
    try:
        apps = db.get_all_applications(user_id)
        
        # We fetch all versions iteratively instead of collection group to stay db-agnostic
        for app in apps:
            app_id = app["id"]
            versions = db.get_app_versions(user_id, app_id)
            for v in versions:
                pdf_key = v.get("pdf_r2_key")
                if pdf_key:
                    company = app.get("company", "Unknown App")
                    key_to_meta[pdf_key] = f"{company} - {v.get('name', 'Custom Version')}"
    except Exception as e:
        print(f"Failed to load apps for list-files: {e}")

    for key in r2_objects:
        if key.endswith(".pdf"):
            display_name = key.split("/")[-1]
            if key in key_to_meta:
                display_name = f"{key_to_meta[key]}.pdf"
            elif "/" in key:
                parts = key.split("/")
                if len(parts) >= 2:
                    display_name = f"[{parts[0]}] {parts[-1]}"

            files.append({
                "name": display_name,
                "path": key,
                "sync_status": "synced",
                "type": "cloud"
            })
            
    return sorted(files, key=lambda x: x["name"])


@router.get("/cloud-pdf/{key:path}")
def view_cloud_pdf(key: str):
    from src.core.upload import get_r2_client, BUCKET
    from fastapi.responses import RedirectResponse
    client = get_r2_client()
    if not client:
        raise HTTPException(500, "R2 not configured")
    try:
        url = client.generate_presigned_url(
            'get_object', Params={'Bucket': BUCKET, 'Key': key}, ExpiresIn=3600
        )
        return RedirectResponse(url)
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Bookmark Compile / Download ────────────────────────────────────────────────

@router.post("/bookmarks/{bm_id}/compile-pdf")
def compile_bookmark_pdf(bm_id: str, include_photo: bool = False):
    from src.core.build import build_custom_version
    import re as _re
    bookmarks = _load_bookmarks()
    bm = next((b for b in bookmarks if b["id"] == bm_id), None)
    if not bm:
        raise HTTPException(404, "Bookmark not found")

    safe_name = _re.sub(r'[^\w\-_]', '_', bm["name"])
    pdf_name = f"bm_{safe_name}"
    suffix = "_X" if include_photo else ""

    pdf_bytes = build_custom_version(bm["data"], pdf_name, include_photo)
    if not pdf_bytes:
        raise HTTPException(500, "Failed to compile PDF")

    (DIST_DIR / f"{pdf_name}{suffix}.pdf").write_bytes(pdf_bytes)
    return {"pdf": f"{pdf_name}{suffix}.pdf"}


@router.get("/bookmarks/{bm_id}/download-latex")
def download_bookmark_latex(bm_id: str, include_photo: bool = False):
    from src.core.build import generate_latex_source
    import re as _re
    bookmarks = _load_bookmarks()
    bm = next((b for b in bookmarks if b["id"] == bm_id), None)
    if not bm:
        raise HTTPException(404, "Bookmark not found")

    safe_name = _re.sub(r'[^\w\-_]', '_', bm["name"])
    latex = generate_latex_source(bm["data"], safe_name, include_photo)
    if not latex:
        raise HTTPException(500, "Failed to generate LaTeX source")

    suffix = "_X" if include_photo else ""
    filename = f"{safe_name}{suffix}.tex"
    return StreamingResponse(
        io.BytesIO(latex.encode("utf-8")),
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/bookmarks/{bm_id}/download-zip")
def download_bookmark_zip(bm_id: str):
    from src.core.build import generate_latex_source
    import re as _re
    bookmarks = _load_bookmarks()
    bm = next((b for b in bookmarks if b["id"] == bm_id), None)
    if not bm:
        raise HTTPException(404, "Bookmark not found")

    safe_name = _re.sub(r'[^\w\-_]', '_', bm["name"])
    latex = generate_latex_source(bm["data"], safe_name, include_photo=True)
    if not latex:
        raise HTTPException(500, "Failed to generate LaTeX source")

    latex = latex.replace("../assets/profile-photo.jpg", "profile.jpg")
    latex = latex.replace(str(PROFILE_PHOTO), "profile.jpg")

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "a", zipfile.ZIP_DEFLATED, False) as zf:
        zf.writestr("resume.tex", latex)
        if PROFILE_PHOTO.exists():
            zf.write(str(PROFILE_PHOTO), "profile.jpg")
        zf.writestr("INSTRUCTIONS.txt", _bundle_instructions())

    zip_buf.seek(0)
    return StreamingResponse(
        zip_buf,
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.zip"'},
    )


# ── Downloads ─────────────────────────────────────────────────────────────────





# ── Build ─────────────────────────────────────────────────────────────────────

@router.get("/build/{role}")
def build_role_stream(role: str, request: Request):
    user_id = get_user_id(request)
    def stream():
        cmd = (
            [sys.executable, str(BUILD_PY), "all", "--user", user_id]
            if role == "all"
            else [sys.executable, str(BUILD_PY), role, "--user", user_id]
        )
        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, cwd=str(ROOT),
        )
        for line in proc.stdout:
            yield line
        proc.wait()

    return StreamingResponse(stream(), media_type="text/plain")


# ── R2 Upload ─────────────────────────────────────────────────────────────────

@router.get("/upload/{filename}")
def upload_file_route(filename: str):
    return upload_pdf(filename)

@router.post("/upload-all")
def upload_all_files():
    from src.core.config import DIST_DIR
    import concurrent.futures
    pdfs = list(DIST_DIR.glob("*.pdf"))
    if not pdfs:
        return {"ok": False, "message": "No PDFs found."}
        
    success = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(upload_pdf, p.name): p.name for p in pdfs}
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res.get("ok"):
                success.append(futures[future])
    
    return {"ok": True, "message": f"Uploaded {len(success)} of {len(pdfs)} files."}

@router.get("/share/{filename}")
def public_share_page(filename: str):
    from src.core.upload import get_r2_client, BUCKET
    from fastapi.responses import HTMLResponse
    
    client = get_r2_client()
    if not client:
        return HTMLResponse("<h1>Error: Cloud Storage not configured</h1>", status_code=500)
        
    try:
        # Generate a 7-day valid link for the PDF
        url = client.generate_presigned_url(
            'get_object',
            Params={'Bucket': BUCKET, 'Key': filename},
            ExpiresIn=3600 * 24 * 7
        )
        
        # Just default values for public share (user_id not easily available)
        user_name = "Candidate"
        user_email = ""
        user_initial = "C"
        
        # Load the presentation template
        template_path = ROOT / "templates" / "share.html"
        html = template_path.read_text()
        
        # Inject the dynamic data
        html = html.replace("{{ PDF_URL }}", url)
        html = html.replace("{{ ROLE_NAME }}", filename.replace(".pdf", "").replace("_", " "))
        html = html.replace("{{ USER_NAME }}", user_name)
        html = html.replace("{{ USER_EMAIL }}", user_email)
        html = html.replace("{{ USER_INITIAL }}", user_initial)
        
        return HTMLResponse(html)
    except Exception as e:
        return HTMLResponse(f"<h1>Error loading document</h1><p>{str(e)}</p>", status_code=500)




