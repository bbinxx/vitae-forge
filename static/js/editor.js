import { state, ui } from './app.js';

export function renderRoleEditor() {
    const rolesList = document.getElementById('roles-list');
    if(!rolesList) return;
    
    rolesList.innerHTML = Object.keys(state.data.recipes).map(r => `
        <button class="w-full text-left px-4 py-2 rounded text-xs tracking-widest border transition-colors ${state.currentEditingRole === r ? 'bg-blue-900 border-blue-700 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'}" onclick="window.selectRole('${r}')">
            ${r} <span class="ml-2 text-[0.6rem] text-gray-500">(${state.data.recipes[r].short_name})</span>
        </button>
    `).join('');
    
    if (state.currentEditingRole && state.data.recipes[state.currentEditingRole]) {
        document.getElementById('role-editor-form').classList.remove('hidden');
        document.getElementById('role-editor-empty').classList.add('hidden');
        populateRoleEditor(state.currentEditingRole);
    } else {
        document.getElementById('role-editor-form').classList.add('hidden');
        document.getElementById('role-editor-empty').classList.remove('hidden');
    }
}

export function selectRole(roleId) {
    state.currentEditingRole = roleId;
    renderRoleEditor();
}

export function addNewRole() {
    const newId = prompt("Enter new role ID (e.g., frontend):");
    if (!newId) return;
    if (state.data.recipes[newId]) return alert("Role ID already exists");
    
    state.data.recipes[newId] = {
        short_name: "NEW",
        sections: { role_title:true, photo:true, summary:true, skills:true, projects:true, education:true, certifications:true, achievements:true, languages:true },
        role_title: Object.keys(state.data.library.role_title || {})[0] || "",
        professional_summary: Object.keys(state.data.library.professional_summary || {})[0] || "",
        skills: [], projects: [], education: Object.keys(state.data.library.education || {})[0] || "", certifications: [], achievements: [], additional_info: []
    };
    selectRole(newId);
}

export function deleteCurrentRole() {
    if (!confirm("Are you sure you want to delete this role?")) return;
    delete state.data.recipes[state.currentEditingRole];
    state.currentEditingRole = null;
    renderRoleEditor();
    state.notify(); // Re-render dashboard
}

export function populateRoleEditor(roleId) {
    const role = state.data.recipes[roleId];
    document.getElementById('edit-role-id').value = roleId;
    document.getElementById('edit-role-shortname').value = role.short_name || "";
    
    const sections = ['role_title', 'photo', 'summary', 'skills', 'projects', 'education', 'certifications', 'achievements', 'languages'];
    document.getElementById('edit-role-sections').innerHTML = sections.map(sec => `
        <label class="flex items-center gap-2 p-2 bg-gray-800 border border-gray-700 rounded cursor-pointer hover:border-gray-500">
            <input type="checkbox" class="rounded text-blue-500 focus:ring-blue-500 bg-gray-900 border-gray-600" ${role.sections && role.sections[sec] ? 'checked' : ''} onchange="window.updateRoleSection('${sec}', this.checked)">
            <span class="text-xs uppercase tracking-wider text-gray-300">${sec}</span>
        </label>
    `).join('');
    
    const buildSelect = (libKey, val) => {
        let options = Object.keys(state.data.library[libKey] || {}).map(k => `<option value="${k}" ${k===val?'selected':''}>${k}</option>`).join('');
        return `<option value="">-- None --</option>` + options;
    };
    
    document.getElementById('edit-role-title').innerHTML = buildSelect('role_title', role.role_title);
    document.getElementById('edit-role-summary').innerHTML = buildSelect('professional_summary', role.professional_summary);
    document.getElementById('edit-role-education').innerHTML = buildSelect('education', role.education);
    
    const buildTags = (libKey, arr, updateField) => Object.keys(state.data.library[libKey] || {}).map(k => {
        const isSel = (arr || []).includes(k);
        return `<div class="px-2 py-1 rounded text-[0.65rem] uppercase cursor-pointer border transition-colors ${isSel ? 'bg-blue-900 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}" onclick="window.toggleRoleArrayItem('${updateField}', '${k}')">${k}</div>`;
    }).join('');
    
    document.getElementById('edit-role-skills').innerHTML = buildTags('skills', role.skills, 'skills');
    document.getElementById('edit-role-projects').innerHTML = buildTags('projects', role.projects, 'projects');
    document.getElementById('edit-role-certifications').innerHTML = buildTags('certifications', role.certifications, 'certifications');
    document.getElementById('edit-role-achievements').innerHTML = buildTags('achievements', role.achievements, 'achievements');
    document.getElementById('edit-role-additional').innerHTML = buildTags('additional_info', role.additional_info, 'additional_info');
}

export function updateRoleField(field, val) {
    if(state.currentEditingRole && state.data.recipes[state.currentEditingRole]) {
        state.data.recipes[state.currentEditingRole][field] = val;
    }
}

export function updateRoleSection(sec, val) {
    if(state.currentEditingRole && state.data.recipes[state.currentEditingRole]) {
        if(!state.data.recipes[state.currentEditingRole].sections) state.data.recipes[state.currentEditingRole].sections = {};
        state.data.recipes[state.currentEditingRole].sections[sec] = val;
    }
}

export function toggleRoleArrayItem(field, item) {
    if(state.currentEditingRole && state.data.recipes[state.currentEditingRole]) {
        if(!state.data.recipes[state.currentEditingRole][field]) state.data.recipes[state.currentEditingRole][field] = [];
        const arr = state.data.recipes[state.currentEditingRole][field];
        if(arr.includes(item)) {
            state.data.recipes[state.currentEditingRole][field] = arr.filter(i => i !== item);
        } else {
            state.data.recipes[state.currentEditingRole][field].push(item);
        }
        populateRoleEditor(state.currentEditingRole);
    }
}

// Bind globals for HTML inline listeners
window.selectRole = selectRole;
window.addNewRole = addNewRole;
window.deleteCurrentRole = deleteCurrentRole;
window.updateRoleField = updateRoleField;
window.updateRoleSection = updateRoleSection;
window.toggleRoleArrayItem = toggleRoleArrayItem;
window.saveConfigToServer = () => state.saveConfig();

state.subscribe(() => {
    // Re-render when config loads
    renderRoleEditor();
});
