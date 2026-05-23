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
    load_resume_config, save_resume_config,
)
from src.core.upload import md5_of_file, list_r2_objects, upload_pdf, BUCKET
from src.core.build import build_role, build_all, clean

router = APIRouter()

BUILD_PY = ROOT / "src" / "core" / "build.py"


# ── Config ────────────────────────────────────────────────────────────────────

@router.get("/get-config")
def get_config():
    return load_resume_config()


@router.post("/save-config")
async def save_config(request: Request):
    data = await request.json()
    save_resume_config(data)
    
    # Try pushing to Firebase as well
    from src.core.firebase import push_config_to_firebase
    push_config_to_firebase(data)
    
    return {"ok": True}

# ── Checkpoints (Version Control) ─────────────────────────────────────────────
CHECKPOINTS_DIR = ROOT / "configs" / "checkpoints"

@router.get("/checkpoints")
def list_checkpoints():
    if not CHECKPOINTS_DIR.exists():
        return []
    cps = []
    for f in CHECKPOINTS_DIR.glob("*.json"):
        cps.append({
            "name": f.name,
            "created": datetime.fromtimestamp(f.stat().st_mtime).isoformat()
        })
    return sorted(cps, key=lambda x: x["created"], reverse=True)

class CheckpointRequest(BaseModel):
    custom_name: str = ""

@router.post("/checkpoints")
def create_checkpoint(req: CheckpointRequest):
    CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)
    config = load_resume_config()
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    
    clean_name = req.custom_name.strip().replace(" ", "_").replace("/", "-")
    if clean_name:
        name = f"checkpoint_{clean_name}_{timestamp}.json"
    else:
        name = f"checkpoint_{timestamp}.json"
        
    import json
    (CHECKPOINTS_DIR / name).write_text(json.dumps(config, indent=4))
    
    # Push to Firebase
    from src.core.firebase import push_checkpoint_to_firebase
    push_checkpoint_to_firebase(name, config)
    
    return {"ok": True, "name": name}

@router.post("/checkpoints/{name}/restore")
def restore_checkpoint(name: str):
    cp_file = CHECKPOINTS_DIR / name
    import json
    if not cp_file.exists():
        # Try fetching from Firebase
        from src.core.firebase import get_firebase_db
        db = get_firebase_db()
        if db:
            doc = db.collection("checkpoints").document(name).get()
            if doc.exists:
                config = doc.to_dict()
                save_resume_config(config)
                return {"ok": True, "source": "firebase"}
        raise HTTPException(404, "Checkpoint not found")
        
    config = json.loads(cp_file.read_text())
    save_resume_config(config)
    return {"ok": True, "source": "local"}

@router.delete("/checkpoints/{name}")
def delete_checkpoint(name: str):
    cp_file = CHECKPOINTS_DIR / name
    if cp_file.exists():
        cp_file.unlink()
    return {"ok": True}

# ── Settings (Firebase) ───────────────────────────────────────────────────────

@router.get("/api/settings")
def get_settings_route():
    from src.core.firebase import get_settings
    return get_settings()

@router.post("/api/settings")
async def save_settings_route(request: Request):
    data = await request.json()
    from src.core.firebase import save_settings
    save_settings(data)
    return {"ok": True}

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
def list_files():
    if not DIST_DIR.exists():
        return []
    r2_objects = list_r2_objects()
    files = []
    for f in DIST_DIR.glob("*.pdf"):
        local_hash = md5_of_file(f)
        if f.name in r2_objects:
            status = "synced" if r2_objects[f.name] == local_hash else "modified"
        else:
            status = "new"
        files.append({"name": f.name, "sync_status": status})
    return sorted(files, key=lambda x: x["name"])


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
def build_role_stream(role: str):
    def stream():
        cmd = (
            [sys.executable, str(BUILD_PY)]
            if role == "all"
            else [sys.executable, str(BUILD_PY), role]
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
        
        # Load user data
        config = load_resume_config()
        personal = config.get("personal", {})
        user_name = personal.get("name", "Candidate")
        user_email = personal.get("email", "contact@example.com")
        user_initial = user_name[0].upper() if user_name else "C"
        
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
def create_snapshot(req: SnapshotRequest):
    """
    Merge `base_recipe` with `customizations` and save as a new recipe.
    The snapshot recipe can then be built like any other role.
    """
    config = load_resume_config()
    base = config.get("recipes", {}).get(req.base_recipe)
    if not base:
        raise HTTPException(404, f"Base recipe '{req.base_recipe}' not found")

    merged = copy.deepcopy(base)
    merged.update(req.customizations)
    merged["_snapshot"] = True
    merged["_snapshot_base"] = req.base_recipe
    merged["_snapshot_created"] = datetime.now().isoformat()
    merged["short_name"] = req.snapshot_name.upper()[:8]

    snap_key = f"snap_{req.snapshot_name.lower().replace(' ', '_')}"
    config["recipes"][snap_key] = merged
    save_resume_config(config)
    return {"ok": True, "recipe_key": snap_key, "recipe": merged}


@router.delete("/snapshot-resume/{snap_key}")
def delete_snapshot(snap_key: str):
    config = load_resume_config()
    recipe = config.get("recipes", {}).get(snap_key)
    if not recipe:
        raise HTTPException(404, "Snapshot not found")
    if not recipe.get("_snapshot"):
        raise HTTPException(400, "Only snapshot recipes can be deleted via this route")
    del config["recipes"][snap_key]
    save_resume_config(config)
    return {"ok": True}
