#!/usr/bin/env python3
"""
scripts/studio.py — Resume Studio Ultimate (V6)
Features: Build, Clean, Live Preview, R2 Sync, Visual Builder, LaTeX Bundler
"""

import json, subprocess, os, hashlib, tempfile, zipfile, io, base64, requests
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
import boto3
from botocore.client import Config

# Try to load env safely
try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*args, **kwargs): pass

# ── Config ────────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).parent.parent
CONFIG_PATH = ROOT / "configs" / "resume_config.json"
BUILD_SH    = ROOT / "scripts" / "build.sh"
GENERATE_PY = ROOT / "scripts" / "generate.py"
DIST_DIR    = ROOT / "dist"
ENV_PATH    = ROOT / ".env"
TEMPLATES   = ROOT / "shared"
ASSETS      = ROOT / "assets"
SETTINGS_PATH = ROOT / "configs" / "settings.json"

DEFAULT_SETTINGS = {
    "compiler_url": "http://localhost:8000",
    "compiler_type": "xelatex"
}

if ENV_PATH.exists():
    load_dotenv(ENV_PATH)

app = FastAPI()

if DIST_DIR.exists():
    app.mount("/pdf", StaticFiles(directory=str(DIST_DIR)), name="pdf")

class LiveBuildRequest(BaseModel):
    config: dict
    role: str
    template: str # 'standard' or 'photo'

class SettingsUpdate(BaseModel):
    compiler_url: str
    compiler_type: str

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

def load_settings():
    if SETTINGS_PATH.exists():
        try:
            return {**DEFAULT_SETTINGS, **json.loads(SETTINGS_PATH.read_text())}
        except:
            return DEFAULT_SETTINGS
    return DEFAULT_SETTINGS

def save_settings(data):
    SETTINGS_PATH.write_text(json.dumps(data, indent=2))

# ── HTML UI ───────────────────────────────────────────────────────────────────
HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Resume Studio Ultimate</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0d0d0d; --surface: #141414; --surface2: #1a1a1a; --surface3: #222;
    --border: #2a2a2a; --border2: #333;
    --text: #e0e0e0; --muted: #666; --accent: #4a9eff; --green: #4caf7d;
    --red: #e05c5c; --yellow: #d4a843;
    --radius: 6px; --font: 'JetBrains Mono', 'Fira Code', monospace;
  }
  body {
    font-family: var(--font); background: var(--bg); color: var(--text);
    font-size: 13px; min-height: 100vh; display: flex; flex-direction: column;
  }
  header { 
    background: var(--surface); border-bottom: 1px solid var(--border); 
    padding: 0.8rem 1.5rem; display: flex; justify-content: space-between; align-items: center;
  }
  h1 { font-size: 0.9rem; color: #fff; letter-spacing: 0.1em; }
  .sub { font-size: 0.65rem; color: var(--muted); margin-left: 10px; }
  
  .tabs { display: flex; gap: 0.5rem; }
  .tab { 
    padding: 0.4rem 1rem; cursor: pointer; font-size: 0.7rem; color: var(--muted); 
    text-transform: uppercase; letter-spacing: 0.1em; border-radius: var(--radius);
    transition: all 0.2s;
  }
  .tab.active { background: var(--surface3); color: #fff; }

  /* Dashboard View */
  .view { display: none; flex: 1; padding: 1.5rem; gap: 1.5rem; min-height: 0; }
  .view.active { display: flex; }
  
  #dashboard-view { display: none; grid-template-columns: 400px 1fr; }
  #dashboard-view.active { display: grid; }

  /* Editor View (Visual) */
  #editor-view { display: none; grid-template-columns: 200px 1fr 1fr; padding: 0; gap: 0; }
  #editor-view.active { display: grid; }

  .sidebar-nav { background: var(--surface); border-right: 1px solid var(--border); overflow-y: auto; padding: 0.5rem 0; }
  .nav-section { padding: 0.3rem 0.8rem 0.1rem; font-size: 0.62rem; color: var(--muted); letter-spacing: 0.12em; text-transform: uppercase; margin-top: 0.5rem; }
  .nav-item { padding: 0.45rem 1rem; cursor: pointer; color: var(--muted); font-size: 0.75rem; transition: all 0.1s; border-left: 2px solid transparent; }
  .nav-item:hover { color: var(--text); background: var(--surface2); }
  .nav-item.active { color: var(--accent); border-left-color: var(--accent); background: var(--surface2); }

  .editor-content { background: var(--bg); overflow-y: auto; padding: 1.5rem; border-right: 1px solid var(--border); }
  .viewer { background: var(--surface); overflow: hidden; display: flex; flex-direction: column; }
  
  /* Shared Components */
  .card {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1.2rem; margin-bottom: 1rem;
  }
  .card h2 { font-size: 0.7rem; color: var(--muted); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 1rem; }
  
  .btn {
    background: var(--surface3); border: 1px solid var(--border2); color: var(--text);
    padding: 0.5rem 0.9rem; border-radius: 5px; cursor: pointer;
    font-family: inherit; font-size: 0.75rem; transition: all 0.1s;
  }
  .btn:hover { border-color: #555; }
  .btn.primary { background: #1a2d4a; border-color: #2a4a7a; color: var(--accent); }
  .btn.green { background: #1a2d1e; border-color: #2a4a2e; color: var(--green); }
  .btn.danger { background: #2d1a1a; border-color: #4a2a2a; color: var(--red); }
  .btn.mini { padding: 0.25rem 0.5rem; font-size: 0.68rem; }
  .btn.wide { width: 100%; margin-top: 0.4rem; }

  /* Editor Specific */
  .field { margin-bottom: 0.9rem; }
  .field label { display: block; font-size: 0.68rem; color: var(--muted); margin-bottom: 0.3rem; letter-spacing: 0.06em; }
  input[type=text], textarea, select {
    width: 100%; background: var(--surface2); border: 1px solid var(--border); color: var(--text);
    padding: 0.45rem 0.6rem; border-radius: var(--radius); font-family: var(--font); font-size: 0.78rem;
    transition: border-color 0.15s; outline: none;
  }
  input:focus, textarea:focus, select:focus { border-color: var(--accent); }
  
  .tag-grid { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.3rem; }
  .tag {
    padding: 0.2rem 0.5rem; border-radius: 3px; border: 1px solid var(--border2);
    font-size: 0.68rem; cursor: pointer; color: var(--muted); background: var(--surface3);
    transition: all 0.15s; user-select: none;
  }
  .tag.selected { color: var(--accent); border-color: var(--accent); background: #1a2a3a; }
  .tag.selected-green { color: var(--green); border-color: var(--green); background: #1a2d1e; }

  .toggle-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4rem; }
  .toggle-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.6rem; background: var(--surface3); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; }
  
  #log {
    background: #0a0a0a; border: 1px solid var(--border); border-radius: 5px;
    padding: 0.8rem; font-size: 0.7rem; color: var(--green);
    height: 150px; overflow-y: auto; white-space: pre-wrap; margin-top: 10px;
  }
  #status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #555; margin-right: 6px; }
  #status-dot.running { background: var(--green); box-shadow: 0 0 6px var(--green); }

  iframe { width: 100%; height: 100%; border: none; background: #fff; }
</style>
</head>
<body>

<header>
  <div>
    <h1>▸ RESUME STUDIO ULTIMATE <span class="sub">visual builder & deploy dashboard</span></h1>
  </div>
  <div style="display:flex; gap:0.5rem">
    <button class="btn mini" onclick="exportJSON()">⬇ Download JSON</button>
    <label class="btn mini" style="cursor:pointer">⬆ Load JSON <input type="file" accept=".json" onchange="importJSON(event)" style="display:none"></label>
    <div class="tabs" style="margin-left:10px">
      <div class="tab active">Visual Builder</div>
    </div>
  </div>
</header>

<!-- VISUAL EDITOR VIEW (ONLY VIEW) -->
<div id="editor-view" class="view active">
  <div class="sidebar-nav">
    <div class="nav-section">Personal</div>
    <div class="nav-item active" onclick="showEditorPanel('personal', this)">Personal Info</div>
    <div class="nav-section">Library</div>
    <div class="nav-item" onclick="showEditorPanel('summaries', this)">Summaries</div>
    <div class="nav-item" onclick="showEditorPanel('skills', this)">Skills</div>
    <div class="nav-item" onclick="showEditorPanel('projects', this)">Projects</div>
    <div class="nav-item" onclick="showEditorPanel('education', this)">Education</div>
    <div class="nav-item" onclick="showEditorPanel('certifications', this)">Certifications</div>
    <div class="nav-item" onclick="showEditorPanel('achievements', this)">Achievements</div>
    <div class="nav-section">Configuration</div>
    <div class="nav-item" onclick="showEditorPanel('recipes', this)">Role Recipes</div>
    <div class="nav-section">System</div>
    <div class="nav-item" onclick="showEditorPanel('settings', this)">App Settings</div>
  </div>

  <div class="editor-content">
    <div id="panel-personal" class="editor-panel active">
        <h2>Personal Information</h2>
        <div class="field"><label>Full Name</label><input type="text" id="p-name" oninput="p_sync()"></div>
        <div class="field"><label>Email</label><input type="text" id="p-email" oninput="p_sync()"></div>
        <div class="field"><label>Phone</label><input type="text" id="p-phone" oninput="p_sync()"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
          <div class="field"><label>LinkedIn</label><input type="text" id="p-linkedin" oninput="p_sync()"></div>
          <div class="field"><label>GitHub</label><input type="text" id="p-github" oninput="p_sync()"></div>
        </div>
    </div>
    <div id="panel-summaries" class="editor-panel" style="display:none">
        <h2>Professional Summaries</h2><div class="tabs" id="summary-tabs" style="margin-bottom:1rem"></div><div id="summary-fields"></div><button class="btn primary btn-sm" onclick="addSummary()">+ Add Role</button>
    </div>
    <div id="panel-skills" class="editor-panel" style="display:none">
        <h2>Skills Library</h2><div id="skills-list"></div><button class="btn primary btn-sm" onclick="addSkill()">+ Add Skill Group</button>
    </div>
    <div id="panel-projects" class="editor-panel" style="display:none">
        <h2>Projects Library</h2><div id="projects-list"></div><button class="btn primary btn-sm" onclick="addProject()">+ Add Project</button>
    </div>
    <div id="panel-education" class="editor-panel" style="display:none">
        <h2>Education</h2><div id="education-list"></div><button class="btn primary btn-sm" onclick="addEducation()">+ Add Degree</button>
    </div>
    <div id="panel-certifications" class="editor-panel" style="display:none">
        <h2>Certifications</h2><div id="certs-list"></div><button class="btn primary btn-sm" onclick="addCert()">+ Add Certification</button>
    </div>
    <div id="panel-achievements" class="editor-panel" style="display:none">
        <h2>Achievements</h2><div id="achievements-list"></div><button class="btn primary btn-sm" onclick="addAchievement()">+ Add Achievement</button>
    </div>
    <div id="panel-recipes" class="editor-panel" style="display:none">
        <h2>Role Recipes</h2><div class="tabs" id="recipe-tabs" style="margin-bottom:1rem"></div><div id="recipe-editor"></div><button class="btn primary btn-sm" onclick="addRecipe()">+ Add Recipe</button>
    </div>
    <div id="panel-settings" class="editor-panel" style="display:none">
        <h2>App Settings</h2>
        <div class="card">
            <div class="field">
                <label>TexCompiler API URL</label>
                <input type="text" id="s-compiler-url" placeholder="http://localhost:8000">
                <small style="color:var(--muted); font-size:10px">The address where your TexCompiler service is running.</small>
            </div>
            <div class="field">
                <label>Compiler Type</label>
                <select id="s-compiler-type">
                    <option value="pdflatex">pdflatex (Standard)</option>
                    <option value="xelatex">xelatex (Modern Fonts)</option>
                    <option value="lualatex">lualatex</option>
                </select>
            </div>
            <button class="btn green wide" onclick="saveSettings()">Save Settings</button>
        </div>
        <div id="settings-status" style="margin-top:10px; font-size:0.7rem"></div>
    </div>
  </div>

  <div class="viewer" style="border-left: 1px solid var(--border);">
    <div class="viewer-header" style="background:var(--surface2); padding:0.6rem 1rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
       <div style="display:flex; gap:0.5rem">
         <select id="live-role" class="btn mini" style="background:#111"></select>
         <select id="live-template" class="btn mini" style="background:#111">
           <option value="standard">Standard</option>
           <option value="photo">Modern (Photo)</option>
         </select>
       </div>
       <div style="display:flex; gap:0.5rem">
         <button id="btn-live-bundle" class="btn mini" onclick="downloadPreviewBundle()" title="Download LaTeX ZIP Bundle">↓ Bundle</button>
         <button id="btn-live-tex" class="btn mini" onclick="downloadPreviewTex()" title="Download raw LaTeX">↓ LaTeX</button>
         <button class="btn mini green" onclick="runLiveBuild()">▶ PREVIEW CHANGES</button>
       </div>
    </div>
    <div id="live-viewer-container" style="flex: 1;">
       <div style="display:flex; align-items:center; justify-content:center; height:100%; color:#222; letter-spacing:0.2em">LIVE PREVIEW</div>
    </div>
  </div>
</div>

<script>
let state = { personal: {}, library: {}, recipes: {} };
let activeSummaryTab = null, activeRecipeTab = null, selectedDashFile = null;

function showEditorPanel(panelId, el) {
  document.querySelectorAll('.editor-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.getElementById('panel-' + panelId).style.display = 'block';
  el.classList.add('active');
}

function p_sync() {
  state.personal = { name: document.getElementById('p-name').value, email: document.getElementById('p-email').value, phone: document.getElementById('p-phone').value, linkedin: document.getElementById('p-linkedin').value, github: document.getElementById('p-github').value };
}

function renderAllEditor() {
    renderSummaries(); renderSkills(); renderProjects(); renderEducation(); renderCerts(); renderAchievements(); renderRecipes();
    document.getElementById('live-role').innerHTML = Object.keys(state.recipes).map(r => `<option value="${r}">${r}</option>`).join('');
}

function renderSummaries() {
  const keys = Object.keys(state.library.professional_summary);
  if (!activeSummaryTab && keys.length) activeSummaryTab = keys[0];
  const tabs = document.getElementById('summary-tabs');
  tabs.innerHTML = keys.map(k => `<button class="tab ${k===activeSummaryTab?'active':''}" onclick="activeSummaryTab='${k}';renderSummaries()">${k}</button>`).join('') + (keys.length ? `<button class="btn red btn-sm" onclick="delSum('${activeSummaryTab}')" style="margin-left:5px">✕</button>` : '');
  const fields = document.getElementById('summary-fields');
  if (!activeSummaryTab || !state.library.professional_summary[activeSummaryTab]) { fields.innerHTML=''; return; }
  fields.innerHTML = `
    <div class="field"><label>ID</label><input type="text" value="${activeSummaryTab}" onchange="renKey('SUM','${activeSummaryTab}',this.value)"></div>
    <div class="field"><label>Role Title</label><input type="text" value="${state.library.role_title[activeSummaryTab]||''}" oninput="state.library.role_title['${activeSummaryTab}']=this.value"></div>
    <div class="field"><label>Text</label><textarea rows="5" oninput="state.library.professional_summary['${activeSummaryTab}']=this.value">${state.library.professional_summary[activeSummaryTab]}</textarea></div>
  `;
}
function addSummary() { const k = 'new_role'; state.library.professional_summary[k] = ''; state.library.role_title[k] = ''; activeSummaryTab = k; renderSummaries(); }
function delSum(k) { delete state.library.professional_summary[k]; delete state.library.role_title[k]; activeSummaryTab = Object.keys(state.library.professional_summary)[0] || null; renderSummaries(); }
function renderSkills() {
  document.getElementById('skills-list').innerHTML = Object.entries(state.library.skills).map(([id, s]) => `
    <div class="card">
      <div style="display:flex; justify-content:space-between"><strong>${id}</strong> <button class="btn btn-sm" onclick="delLib('skills','${id}',renderSkills)">✕</button></div>
      <div class="row" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px">
        <div class="field"><label>ID</label><input type="text" value="${id}" onchange="renKey('skills','${id}',this.value,renderSkills)"></div>
        <div class="field"><label>Category</label><input type="text" value="${s.name}" oninput="state.library.skills['${id}'].name=this.value"></div>
      </div>
      <div class="field"><label>Keywords (comma sep)</label><input type="text" value="${s.keywords}" oninput="state.library.skills['${id}'].keywords=this.value"></div>
    </div>
  `).join('');
}
function addSkill() { const id = 'skill_'+Date.now().toString(36); state.library.skills[id] = {name:'', keywords:''}; renderSkills(); }
function renderProjects() {
    document.getElementById('projects-list').innerHTML = Object.entries(state.library.projects).map(([id, p]) => `
        <div class="card">
          <div style="display:flex; justify-content:space-between"><strong>${id}</strong> <button class="btn btn-sm" onclick="delLib('projects','${id}',renderProjects)">✕</button></div>
          <div class="field" style="margin-top:10px"><label>Project Name</label><input type="text" value="${p.name}" oninput="state.library.projects['${id}'].name=this.value"></div>
          <div class="row" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px"><div class="field"><label>ID</label><input type="text" value="${id}" onchange="renKey('projects','${id}',this.value,renderProjects)"></div><div class="field"><label>Tech</label><input type="text" value="${p.tech}" oninput="state.library.projects['${id}'].tech=this.value"></div><div class="field"><label>Date</label><input type="text" value="${p.date}" oninput="state.library.projects['${id}'].date=this.value"></div></div>
          <div class="field"><label>Bullets</label>
            ${(p.points||[]).map((pt,i)=>`<div style="display:flex; gap:5px; margin-bottom:5px"><textarea rows="2" oninput="state.library.projects['${id}'].points[${i}]=this.value">${pt}</textarea><button class="btn mini" onclick="state.library.projects['${id}'].points.splice(${i},1);renderProjects()">✕</button></div>`).join('')}
            <button class="btn mini" onclick="state.library.projects['${id}'].points.push('');renderProjects()">+ Bullet</button>
          </div>
        </div>
    `).join('');
}
function addProject() { const id = 'proj_'+Date.now().toString(36); state.library.projects[id] = {name:'', tech:'', date:'', points:[]}; renderProjects(); }
function renderEducation() {
  document.getElementById('education-list').innerHTML = Object.entries(state.library.education).map(([id, val]) => `
    <div class="card"><div style="display:flex; justify-content:space-between"><strong>${id}</strong> <button class="btn btn-sm" onclick="delLib('education','${id}',renderEducation)">✕</button></div><div class="field" style="margin-top:10px"><label>ID</label><input type="text" value="${id}" onchange="renKey('education','${id}',this.value,renderEducation)"></div><div class="field"><label>LaTeX Content</label><textarea rows="3" oninput="state.library.education['${id}']=this.value">${val}</textarea></div></div>
  `).join('');
}
function addEducation() { const id = 'edu_'+Date.now().toString(36); state.library.education[id] = ''; renderEducation(); }
function renderCerts() {
  document.getElementById('certs-list').innerHTML = Object.entries(state.library.certifications).map(([id, c]) => `
    <div class="card"><div style="display:flex; justify-content:space-between"><strong>${id}</strong> <button class="btn btn-sm" onclick="delLib('certifications','${id}',renderCerts)">✕</button></div><div class="row" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px"><div class="field"><label>ID</label><input type="text" value="${id}" onchange="renKey('certifications','${id}',this.value,renderCerts)"></div><div class="field"><label>Name</label><input type="text" value="${c.name}" oninput="state.library.certifications['${id}'].name=this.value"></div></div><div class="row" style="display:grid; grid-template-columns:1fr 1fr; gap:10px"><div class="field"><label>Issuer</label><input type="text" value="${c.issuer}" oninput="state.library.certifications['${id}'].issuer=this.value"></div><div class="field"><label>Year</label><input type="text" value="${c.year}" oninput="state.library.certifications['${id}'].year=this.value"></div></div></div>
  `).join('');
}
function addCert() { const id = 'cert_'+Date.now().toString(36); state.library.certifications[id] = {name:'', issuer:'', year:''}; renderCerts(); }
function renderAchievements() {
  document.getElementById('achievements-list').innerHTML = Object.entries(state.library.achievements).map(([id, a]) => `
    <div class="card"><div style="display:flex; justify-content:space-between"><strong>${id}</strong> <button class="btn btn-sm" onclick="delLib('achievements','${id}',renderAchievements)">✕</button></div><div class="row" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px"><div class="field"><label>ID</label><input type="text" value="${id}" onchange="renKey('achievements','${id}',this.value,renderAchievements)"></div><div class="field"><label>Name</label><input type="text" value="${a.name}" oninput="state.library.achievements['${id}'].name=this.value"></div></div><div class="row" style="display:grid; grid-template-columns:1fr 1fr; gap:10px"><div class="field"><label>Issuer</label><input type="text" value="${a.issuer}" oninput="state.library.achievements['${id}'].issuer=this.value"></div><div class="field"><label>Year</label><input type="text" value="${a.year||''}" oninput="state.library.achievements['${id}'].year=this.value"></div></div></div>
  `).join('');
}
function addAchievement() { const id = 'ach_'+Date.now().toString(36); state.library.achievements[id] = {name:'', issuer:'', year:''}; renderAchievements(); }
function renderRecipes() {
  const keys = Object.keys(state.recipes); if (!activeRecipeTab && keys.length) activeRecipeTab = keys[0];
  const tabs = document.getElementById('recipe-tabs'); tabs.innerHTML = keys.map(k => `<button class="tab ${k===activeRecipeTab?'active':''}" onclick="activeRecipeTab='${k}';renderRecipes()">${k}</button>`).join('') + (keys.length ? `<button class="btn red btn-sm" onclick="delRec('${activeRecipeTab}')" style="margin-left:5px">✕</button>` : '');
  const el = document.getElementById('recipe-editor'); if (!activeRecipeTab || !state.recipes[activeRecipeTab]) { el.innerHTML=''; return; }
  const r = state.recipes[activeRecipeTab], sections = r.sections || {}, sectionKeys = ['role_title','photo','summary','skills','projects','education','certifications','achievements','languages'];
  const allIds = { skill: Object.keys(state.library.skills), proj: Object.keys(state.library.projects), cert: Object.keys(state.library.certifications), ach: Object.keys(state.library.achievements), sum: Object.keys(state.library.professional_summary), edu: Object.keys(state.library.education) };
  el.innerHTML = `<div class="card"><div class="row" style="display:grid; grid-template-columns:1fr 1fr; gap:10px"><div class="field"><label>ID</label><input type="text" value="${activeRecipeTab}" onchange="renRec('${activeRecipeTab}',this.value)"></div><div class="field"><label>Short Code</label><input type="text" value="${r.short_name}" oninput="state.recipes['${activeRecipeTab}'].short_name=this.value"></div></div><div class="field"><label>Role Title / Summary Key</label><div class="tag-grid">${allIds.sum.map(id=>`<span class="tag ${r.role_title===id?'selected':''}" onclick="state.recipes['${activeRecipeTab}'].role_title='${id}'; state.recipes['${activeRecipeTab}'].professional_summary='${id}';renderRecipes()">${id}</span>`).join('')}</div></div><div class="field"><label>Education Key</label><div class="tag-grid">${allIds.edu.map(id=>`<span class="tag ${r.education===id?'selected':''}" onclick="state.recipes['${activeRecipeTab}'].education='${id}';renderRecipes()">${id}</span>`).join('')}</div></div><div class="field"><label>Section Visibility</label><div class="toggle-grid">${sectionKeys.map(s=>`<div class="toggle-item"><input type="checkbox" ${sections[s]!==false?'checked':''} onchange="state.recipes['${activeRecipeTab}'].sections['${s}']=this.checked"><label>${s}</label></div>`).join('')}</div></div><hr style="border:0; border-top:1px solid #222; margin:10px 0"><div class="field"><label>Skills</label><div class="tag-grid">${allIds.skill.map(id=>`<span class="tag ${(r.skills||[]).includes(id)?'selected-green':''}" onclick="togArr('${activeRecipeTab}','skills','${id}')">${id}</span>`).join('')}</div></div><div class="field"><label>Projects</label><div class="tag-grid">${allIds.proj.map(id=>`<span class="tag ${(r.projects||[]).includes(id)?'selected-green':''}" onclick="togArr('${activeRecipeTab}','projects','${id}')">${id}</span>`).join('')}</div></div><div class="field"><label>Certs</label><div class="tag-grid">${allIds.cert.map(id=>`<span class="tag ${(r.certifications||[]).includes(id)?'selected-green':''}" onclick="togArr('${activeRecipeTab}','certifications','${id}')">${id}</span>`).join('')}</div></div><div class="field"><label>Achievements</label><div class="tag-grid">${allIds.ach.map(id=>`<span class="tag ${(r.achievements||[]).includes(id)?'selected-green':''}" onclick="togArr('${activeRecipeTab}','achievements','${id}')">${id}</span>`).join('')}</div></div></div>`;
}
function addRecipe() { const k = 'new_role'; state.recipes[k] = {short_name:'', sections:{}, role_title:'', professional_summary:'', skills:[], projects:[], education:'', certifications:[], achievements:[]}; activeRecipeTab = k; renderRecipes(); }
function delRec(k) { delete state.recipes[k]; activeRecipeTab = Object.keys(state.recipes)[0]||null; renderRecipes(); }
function renRec(old, nw) { nw = nw.replace(/ /g,'_').toLowerCase(); state.recipes[nw] = state.recipes[old]; delete state.recipes[old]; activeRecipeTab = nw; renderRecipes(); }
function togArr(r, f, id) { const arr = state.recipes[r][f] || []; const idx = arr.indexOf(id); if (idx > -1) arr.splice(idx, 1); else arr.push(id); state.recipes[r][f] = arr; renderRecipes(); }
function renKey(sec, old, nw, cb) { nw = nw.replace(/ /g,'_').toLowerCase(); if (sec==='SUM') { state.library.professional_summary[nw] = state.library.professional_summary[old]; state.library.role_title[nw] = state.library.role_title[old]; delete state.library.professional_summary[old]; delete state.library.role_title[old]; activeSummaryTab = nw; renderSummaries(); } else { state.library[sec][nw] = state.library[sec][old]; delete state.library[sec][old]; cb(); } }
function delLib(sec, id, cb) { delete state.library[sec][id]; cb(); }

async function runLiveBuild() {
    const role = document.getElementById('live-role').value, template = document.getElementById('live-template').value;
    document.getElementById('live-viewer-container').innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--accent)">COMPILING...</div>';
    const cleanProj = {}; Object.entries(state.library.projects).forEach(([id,p])=>{ cleanProj[id] = {...p}; if(!cleanProj[id].link) delete cleanProj[id].link; });
    const res = await fetch('/live-build', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ config: { ...state, library: { ...state.library, projects: cleanProj } }, role, template }) });
    const data = await res.json();
    if (data.ok) {
        document.getElementById('live-viewer-container').innerHTML = `<iframe src="/pdf/${data.filename}?t=${Date.now()}#toolbar=0"></iframe>`;
        const isPhoto = template === 'photo';
        document.getElementById('btn-live-bundle').style.display = isPhoto ? 'inline-block' : 'none';
        document.getElementById('btn-live-tex').style.display = isPhoto ? 'none' : 'inline-block';
    }
    else document.getElementById('live-viewer-container').innerHTML = `<div style="padding:2rem; color:var(--red)">Error: ${data.error}</div>`;
}

function downloadPreviewBundle() { window.open('/download-bundle/LIVE_PREVIEW_TEMP.tex', '_blank'); }
function downloadPreviewTex() { window.open('/download/LIVE_PREVIEW_TEMP.tex', '_blank'); }

async function init() {
    const res = await fetch('/get-config'), data = await res.json(); state = data;
    const sRes = await fetch('/get-settings'), sData = await sRes.json();
    document.getElementById('s-compiler-url').value = sData.compiler_url;
    document.getElementById('s-compiler-type').value = sData.compiler_type;
    renderAllEditor();
    document.getElementById('p-name').value = state.personal.name || ''; document.getElementById('p-email').value = state.personal.email || ''; document.getElementById('p-phone').value = state.personal.phone || ''; document.getElementById('p-linkedin').value = state.personal.linkedin || ''; document.getElementById('p-github').value = state.personal.github || '';
}
async function saveSettings() {
    const compiler_url = document.getElementById('s-compiler-url').value;
    const compiler_type = document.getElementById('s-compiler-type').value;
    const res = await fetch('/update-settings', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ compiler_url, compiler_type })
    });
    const data = await res.json();
    const status = document.getElementById('settings-status');
    if (data.ok) {
        status.innerHTML = '<span style="color:var(--green)">✓ Settings saved successfully</span>';
        setTimeout(() => status.innerHTML = '', 3000);
    } else {
        status.innerHTML = '<span style="color:var(--red)">❌ Failed to save settings</span>';
    }
}
function exportJSON() { const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'}), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'resume_config.json'; a.click(); }
function importJSON(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = e => { try { state = JSON.parse(e.target.result); document.getElementById('p-name').value = state.personal.name || ''; document.getElementById('p-email').value = state.personal.email || ''; document.getElementById('p-phone').value = state.personal.phone || ''; document.getElementById('p-linkedin').value = state.personal.linkedin || ''; document.getElementById('p-github').value = state.personal.github || ''; renderAllEditor(); alert('✓ Configuration loaded'); } catch(err) { alert('Invalid JSON file'); } }; reader.readAsText(file);
}
init();
</script></body></html>"""

@app.get("/", response_class=HTMLResponse)
def index():
    return HTML

@app.get("/get-config")
def get_config():
    return load_full_config()

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

@app.get("/get-settings")
def get_settings():
    return load_settings()

@app.post("/update-settings")
def update_settings(s: SettingsUpdate):
    save_settings(s.dict())
    return {"ok": True}

@app.post("/live-build")
async def live_build(req: LiveBuildRequest):
    settings = load_settings()
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(req.config, f)
        temp_config_path = f.name
    
    template_file = "template_photo.tex" if req.template == "photo" else "template.tex"
    template_path = TEMPLATES / template_file
    output_tex = DIST_DIR / "LIVE_PREVIEW_TEMP.tex"
    output_pdf = DIST_DIR / "LIVE_PREVIEW_TEMP.pdf"
    
    try:
        # 1. Generate local TeX file
        subprocess.run(["python3", str(GENERATE_PY), temp_config_path, str(template_path), str(output_tex), "--role", req.role], check=True, cwd=str(ROOT))
        
        # 2. Check if we should use Remoate API
        if settings.get("compiler_url"):
            tex_content = output_tex.read_text()
            
            files = { "resume.tex": tex_content }
            
            # Add photo if modern template
            if req.template == "photo":
                photo_path = ASSETS / "profile-photo.jpg"
                if photo_path.exists():
                    # Fix path for remote compiler (remove ../assets/ prefix)
                    tex_content = tex_content.replace("../assets/profile-photo.jpg", "profile-photo.jpg")
                    files["resume.tex"] = tex_content
                    with open(photo_path, "rb") as img_f:
                        files["profile-photo.jpg"] = base64.b64encode(img_f.read()).decode('utf-8')

            payload = {
                "main_file": "resume.tex",
                "compiler": settings.get("compiler_type", "xelatex"),
                "files": files
            }
            
            resp = requests.post(f"{settings['compiler_url'].rstrip('/')}/compile", json=payload, timeout=30)
            
            if resp.status_code == 200:
                output_pdf.write_bytes(resp.content)
                return {"ok": True, "filename": "LIVE_PREVIEW_TEMP.pdf"}
            else:
                err_msg = "API Error"
                try:
                    err_data = resp.json()
                    err_msg = err_data.get("log", err_data.get("error", "Unknown error"))
                except: pass
                return {"ok": False, "error": f"Compilation failed: {err_msg}"}
        else:
            # Fallback to local
            subprocess.run(["pdflatex", "-interaction=nonstopmode", "-output-directory", str(DIST_DIR), str(output_tex)], check=True, cwd=str(ROOT))
            return {"ok": True, "filename": "LIVE_PREVIEW_TEMP.pdf"}

    except Exception as e: return {"ok": False, "error": str(e)}
    finally:
        if os.path.exists(temp_config_path): os.remove(temp_config_path)

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

@app.get("/build/{role}")
def build_role(role: str):
    def stream():
        cmd = ["bash", str(BUILD_SH)] if role == "all" else ["bash", str(BUILD_SH), role]
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

if __name__ == "__main__":
    uvicorn.run("scripts.studio:app", host="127.0.0.1", port=5051, reload=True)
