export async function loadSettings() {
    const container = document.getElementById('settings-container');
    if (!container) return;
    
    container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Loading settings from Firebase...</div>';
    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();
        
        container.innerHTML = `
            <div class="field-group mb-4">
                <label style="display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" id="setting-cloud-mode" ${settings.always_cloud_mode ? 'checked' : ''} style="accent-color:var(--accent)">
                    Strict Cloud Mode (Fail if Firebase offline)
                </label>
            </div>
            <div class="field-group mb-4">
                <label>Automated R2 Backup Frequency (Hours)</label>
                <input type="number" id="setting-backup-freq" class="input-field" value="${settings.backup_frequency_hours || 24}" min="1" max="720">
                <p class="hint-text mt-1">Zips and uploads your configs and templates to R2 automatically.</p>
            </div>
            <div class="field-group mb-4">
                <label>Local Export Folder Path</label>
                <input type="text" id="setting-export-folder" class="input-field" value="${settings.export_folder || ''}" placeholder="/path/to/local/folder">
                <p class="hint-text mt-1">Directory to save exported PDFs when clicking 'Save to Folder'.</p>
            </div>
            <button class="btn btn-success mt-4" onclick="saveSettings()">Save Settings</button>
            
            <hr style="border:none;border-top:1px solid var(--border);margin:30px 0;">
            
            <div class="editor-form-header">Manual Actions</div>
            <button class="btn btn-secondary mt-2" onclick="triggerManualR2Backup()">Force R2 Archive Backup Now</button>
        `;
    } catch (e) {
        container.innerHTML = '<div style="color:red;font-size:12px;">Failed to load settings.</div>';
    }
}

window.saveSettings = async function() {
    const always_cloud_mode = document.getElementById('setting-cloud-mode').checked;
    const backup_frequency_hours = parseInt(document.getElementById('setting-backup-freq').value, 10);
    const export_folder = document.getElementById('setting-export-folder').value;
    
    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ always_cloud_mode, backup_frequency_hours, export_folder })
        });
        if (res.ok) {
            alert('Settings saved to Firebase successfully!');
        } else {
            alert('Failed to save settings.');
        }
    } catch (e) {
        alert('Error saving settings.');
    }
};

window.triggerManualR2Backup = async function() {
    alert("Triggering manual backup to R2... This might take a moment.");
    try {
        const res = await fetch('/api/r2-backup', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
            alert(`Backup successful! Archive saved to R2 as: ${data.filename}`);
        } else {
            alert(`Backup failed: ${data.detail || data.error}`);
        }
    } catch (e) {
        alert('Error communicating with server for backup.');
    }
};
