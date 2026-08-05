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

@router.put("/bookmarks/{bm_id}")
def update_bookmark(bm_id: str, req: BookmarkCreate):
    bookmarks = _load_bookmarks()
    for bm in bookmarks:
        if bm.get("id") == bm_id:
            bm["name"] = req.name
            bm["data"] = req.data
            bm["updated_at"] = datetime.now().isoformat()
            _save_bookmarks(bookmarks)
            return {"ok": True, "bookmark": bm}
    raise HTTPException(404, "Bookmark not found")

@router.delete("/bookmarks/{bm_id}")
def delete_bookmark(bm_id: str):
    bookmarks = _load_bookmarks()
    bookmarks = [b for b in bookmarks if b.get("id") != bm_id]
    _save_bookmarks(bookmarks)
    return {"ok": True}


class DirectCompileRequest(BaseModel):
    config: dict
    name: str = "resume"
    pdf_name: str | None = None
    type: str = "resume"
    include_photo: bool = False

@router.post("/compile-direct")
def compile_direct(req: DirectCompileRequest, request: Request = None):
    from src.core.build import build_variant
    from src.core.config import load_resume_config, TEMPLATE_PHOTO, TEMPLATE_PLAIN, TEMPLATE_COVER_LETTER, PROFILE_PHOTO
    import re as _re
    import tempfile, json, os
    from pathlib import Path

    user_id = getattr(request.state, "user_id", None) if request and hasattr(request, "state") else None
    raw_name = req.pdf_name or req.name or "resume"
    safe_name = _re.sub(r'[^\w\-_]', '_', raw_name)

    if req.type == "cover_letter":
        template = TEMPLATE_COVER_LETTER
        suffix = "_Cover_Letter"
        photo_to_use = None
    else:
        template = TEMPLATE_PHOTO if req.include_photo else TEMPLATE_PLAIN
        suffix = "_X" if req.include_photo else ""
        photo_to_use = PROFILE_PHOTO if req.include_photo else None

    if user_id:
        from src.services.resume_service import get_full_config
        main_config = get_full_config(user_id)
    else:
        main_config = load_resume_config()

    full_config = {
        "personal": dict(main_config.get("personal", {})),
        "library": dict(main_config.get("library", {})),
    }

    rec_obj = req.config.get("recipe") if (isinstance(req.config, dict) and "recipe" in req.config) else (req.config.get("resume_template") if (isinstance(req.config, dict) and "resume_template" in req.config) else None)
    if isinstance(rec_obj, dict):
        v_data = dict(rec_obj)
        if "cover_letter" not in v_data and "email" in req.config:
            v_data["cover_letter"] = req.config["email"]
        elif "cover_letter" in req.config and "cover_letter" not in v_data:
            v_data["cover_letter"] = req.config["cover_letter"]
    else:
        v_data = dict(req.config)

    if "personal" in req.config and isinstance(req.config["personal"], dict):
        full_config["personal"].update(req.config["personal"])
    elif "personal" in v_data and isinstance(v_data["personal"], dict):
        full_config["personal"].update(v_data["personal"])

    full_config.update(v_data)

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
        json.dump(full_config, tmp)
        tmp_path = tmp.name

    try:
        success = build_variant(tmp_path, safe_name, template, suffix, photo_to_use, user_id=user_id)
        if not success:
            raise HTTPException(500, "Failed to compile PDF")
        return {"pdf": f"{safe_name}{suffix}.pdf"}
    finally:
        Path(tmp_path).unlink(missing_ok=True)

@router.post("/download-latex-direct")
def download_latex_direct(req: DirectCompileRequest, request: Request = None):
    from src.core.build import generate_latex_source
    import re as _re
    user_id = getattr(request.state, "user_id", None) if request and hasattr(request, "state") else None
    safe_name = _re.sub(r'[^\w\-_]', '_', req.name)
    suffix = "_X" if req.include_photo else ""
    latex = generate_latex_source(req.config, safe_name, req.include_photo, user_id=user_id)
    if not latex:
        raise HTTPException(500, "Failed to generate LaTeX source")
    return StreamingResponse(
        io.BytesIO(latex.encode("utf-8")),
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}{suffix}.tex"'},
    )

@router.post("/download-zip-direct")
def download_zip_direct(req: DirectCompileRequest, request: Request = None):
    from src.core.build import generate_latex_source
    import re as _re
    user_id = getattr(request.state, "user_id", None) if request and hasattr(request, "state") else None
    safe_name = _re.sub(r'[^\w\-_]', '_', req.name)
    latex = generate_latex_source(req.config, safe_name, include_photo=True, user_id=user_id)
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
    config = data.get("config")
    pdf_name = data.get("pdf_name", "")
    preview_type = data.get("type", "resume")
    include_photo = data.get("include_photo", False)

    from src.core.firebase import get_settings
    settings = get_settings()
    export_folder = settings.get("export_folder")

    if not export_folder:
        raise HTTPException(400, "No export folder specified in settings.")

    if not config:
        raise HTTPException(400, "Missing config in request body")

    if not pdf_name:
        prefix = settings.get("file_name_prefix", "YOUR_NAME-") if isinstance(settings, dict) else "YOUR_NAME-"
        role = config.get("role_title", "")
        import re
        safe_role = re.sub(r'[^a-zA-Z0-9_-]', '_', role.strip()).strip('_') if role else "resume"
        pdf_name = f"{prefix}{safe_role}"

    from pathlib import Path

    if not pdf_name.endswith(".pdf"):
        pdf_name = f"{pdf_name}.pdf"

    target_dir = Path(export_folder)
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / pdf_name

    import shutil
    import json
    import tempfile
    import subprocess
    import os
    from src.core.config import (
        TEMPLATE_PLAIN, TEMPLATE_PHOTO, TEMPLATE_COVER_LETTER,
        PROFILE_PHOTO, DIST_DIR, load_resume_config,
    )
    from src.core.generate import generate_resume

    main_config = load_resume_config()
    full_config = {
        "personal": main_config.get("personal", {}),
        "library": main_config.get("library", {}),
    }

    if "library" in config:
        for lib_type, lib_items in config["library"].items():
            if lib_type not in full_config["library"]:
                full_config["library"][lib_type] = {}
            full_config["library"][lib_type].update(lib_items)
    v_data = {k: v for k, v in config.items() if k != "library"}
    full_config.update(v_data)

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
        json.dump(full_config, tmp)
        tmp_config_path = tmp.name

    tmp_dir = Path(tmp_config_path).parent
    tmp_tex_path = str(tmp_dir / f"export_{os.getpid()}.tex")

    try:
        if preview_type == "cover_letter":
            template = TEMPLATE_COVER_LETTER
        elif include_photo:
            template = TEMPLATE_PHOTO
        else:
            template = TEMPLATE_PLAIN

        generate_resume(
            tmp_config_path, str(template), tmp_tex_path,
            photo_path=str(PROFILE_PHOTO) if include_photo else None,
        )

        from src.core.config import find_pdflatex
        pdflatex_cmd = find_pdflatex()
        if not pdflatex_cmd:
            raise HTTPException(400, "LaTeX compiler 'pdflatex' not found.")

        subprocess.run(
            [pdflatex_cmd, "-interaction=nonstopmode",
             "-output-directory", str(tmp_dir), tmp_tex_path],
            capture_output=True, timeout=60,
        )

        pdf_file = Path(tmp_tex_path).with_suffix(".pdf")
        if not pdf_file.exists():
            raise HTTPException(500, "PDF compilation failed.")

        shutil.copy2(str(pdf_file), str(target_path))
        shutil.copy2(str(pdf_file), str(DIST_DIR / pdf_name))

        return {"ok": True, "path": str(target_path)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to copy to export folder: {str(e)}")

@router.get("/api/template/{filename}")
def get_template(filename: str):
    tpl_path = ROOT / "templates" / "tex" / filename
    if not tpl_path.exists() or not tpl_path.suffix == ".tex":
        raise HTTPException(404, "Template not found")
    return {"content": tpl_path.read_text(), "filename": filename}

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
def compile_bookmark_pdf(bm_id: str, include_photo: bool = False, request: Request = None):
    from src.core.build import build_custom_version
    import re as _re
    bookmarks = _load_bookmarks()
    bm = next((b for b in bookmarks if b["id"] == bm_id), None)
    if not bm:
        raise HTTPException(404, "Bookmark not found")

    user_id = getattr(request.state, "user_id", None) if request and hasattr(request, "state") else None
    safe_name = _re.sub(r'[^\w\-_]', '_', bm["name"])
    pdf_name = f"bm_{safe_name}"
    suffix = "_X" if include_photo else ""

    success = build_custom_version(bm["data"], pdf_name, include_photo, user_id=user_id)
    if not success:
        raise HTTPException(500, "Failed to compile PDF")

    return {"pdf": f"{pdf_name}{suffix}.pdf"}


@router.get("/bookmarks/{bm_id}/download-latex")
def download_bookmark_latex(bm_id: str, include_photo: bool = False, request: Request = None):
    from src.core.build import generate_latex_source
    import re as _re
    bookmarks = _load_bookmarks()
    bm = next((b for b in bookmarks if b["id"] == bm_id), None)
    if not bm:
        raise HTTPException(404, "Bookmark not found")

    user_id = getattr(request.state, "user_id", None) if request and hasattr(request, "state") else None
    safe_name = _re.sub(r'[^\w\-_]', '_', bm["name"])
    latex = generate_latex_source(bm["data"], safe_name, include_photo, user_id=user_id)
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
def download_bookmark_zip(bm_id: str, request: Request = None):
    from src.core.build import generate_latex_source
    import re as _re
    bookmarks = _load_bookmarks()
    bm = next((b for b in bookmarks if b["id"] == bm_id), None)
    if not bm:
        raise HTTPException(404, "Bookmark not found")

    user_id = getattr(request.state, "user_id", None) if request and hasattr(request, "state") else None
    safe_name = _re.sub(r'[^\w\-_]', '_', bm["name"])
    latex = generate_latex_source(bm["data"], safe_name, include_photo=True, user_id=user_id)
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
