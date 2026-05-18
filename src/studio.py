#!/usr/bin/env python3
"""
scripts/studio.py — Resume Studio Ultimate (V6)
Features: Build, Clean, Live Preview, R2 Sync, Visual Builder, LaTeX Bundler
"""

import sys, json, subprocess, os, hashlib, tempfile, zipfile, io
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import boto3
from botocore.client import Config
from PIL import Image

# Try to load env safely
try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*args, **kwargs): pass

# ── Config ────────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).parent.parent
CONFIG_PATH = ROOT / "configs" / "resume_config.json"
BUILD_SH    = ROOT / "src" / "build.sh"
GENERATE_PY = ROOT / "src" / "generate.py"
DIST_DIR    = ROOT / "dist"
ENV_PATH    = ROOT / ".env"
TEMPLATES   = ROOT / "templates" / "tex"
ASSETS      = ROOT / "assets"

if ENV_PATH.exists():
    load_dotenv(ENV_PATH)

app = FastAPI()

if DIST_DIR.exists():
    app.mount("/pdf", StaticFiles(directory=str(DIST_DIR)), name="pdf")

STATIC_DIR = ROOT / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

def get_file_hash(path):
    hash_md5 = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def load_full_config():
    return json.loads(CONFIG_PATH.read_text())

def get_roles():
    try:
        data = load_full_config()
        return list(data.get("recipes", {}).keys())
    except:
        return []

def get_r2_client():
    account_id = os.environ.get("R2_ACCOUNT_ID")
    access_key = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    if not all([account_id, access_key, secret_key]):
        return None
    return boto3.client(
        's3',
        endpoint_url=f'https://{account_id}.r2.cloudflarestorage.com',
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )

BUCKET = os.environ.get("R2_BUCKET_NAME", "dev-n1")

# ── HTML UI ───────────────────────────────────────────────────────────────────
def get_html():
    html_path = Path(__file__).parent.parent / "templates" / "studio.html"
    return html_path.read_text()

@app.get("/", response_class=HTMLResponse)
def index():
    return get_html()


@app.get("/get-config")
def get_config():
    return load_full_config()

@app.post("/save-config")
async def save_config(request: Request):
    data = await request.json()
    CONFIG_PATH.write_text(json.dumps(data, indent=2))
    return {"ok": True}

@app.get("/download/{filename}")
def download_file(filename: str):
    file_path = DIST_DIR / filename
    if not file_path.exists(): raise HTTPException(status_code=404)
    return FileResponse(path=file_path, filename=filename)

@app.get("/download-bundle/{filename}")
def download_bundle(filename: str):
    if not filename.endswith(".tex"): filename = filename + ".tex"
    tex_path = DIST_DIR / filename
    if not tex_path.exists(): raise HTTPException(status_code=404)
    
    # Bundle logic
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        content = tex_path.read_text()
        # Fix image path for bundle (relative to root)
        content = content.replace("../assets/profile-photo.jpg", "profile.jpg")
        zip_file.writestr("resume.tex", content)
        
        # Add photo
        photo_path = ASSETS / "profile-photo.jpg"
        if photo_path.exists():
            zip_file.write(str(photo_path), "profile.jpg")
            
        # Add Instructions
        instructions = """HOW TO COMPILE YOUR RESUME
---------------------------
1. Unzip this folder.
2. Ensure you have 'resume.tex' and 'profile.jpg' in the same folder.
3. Open a terminal/command prompt in this folder.
4. Run: pdflatex resume.tex
5. Done! Your PDF will be generated in the same folder.

Alternative:
You can also upload both files to Overleaf.com and hit 'Compile'.
"""
        zip_file.writestr("INSTRUCTIONS.txt", instructions)
        
    zip_buffer.seek(0)
    return StreamingResponse(zip_buffer, media_type="application/x-zip-compressed", headers={"Content-Disposition": f"attachment; filename=resume_bundle_{filename.replace('.tex','')}.zip"})


@app.get("/list-files")
def list_files():
    if not DIST_DIR.exists(): return []
    client = get_r2_client()
    r2_objects = {}
    if client:
        try:
            resp = client.list_objects_v2(Bucket=BUCKET)
            if 'Contents' in resp:
                for obj in resp['Contents']: r2_objects[obj['Key']] = obj['ETag'].strip('"')
        except: pass
    files = []
    for f in DIST_DIR.glob("*.pdf"):
        hash_md5 = hashlib.md5()
        with open(f, "rb") as fl:
            for chunk in iter(lambda: fl.read(4096), b""): hash_md5.update(chunk)
        local_hash = hash_md5.hexdigest()
        status = "new"
        if f.name in r2_objects: status = "synced" if r2_objects[f.name] == local_hash else "modified"
        files.append({"name": f.name, "sync_status": status})
    return sorted(files, key=lambda x: x['name'])

BUILD_PY = ROOT / "src" / "build.py"

@app.get("/build/{role}")
def build_role(role: str):
    def stream():
        cmd = [sys.executable, str(BUILD_PY)] if role == "all" else [sys.executable, str(BUILD_PY), role]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=str(ROOT))
        for line in proc.stdout: yield line
        proc.wait()
    return StreamingResponse(stream(), media_type="text/plain")

@app.get("/upload/{filename}")
def upload_file_route(filename: str):
    file_path = DIST_DIR / filename
    client = get_r2_client()
    if not client: return {"ok": False, "error": "R2 not configured"}
    try:
        client.upload_file(str(file_path), BUCKET, filename, ExtraArgs={'ContentType': 'application/pdf'})
        return {"ok": True}
    except Exception as e: return {"ok": False, "error": str(e)}

@app.post("/upload-photo")
async def upload_photo(file: UploadFile = File(...)):
    try:
        photo_path = ASSETS / "profile-photo.jpg"
        content = await file.read()
        
        try:
            new_img = Image.open(io.BytesIO(content))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image file format")
            
        if photo_path.exists():
            with Image.open(photo_path) as current_img:
                current_aspect = current_img.width / current_img.height
                new_aspect = new_img.width / new_img.height
                
                if abs(current_aspect - new_aspect) > 0.15:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Aspect ratio mismatch. Existing is {current_aspect:.2f}, new is {new_aspect:.2f}. Please provide an image with a similar ratio (e.g., 3:4)."
                    )
        
        # Save photo, converting to RGB (JPEG) if necessary
        if new_img.mode != "RGB":
            new_img = new_img.convert("RGB")
            
        new_img.save(photo_path, "JPEG", quality=90)
        return {"ok": True, "message": "Photo successfully updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
