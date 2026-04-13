#!/usr/bin/env python3
"""
scripts/studio.py — Resume Studio Pro (V3)
Features: Build, Clean, Live Preview, Download, R2 Sync Status & Upload
"""

import json, subprocess, os, hashlib
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# ── Config ────────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).parent.parent
CONFIG_PATH = ROOT / "configs" / "resume_config.json"
BUILD_SH    = ROOT / "scripts" / "build.sh"
DIST_DIR    = ROOT / "dist"
ENV_PATH    = ROOT / ".env"

load_dotenv(ENV_PATH)

app = FastAPI()

if DIST_DIR.exists():
    app.mount("/pdf", StaticFiles(directory=str(DIST_DIR)), name="pdf")

def get_file_hash(path):
    hash_md5 = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def get_roles():
    try:
        data = json.loads(CONFIG_PATH.read_text())
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
HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Resume Studio Pro</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    background: #0d0d0d; color: #e0e0e0;
    min-height: 100vh; padding: 1.5rem; display: flex; flex-direction: column;
  }
  header { margin-bottom: 1.5rem; }
  h1 { font-size: 1.1rem; color: #fff; letter-spacing: 0.1em; margin-bottom: 0.2rem; }
  .sub { font-size: 0.72rem; color: #555; }
  
  .main-layout { display: grid; grid-template-columns: 380px 1fr; gap: 1.5rem; flex: 1; min-height: 0; }
  
  .sidebar { display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; }
  .viewer { 
    background: #161616; border: 1px solid #252525; border-radius: 8px; 
    overflow: hidden; display: flex; flex-direction: column;
  }
  
  .card {
    background: #161616; border: 1px solid #252525;
    border-radius: 8px; padding: 1.2rem;
  }
  .card h2 { font-size: 0.72rem; color: #555; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 1rem; }
  
  .role-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 1rem; }
  .btn {
    background: #1e1e1e; border: 1px solid #2e2e2e; color: #ccc;
    padding: 0.55rem 0.9rem; border-radius: 5px; cursor: pointer;
    font-family: inherit; font-size: 0.8rem; text-align: left;
    transition: all 0.1s;
  }
  .btn:hover { border-color: #555; color: #fff; background: #252525; }
  .btn.primary { background: #1a2a1a; border-color: #2d4a2d; color: #7ec87e; }
  .btn.danger { background: #2a1a1a; border-color: #4a2d2d; color: #c87e7e; }
  .btn.wide { width: 100%; margin-top: 0.4rem; }
  .btn.mini { padding: 0.2rem 0.5rem; font-size: 0.65rem; }
  
  #log {
    background: #0a0a0a; border: 1px solid #1e1e1e; border-radius: 5px;
    padding: 0.8rem; font-size: 0.72rem; color: #7ec87e;
    height: 120px; overflow-y: auto; white-space: pre-wrap;
    line-height: 1.6; margin-top: 1rem;
  }
  
  .file-list { display: flex; flex-direction: column; gap: 0.4rem; }
  .file-item {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.5rem 0.8rem; background: #1a1a1a; border: 1px solid #252525; border-radius: 4px;
    font-size: 0.75rem; transition: background 0.1s;
  }
  .file-item:hover { background: #202020; }
  .file-item-name { cursor: pointer; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 10px; }
  
  .sync-badge {
    font-size: 0.6rem; padding: 1px 6px; border-radius: 10px;
    background: #252525; color: #555; text-transform: uppercase;
    margin-right: 8px; font-weight: bold;
  }
  .sync-badge.synced { background: #1a2a1a; color: #7ec87e; }
  .sync-badge.modified { background: #2a2a1a; color: #c8c87e; }
  .sync-badge.new { background: #1a1a2a; color: #7e7ec8; }

  iframe { width: 100%; height: 100%; border: none; background: #fff; }
  .viewer-placeholder { 
    display: flex; align-items: center; justify-content: center; height: 100%; 
    color: #333; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.2em;
  }
  .viewer-header {
    background: #202020; padding: 0.5rem 1rem; border-bottom: 1px solid #252525;
    display: flex; justify-content: space-between; align-items: center;
  }
  #status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #555; margin-right: 6px; vertical-align: middle; }
  #status-dot.running { background: #7ec87e; box-shadow: 0 0 6px #7ec87e; }
</style>
</head>
<body>
<header>
  <h1>▸ RESUME STUDIO PRO</h1>
  <p class="sub">resume build & cloud sync control panel</p>
</header>

<div class="main-layout">
  <div class="sidebar">
    <div class="card">
      <h2>Build Role</h2>
      <div class="role-grid" id="roles"></div>
      <button class="btn primary wide" onclick="build('all')">⬡ Build All</button>
      <p style="font-size: 0.65rem; color: #444; margin-top: 1rem;"><span id="status-dot"></span><span id="status-text">IDLE</span></p>
      <div id="log">ready.\n</div>
    </div>

    <div class="card">
      <h2>Generated Files <span id="sync-all-btn" style="float:right; cursor:pointer; color:#7ec87e" onclick="checkAllSync()">↺ check sync</span></h2>
      <div id="file-list" class="file-list"></div>
      <button class="btn wide mini" style="margin-top:1.2rem" onclick="build('clean')">⌫ Wipe dist/</button>
    </div>
  </div>

  <div class="viewer">
    <div class="viewer-header">
      <span id="current-file" style="font-size: 0.7rem; color: #888;">No file selected</span>
      <div id="viewer-actions" style="display: none; gap: .5rem">
        <button class="btn mini primary" id="upload-btn" onclick="uploadCurrent()">☁ Upload</button>
        <button class="btn mini" onclick="downloadCurrent()">↓ Download</button>
      </div>
    </div>
    <div id="viewer-content" style="flex: 1;">
      <div class="viewer-placeholder">Select a resume to preview</div>
    </div>
  </div>
</div>

<script>
const log = document.getElementById('log');
const dot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const fileList = document.getElementById('file-list');
const viewerContent = document.getElementById('viewer-content');
const viewerActions = document.getElementById('viewer-actions');
const currentFileName = document.getElementById('current-file');
const uploadBtn = document.getElementById('upload-btn');

let selectedFile = null;

function appendLog(text) {
  log.textContent += text;
  log.scrollTop = log.scrollHeight;
}

function setStatus(running) {
  dot.className = running ? 'running' : '';
  statusText.textContent = running ? 'BUILDING...' : 'IDLE';
}

async function build(role) {
  log.textContent = '';
  setStatus(true);
  appendLog(`> exec build ${role}\\n\\n`);
  const res = await fetch(`/build/${role}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    appendLog(dec.decode(value));
  }
  setStatus(false);
  refreshFiles();
}

async function refreshFiles() {
  const res = await fetch('/list-files');
  const files = await res.json();
  if (files.length === 0) {
    fileList.innerHTML = '<p style="font-size: 0.7rem; color: #444; text-align: center;">No builds found.</p>';
    return;
  }
  fileList.innerHTML = files.map(f => `
    <div class="file-item" id="item-${f.name}">
      <span class="sync-badge ${f.sync_status}" id="badge-${f.name}">${f.sync_status}</span>
      <div class="file-item-name" onclick="preview('${f.name}')">${f.name}</div>
      <button class="btn mini primary" onclick="upload('${f.name}')">☁</button>
    </div>
  `).join('');
}

async function checkAllSync() {
  appendLog(`\\n> checking cloud sync status...\\n`);
  refreshFiles();
}

function preview(file) {
  selectedFile = file;
  currentFileName.textContent = file;
  viewerActions.style.display = 'flex';
  viewerContent.innerHTML = `<iframe src="/pdf/${file}#toolbar=0"></iframe>`;
}

function downloadCurrent() {
  if (selectedFile) window.open(`/download/${selectedFile}`, '_blank');
}

async function upload(file) {
  appendLog(`\\n> uploading ${file} to R2...\\n`);
  const res = await fetch(`/upload/${file}`);
  const data = await res.json();
  if (data.ok) {
    appendLog(`✅ successfully uploaded to R2\\n`);
    const badge = document.getElementById(`badge-${file}`);
    if (badge) { badge.textContent = 'synced'; badge.className = 'sync-badge synced'; }
  } else {
    appendLog(`❌ upload failed: ${data.error}\\n`);
  }
}

function uploadCurrent() { if (selectedFile) upload(selectedFile); }

async function reloadRoles() {
  const res = await fetch('/roles');
  const roles = await res.json();
  const container = document.getElementById('roles');
  container.innerHTML = roles.map(r => `<button class="btn" onclick="build('${r}')">${r}</button>`).join('');
}

reloadRoles();
refreshFiles();
</script>
</body>
</html>"""

@app.get("/", response_class=HTMLResponse)
def index():
    return HTML

@app.get("/roles")
def roles():
    return get_roles()

@app.get("/list-files")
def list_files():
    if not DIST_DIR.exists():
        return []
    
    client = get_r2_client()
    r2_objects = {}
    if client:
        try:
            resp = client.list_objects_v2(Bucket=BUCKET)
            if 'Contents' in resp:
                for obj in resp['Contents']:
                    # R2 ETag is quoted MD5
                    r2_objects[obj['Key']] = obj['ETag'].strip('"')
        except:
            pass

    files = []
    for f in DIST_DIR.glob("*.pdf"):
        local_hash = get_file_hash(f)
        status = "new"
        if f.name in r2_objects:
            status = "synced" if r2_objects[f.name] == local_hash else "modified"
        
        files.append({
            "name": f.name,
            "sync_status": status
        })
    return sorted(files, key=lambda x: x['name'])

@app.get("/download/{filename}")
def download(filename: str):
    file_path = DIST_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404)
    return FileResponse(path=file_path, filename=filename)

@app.get("/build/{role}")
def build_route(role: str):
    allowed = get_roles() + ["all", "clean"]
    if role not in allowed: return {"error": "unknown role"}
    def stream():
        cmd = ["bash", str(BUILD_SH)] if role == "all" else ["bash", str(BUILD_SH), role]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=str(ROOT))
        for line in proc.stdout: yield line
        proc.wait()
        yield f"\n> exit code {proc.returncode}\n"
    return StreamingResponse(stream(), media_type="text/plain")

@app.get("/upload/{filename}")
def upload_route(filename: str):
    file_path = DIST_DIR / filename
    if not file_path.exists(): return {"ok": False, "error": "file not found"}
    client = get_r2_client()
    if not client: return {"ok": False, "error": "R2 credentials not configured"}
    try:
        client.upload_file(str(file_path), BUCKET, filename, ExtraArgs={'ContentType': 'application/pdf'})
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

if __name__ == "__main__":
    uvicorn.run("studio:app", host="127.0.0.1", port=5050, reload=True)
