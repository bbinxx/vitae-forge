import { state, ui } from './app.js';

export function renderRoleEditor() {
    const rolesList = document.getElementById('roles-list');
    if(!rolesList) return;
    
    rolesList.innerHTML = Object.keys(state.data.recipes).map(r => `
        <button class="btn btn-secondary" style="width:100%;justify-content:flex-start;${state.currentEditingRole === r ? 'background:var(--accent-dim);border-color:rgba(99,102,241,0.3);color:var(--accent-hover)' : ''}" onclick="window.selectRole('${r}')">
            ${r} <span style="margin-left:6px;font-size:10px;opacity:0.5">(${state.data.recipes[r].short_name})</span>
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
        <label style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);cursor:pointer;font-size:11px;color:var(--text-secondary)">
            <input type="checkbox" ${role.sections && role.sections[sec] ? 'checked' : ''} onchange="window.updateRoleSection('${sec}', this.checked)" style="accent-color:var(--accent)">
            ${sec}
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
        const sel = isSel ? 'background:var(--accent-dim);border-color:rgba(99,102,241,0.4);color:var(--accent-hover)' : 'background:var(--bg-card);border-color:var(--border);color:var(--text-secondary)';
        return `<div style="padding:4px 10px;border-radius:var(--radius);font-size:10px;text-transform:uppercase;cursor:pointer;border:1px solid;${sel}" onclick="window.toggleRoleArrayItem('${updateField}', '${k}')">${k}</div>`;
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
