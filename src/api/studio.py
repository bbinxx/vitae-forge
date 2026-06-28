"""
src/api/studio.py
FastAPI router for resume build, file management, config I/O,
photo upload, and resume snapshot (custom one-off recipe) endpoints.
"""
import sys
import io
import copy
import zipfile
import subprocess
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from PIL import Image

from src.core.config import (
    ROOT, DIST_DIR, ASSETS_DIR, PROFILE_PHOTO,
)
from src.core.upload import md5_of_file, list_r2_objects, upload_pdf, BUCKET
from src.core.build import build_role, build_all, clean

from src.db import db
from src.services.resume_service import get_full_config, save_full_config
import src.services.checkpoint_service as cps

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
        return json.loads(BOOKMARKS_FILE.read_text())
    return []

def _save_bookmarks(bookmarks):
    import json
    BOOKMARKS_FILE.parent.mkdir(parents=True, exist_ok=True)
    BOOKMARKS_FILE.write_text(json.dumps(bookmarks, indent=4))

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
    success = build_custom_version(req.config, safe_name, req.include_photo)
    if not success:
        raise HTTPException(500, "Failed to compile PDF")
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
    latex = generate_latex_source(req.config, safe_name, include_photo=True)
    if not latex:
        raise HTTPException(500, "Failed to generate LaTeX source")
    latex = latex.replace("../assets/profile-photo.jpg", "profile.jpg")
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

@router.post("/api/export-pdf-local")
async def export_pdf_local_route(request: Request):
    data = await request.json()
    pdf_name = data.get("pdf_name")
    if not pdf_name:
        raise HTTPException(400, "Missing pdf_name")
        
    from src.core.firebase import get_settings
    settings = get_settings()
    export_folder = settings.get("export_folder")
    
    if not export_folder:
        raise HTTPException(400, "No export folder specified in settings.")
        
    import shutil
    import os
    from src.core.config import DIST_DIR
    from pathlib import Path
    
    source_pdf = DIST_DIR / f"{pdf_name}.pdf"
    if not source_pdf.exists():
        raise HTTPException(404, f"PDF {pdf_name}.pdf not found. Generate it first.")
        
    target_dir = Path(export_folder)
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / f"{pdf_name}.pdf"
        shutil.copy2(source_pdf, target_path)
        return {"ok": True, "path": str(target_path)}
    except Exception as e:
        raise HTTPException(500, f"Failed to copy to export folder: {str(e)}")

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
    import json
    if BOOKMARKS_FILE.exists():
        try:
            return json.loads(BOOKMARKS_FILE.read_text())
        except Exception:
            return []
    return []


def _save_bookmarks_data(bookmarks: list):
    import json
    BOOKMARKS_FILE.parent.mkdir(parents=True, exist_ok=True)
    BOOKMARKS_FILE.write_text(json.dumps(bookmarks, indent=4))


@router.get("/api/export-backup")
def export_backup(request: Request):
    """Export ALL user data as a single JSON backup (incl. base64 images)."""
    user_id = get_user_id(request)
    user = db.get_user_by_id(user_id)

    # 1. Core resume data
    personal = db.get_personal(user_id)
    library = db.get_library(user_id)
    recipes = db.get_recipes(user_id)
    settings = db.get_settings(user_id)

    # 2. Applications with versions
    apps_raw = db.get_all_applications(user_id)
    applications = []
    for app in apps_raw:
        app_id = app.get("id", "")
        versions = db.get_app_versions(user_id, app_id) if app_id else []
        applications.append({**app, "versions": versions})

    # 3. Checkpoints
    checkpoint_names = db.list_checkpoints(user_id)
    checkpoints = {}
    for name in checkpoint_names:
        data = db.get_checkpoint(user_id, name)
        if data:
            checkpoints[name] = data

    # 4. Assets — profile photo
    assets = {}
    photo_b64 = _base64_file(PROFILE_PHOTO)
    if photo_b64:
        assets["profile_photo"] = {
            "filename": "profile-photo.jpg",
            "content": photo_b64,
            "encoding": "base64",
        }

    # 5. Application photos from R2
    from src.core.upload import get_r2_client
    r2_client = get_r2_client()
    app_photos = {}
    if r2_client:
        seen_keys = set()
        for app in applications:
            for v in app.get("versions", []):
                key = v.get("photo_r2_key", "")
                if key and key not in seen_keys:
                    seen_keys.add(key)
                    asset = _r2_download_base64(key)
                    if asset:
                        app_photos[key] = asset
        # Also check archived_pdf as potential image (unlikely but thorough)
        # — only pdfs, skip
    if app_photos:
        assets["application_photos"] = app_photos

    # 6. Bookmarks (local file)
    bookmarks = _load_bookmarks_data()

    backup = {
        "version": 2,
        "exported_at": datetime.now().isoformat(),
        "user": {
            "id": user_id,
            "username": (user or {}).get("username", ""),
        },
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

    import json
    json_str = json.dumps(backup, indent=2, default=str)
    return StreamingResponse(
        io.BytesIO(json_str.encode("utf-8")),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="resume_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json"'
        },
    )


@router.post("/api/import-backup")
async def import_backup(request: Request):
    """Restore ALL user data from a full backup JSON."""
    user_id = get_user_id(request)
    body = await request.json()

    data = body.get("data", {})
    assets = body.get("assets", {})
    bookmarks = body.get("bookmarks")

    # 1. Core resume data
    if "personal" in data:
        db.save_personal(user_id, data["personal"])
    if "library" in data:
        db.save_library(user_id, data["library"])
    if "recipes" in data:
        db.save_recipes(user_id, data["recipes"])
    if "settings" in data:
        db.save_settings(user_id, data["settings"])

    # 2. Applications → replace all (delete existing, re-save)
    existing_apps = db.get_all_applications(user_id)
    for app in existing_apps:
        app_id = app.get("id")
        if app_id:
            # Delete versions first
            v_docs = db.get_app_versions(user_id, app_id)
            for v in v_docs:
                v_id = v.get("id")
                if v_id:
                    db.delete_app_version(user_id, app_id, v_id)
            db.delete_application(user_id, app_id)

    for app in data.get("applications", []):
        versions = app.pop("versions", [])
        db.save_application(user_id, app)
        app_id = app.get("id", "")
        if app_id:
            for v in versions:
                db.save_app_version(user_id, app_id, v)

    # 3. Checkpoints → replace all
    existing_cps = db.list_checkpoints(user_id)
    for name in existing_cps:
        db.delete_checkpoint(user_id, name)
    for name, cp_data in data.get("checkpoints", {}).items():
        db.save_checkpoint(user_id, name, cp_data)

    # 4. Profile photo
    profile = assets.get("profile_photo", {})
    if profile.get("content") and profile.get("encoding") == "base64":
        import base64
        try:
            raw = base64.b64decode(profile["content"])
            PROFILE_PHOTO.parent.mkdir(parents=True, exist_ok=True)
            with open(PROFILE_PHOTO, "wb") as f:
                f.write(raw)
        except Exception as e:
            print(f"Failed to restore profile photo: {e}")

    # 5. Application photos → upload back to R2
    app_photos = assets.get("application_photos", {})
    if app_photos:
        from src.core.upload import get_r2_client, BUCKET
        import base64, io
        r2_client = get_r2_client()
        if r2_client:
            for r2_key, photo in app_photos.items():
                if photo.get("content") and photo.get("encoding") == "base64":
                    try:
                        raw = base64.b64decode(photo["content"])
                        r2_client.upload_fileobj(
                            io.BytesIO(raw), BUCKET, r2_key,
                            ExtraArgs={"ContentType": "image/jpeg"},
                        )
                    except Exception as e:
                        print(f"Failed to restore app photo {r2_key}: {e}")

    # 6. Bookmarks
    if bookmarks is not None:
        _save_bookmarks_data(bookmarks)

    return {"ok": True, "message": "Backup restored successfully"}


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

    success = build_custom_version(bm["data"], pdf_name, include_photo)
    if not success:
        raise HTTPException(500, "Failed to compile PDF")

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

@router.get("/presigned-url/{filename}")
def get_presigned_url(filename: str):
    from src.core.upload import get_r2_client, BUCKET
    client = get_r2_client()
    if not client:
        raise HTTPException(500, "R2 not configured")
    try:
        url = client.generate_presigned_url(
            'get_object',
            Params={'Bucket': BUCKET, 'Key': filename},
            ExpiresIn=3600 * 24 * 7 # 7 days
        )
        return {"ok": True, "url": url}
    except Exception as e:
        raise HTTPException(500, str(e))

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



# ── Resume Snapshot (custom one-off recipe) ───────────────────────────────────

class SnapshotRequest(BaseModel):
    base_recipe: str
    customizations: dict
    snapshot_name: str


@router.post("/snapshot-resume")
def create_snapshot(req: SnapshotRequest, request: Request):
    """
    Merge `base_recipe` with `customizations` and save as a new recipe.
    The snapshot recipe can then be built like any other role.
    """
    user_id = get_user_id(request)
    recipes = db.get_recipes(user_id)
    base = recipes.get(req.base_recipe)
    if not base:
        raise HTTPException(404, f"Base recipe '{req.base_recipe}' not found")

    merged = copy.deepcopy(base)
    merged.update(req.customizations)
    merged["_snapshot"] = True
    merged["_snapshot_base"] = req.base_recipe
    merged["_snapshot_created"] = datetime.now().isoformat()
    merged["short_name"] = req.snapshot_name.upper()[:8]

    snap_key = f"snap_{req.snapshot_name.lower().replace(' ', '_')}"
    recipes[snap_key] = merged
    db.save_recipes(user_id, recipes)
    return {"ok": True, "recipe_key": snap_key, "recipe": merged}


@router.delete("/snapshot-resume/{snap_key}")
def delete_snapshot(snap_key: str, request: Request):
    user_id = get_user_id(request)
    recipes = db.get_recipes(user_id)
    recipe = recipes.get(snap_key)
    if not recipe:
        raise HTTPException(404, "Snapshot not found")
    if not recipe.get("_snapshot"):
        raise HTTPException(400, "Only snapshot recipes can be deleted via this route")
    del recipes[snap_key]
    db.save_recipes(user_id, recipes)
    return {"ok": True}
