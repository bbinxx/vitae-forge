import { api } from './api.js';
import { state } from './app.js';

export async function refreshSync() {
    try {
        const files = await api.fetchFiles();
        const list = document.getElementById('file-list');
        if (!list) return;
        
        list.innerHTML = files.filter(f => !f.name.includes('LIVE_PREVIEW_TEMP')).map(f => {
            const isPhoto = f.name.includes('_X.pdf');
            const colorClass = f.sync_status === 'synced' ? 'text-green-400 border-green-400' 
                             : f.sync_status === 'modified' ? 'text-yellow-400 border-yellow-400' 
                             : 'text-blue-400 border-blue-400';
                             
            return `
            <div class="flex justify-between items-center bg-gray-800 p-2 rounded text-xs mt-2">
              <div class="flex items-center gap-2">
                <span class="px-1.5 py-0.5 rounded bg-gray-900 border ${colorClass} text-[0.6rem] uppercase">${f.sync_status}</span>
                ${isPhoto ? '<span class="px-1.5 py-0.5 rounded border border-gray-600 text-gray-400 text-[0.6rem]">PHOTO</span>' : ''}
              </div>
              <span class="flex-1 ml-3 cursor-pointer text-gray-300 hover:text-white" onclick="window.dashPreview('${f.name}')">${f.name}</span>
              <button class="bg-blue-900 text-blue-300 hover:bg-blue-800 border border-blue-800 px-2 py-1 rounded text-xs" onclick="window.dashUpload('${f.name}')">☁</button>
            </div>
            `;
        }).join('');
    } catch (e) {
        console.error("Server offline", e);
    }
}

export async function runBuild(role) {
    const logEl = document.getElementById('log');
    const dot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    
    logEl.textContent = ''; 
    dot.className = 'inline-block w-2 h-2 rounded-full mr-2 bg-green-500 shadow-[0_0_6px_#22c55e]';
    statusText.textContent = 'BUILDING...';
    
    await api.buildRole(role, (line) => {
        logEl.textContent += line;
        logEl.scrollTop = logEl.scrollHeight;
    });
    
    dot.className = 'inline-block w-2 h-2 rounded-full mr-2 bg-gray-500';
    statusText.textContent = 'IDLE';
    refreshSync();
}

export function dashPreview(f) { 
    state.selectedDashFile = f; 
    document.getElementById('current-filename').textContent = f; 
    document.getElementById('dash-actions').style.display = 'flex'; 
    document.getElementById('viewer-container').innerHTML = `<iframe src="/pdf/${f}#toolbar=0" class="w-full h-full border-none bg-white"></iframe>`; 
    
    const isPhoto = f.includes('_X.pdf');
    document.getElementById('btn-dash-bundle').style.display = isPhoto ? 'inline-block' : 'none';
    document.getElementById('btn-dash-tex').style.display = isPhoto ? 'none' : 'inline-block';
}

export async function dashUpload(f) { 
    try {
        await api.uploadPdfToCloud(f);
        refreshSync(); 
    } catch(e) {}
}

export async function uploadPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const res = await api.uploadPhoto(file);
        if (res.ok) {
            alert("✅ " + res.data.message);
        } else {
            alert("❌ Upload failed:\n" + (res.data.detail || "Unknown error"));
        }
    } catch (e) {
        alert("❌ Error uploading photo.");
        console.error(e);
    }
    event.target.value = '';
}

// Bind to window for HTML onclick handlers
window.dashPreview = dashPreview;
window.dashUpload = dashUpload;
window.runBuild = runBuild;
window.uploadPhoto = uploadPhoto;
window.refreshSync = refreshSync;
window.downloadCurrent = () => { if (state.selectedDashFile) window.open(`/download/${state.selectedDashFile}`, '_blank'); };
window.downloadCurrentBundle = () => { if (state.selectedDashFile) window.open(`/download-bundle/${state.selectedDashFile.replace('.pdf', '.tex')}`, '_blank'); };
window.downloadCurrentTex = () => { if (state.selectedDashFile) window.open(`/download/${state.selectedDashFile.replace('.pdf', '.tex')}`, '_blank'); };
window.uploadCurrent = () => { if (state.selectedDashFile) dashUpload(state.selectedDashFile); };

state.subscribe(() => {
    const rolesGrid = document.getElementById('roles-grid');
    if (rolesGrid) {
        rolesGrid.innerHTML = Object.keys(state.data.recipes).map(r => `
            <button class="bg-gray-800 border border-gray-700 hover:border-gray-500 text-gray-200 px-3 py-2 rounded text-xs uppercase tracking-wider" onclick="runBuild('${r}')">${r}</button>
        `).join('');
    }
});

// Initial load
document.addEventListener('DOMContentLoaded', refreshSync);
