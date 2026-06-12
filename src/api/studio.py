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
