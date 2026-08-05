import { api } from './api.js';
import { state } from './app.js';

let dashboardFiles = [];

export async function refreshSync() {
    try {
        let files;
        if (window.__PRELOADED_FILES__) {
            files = window.__PRELOADED_FILES__;
            // Don't clear it here because tracker.js also needs it
        } else {
            files = await api.fetchFiles();
        }
        const list = document.getElementById('file-list');
        if (!list) return;
        
        dashboardFiles = files.filter(f => !f.name.includes('LIVE_PREVIEW_TEMP'));
        
        if (dashboardFiles.length === 0) {
            list.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:8px">No files built yet</div>';
            return;
        }
        
        const localFiles = dashboardFiles.filter(f => f.type === 'local');
        const cloudFiles = dashboardFiles.filter(f => f.type === 'cloud');
        
        let html = '';
        
        if (localFiles.length > 0) {
            html += '<div style="font-size:10px;font-weight:600;color:var(--text-muted);margin:8px 0 4px 0;text-transform:uppercase;letter-spacing:0.05em">Base Builds (Local)</div>';
            html += localFiles.map(f => {
                const syncClass = f.sync_status === 'synced' ? 'sync-synced'
                               : f.sync_status === 'modified' ? 'sync-modified' : 'sync-new';
                return `
                <div class="file-item" onclick="window.dashPreview('${f.path}')">
                    <span class="sync-tag ${syncClass}">${f.sync_status}</span>
                    <span class="file-name">${f.name}</span>
                    <button class="btn btn-sm btn-outline" style="padding:2px 8px" onclick="event.stopPropagation();window.dashUpload('${f.path}')"></button>
                </div>`;
            }).join('');
        }
        
        if (cloudFiles.length > 0) {
            html += '<div style="font-size:10px;font-weight:600;color:var(--text-muted);margin:12px 0 4px 0;text-transform:uppercase;letter-spacing:0.05em">App Versions (Cloud)</div>';
            html += cloudFiles.map(f => {
                return `
                <div class="file-item" onclick="window.dashPreview('${f.path}')">
                    <span class="sync-tag" style="background:rgba(59,130,246,0.15);color:#3b82f6;border:1px solid rgba(59,130,246,0.3)"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">cloud</span> cloud</span>
                    <span class="file-name" title="${f.name}">${f.name.length > 28 ? f.name.substring(0,25)+'...' : f.name}</span>
                </div>`;
            }).join('');
        }
        
        list.innerHTML = html;
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

export function dashPreview(path) {
    const f = dashboardFiles.find(x => x.path === path);
    if (!f) return;
    
    state.selectedDashFile = f;
    document.getElementById('current-filename').textContent = f.name;
    document.getElementById('dash-actions').style.display = 'flex';
    
    const isCloud = f.type === 'cloud';
    const isPhoto = f.name.includes('_X.pdf');
    
    let url = isCloud ? `/cloud-pdf/${f.path}` : `/pdf/${f.path}`;
    url += '?token=' + localStorage.getItem('token');
    document.getElementById('viewer-container').innerHTML = `<iframe src="${url}#toolbar=0" style="width:100%;height:100%;border:none;background:#fff"></iframe>`;
    
    document.getElementById('btn-dash-bundle').style.display = (!isCloud && isPhoto) ? 'inline-flex' : 'none';
    document.getElementById('btn-dash-tex').style.display = (!isCloud && !isPhoto) ? 'inline-flex' : 'none';
    
    // Cloud files cannot be "uploaded" (already there) or shared via local static route easily yet (though we could share the presigned URL).
    // For now, let's keep upload hidden for cloud files.
    const uploadBtn = document.querySelector('#dash-actions button[onclick="uploadCurrent()"]');
    if (uploadBtn) uploadBtn.style.display = isCloud ? 'none' : 'inline-flex';
    
    const shareBtn = document.querySelector('#dash-actions button[onclick="shareCurrent()"]');
    if (shareBtn) shareBtn.style.display = isCloud ? 'none' : 'inline-flex';
}

export async function dashUpload(path) {
    try { await api.uploadPdfToCloud(path); refreshSync(); } catch(e) {}
}

export async function uploadPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const res = await api.uploadPhoto(file);
        if (res.ok) await alert(' ' + res.data.message);
        else await alert(' Upload failed:\n' + (res.data.detail || 'Unknown error'));
    } catch (e) { await alert(' Error uploading photo.'); }
    event.target.value = '';
}

export async function uploadAll() {
    try {
        const log = document.getElementById('log');
        if (log) log.innerHTML += `<br><span style="color:var(--text-muted)">[${new Date().toLocaleTimeString()}]</span> Uploading all PDFs to R2...`;
        
        const res = await fetch('/upload-all', { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.ok) {
            await alert(' Success: ' + data.message);
            if (log) log.innerHTML += `<br><span style="color:var(--text-muted)">[${new Date().toLocaleTimeString()}]</span> Upload All Complete: ${data.message}`;
        } else {
            await alert(' Upload All failed:\n' + (data.detail || data.message || 'Unknown error'));
        }
    } catch (e) { 
        await alert(' Error uploading files.'); 
    }
}

// Bind globals
window.dashPreview = dashPreview;
window.dashUpload  = dashUpload;
window.runBuild    = runBuild;
window.uploadPhoto = uploadPhoto;
window.refreshSync = refreshSync;
window.uploadAll   = uploadAll;
window.downloadCurrent       = () => { 
    if (state.selectedDashFile) {
        if (state.selectedDashFile.type === 'cloud') {
            window.open(`/cloud-pdf/${state.selectedDashFile.path}?token=` + localStorage.getItem('token'), '_blank');
        } else {
            window.open(`/download/${state.selectedDashFile.path}?token=` + localStorage.getItem('token'), '_blank');
        }
    } 
};
window.downloadCurrentBundle = () => { if (state.selectedDashFile && state.selectedDashFile.type !== 'cloud') window.open(`/download-bundle/${state.selectedDashFile.path.replace('.pdf','.tex')}?token=` + localStorage.getItem('token'), '_blank'); };
window.downloadCurrentTex    = () => { if (state.selectedDashFile && state.selectedDashFile.type !== 'cloud') window.open(`/download/${state.selectedDashFile.path.replace('.pdf','.tex')}?token=` + localStorage.getItem('token'), '_blank'); };
window.uploadCurrent         = () => { if (state.selectedDashFile && state.selectedDashFile.type !== 'cloud') dashUpload(state.selectedDashFile.path); };

window.shareCurrent = async () => {
    if (!state.selectedDashFile) return;
    
    // Construct the elegant public URL
    const publicUrl = window.location.origin + '/share/' + state.selectedDashFile.path;
    
    try {
        await navigator.clipboard.writeText(publicUrl);
        await alert(`Smart Portfolio Link copied to clipboard!\n\n${publicUrl}\n\n(Valid for 7 days)`);
    } catch(e) {
        await alert('Failed to copy link.');
    }
};

state.subscribe(async () => {
    const rolesGrid = document.getElementById('roles-grid');
    if (rolesGrid) {
        rolesGrid.innerHTML = Object.keys(state.data.recipes).map(r =>
            `<button class="btn btn-secondary" onclick="runBuild('${r}')">${r}</button>`
        ).join('');
    }
});

document.addEventListener('DOMContentLoaded', refreshSync);
