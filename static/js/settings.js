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
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="setting-export-folder" class="input-field" value="${settings.export_folder || ''}" placeholder="/path/to/local/folder" style="flex: 1;">
                    <button class="btn btn-secondary" onclick="window.pickExportFolder()" style="white-space: nowrap;">Browse...</button>
                </div>
                <p class="hint-text mt-1">Directory to save exported PDFs when clicking 'Save to Folder'.</p>
            </div>
            <div class="field-group mb-4">
                <label>File Name Prefix</label>
                <input type="text" id="setting-file-prefix" class="input-field" value="${settings.file_name_prefix || 'BIBIN_RAJU-'}" placeholder="e.g. BIBIN_RAJU-">
                <p class="hint-text mt-1">Prefix added to automatically generated PDF and cover letter filenames.</p>
            </div>
            <button class="btn btn-success mt-4" onclick="saveSettings()">Save Settings</button>
            
            <hr style="border:none;border-top:1px solid var(--border);margin:30px 0;">
            
            <div class="editor-form-header">Manual Actions</div>
            <button class="btn btn-secondary mt-2" onclick="triggerManualR2Backup()">Force R2 Archive Backup Now</button>

            <hr style="border:none;border-top:1px solid var(--border);margin:30px 0;">

            <div class="editor-form-header">Profile Photo</div>
            <div id="photo-section" style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;margin-top:12px">
                <div id="photo-preview" style="width:120px;height:160px;border:2px dashed var(--border);border-radius:var(--radius);overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--bg-main);flex-shrink:0">
                    <img id="photo-img" src="/assets/profile-photo.jpg?t=${Date.now()}" style="max-width:100%;max-height:100%;object-fit:contain" onerror="this.style.display='none'" onload="this.style.display='block'">
                </div>
                <div style="display:flex;flex-direction:column;gap:8px">
                    <label class="btn btn-primary" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;width:fit-content">
                        <span class="material-symbols-outlined" style="font-size:16px">upload</span> Upload Photo
                        <input type="file" accept="image/*" style="display:none" onchange="window.settingsUploadPhoto(event)">
                    </label>
                    <p class="hint-text" style="font-size:11px;color:var(--text-muted);max-width:300px">
                        JPEG/PNG, ~3:4 aspect ratio. Saved locally and synced to R2 cloud storage.
                    </p>
                    <div id="photo-status" style="font-size:11px;color:var(--text-muted)"></div>
                </div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = '<div style="color:red;font-size:12px;">Failed to load settings.</div>';
    }
}

window.saveSettings = async function() {
    const always_cloud_mode = document.getElementById('setting-cloud-mode').checked;
    const backup_frequency_hours = parseInt(document.getElementById('setting-backup-freq').value, 10);
    const export_folder = document.getElementById('setting-export-folder').value;
    const file_name_prefix = document.getElementById('setting-file-prefix').value;
    
    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ always_cloud_mode, backup_frequency_hours, export_folder, file_name_prefix })
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

window.pickExportFolder = async function() {
    try {
        const res = await fetch('/api/settings/pick-folder');
        const data = await res.json();
        if (data.folder) {
            document.getElementById('setting-export-folder').value = data.folder;
        }
    } catch(e) {
        console.error("Error picking folder", e);
    }
};

window.settingsUploadPhoto = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById('photo-status');
    if (statusEl) statusEl.textContent = 'Uploading...';
    try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/upload-photo', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            if (statusEl) statusEl.textContent = data.message || 'Photo updated';
            const img = document.getElementById('photo-img');
            if (img) img.src = '/assets/profile-photo.jpg?t=' + Date.now();
        } else {
            if (statusEl) statusEl.textContent = 'Error: ' + (data.detail || 'Unknown error');
        }
    } catch (e) {
        if (statusEl) statusEl.textContent = 'Upload failed: ' + e.message;
    }
    event.target.value = '';
};
