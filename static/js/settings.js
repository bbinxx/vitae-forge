export async function loadSettings() {
    const container = document.getElementById('settings-container');
    if (!container) return;

    container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Loading settings from Firebase...</div>';
    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();
        const exportFolder = settings.export_folder || '';

        container.innerHTML = `
            <div class="settings-section" style="max-width: 600px;">
                <div class="field-group mb-4">
                    <label>File Name Prefix</label>
                    <input type="text" id="setting-file-prefix" class="input-field" value="${settings.file_name_prefix || 'RESUME-'}" placeholder="e.g. RESUME-">
                    <p class="hint-text mt-1">Prefix added to automatically generated PDF and cover letter filenames.</p>
                </div>

                <div class="field-group mb-4">
                    <label>Export Folder</label>
                    <div style="display:flex;gap:8px">
                        <input type="text" id="setting-export-folder" class="input-field" value="${exportFolder}" placeholder="/home/user/Exports" style="flex:1">
                        <button class="btn btn-secondary" onclick="pickExportFolder()" title="Browse..."><span class="material-symbols-outlined" style="font-size:16px;vertical-align:-3px">folder_open</span></button>
                    </div>
                    <p class="hint-text mt-1">Local folder where PDFs are saved when using "Save to Folder".</p>
                </div>

                <button class="btn btn-success mt-2" onclick="saveSettings()">Save Preferences</button>
            </div>

            <hr style="border:none;border-top:1px solid var(--border);margin:30px 0;">

            <div class="settings-section">
                <div class="editor-form-header" style="margin-bottom:16px">Profile Photo</div>
                <div style="display:flex; flex-wrap:wrap; align-items:center; gap:24px">
                    <div id="settings-photo-preview" style="width:120px;height:120px;border-radius:50%;border:2px dashed var(--border);overflow:hidden;flex-shrink:0;background:var(--bg-card);align-items:center;justify-content:center;display:none;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
                    </div>
                    <div style="flex:1; min-width: 200px;">
                        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">Upload a square profile picture. This will be automatically injected into resume templates that support photos.</p>
                        <div style="display:flex;gap:10px">
                            <label for="settings-photo-upload" class="btn btn-secondary" style="cursor:pointer"><span class="material-symbols-outlined" style="font-size:16px;vertical-align:-3px">photo_camera</span> Choose Photo</label>
                            <input type="file" id="settings-photo-upload" accept="image/*" class="hidden" onchange="window.uploadSettingsPhoto(event)">
                        </div>
                    </div>
                </div>
            </div>
        `;

        loadSettingsPhotoPreview();
    } catch (e) {
        container.innerHTML = '<div style="color:red;font-size:12px;">Failed to load settings.</div>';
    }
}

export async function uploadSettingsPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/upload-photo', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok && data.ok) {
            toast('Photo uploaded successfully', 'success');
            loadSettingsPhotoPreview();
        } else {
            toast('Upload failed: ' + (data.detail || 'Unknown error'), 'error');
        }
    } catch (e) { toast('Error uploading photo.', 'error'); }
    event.target.value = '';
}

export async function loadSettingsPhotoPreview() {
    const preview = document.getElementById('settings-photo-preview');
    if (!preview) return;
    try {
        const res = await fetch('/photo-status');
        if (res.ok) {
            const data = await res.json();
            if (data.has_photo) {
                preview.style.display = 'flex';
                const token = localStorage.getItem('token') || '';
                preview.innerHTML = `<img src="/photo?t=${Date.now()}&token=${token}" style="width:100%;height:100%;object-fit:cover;display:block">`;
            } else {
                preview.style.display = 'none';
            }
        }
    } catch(e) {}
}

window.saveSettings = async function() {
    const file_name_prefix = document.getElementById('setting-file-prefix').value;
    const export_folder = document.getElementById('setting-export-folder').value;

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_name_prefix, export_folder })
        });
        if (res.ok) {
            toast('Settings saved successfully!', 'success');
        } else {
            toast('Failed to save settings.', 'error');
        }
    } catch (e) {
        toast('Error saving settings.', 'error');
    }
};

window.pickExportFolder = async function() {
    const res = await fetch('/api/settings/pick-folder');
    const data = await res.json();
    if (data.folder) {
        document.getElementById('setting-export-folder').value = data.folder;
    } else {
        toast('No folder selected or picker unavailable.', 'info');
    }
};

window.uploadSettingsPhoto = uploadSettingsPhoto;
window.loadSettingsPhotoPreview = loadSettingsPhotoPreview;

function toast(msg, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: 'check', error: 'close', info: 'info' };
    const t = document.createElement('div');
    t.className = `toast toast-${type || 'info'}`;
    t.innerHTML = `
        <span class="toast-icon"><span class="material-symbols-outlined" style="font-size:1.1em;vertical-align:middle;line-height:1">${icons[type] || 'info'}</span></span>
        <span class="toast-msg">${msg}</span>
        <button class="toast-dismiss" onclick="this.parentElement.remove()"><span class="material-symbols-outlined" style="font-size:1.1em;vertical-align:middle;line-height:1">close</span></button>`;
    container.appendChild(t);
    setTimeout(() => { t.classList.add('toast-out'); setTimeout(() => t.remove(), 220); }, 3000);
}
