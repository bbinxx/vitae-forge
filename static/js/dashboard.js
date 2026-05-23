import { api } from './api.js';
import { state } from './app.js';

export async function refreshSync() {
    try {
        const files = await api.fetchFiles();
        const list = document.getElementById('file-list');
        if (!list) return;
        const filtered = files.filter(f => !f.name.includes('LIVE_PREVIEW_TEMP'));
        if (filtered.length === 0) {
            list.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:8px">No files built yet</div>';
            return;
        }
        list.innerHTML = filtered.map(f => {
            const syncClass = f.sync_status === 'synced' ? 'sync-synced'
                           : f.sync_status === 'modified' ? 'sync-modified' : 'sync-new';
            return `
            <div class="file-item" onclick="window.dashPreview('${f.name}')">
                <span class="sync-tag ${syncClass}">${f.sync_status}</span>
                <span class="file-name">${f.name}</span>
                <button class="btn btn-sm btn-outline" style="padding:2px 8px" onclick="event.stopPropagation();window.dashUpload('${f.name}')"></button>
            </div>`;
        }).join('');
    } catch (e) { console.error('Server offline', e); }
}

export async function runBuild(role) {
    const logEl = document.getElementById('log');
    const dot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    logEl.textContent = '';
    dot.className = 'dot dot-active';
    statusText.textContent = 'BUILDING...';
    await api.buildRole(role, line => {
        logEl.textContent += line;
        logEl.scrollTop = logEl.scrollHeight;
    });
    dot.className = 'dot dot-idle';
    statusText.textContent = 'IDLE';
    refreshSync();
}

export function dashPreview(f) {
    state.selectedDashFile = f;
    document.getElementById('current-filename').textContent = f;
    document.getElementById('dash-actions').style.display = 'flex';
    document.getElementById('viewer-container').innerHTML = `<iframe src="/pdf/${f}#toolbar=0" style="width:100%;height:100%;border:none;background:#fff"></iframe>`;
    const isPhoto = f.includes('_X.pdf');
    document.getElementById('btn-dash-bundle').style.display = isPhoto ? 'inline-flex' : 'none';
    document.getElementById('btn-dash-tex').style.display = isPhoto ? 'none' : 'inline-flex';
}

export async function dashUpload(f) {
    try { await api.uploadPdfToCloud(f); refreshSync(); } catch(e) {}
}

export async function uploadPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const res = await api.uploadPhoto(file);
        if (res.ok) alert(' ' + res.data.message);
        else alert(' Upload failed:\n' + (res.data.detail || 'Unknown error'));
    } catch (e) { alert(' Error uploading photo.'); }
    event.target.value = '';
}

export async function uploadAll() {
    try {
        const log = document.getElementById('log');
        if (log) log.innerHTML += `<br><span style="color:var(--text-muted)">[${new Date().toLocaleTimeString()}]</span> Uploading all PDFs to R2...`;
        
        const res = await window.apiClient.post('/upload-all');
        if (res.ok) {
            alert(' Success: ' + res.data.message);
            if (log) log.innerHTML += `<br><span style="color:var(--text-muted)">[${new Date().toLocaleTimeString()}]</span> Upload All Complete: ${res.data.message}`;
        } else {
            alert(' Upload All failed:\n' + (res.data.detail || res.data.message || 'Unknown error'));
        }
    } catch (e) { 
        alert(' Error uploading files.'); 
    }
}

// Bind globals
window.dashPreview = dashPreview;
window.dashUpload  = dashUpload;
window.runBuild    = runBuild;
window.uploadPhoto = uploadPhoto;
window.refreshSync = refreshSync;
window.uploadAll   = uploadAll;
window.downloadCurrent       = () => { if (state.selectedDashFile) window.open(`/download/${state.selectedDashFile}`, '_blank'); };
window.downloadCurrentBundle = () => { if (state.selectedDashFile) window.open(`/download-bundle/${state.selectedDashFile.replace('.pdf','.tex')}`, '_blank'); };
window.downloadCurrentTex    = () => { if (state.selectedDashFile) window.open(`/download/${state.selectedDashFile.replace('.pdf','.tex')}`, '_blank'); };
window.uploadCurrent         = () => { if (state.selectedDashFile) dashUpload(state.selectedDashFile); };

window.shareCurrent = async () => {
    if (!state.selectedDashFile) return;
    try {
        const response = await fetch(`/presigned-url/${state.selectedDashFile}`);
        const data = await response.json();
        if (data.ok) {
            navigator.clipboard.writeText(data.url);
            alert('Public sharing link copied to clipboard! (Valid for 7 days)');
        } else {
            alert('Error generating link.');
        }
    } catch(e) {
        alert('Failed to generate link.');
    }
};

state.subscribe(() => {
    const rolesGrid = document.getElementById('roles-grid');
    if (rolesGrid) {
        rolesGrid.innerHTML = Object.keys(state.data.recipes).map(r =>
            `<button class="btn btn-secondary" onclick="runBuild('${r}')">${r}</button>`
        ).join('');
    }
});

document.addEventListener('DOMContentLoaded', refreshSync);
