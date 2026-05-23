import { state, ui } from './app.js';

export async function loadCheckpoints() {
    const listEl = document.getElementById('checkpoint-list');
    if (!listEl) return;
    
    listEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Loading checkpoints...</div>';
    try {
        const res = await fetch('/checkpoints');
        const cps = await res.json();
        
        if (cps.length === 0) {
            listEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">No checkpoints found. Create one to get started.</div>';
            return;
        }
        
        listEl.innerHTML = cps.map(cp => `
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:14px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px;">${cp.name}</div>
                    <div style="font-size:11px;color:var(--text-muted);">Created: ${new Date(cp.created).toLocaleString()}</div>
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="btn btn-sm btn-primary" onclick="restoreCheckpoint('${cp.name}')">Restore</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCheckpoint('${cp.name}')">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        listEl.innerHTML = '<div style="color:red;font-size:12px;">Failed to load checkpoints.</div>';
    }
}

window.restoreCheckpoint = async function(name) {
    if (!confirm(`Are you sure you want to restore ${name}? This will overwrite your current configuration.`)) return;
    try {
        const res = await fetch(`/checkpoints/${name}/restore`, { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
            alert(`Checkpoint restored from ${data.source}! Reloading application...`);
            window.location.reload();
        } else {
            alert('Failed to restore checkpoint.');
        }
    } catch (e) {
        alert('Error restoring checkpoint.');
    }
};

window.deleteCheckpoint = async function(name) {
    if (!confirm(`Delete checkpoint ${name}?`)) return;
    try {
        await fetch(`/checkpoints/${name}`, { method: 'DELETE' });
        loadCheckpoints();
    } catch (e) {
        alert('Error deleting checkpoint.');
    }
};

// Override the createCheckpoint from main.js to reload the list
const originalCreate = window.createCheckpoint;
window.createCheckpoint = async function() {
    await originalCreate();
    loadCheckpoints();
};
