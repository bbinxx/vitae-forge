const FILES = [
    { id: 'plain', label: 'Standard (No Photo)', file: 'template.tex' },
    { id: 'photo', label: 'With Photo', file: 'template_photo.tex' },
];

let loadedContent = {};

export async function loadTemplates() {
    const list = document.getElementById('templates-list');
    if (!list) return;

    list.innerHTML = FILES.map(t => `
        <button class="btn btn-secondary" style="width:100%;justify-content:flex-start;" onclick="window.openTemplate('${t.id}')">
            <span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px;margin-right:4px">article</span>
            ${t.label}
        </button>
    `).join('');
}

export async function openTemplate(templateId) {
    const allLoaded = await loadAllTemplates();
    if (!allLoaded) return;

    document.getElementById('template-editor-form').classList.remove('hidden');
    document.getElementById('template-editor-empty').classList.add('hidden');

    const tabs = document.getElementById('tpl-tabs');
    const panels = document.getElementById('tpl-panels');

    tabs.innerHTML = FILES.map((t, i) => `
        <button class="tpl-tab ${t.id === templateId ? 'active' : ''}" data-id="${t.id}" onclick="window.switchTplTab('${t.id}')">
            ${t.label}
        </button>
    `).join('');

    panels.innerHTML = FILES.map(t => `
        <div class="tpl-panel ${t.id === templateId ? 'active' : ''}" data-id="${t.id}">
            <div class="tpl-panel-header">
                <span class="tpl-panel-title">${t.label}</span>
                <button class="btn btn-secondary btn-sm" onclick="window.downloadTpl('${t.id}')">
                    <span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">download</span> Download .tex
                </button>
            </div>
            <textarea class="tpl-source" readonly spellcheck="false">${escapeHtml(loadedContent[t.id])}</textarea>
        </div>
    `).join('');
}

export function switchTplTab(tabId) {
    document.querySelectorAll('.tpl-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tpl-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`.tpl-tab[data-id="${tabId}"]`)?.classList.add('active');
    document.querySelector(`.tpl-panel[data-id="${tabId}"]`)?.classList.add('active');
}

export function downloadTpl(templateId) {
    const content = loadedContent[templateId];
    if (!content) return;
    const file = FILES.find(f => f.id === templateId);
    if (!file) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file.file;
    a.click();
}

async function loadAllTemplates() {
    try {
        const results = await Promise.all(FILES.map(async f => {
            const res = await fetch(`/api/template/${f.file}`);
            if (!res.ok) throw new Error(`Failed to load ${f.file}`);
            const data = await res.json();
            return { id: f.id, content: data.content };
        }));
        for (const r of results) loadedContent[r.id] = r.content;
        return true;
    } catch (e) {
        alert('Failed to load templates: ' + e.message);
        return false;
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.openTemplate = openTemplate;
window.switchTplTab = switchTplTab;
window.downloadTpl = downloadTpl;
