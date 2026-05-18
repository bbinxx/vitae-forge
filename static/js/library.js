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
        <button class="w-full text-left px-4 py-2 rounded text-xs tracking-widest border transition-colors ${currentCategory === cat.id ? 'bg-blue-900 border-blue-700 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'}" onclick="window.selectLibCategory('${cat.id}')">
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
        newItem = { title: "", date: "", link: "", description: [] };
    } else if (currentCategory === 'education') {
        newItem = { institution: "", degree: "", date: "", score: "" };
    } else if (currentCategory === 'certifications') {
        newItem = { name: "", issuer: "", date: "", link: "" };
    } else if (currentCategory === 'achievements') {
        newItem = { title: "", details: [] };
    } else if (currentCategory === 'additional_info') {
        newItem = { title: "", detail: "" };
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
    return `<div class="flex flex-col gap-1.5 mb-4">
        <label class="text-[0.65rem] text-gray-400 tracking-wider uppercase">${label}</label>
        ${html}
    </div>`;
}

function inputField(id, value, isTextArea = false) {
    const cls = "bg-gray-800 border border-gray-700 text-gray-200 px-3 py-2 rounded text-xs w-full focus:border-blue-500 focus:outline-none transition-colors";
    const val = (value || '').toString().replace(/"/g, '&quot;');
    if (isTextArea) {
        return `<textarea id="${id}" rows="4" class="${cls}" onchange="window.updateLibField()">${val}</textarea>`;
    }
    return `<input type="text" id="${id}" value="${val}" class="${cls}" onchange="window.updateLibField()">`;
}

export function renderLibraryContent() {
    const container = document.getElementById('lib-editor-container');
    if (!container) return;
    
    if (currentCategory === 'personal') {
        const p = state.data.personal || {};
        container.innerHTML = `
            <h2 class="text-[0.65rem] text-blue-400 tracking-[0.15em] uppercase mb-6 pb-4 border-b border-gray-800">Personal Info</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${fieldGroup("Name", inputField("p_name", p.name))}
                ${fieldGroup("Email", inputField("p_email", p.email))}
                ${fieldGroup("Phone", inputField("p_phone", p.phone))}
                ${fieldGroup("LinkedIn", inputField("p_linkedin", p.linkedin))}
                ${fieldGroup("GitHub", inputField("p_github", p.github))}
            </div>
            <div class="mt-6 pt-4 border-t border-gray-800">
                <button class="bg-green-900 hover:bg-green-800 text-green-300 px-4 py-2 rounded text-xs uppercase" onclick="window.saveConfigToServer()">💾 Save Changes</button>
            </div>
        `;
        return;
    }
    
    // For library categories
    const items = state.data.library[currentCategory] || {};
    
    let sidebarHtml = `<div class="w-full md:w-64 border-r border-gray-800 pr-4 flex flex-col gap-2">
        <button class="w-full bg-blue-900 hover:bg-blue-800 text-blue-300 px-4 py-2 rounded text-xs tracking-widest uppercase transition-colors mb-4" onclick="window.addNewLibItem()">+ Add Item</button>
        <div class="flex flex-col gap-1 overflow-y-auto">
            ${Object.keys(items).map(k => `
                <button class="w-full text-left px-3 py-1.5 rounded text-xs tracking-wide border transition-colors ${currentItemId === k ? 'bg-gray-800 border-gray-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800'}" onclick="window.selectLibItem('${k}')">${k}</button>
            `).join('')}
        </div>
    </div>`;
    
    let formHtml = `<div class="flex-1 pl-0 md:pl-6 pt-4 md:pt-0">`;
    if (!currentItemId || !items[currentItemId]) {
        formHtml += `<div class="h-full flex items-center justify-center text-gray-500 uppercase text-xs">Select an item</div></div>`;
    } else {
        const data = items[currentItemId];
        formHtml += `<h2 class="text-[0.65rem] text-blue-400 tracking-[0.15em] uppercase mb-6 pb-4 border-b border-gray-800">Editing: ${currentItemId}</h2>`;
        
        if (currentCategory === 'role_title' || currentCategory === 'professional_summary') {
            formHtml += fieldGroup("Value", inputField("l_val", data, currentCategory === 'professional_summary'));
        } 
        else if (currentCategory === 'skills') {
            formHtml += fieldGroup("Name (e.g. Languages)", inputField("l_name", data.name));
            formHtml += fieldGroup("Keywords", inputField("l_keywords", data.keywords, true));
        }
        else if (currentCategory === 'projects') {
            formHtml += fieldGroup("Title", inputField("l_title", data.title));
            formHtml += fieldGroup("Date", inputField("l_date", data.date));
            formHtml += fieldGroup("Link", inputField("l_link", data.link));
            formHtml += fieldGroup("Description (One bullet per line)", inputField("l_desc", (data.description||[]).join('\\n'), true));
        }
        else if (currentCategory === 'education') {
            formHtml += fieldGroup("Institution", inputField("l_inst", data.institution));
            formHtml += fieldGroup("Degree", inputField("l_degree", data.degree));
            formHtml += fieldGroup("Date", inputField("l_date", data.date));
            formHtml += fieldGroup("Score", inputField("l_score", data.score));
        }
        else if (currentCategory === 'certifications') {
            formHtml += fieldGroup("Name", inputField("l_name", data.name));
            formHtml += fieldGroup("Issuer", inputField("l_issuer", data.issuer));
            formHtml += fieldGroup("Date", inputField("l_date", data.date));
            formHtml += fieldGroup("Link", inputField("l_link", data.link));
        }
        else if (currentCategory === 'achievements') {
            formHtml += fieldGroup("Title", inputField("l_title", data.title));
            formHtml += fieldGroup("Details (One bullet per line)", inputField("l_details", (data.details||[]).join('\\n'), true));
        }
        else if (currentCategory === 'additional_info') {
            formHtml += fieldGroup("Title", inputField("l_title", data.title));
            formHtml += fieldGroup("Detail", inputField("l_detail", data.detail, true));
        }
        
        formHtml += `<div class="mt-6 pt-4 border-t border-gray-800 flex gap-3">
            <button class="bg-green-900 hover:bg-green-800 text-green-300 px-4 py-2 rounded text-xs uppercase" onclick="window.saveConfigToServer()">💾 Save</button>
            <button class="bg-red-950 hover:bg-red-900 text-red-400 px-4 py-2 rounded text-xs uppercase" onclick="window.deleteLibItem('${currentItemId}')">🗑 Delete</button>
        </div></div>`;
    }
    
    container.innerHTML = `<div class="flex flex-col md:flex-row h-full">${sidebarHtml}${formHtml}</div>`;
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
    const getList = (id) => getVal(id).split('\\n').map(s=>s.trim()).filter(s=>s);
    
    if (currentCategory === 'role_title' || currentCategory === 'professional_summary') {
        state.data.library[currentCategory][currentItemId] = getVal('l_val');
    }
    else if (currentCategory === 'skills') {
        obj.name = getVal('l_name');
        obj.keywords = getVal('l_keywords');
    }
    else if (currentCategory === 'projects') {
        obj.title = getVal('l_title');
        obj.date = getVal('l_date');
        obj.link = getVal('l_link');
        obj.description = getList('l_desc');
    }
    else if (currentCategory === 'education') {
        obj.institution = getVal('l_inst');
        obj.degree = getVal('l_degree');
        obj.date = getVal('l_date');
        obj.score = getVal('l_score');
    }
    else if (currentCategory === 'certifications') {
        obj.name = getVal('l_name');
        obj.issuer = getVal('l_issuer');
        obj.date = getVal('l_date');
        obj.link = getVal('l_link');
    }
    else if (currentCategory === 'achievements') {
        obj.title = getVal('l_title');
        obj.details = getList('l_details');
    }
    else if (currentCategory === 'additional_info') {
        obj.title = getVal('l_title');
        obj.detail = getVal('l_detail');
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
