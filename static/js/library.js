import { state } from './app.js';

export let currentCategory = 'personal';

export function renderLibrarySidebar() {
    const list = document.getElementById('lib-category-list');
    if (!list) return;
    
    list.innerHTML = `
        <button class="btn btn-secondary" style="width:100%;justify-content:flex-start;background:var(--accent-dim);border-color:rgba(99,102,241,0.3);color:var(--accent-hover)">
            <span class="material-symbols-outlined" style="font-size:12px;vertical-align:-2px;margin-right:4px">person</span>
            Personal Info
        </button>
    `;
    
    renderLibraryContent();
}

export function selectLibCategory(catId) {
    // Only personal is supported
    currentCategory = 'personal';
    renderLibrarySidebar();
}

function fieldGroup(label, html) {
    return `<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:14px">
        <label style="font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted)">${label}</label>
        ${html}
    </div>`;
}

function inputField(id, value, isTextArea = false) {
    const val = (value || '').toString().replace(/"/g, '&quot;');
    if (isTextArea) {
        return `<textarea id="${id}" rows="4" class="input-field textarea" oninput="window.updateLibField()" onchange="window.updateLibField()">${val}</textarea>`;
    }
    return `<input type="text" id="${id}" value="${val}" class="input-field" oninput="window.updateLibField()" onchange="window.updateLibField()">`;
}

export function renderLibraryContent() {
    const container = document.getElementById('lib-editor-container');
    if (!container) return;
    
    if (currentCategory === 'personal') {
        const p = state.data.personal || {};
        container.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;padding-bottom:14px;border-bottom:1px solid var(--border)">
                <span style="width:32px;height:32px;border-radius:50%;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;color:var(--accent);font-size:14px;font-weight:600">${(p.name || '?')[0]}</span>
                <div>
                    <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${p.name || 'Personal Info'}</div>
                    <div style="font-size:10px;color:var(--text-muted)">Your contact details used in every resume</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                ${fieldGroup("Full Name", inputField("p_name", p.name))}
                ${fieldGroup("Email", inputField("p_email", p.email))}
                ${fieldGroup("Phone", inputField("p_phone", p.phone))}
                ${fieldGroup("LinkedIn URL", inputField("p_linkedin", p.linkedin))}
                ${fieldGroup("GitHub URL", inputField("p_github", p.github))}
            </div>
            <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--border)">
                <button class="btn btn-success" onclick="window.saveConfigToServer()"> Save Changes</button>
            </div>
        `;
    }
}

export function updateLibField() {
    if(!state.data.personal) state.data.personal = {};
    const p = state.data.personal;
    p.name = document.getElementById('p_name')?.value || '';
    p.email = document.getElementById('p_email')?.value || '';
    p.phone = document.getElementById('p_phone')?.value || '';
    p.linkedin = document.getElementById('p_linkedin')?.value || '';
    p.github = document.getElementById('p_github')?.value || '';
}

window.selectLibCategory = selectLibCategory;
window.updateLibField = updateLibField;

state.subscribe(() => {
    renderLibrarySidebar();
});
