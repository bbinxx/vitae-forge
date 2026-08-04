import { state } from './app.js';

let bookmarks = [];

function buildItemList() {
    const items = [];

    for (const roleId of Object.keys(state.data.recipes || {})) {
        const recipe = state.data.recipes[roleId];
        const name = recipe.short_name || roleId;
        items.push({
            id: `recipe_${roleId}_nophoto`,
            name: `${name} (No Photo)`,
            source: 'recipe',
            roleId,
            includePhoto: false,
            getData: () => JSON.parse(JSON.stringify(recipe)),
            origin: 'Recipe',
        });
        items.push({
            id: `recipe_${roleId}_photo`,
            name: `${name} (With Photo)`,
            source: 'recipe',
            roleId,
            includePhoto: true,
            getData: () => {
                const d = JSON.parse(JSON.stringify(recipe));
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
            includePhoto: !!(data.sections && data.sections.photo),
            getData: () => JSON.parse(JSON.stringify(data)),
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

export function addNewRecipe() {
    const newId = prompt("Enter new recipe ID (e.g., frontend):");
    if (!newId) return;
    if (state.data.recipes[newId]) return alert("Recipe ID already exists");

    state.data.recipes[newId] = {
        short_name: "NEW",
        sections: { role_title: true, photo: true, summary: true, skills: true, projects: true, education: true, certifications: true, achievements: true, languages: true },
        role_title: Object.keys(state.data.library.role_title || {})[0] || "",
        professional_summary: Object.keys(state.data.library.professional_summary || {})[0] || "",
        skills: [], projects: [], education: Object.keys(state.data.library.education || {})[0] || "", certifications: [], achievements: [], additional_info: []
    };
    state.notify();
    loadSavedResumes();
}

export async function addRecipeFromApp() {
    let apps = [];
    try {
        const res = await fetch('/applications');
        const data = await res.json();
        apps = data.applications || [];
    } catch (e) {}

    if (apps.length === 0 && bookmarks.length === 0) {
        return alert("No applications or bookmarks found to clone from.");
    }
    const items = [
        ...apps.map((a, i) => ({ idx: i, label: `${a.company} - ${a.role}`, template: a.resume_template })),
        ...bookmarks.map((b, i) => ({ idx: i + apps.length, label: `[Bookmark] ${b.name}`, template: b.data }))
    ];
    const listStr = items.map(it => `${it.idx}: ${it.label}`).join('\n');
    const indexStr = prompt(`Enter the index to clone:\n${listStr}`);
    if (!indexStr || isNaN(indexStr)) return;
    const idx = parseInt(indexStr);
    const item = items[idx];
    if (!item || !item.template) return alert("Selected item has no resume template.");

    const newId = prompt("Enter ID for the cloned recipe:");
    if (!newId) return;
    if (state.data.recipes[newId]) return alert("Recipe ID already exists");

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
        if (!app) { alert('Application not found'); return; }

        const template = app.resume_template;
        if (!template || Object.keys(template).length === 0) {
            alert('This application has no resume template to bookmark.');
            return;
        }

        const name = prompt('Name this saved resume:', `${app.company} - ${app.role}`);
        if (!name) return;

        const bmRes = await fetch('/bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, data: template, source_app_id: appId })
        });
        const bmData = await bmRes.json();
        if (bmData.ok) {
            alert('Resume bookmarked successfully!');
            loadSavedResumes();
        } else {
            alert('Failed to bookmark resume.');
        }
    } catch (e) {
        alert('Error bookmarking resume: ' + e.message);
    }
}

export async function deleteBookmarkItem(bmId) {
    if (!confirm('Delete this bookmark?')) return;
    try {
        await fetch(`/bookmarks/${bmId}`, { method: 'DELETE' });
        loadSavedResumes();
    } catch (e) {
        alert('Error deleting bookmark: ' + e.message);
    }
}

// ── Modal ──────────────────────────────────────────────────────────────────

let _srModalCurrentItem = null;

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
            <div class="modal-box">
                <div class="modal-header">
                    <div class="modal-title" id="sr-modal-title"></div>
                    <button class="modal-close material-symbols-outlined" onclick="document.getElementById('sr-modal').classList.add('hidden')">close</button>
                </div>
                <div class="modal-tabs" id="sr-modal-tabs">
                    <button class="modal-tab active" data-tab="preview"><span class="material-symbols-outlined" style="font-size:14px">visibility</span> Preview</button>
                    <button class="modal-tab" data-tab="json"><span class="material-symbols-outlined" style="font-size:14px">code</span> JSON Edit</button>
                </div>
                <div class="modal-body">
                    <div class="modal-tab-content">
                        <div class="modal-tab-pane active" id="sr-pane-preview">
                            <iframe id="sr-preview-iframe" src="about:blank"></iframe>
                        </div>
                        <div class="modal-tab-pane" id="sr-pane-json">
                            <div id="sr-json-editor-container" style="height:420px;border-radius:6px;overflow:hidden"></div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer" id="sr-modal-footer"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelectorAll('.modal-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                overlay.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
                overlay.querySelectorAll('.modal-tab-pane').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const pane = document.getElementById('sr-pane-' + tab.dataset.tab);
                if (pane) pane.classList.add('active');

                if (tab.dataset.tab === 'preview') {
                    refreshPreview();
                }
            });
        });
    }

    document.getElementById('sr-modal-title').textContent = name;

    const footer = document.getElementById('sr-modal-footer');
    footer.innerHTML = `
        <button class="btn btn-primary" onclick="window.srDownloadPdf()"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">picture_as_pdf</span> Download PDF</button>
        <button class="btn btn-secondary" onclick="window.srDownloadLatex()"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">description</span> Download LaTeX</button>
        ${hasPhoto ? `<button class="btn btn-secondary" onclick="window.srDownloadZip()"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">folder_zip</span> Download ZIP</button>` : ''}
        <button class="btn btn-secondary" onclick="window.srExportBookmark()" style="margin-left:auto"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">bookmark_add</span> Save as Bookmark</button>
    `;

    const jsonContainer = document.getElementById('sr-json-editor-container');
    if (window.JSONEditor) {
        jsonContainer.innerHTML = '';
        window._srJsonEditor = new JSONEditor(jsonContainer, {
            mode: 'code',
            modes: ['code', 'tree', 'form']
        });
        window._srJsonEditor.set(data);
    } else {
        jsonContainer.innerHTML = `<textarea class="json-editor" id="sr-json-editor" style="width:100%;height:100%;font-family:monospace;">${JSON.stringify(data, null, 2)}</textarea>`;
    }

    document.getElementById('sr-preview-iframe').src = 'about:blank';
    overlay.classList.remove('hidden');

    window.srDownloadPdf = () => srDownloadPdf(item);
    window.srDownloadLatex = () => srDownloadLatex(item);
    window.srDownloadZip = () => srDownloadZip(item);
    window.srExportBookmark = () => srExportBookmark(item, editor);

    const previewTab = overlay.querySelector('[data-tab="preview"]');
    if (previewTab.classList.contains('active')) {
        refreshPreview();
    }
}

let _srCompiledPdf = null;

async function refreshPreview() {
    const item = _srModalCurrentItem;
    if (!item) return;

    const iframe = document.getElementById('sr-preview-iframe');
    iframe.src = 'about:blank';

    try {
        const data = item.getData();
        const name = item.name.replace(/[^\w\-_]/g, '_');

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
            _srCompiledPdf = pdfFile;
            iframe.src = `/pdf/${pdfFile}`;
        }
    } catch (e) {
        iframe.src = 'about:blank';
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
        alert('Failed to compile PDF: ' + e.message);
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
        alert('Failed to download LaTeX: ' + e.message);
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
        alert('Failed to download ZIP: ' + e.message);
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
        alert('Invalid JSON in editor. Please fix before saving.');
        return;
    }

    const name = prompt('Name this bookmark:', item.name);
    if (!name) return;

    try {
        const res = await fetch('/bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, data, source_app_id: '' })
        });
        const result = await res.json();
        if (result.ok) {
            alert('Saved as bookmark!');
            loadSavedResumes();
        }
    } catch (e) {
        alert('Error saving bookmark: ' + e.message);
    }
}

window.deleteBookmarkItem = deleteBookmarkItem;
window.addNewRecipe = addNewRecipe;
window.addRecipeFromApp = addRecipeFromApp;
window.bookmarkAppResume = bookmarkAppResume;

document.addEventListener('input', (e) => {
    if (e.target.id === 'sr-filter') {
        renderList(e.target.value);
    }
});

state.subscribe(() => {
    const el = document.getElementById('sr-list');
    if (el) loadSavedResumes();
});

