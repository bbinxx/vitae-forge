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

# ── Checkpoints (Version Control) ─────────────────────────────────────────────
@router.get("/checkpoints")
def list_checkpoints(request: Request):
    user_id = get_user_id(request)
    return cps.list_checkpoints(user_id)

class CheckpointRequest(BaseModel):
    custom_name: str = ""

@router.post("/checkpoints")
def create_checkpoint(req: CheckpointRequest, request: Request):
    user_id = get_user_id(request)
    config = get_full_config(user_id)
    name = cps.create_checkpoint(user_id, req.custom_name, config)
    return {"ok": True, "name": name}

@router.post("/checkpoints/{name}/restore")
def restore_checkpoint(name: str, request: Request):
    user_id = get_user_id(request)
    restored = cps.restore_checkpoint(user_id, name)
    if restored:
        return {"ok": True, "source": "db"}
    raise HTTPException(404, "Checkpoint not found")

@router.delete("/checkpoints/{name}")
def delete_checkpoint(name: str, request: Request):
    user_id = get_user_id(request)
    cps.delete_checkpoint(user_id, name)
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
        
    user_id = get_user_id(request)
    settings = db.get_settings(user_id)
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
    local_names = set()
    
    # Identify base builds
    config = get_full_config(user_id)
    name_raw = config.get("personal", {}).get("name", "Resume")
    base_prefix = name_raw.upper().replace(' ', '_')
    expected_base_builds = set()
    for role_id, recipe in config.get("recipes", {}).items():
        short = recipe.get("short_name", role_id)
        display = f"{base_prefix}_{short}"
        expected_base_builds.add(f"{display}.pdf")
        expected_base_builds.add(f"{display}_X.pdf")
    
    # 1. Local files
    if DIST_DIR.exists():
        for f in DIST_DIR.glob("*.pdf"):
            # Only include base builds in the file list
            if f.name not in expected_base_builds:
                continue
                
            local_hash = md5_of_file(f)
            local_names.add(f.name)
            if f.name in r2_objects:
                status = "synced" if r2_objects[f.name] == local_hash else "modified"
            else:
                status = "new"
            files.append({
                "name": f.name,
                "path": f.name,
                "sync_status": status,
                "type": "local"
            })
            
    # 2. Cloud files (R2)
    # Build a lookup map from r2_key -> {company, version_name}
    key_to_meta = {}
    try:
        apps = db.get_all_applications(user_id)
        apps_map = {app["id"]: app for app in apps if "id" in app}
        
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
        if key.endswith(".pdf") and key not in local_names:
            # Check if we should extract just the filename for display
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
                "sync_status": "cloud_only",
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


# ── Downloads ─────────────────────────────────────────────────────────────────

@router.get("/download/{filename}")
def download_file(filename: str):
    file_path = DIST_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404)
    return FileResponse(path=file_path, filename=filename)


@router.get("/download-bundle/{filename}")
def download_bundle(filename: str):
    if not filename.endswith(".tex"):
        filename += ".tex"
    tex_path = DIST_DIR / filename
    if not tex_path.exists():
        raise HTTPException(status_code=404)

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "a", zipfile.ZIP_DEFLATED, False) as zf:
        content = tex_path.read_text().replace(
            "../assets/profile-photo.jpg", "profile.jpg"
        )
        zf.writestr("resume.tex", content)
        if PROFILE_PHOTO.exists():
            zf.write(str(PROFILE_PHOTO), "profile.jpg")
        zf.writestr("INSTRUCTIONS.txt", _bundle_instructions())

    zip_buf.seek(0)
    stem = filename.replace(".tex", "")
    return StreamingResponse(
        zip_buf,
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": f'attachment; filename="resume_bundle_{stem}.zip"'},
    )


@router.get("/download-workspace-archive")
def download_workspace_archive():
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "a", zipfile.ZIP_DEFLATED, False) as zf:
        # Save configs
        for f in (ROOT / "configs").glob("*"):
            if f.is_file(): zf.write(str(f), arcname=f"configs/{f.name}")
        # Save templates
        for f in (ROOT / "templates").glob("*"):
            if f.is_file(): zf.write(str(f), arcname=f"templates/{f.name}")
        # Save assets
        for f in (ROOT / "assets").glob("*"):
            if f.is_file(): zf.write(str(f), arcname=f"assets/{f.name}")
        # Save dist (compiled pdfs and tracker_db)
        if DIST_DIR.exists():
            for f in DIST_DIR.glob("*"):
                if f.is_file(): zf.write(str(f), arcname=f"dist/{f.name}")
    
    zip_buf.seek(0)
    return StreamingResponse(
        zip_buf,
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": 'attachment; filename="resume_workspace_backup.zip"'},
    )


@router.get("/download-all-pdfs")
def download_all_pdfs():
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "a", zipfile.ZIP_DEFLATED, False) as zf:
        if DIST_DIR.exists():
            for f in DIST_DIR.glob("*.pdf"):
                zf.write(str(f), arcname=f.name)
                
    zip_buf.seek(0)
    return StreamingResponse(
        zip_buf,
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": 'attachment; filename="all_resumes.zip"'},
    )


def _bundle_instructions() -> str:
    return (
        "HOW TO COMPILE YOUR RESUME\n"
        "---------------------------\n"
        "1. Unzip this folder.\n"
        "2. Ensure resume.tex and profile.jpg are in the same folder.\n"
        "3. Open a terminal and run: pdflatex resume.tex\n"
        "4. Done! Your PDF will be in the same folder.\n\n"
        "Alternative: Upload both files to Overleaf.com and click Compile.\n"
    )


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



# ── Photo Manager ─────────────────────────────────────────────────────────────

@router.post("/upload-photo")
async def upload_photo(file: UploadFile = File(...)):
    try:
        content = await file.read()
        try:
            new_img = Image.open(io.BytesIO(content))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image format")

        if PROFILE_PHOTO.exists():
            with Image.open(PROFILE_PHOTO) as cur:
                cur_ratio = cur.width / cur.height
                new_ratio = new_img.width / new_img.height
                if abs(cur_ratio - new_ratio) > 0.15:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Aspect ratio mismatch. Current: {cur_ratio:.2f}, "
                            f"new: {new_ratio:.2f}. Please use a ~3:4 image."
                        ),
                    )

        if new_img.mode != "RGB":
            new_img = new_img.convert("RGB")
        new_img.save(PROFILE_PHOTO, "JPEG", quality=90)
        return {"ok": True, "message": "Photo updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
