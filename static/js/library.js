import { state } from './app.js';

export let currentCategory = 'personal';
export let currentItemId = null;

const categories = [
    { id: 'personal', name: 'Personal Info' },
    { id: 'role_title', name: 'Role Titles' },
    { id: 'professional_summary', name: 'Summaries' },
    { id: 'skills', name: 'Skills' },
    { id: 'projects', name: 'Projects' },
    { id: 'education', name: 'Education' },
    { id: 'certifications', name: 'Certifications' },
    { id: 'achievements', name: 'Achievements' },
    { id: 'additional_info', name: 'Additional Info' }
];

export function renderLibrarySidebar() {
    const list = document.getElementById('lib-category-list');
    if (!list) return;
    
    list.innerHTML = categories.map(cat => `
        <button class="btn btn-secondary" style="width:100%;justify-content:flex-start;${currentCategory === cat.id ? 'background:var(--accent-dim);border-color:rgba(99,102,241,0.3);color:var(--accent-hover)' : ''}" onclick="window.selectLibCategory('${cat.id}')">
            ${cat.name}
        </button>
    `).join('');
    
    renderLibraryContent();
}

export function selectLibCategory(catId) {
    currentCategory = catId;
    currentItemId = null;
    renderLibrarySidebar();
}

export function selectLibItem(itemId) {
    currentItemId = itemId;
    renderLibraryContent();
}

export function addNewLibItem() {
    const newId = prompt(`Enter new ID for ${currentCategory} (e.g., 'new_item'):`);
    if (!newId) return;
    if (!state.data.library[currentCategory]) state.data.library[currentCategory] = {};
    if (state.data.library[currentCategory][newId]) return alert("ID already exists");
    
    let newItem = {};
    if (currentCategory === 'role_title' || currentCategory === 'professional_summary') {
        newItem = "";
    } else if (currentCategory === 'skills') {
        newItem = { name: "", keywords: "" };
    } else if (currentCategory === 'projects') {
        newItem = { name: "", tech: "", date: "", link: "", points: [] };
    } else if (currentCategory === 'education') {
        newItem = { institution: "", degree: "", date: "", details: "" };
    } else if (currentCategory === 'certifications') {
        newItem = { name: "", issuer: "", year: "", link: "" };
    } else if (currentCategory === 'achievements') {
        newItem = { name: "", issuer: "", year: "" };
    } else if (currentCategory === 'additional_info') {
        newItem = { name: "", content: "" };
    }
    
    state.data.library[currentCategory][newId] = newItem;
    selectLibItem(newId);
}

export function deleteLibItem(itemId) {
    if (!confirm(`Delete ${itemId}?`)) return;
    delete state.data.library[currentCategory][itemId];
    currentItemId = null;
    renderLibraryContent();
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
            <h2 style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid var(--border)">Personal Info</h2>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                ${fieldGroup("Name", inputField("p_name", p.name))}
                ${fieldGroup("Email", inputField("p_email", p.email))}
                ${fieldGroup("Phone", inputField("p_phone", p.phone))}
                ${fieldGroup("LinkedIn", inputField("p_linkedin", p.linkedin))}
                ${fieldGroup("GitHub", inputField("p_github", p.github))}
            </div>
            <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--border)">
                <button class="btn btn-success" onclick="window.saveConfigToServer()"> Save Changes</button>
            </div>
        `;
        return;
    }
    
    // For library categories
    const items = state.data.library[currentCategory] || {};
    
    let sidebarHtml = `<div style="width:200px;border-right:1px solid var(--border);padding-right:16px;flex-shrink:0;display:flex;flex-direction:column;gap:6px">
        <button class="btn btn-primary" style="margin-bottom:10px" onclick="window.addNewLibItem()">+ Add Item</button>
        <div style="display:flex;flex-direction:column;gap:3px;overflow-y:auto">
            ${Object.keys(items).map(k => `
                <button style="width:100%;text-align:left;padding:5px 8px;border-radius:var(--radius);font-size:11px;border:1px solid;cursor:pointer;${currentItemId === k ? 'background:var(--bg-hover);border-color:var(--border);color:var(--text-primary)' : 'border-color:transparent;color:var(--text-muted);background:none'}" onclick="window.selectLibItem('${k}')">${k}</button>
            `).join('')}
        </div>
    </div>`;
    
    let formHtml = `<div style="flex:1;padding-left:20px">`;
    if (!currentItemId || !items[currentItemId]) {
        formHtml += `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px">Select an item</div></div>`;
    } else {
        const data = items[currentItemId];
        formHtml += `<h2 style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--border)">Editing: ${currentItemId}</h2>`;
        
        if (currentCategory === 'role_title' || currentCategory === 'professional_summary') {
            formHtml += fieldGroup("Value", inputField("l_val", data, currentCategory === 'professional_summary'));
        } 
        else if (currentCategory === 'skills') {
            formHtml += fieldGroup("Name (e.g. Languages)", inputField("l_name", data.name));
            formHtml += fieldGroup("Keywords", inputField("l_keywords", data.keywords, true));
        }
        else if (currentCategory === 'projects') {
            formHtml += fieldGroup("Project Name", inputField("l_name", data.name));
            formHtml += fieldGroup("Technologies", inputField("l_tech", data.tech));
            formHtml += fieldGroup("Date", inputField("l_date", data.date));
            formHtml += fieldGroup("Link", inputField("l_link", data.link));
            formHtml += fieldGroup("Bullet Points (One bullet per line)", inputField("l_points", (data.points||[]).join('\n'), true));
        }
        else if (currentCategory === 'education') {
            formHtml += fieldGroup("Institution", inputField("l_inst", data.institution));
            formHtml += fieldGroup("Degree", inputField("l_degree", data.degree));
            formHtml += fieldGroup("Date", inputField("l_date", data.date));
            formHtml += fieldGroup("University / Board / Details", inputField("l_details", data.details));
        }
        else if (currentCategory === 'certifications') {
            formHtml += fieldGroup("Certificate Name", inputField("l_name", data.name));
            formHtml += fieldGroup("Issuer", inputField("l_issuer", data.issuer));
            formHtml += fieldGroup("Year", inputField("l_year", data.year));
            formHtml += fieldGroup("Link (Optional)", inputField("l_link", data.link));
        }
        else if (currentCategory === 'achievements') {
            formHtml += fieldGroup("Achievement/Award Title", inputField("l_name", data.name));
            formHtml += fieldGroup("Issuer", inputField("l_issuer", data.issuer));
            formHtml += fieldGroup("Year", inputField("l_year", data.year));
        }
        else if (currentCategory === 'additional_info') {
            formHtml += fieldGroup("Section Title (e.g. Areas of Interest)", inputField("l_name", data.name));
            formHtml += fieldGroup("Content", inputField("l_content", data.content, true));
        }
        
        formHtml += `<div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--border);display:flex;gap:10px">
            <button class="btn btn-success" onclick="window.saveConfigToServer()"> Save</button>
            <button class="btn btn-danger" onclick="window.deleteLibItem('${currentItemId}')"> Delete</button>
        </div></div>`;
    }
    
    container.innerHTML = `<div style="display:flex;height:100%">${sidebarHtml}${formHtml}</div>`;
}

export function updateLibField() {
    if (currentCategory === 'personal') {
        if(!state.data.personal) state.data.personal = {};
        const p = state.data.personal;
        p.name = document.getElementById('p_name')?.value || '';
        p.email = document.getElementById('p_email')?.value || '';
        p.phone = document.getElementById('p_phone')?.value || '';
        p.linkedin = document.getElementById('p_linkedin')?.value || '';
        p.github = document.getElementById('p_github')?.value || '';
        return;
    }
    
    if (!currentItemId || !state.data.library[currentCategory]) return;
    
    const obj = state.data.library[currentCategory][currentItemId];
    const getVal = (id) => document.getElementById(id)?.value || '';
    const getList = (id) => getVal(id).split('\n').map(s=>s.trim()).filter(s=>s);
    
    if (currentCategory === 'role_title' || currentCategory === 'professional_summary') {
        state.data.library[currentCategory][currentItemId] = getVal('l_val');
    }
    else if (currentCategory === 'skills') {
        obj.name = getVal('l_name');
        obj.keywords = getVal('l_keywords');
    }
    else if (currentCategory === 'projects') {
        obj.name = getVal('l_name');
        obj.tech = getVal('l_tech');
        obj.date = getVal('l_date');
        obj.link = getVal('l_link');
        obj.points = getList('l_points');
    }
    else if (currentCategory === 'education') {
        obj.institution = getVal('l_inst');
        obj.degree = getVal('l_degree');
        obj.date = getVal('l_date');
        obj.details = getVal('l_details');
    }
    else if (currentCategory === 'certifications') {
        obj.name = getVal('l_name');
        obj.issuer = getVal('l_issuer');
        obj.year = getVal('l_year');
        obj.link = getVal('l_link');
    }
    else if (currentCategory === 'achievements') {
        obj.name = getVal('l_name');
        obj.issuer = getVal('l_issuer');
        obj.year = getVal('l_year');
    }
    else if (currentCategory === 'additional_info') {
        obj.name = getVal('l_name');
        obj.content = getVal('l_content');
    }
}

window.selectLibCategory = selectLibCategory;
window.selectLibItem = selectLibItem;
window.addNewLibItem = addNewLibItem;
window.deleteLibItem = deleteLibItem;
window.updateLibField = updateLibField;

state.subscribe(() => {
    renderLibrarySidebar();
});
