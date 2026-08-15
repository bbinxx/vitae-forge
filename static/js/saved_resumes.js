import { state } from './app.js';
import { openBookmarkEditor } from './version_editor.js';

let bookmarks = [];

function buildItemList() {
    const items = [];
    const recipes = state.data.recipes || {};

    for (const roleId of Object.keys(recipes)) {
        const recipe = recipes[roleId];
        const name = recipe.short_name || roleId;
        items.push({
            id: `recipe_${roleId}_nophoto`,
            name: `${name} (No Photo)`,
            source: 'recipe',
            roleId,
            includePhoto: false,
            getData: () => {
                const d = JSON.parse(JSON.stringify(recipes[roleId]));
                if (!d.sections) d.sections = {};
                d.sections.photo = false;
                return d;
            },
            origin: 'Recipe',
        });
        items.push({
            id: `recipe_${roleId}_photo`,
            name: `${name} (With Photo)`,
            source: 'recipe',
            roleId,
            includePhoto: true,
            getData: () => {
                const d = JSON.parse(JSON.stringify(recipes[roleId]));
                if (!d.sections) d.sections = {};
                d.sections.photo = true;
                return d;
            },
            origin: 'Recipe',
        });
    }

    for (const bm of bookmarks) {
        const data = bm.data || {};
        items.push({
            id: `bm_${bm.id}`,
            name: bm.name,
            source: 'bookmark',
            bmId: bm.id,
            includePhoto: data.sections && data.sections.photo !== false,
            getData: function() { return this._customData || JSON.parse(JSON.stringify(data)); },
            origin: 'Bookmark',
            createdAt: bm.created_at,
        });
    }

    return items;
}

function renderList(filter) {
    const el = document.getElementById('sr-list');
    const empty = document.getElementById('sr-empty');
    if (!el) return;

    const all = buildItemList();
    const filtered = filter
        ? all.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()))
        : all;

    if (filtered.length === 0) {
        el.innerHTML = '';
        el.classList.add('hidden');
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');
    el.classList.remove('hidden');

    el.innerHTML = filtered.map(item => `
        <div class="sr-item" data-id="${item.id}">
            <span class="sr-item-icon material-symbols-outlined">description</span>
            <div class="sr-item-body">
                <div class="sr-item-name">${item.name}</div>
                <div class="sr-item-meta">${item.origin}${item.createdAt ? ' \u00b7 ' + new Date(item.createdAt).toLocaleDateString() : ''}</div>
            </div>
            <div class="sr-item-badges">
                <span class="sr-badge ${item.includePhoto ? 'sr-badge-photo' : 'sr-badge-nophoto'}">${item.includePhoto ? 'Photo' : 'No Photo'}</span>
                <span class="sr-badge ${item.source === 'recipe' ? 'sr-badge-recipe' : 'sr-badge-bookmark'}">${item.origin}</span>
            </div>
            <button class="sr-item-delete material-symbols-outlined" title="${item.source === 'bookmark' ? 'Delete bookmark' : 'Recipe cannot be deleted here'}" ${item.source === 'bookmark' ? `onclick="event.stopPropagation();window.deleteBookmarkItem('${item.bmId}')"` : 'disabled style="opacity:0.2"'}>close</button>
        </div>
    `).join('');

    el.querySelectorAll('.sr-item').forEach(div => {
        div.addEventListener('click', () => {
            const id = div.dataset.id;
            const item = filtered.find(i => i.id === id);
            if (item) openSrModal(item);
        });
    });
}

export async function loadSavedResumes() {
    try {
        const res = await fetch('/bookmarks');
        const data = await res.json();
        bookmarks = data.bookmarks || [];
    } catch (e) {
        bookmarks = [];
    }
    const filterEl = document.getElementById('sr-filter');
    const filter = filterEl ? filterEl.value : '';
    renderList(filter);
}


let _jsonImportEditor = null;

export function addRecipeFromJson() {
    document.getElementById('json-import-name').value = '';
    document.getElementById('json-import-photo').checked = false;
    
    const container = document.getElementById('json-import-editor-container');
    container.innerHTML = '';
    
    if (window.JSONEditor) {
        _jsonImportEditor = new JSONEditor(container, {
            mode: 'code',
            modes: ['code', 'tree', 'form']
        });
        _jsonImportEditor.set({});
    } else {
        container.innerHTML = '<textarea id="json-import-textarea" class="json-editor" style="width:100%; height:100%; border:none; padding:8px;"></textarea>';
    }
    
    const modal = document.getElementById('json-import-modal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

export async function submitJsonImport() {
    let data;
    if (_jsonImportEditor) {
        try {
            data = _jsonImportEditor.get();
        } catch(e) {
            return await alert("Invalid JSON format in editor.");
        }
    } else {
        const text = document.getElementById('json-import-textarea').value;
        try {
            data = JSON.parse(text);
        } catch(e) {
            return await alert("Invalid JSON format.");
        }
    }
    
    const name = document.getElementById('json-import-name').value.trim();
    if (!name) return await alert("Please enter a name for the resume.");
    
    const includePhoto = document.getElementById('json-import-photo').checked;
    if (!data.sections) data.sections = {};
    data.sections.photo = includePhoto;
    
    try {
        const res = await fetch('/bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, data, source_app_id: '' })
        });
        const result = await res.json();
        if (result.ok) {
            const modal = document.getElementById('json-import-modal');
            modal.classList.add('hidden');
            modal.style.display = 'none';
            await alert('Resume added successfully!');
            loadSavedResumes();
        } else {
            await alert('Failed to add resume');
        }
    } catch (e) {
        await alert('Error: ' + e.message);
    }
}

export async function addRecipeFromApp() {
    let apps = [];
    try {
        const res = await fetch('/applications');
        const data = await res.json();
        apps = data.applications || [];
    } catch (e) {}

    if (apps.length === 0 && bookmarks.length === 0) {
        return await alert("No applications or bookmarks found to clone from.");
    }
    const items = [
        ...apps.map((a, i) => ({ idx: i, label: `${a.company} - ${a.role}`, template: a.resume_template })),
        ...bookmarks.map((b, i) => ({ idx: i + apps.length, label: `[Bookmark] ${b.name}`, template: b.data }))
    ];
    const listStr = items.map(it => `${it.idx}: ${it.label}`).join('\n');
    const indexStr = await prompt(`Enter the index to clone:\n${listStr}`);
    if (!indexStr || isNaN(indexStr)) return;
    const idx = parseInt(indexStr);
    const item = items[idx];
    if (!item || !item.template) return await alert("Selected item has no resume template.");

    const newId = await prompt("Enter ID for the cloned recipe:");
    if (!newId) return;
    if (state.data.recipes[newId]) return await alert("Recipe ID already exists");

    state.data.recipes[newId] = JSON.parse(JSON.stringify(item.template));
    state.data.recipes[newId].short_name = "CLONED";

    state.notify();
    loadSavedResumes();
}

export async function bookmarkAppResume(appId) {
    try {
        const res = await fetch('/applications');
        const data = await res.json();
        const apps = data.applications || [];
        const app = apps.find(a => a.id === appId);
        if (!app) { await alert('Application not found'); return; }

        const template = app.resume_template;
        if (!template || Object.keys(template).length === 0) {
            await alert('This application has no resume template to bookmark.');
            return;
        }

        const name = await prompt('Name this saved resume:', `${app.company} - ${app.role}`);
        if (!name) return;

        const bmRes = await fetch('/bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, data: template, source_app_id: appId })
        });
        const bmData = await bmRes.json();
        if (bmData.ok) {
            await alert('Resume bookmarked successfully!');
            loadSavedResumes();
        } else {
            await alert('Failed to bookmark resume.');
        }
    } catch (e) {
        await alert('Error bookmarking resume: ' + e.message);
    }
}

export async function deleteBookmarkItem(bmId) {
    if (!await confirm('Delete this bookmark?')) return;
    try {
        await fetch(`/bookmarks/${bmId}`, { method: 'DELETE' });
        loadSavedResumes();
    } catch (e) {
        await alert('Error deleting bookmark: ' + e.message);
    }
}

// ── Modal ──────────────────────────────────────────────────────────────────

let _srModalCurrentItem = null;
let _srPreviewType = 'resume';
let _srIncludePhoto = false;
let _srDebounceTimer = null;
let _srCompiledPdf = null;

window.srHasCoverLetter = function(data) {
    if (!data || typeof data !== 'object') return false;
    const cl = data.cover_letter || data.email || (data.resume_template && (data.resume_template.cover_letter || data.resume_template.email)) || (data.recipe && (data.recipe.cover_letter || data.recipe.email));
    return !!(cl && String(cl).trim());
};

window.srUpdateToggleUI = function() {
    const rBtn = document.getElementById('sr-type-resume');
    const cBtn = document.getElementById('sr-type-cover');
    const pBtn = document.getElementById('sr-type-photo');

    const item = _srModalCurrentItem;
    const data = item ? item.getData() : null;
    const hasCL = window.srHasCoverLetter(data);

    if (cBtn) {
        if (!hasCL) {
            cBtn.style.display = 'none';
            if (_srPreviewType === 'cover_letter') {
                _srPreviewType = 'resume';
            }
        } else {
            cBtn.style.display = 'inline-flex';
        }
    }

    if (rBtn && cBtn) {
        if (_srPreviewType === 'resume') {
            rBtn.style.background = 'var(--accent)';
            rBtn.style.color = 'white';
            cBtn.style.background = 'transparent';
            cBtn.style.color = 'inherit';
        } else {
            cBtn.style.background = 'var(--accent)';
            cBtn.style.color = 'white';
            rBtn.style.background = 'transparent';
            rBtn.style.color = 'inherit';
        }
    }
    if (pBtn) {
        if (_srIncludePhoto) {
            pBtn.style.background = 'var(--accent)';
            pBtn.style.color = 'white';
        } else {
            pBtn.style.background = 'transparent';
            pBtn.style.color = 'inherit';
        }
    }
};

window.srSetPreviewType = function(type) {
    _srPreviewType = type;
    window.srUpdateToggleUI();
    refreshPreview();
};

window.srTogglePhoto = function() {
    _srIncludePhoto = !_srIncludePhoto;
    window.srUpdateToggleUI();
    refreshPreview();
};

window.srOnJsonInput = function(text) {
    try {
        const item = _srModalCurrentItem;
        if (item) {
            item._customData = JSON.parse(text);
            window.srUpdateToggleUI();
            const saveStatus = document.getElementById('sr-save-status');
            if (saveStatus) saveStatus.innerHTML = '<span class="material-symbols-outlined spinning" style="font-size:12px;vertical-align:-2px">sync</span> Saving...';

            if (_srDebounceTimer) clearTimeout(_srDebounceTimer);
            _srDebounceTimer = setTimeout(() => {
                refreshPreview();
                window.srSaveToBackend();
            }, 600);
        }
    } catch(e) {}
};

function openSrModal(item) {
    _srModalCurrentItem = item;
    const data = item.getData();
    const hasPhoto = item.includePhoto;
    const name = item.name;

    let overlay = document.getElementById('sr-modal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sr-modal';
        overlay.className = 'modal-overlay hidden';
        overlay.innerHTML = `
            <style>
              #sr-modal .modal-box {
                width: 95vw;
                max-width: 1400px;
                height: 88vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
              }
              .sr-split-body {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                flex: 1;
                min-height: 0;
                padding: 16px 20px;
                background: var(--bg-main);
              }
              @media (max-width: 900px) {
                .sr-split-body {
                  grid-template-columns: 1fr;
                  overflow-y: auto;
                }
              }
            </style>
            <div class="modal-box">
                <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between">
                    <div style="display:flex;align-items:center;gap:12px">
                        <div class="modal-title" id="sr-modal-title"></div>
                        <div id="sr-save-status" style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:4px">
                            <span class="material-symbols-outlined" style="font-size:14px;color:var(--success)">check_circle</span> Saved
                        </div>
                    </div>
                    <button class="modal-close material-symbols-outlined" onclick="document.getElementById('sr-modal').classList.add('hidden')">close</button>
                </div>
                <div class="sr-split-body">
                    <!-- Left Column: JSON Editor -->
                    <div style="display:flex;flex-direction:column;gap:8px;min-height:0">
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px">
                            <span style="font-size:11px;font-weight:600;color:var(--accent);display:flex;align-items:center;gap:4px">
                                <span class="material-symbols-outlined" style="font-size:1.1em">code</span> Resume JSON
                            </span>
                            <span style="font-size:10px;color:var(--text-muted)">Realtime sync enabled</span>
                        </div>
                        <div id="sr-sec-toggle-bar" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding:6px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;"></div>
                        <div id="sr-json-editor-container" style="flex:1;min-height:0;border-radius:6px;overflow:hidden;border:1px solid var(--border)"></div>
                    </div>

                    <!-- Right Column: Live PDF Preview -->
                    <div style="display:flex;flex-direction:column;gap:8px;min-height:0">
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px">
                            <span id="sr-preview-status" style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:6px">
                                <span class="material-symbols-outlined" style="font-size:1.1em">description</span> Live PDF Preview
                            </span>
                            <div style="display:flex;gap:4px;align-items:center">
                                <button id="sr-type-resume" class="btn btn-ghost" style="font-size:10px;padding:2px 8px;background:var(--accent);color:white" onclick="window.srSetPreviewType('resume')">Resume</button>
                                <button id="sr-type-cover" class="btn btn-ghost" style="font-size:10px;padding:2px 8px" onclick="window.srSetPreviewType('cover_letter')">Cover Letter</button>
                                <span style="width:1px;height:16px;background:var(--border);margin:0 2px"></span>
                                <button id="sr-type-photo" class="btn btn-ghost" style="font-size:10px;padding:2px 8px" onclick="window.srTogglePhoto()" title="Include photo">
                                    <span class="material-symbols-outlined" style="font-size:12px;vertical-align:-2px">photo_camera</span> Photo
                                </button>
                            </div>
                        </div>
                        <div style="flex:1;position:relative;border:1px solid var(--border);border-radius:6px;overflow:hidden;background:#525659">
                            <div id="sr-preview-loading" class="sr-loading-overlay hidden">
                                <div class="sr-spinner"></div>
                                <div id="sr-loading-pct" style="font-size:16px;font-weight:700;color:#818cf8;margin-top:4px">0%</div>
                                <span style="font-size:12px;font-weight:500;color:#e2e8f0">Compiling PDF preview...</span>
                            </div>
                            <iframe id="sr-preview-iframe" src="about:blank" style="width:100%;height:100%;border:none;transition:opacity 0.2s ease"></iframe>
                        </div>
                    </div>
                </div>
                <div class="modal-footer" id="sr-modal-footer"></div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    document.getElementById('sr-modal-title').textContent = name;

    const footer = document.getElementById('sr-modal-footer');
    footer.innerHTML = `
        <button class="btn btn-secondary" onclick="window.srEditVisually()"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">edit</span> Visual Edit</button>
        <button class="btn btn-primary" onclick="window.srManualSave()" style="background-color: var(--accent); border-color: var(--accent);"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">save</span> Save</button>
        <button class="btn btn-secondary" onclick="window.srDownloadPdf()" style="margin-left:auto"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">picture_as_pdf</span> Download PDF</button>
        <button class="btn btn-secondary" onclick="window.srDownloadLatex()"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">description</span> Download LaTeX</button>
    `;

    renderSrSectionToggleButtons(data);

    const jsonContainer = document.getElementById('sr-json-editor-container');
    if (window.JSONEditor) {
        jsonContainer.innerHTML = '';
        window._srJsonEditor = new JSONEditor(jsonContainer, {
            mode: 'code',
            modes: ['code', 'tree', 'form'],
            onChangeText: (text) => {
                try {
                    const parsed = JSON.parse(text);
                    item._customData = parsed;
                    renderSrSectionToggleButtons(parsed);
                    const saveStatus = document.getElementById('sr-save-status');
                    if (saveStatus) saveStatus.innerHTML = '<span class="material-symbols-outlined spinning" style="font-size:12px;vertical-align:-2px">sync</span> Saving...';

                    if (_srDebounceTimer) clearTimeout(_srDebounceTimer);
                    _srDebounceTimer = setTimeout(() => {
                        refreshPreview();
                        window.srSaveToBackend();
                    }, 600);
                } catch(e) {}
            }
        });
        window._srJsonEditor.set(data);
    } else {
        jsonContainer.innerHTML = `<textarea class="json-editor" id="sr-json-editor" style="width:100%;height:100%;font-family:monospace;" oninput="window.srOnJsonInput(this.value)">${JSON.stringify(data, null, 2)}</textarea>`;
    }

    document.getElementById('sr-preview-iframe').src = 'about:blank';
    _srIncludePhoto = !!item.includePhoto;
    _srPreviewType = 'resume';
    window.srUpdateToggleUI();
    overlay.classList.remove('hidden');

    window.srDownloadPdf = () => srDownloadPdf(item);
    window.srDownloadLatex = () => srDownloadLatex(item);
    window.srDownloadZip = () => srDownloadZip(item);
    window.srExportBookmark = () => srExportBookmark(item, editor);

    refreshPreview();
}

window.srSaveToBackend = async function() {
    const item = _srModalCurrentItem;
    if (!item || item.source !== 'bookmark') return;
    const saveStatus = document.getElementById('sr-save-status');
    if (saveStatus) saveStatus.innerHTML = '<span class="material-symbols-outlined spinning" style="font-size:12px;vertical-align:-2px">sync</span> Saving...';
    try {
        const res = await fetch(`/bookmarks/${item.bmId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: item.name, data: item.getData(), source_app_id: item.appId || "" })
        });
        const result = await res.json();
        if (result.ok) {
            if (saveStatus) saveStatus.innerHTML = '<span class="material-symbols-outlined" style="font-size:12px;color:var(--success);vertical-align:-2px">check_circle</span> Saved';
        } else {
            if (saveStatus) saveStatus.innerHTML = '<span style="color:var(--error)">Save failed</span>';
        }
    } catch(e) {
        if (saveStatus) saveStatus.innerHTML = '<span style="color:var(--error)">Save error</span>';
    }
};

window.srManualSave = async function() {
    const saveBtn = document.querySelector('#sr-modal-footer .btn-primary');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<span class="material-symbols-outlined spinning" style="font-size:14px;vertical-align:-2px">sync</span> Saving...'; }
    await window.srSaveToBackend();
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">save</span> Save'; }
};

let _srProgressInterval = null;

function startPreviewProgress() {
    if (_srProgressInterval) clearInterval(_srProgressInterval);
    const pctEl = document.getElementById('sr-loading-pct');
    const status = document.getElementById('sr-preview-status');
    let pct = 10;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (status) status.innerHTML = `<span class="material-symbols-outlined spinning" style="font-size:1.1em;vertical-align:middle;line-height:1">hourglass_empty</span> Compiling preview (${pct}%)...`;

    _srProgressInterval = setInterval(() => {
        if (pct < 50) {
            pct += Math.floor(Math.random() * 8) + 6;
        } else if (pct < 85) {
            pct += Math.floor(Math.random() * 6) + 3;
        } else if (pct < 95) {
            pct += 1;
        }
        if (pct > 95) pct = 95;
        if (pctEl) pctEl.textContent = `${pct}%`;
        if (status) status.innerHTML = `<span class="material-symbols-outlined spinning" style="font-size:1.1em;vertical-align:middle;line-height:1">hourglass_empty</span> Compiling preview (${pct}%)...`;
    }, 120);
}

function stopPreviewProgress(success = true) {
    if (_srProgressInterval) {
        clearInterval(_srProgressInterval);
        _srProgressInterval = null;
    }
    const pctEl = document.getElementById('sr-loading-pct');
    if (pctEl) pctEl.textContent = success ? '100%' : '0%';
}

async function refreshPreview() {
    const item = _srModalCurrentItem;
    if (!item) return;

    const iframe = document.getElementById('sr-preview-iframe');
    const loading = document.getElementById('sr-preview-loading');
    const status = document.getElementById('sr-preview-status');

    if (loading) loading.classList.remove('hidden');
    startPreviewProgress();
    if (iframe) iframe.style.opacity = '0.3';

    try {
        const data = item.getData();
        const name = item.name.replace(/[^\w\-_]/g, '_');
        const photo = _srIncludePhoto;
        const type = _srPreviewType;

        let pdfFile;

        if (item.source === 'bookmark' && type === 'resume' && photo === !!item.includePhoto && !item._customData) {
            const res = await fetch(`/bookmarks/${item.bmId}/compile-pdf?include_photo=${photo}`, { method: 'POST' });
            const result = await res.json();
            pdfFile = result.pdf;
        } else {
            const res = await fetch('/compile-direct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: data, name: name, pdf_name: name, type: type, include_photo: photo })
            });
            const result = await res.json();
            pdfFile = result.pdf || (result.path ? result.path.split('/').pop() : null);
        }

        if (pdfFile) {
            _srCompiledPdf = pdfFile;
            iframe.src = `/pdf/${pdfFile}`;
            iframe.onload = () => {
                stopPreviewProgress(true);
                if (loading) loading.classList.add('hidden');
                if (status) status.innerHTML = '<span class="material-symbols-outlined" style="font-size:1.1em;color:var(--success);vertical-align:middle">check_circle</span> Live PDF Preview';
                if (iframe) iframe.style.opacity = '1';
            };
        } else {
            stopPreviewProgress(false);
            if (loading) loading.classList.add('hidden');
            if (status) status.innerHTML = '<span class="material-symbols-outlined" style="font-size:1.1em;color:var(--error);vertical-align:middle">error</span> Compilation failed';
            if (iframe) iframe.style.opacity = '1';
        }
    } catch (e) {
        stopPreviewProgress(false);
        if (loading) loading.classList.add('hidden');
        if (status) status.innerHTML = '<span class="material-symbols-outlined" style="font-size:1.1em;color:var(--error);vertical-align:middle">error</span> Error generating preview';
        if (iframe) iframe.style.opacity = '1';
    }
}

async function srDownloadPdf(item) {
    const data = item.getData();
    const name = item.name.replace(/[^\w\-_]/g, '_');

    try {
        let pdfFile;
        const photo = !!item.includePhoto;
        if (item.source === 'bookmark') {
            const res = await fetch(`/bookmarks/${item.bmId}/compile-pdf?include_photo=${photo}`, { method: 'POST' });
            const result = await res.json();
            pdfFile = result.pdf;
        } else {
            const res = await fetch('/compile-direct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: data, name, include_photo: photo })
            });
            const result = await res.json();
            pdfFile = result.pdf;
        }

        if (pdfFile) {
            const a = document.createElement('a');
            a.href = `/pdf/${pdfFile}`;
            a.download = pdfFile;
            a.click();
        }
    } catch (e) {
        await alert('Failed to compile PDF: ' + e.message);
    }
}

async function srDownloadLatex(item) {
    const data = item.getData();
    const name = item.name.replace(/[^\w\-_]/g, '_');

    try {
        let blob;
        const photo = !!item.includePhoto;
        if (item.source === 'bookmark') {
            const res = await fetch(`/bookmarks/${item.bmId}/download-latex?include_photo=${photo}`);
            blob = await res.blob();
        } else {
            const res = await fetch('/download-latex-direct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: data, name, include_photo: photo })
            });
            blob = await res.blob();
        }

        const suffix = item.includePhoto ? '_X' : '';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}${suffix}.tex`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        await alert('Failed to download LaTeX: ' + e.message);
    }
}

async function srDownloadZip(item) {
    const data = item.getData();
    const name = item.name.replace(/[^\w\-_]/g, '_');

    try {
        let blob;
        if (item.source === 'bookmark') {
            const res = await fetch(`/bookmarks/${item.bmId}/download-zip`);
            blob = await res.blob();
        } else {
            const res = await fetch('/download-zip-direct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: data, name, include_photo: true })
            });
            blob = await res.blob();
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        await alert('Failed to download ZIP: ' + e.message);
    }
}

async function srExportBookmark(item) {
    let data;
    try {
        if (window._srJsonEditor) {
            data = window._srJsonEditor.get();
        } else {
            const editorEl = document.getElementById('sr-json-editor');
            data = JSON.parse(editorEl.value);
        }
    } catch (e) {
        await alert('Invalid JSON in editor. Please fix before saving.');
        return;
    }

    const name = await prompt('Name this bookmark:', item.name);
    if (!name) return;

    try {
        const res = await fetch('/bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, data, source_app_id: '' })
        });
        const result = await res.json();
        if (result.ok) {
            await alert('Saved as bookmark!');
            loadSavedResumes();
        }
    } catch (e) {
        await alert('Error saving bookmark: ' + e.message);
    }
}

window.deleteBookmarkItem = deleteBookmarkItem;
window.addRecipeFromApp = addRecipeFromApp;
window.addRecipeFromJson = addRecipeFromJson;
window.submitJsonImport = submitJsonImport;
window.bookmarkAppResume = bookmarkAppResume;

document.addEventListener('input', async (e) => {
    if (e.target.id === 'sr-filter') {
        renderList(e.target.value);
    }
});

state.subscribe(async () => {
    const el = document.getElementById('sr-list');
    if (el) loadSavedResumes();
});



window.srEditVisually = function() {
    const item = _srModalCurrentItem;
    if (!item || item.source !== 'bookmark') {
        alert("Visual Edit is only supported for bookmarks.");
        return;
    }
    document.getElementById('sr-modal').classList.add('hidden');
    openBookmarkEditor(item.bmId, item.getData(), item.name, async (updatedRecipe) => {
        const originalData = item.getData();
        let payloadData;
        if (originalData && originalData.recipe) {
            payloadData = { ...originalData, recipe: updatedRecipe };
        } else if (originalData && originalData.resume_template) {
            payloadData = { ...originalData, resume_template: updatedRecipe };
        } else {
            payloadData = updatedRecipe;
        }
        try {
            const res = await fetch(`/bookmarks/${item.bmId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: item.name, data: payloadData, source_app_id: item.appId || "" })
            });
            const result = await res.json();
            if (result.ok) {
                alert('Bookmark saved successfully!');
                loadSavedResumes();
            } else {
                alert('Failed to save bookmark');
            }
        } catch (e) {
            alert('Error: ' + e.message);
        }
    });
};

function renderSrSectionToggleButtons(data) {
    const bar = document.getElementById('sr-sec-toggle-bar');
    if (!bar) return;

    let sectionsObj = {};
    if (data.sections && typeof data.sections === 'object') {
        sectionsObj = data.sections;
    } else if (data.resume_template && data.resume_template.sections && typeof data.resume_template.sections === 'object') {
        sectionsObj = data.resume_template.sections;
    }

    const defaultKeys = [
        'role_title', 'photo', 'summary', 'skills', 'experience', 
        'projects', 'education', 'certifications', 'achievements', 
        'areas_of_interest', 'languages', 'additional_info', 'cover_letter'
    ];

    const detectedKeys = new Set(defaultKeys);
    Object.keys(sectionsObj).forEach(k => detectedKeys.add(k));

    const formatLabel = (key) => {
        const labels = {
            role_title: 'Role Title',
            photo: 'Photo',
            summary: 'Summary',
            skills: 'Skills',
            experience: 'Experience',
            projects: 'Projects',
            education: 'Education',
            certifications: 'Certifications',
            achievements: 'Achievements',
            areas_of_interest: 'Areas of Interest',
            languages: 'Languages',
            additional_info: 'Additional Info',
            cover_letter: 'Cover Letter'
        };
        if (labels[key]) return labels[key];
        return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    const buttonsHtml = Array.from(detectedKeys).map(secKey => {
        const isEnabled = sectionsObj[secKey] !== false;
        const activeCls = isEnabled ? 'active' : 'disabled';
        const title = isEnabled ? `Click to disable ${formatLabel(secKey)} section in PDF` : `Click to enable ${formatLabel(secKey)} section in PDF`;
        return `<button type="button" class="sec-toggle-btn ${activeCls}" data-section="${secKey}" title="${title}" onclick="window.toggleSrResumeSection('${secKey}')">${formatLabel(secKey)}</button>`;
    }).join('');

    bar.innerHTML = `<span style="font-size:10px;font-weight:600;color:var(--text-muted);margin-right:2px">PDF Sections:</span>${buttonsHtml}`;
}

window.toggleSrResumeSection = function(secKey) {
    if (!_srModalCurrentItem) return;
    let data = _srModalCurrentItem.getData();
    if (!data) return;

    if (data.sections && typeof data.sections === 'object') {
        data.sections[secKey] = data.sections[secKey] === false ? true : false;
    } else if (data.resume_template) {
        if (!data.resume_template.sections) data.resume_template.sections = {};
        data.resume_template.sections[secKey] = data.resume_template.sections[secKey] === false ? true : false;
    } else {
        data.sections = { [secKey]: false };
    }

    _srModalCurrentItem._customData = data;
    if (window._srJsonEditor) {
        window._srJsonEditor.set(data);
    }
    renderSrSectionToggleButtons(data);
    refreshPreview();
    window.srSaveToBackend();
};
