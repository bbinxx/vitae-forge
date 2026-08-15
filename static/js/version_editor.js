import { state } from './app.js';
import { showModal, toast, trackerApi } from './tracker.js';

let editorState = {
    appId: null,
    versionId: null,
    versionData: null,
    mergedRecipe: null,
    appData: null,
};

function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export async function openVersionEditor(appId, versionId) {
    editorState.appId = appId;
    editorState.versionId = versionId;
    editorState.appData = null;
    
    // Fetch application data for context (JD, company, role)
    try {
        const appsRes = await fetch('/applications');
        const appsData = await appsRes.json();
        editorState.appData = (appsData.applications || []).find(a => a.id === appId);
    } catch (e) {
        // Non-critical - editor works without app context
    }
    
    // Fetch versions
    try {
        const res = await fetch(`/applications/${appId}/versions`);
        const versions = await res.json();
        editorState.versionData = versions.find(v => v.id === versionId);
        if (!editorState.versionData) throw new Error("Version not found");
    } catch (e) {
        toast("Failed to load version", "error");
        return;
    }

    // Compute merged recipe
    const baseRecipeKey = editorState.versionData.base_recipe;
    const baseRecipe = state.data.recipes[baseRecipeKey] || {};
    editorState.mergedRecipe = deepClone(baseRecipe);
    
    // Merge customizations
    const cust = editorState.versionData.customizations || {};
    for (let k in cust) {
        if (typeof cust[k] === 'object' && !Array.isArray(cust[k])) {
            editorState.mergedRecipe[k] = { ...(editorState.mergedRecipe[k] || {}), ...cust[k] };
        } else {
            editorState.mergedRecipe[k] = deepClone(cust[k]);
        }
    }

    renderEditorModal();
}

function renderEditorModal() {
    const title = `Resume Editor: ${escapeHtml(editorState.versionData.name)}`;
    
    const app = editorState.appData;
    const jd = app?.job_description || '';
    const company = app?.company || '';
    const role = app?.role || '';
    
    const jdHtml = jd ? `
        <details style="margin-bottom:12px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:8px 12px;">
            <summary style="font-size:12px;font-weight:600;cursor:pointer;color:var(--accent)">📋 Job Description — ${escapeHtml(company)} / ${escapeHtml(role)}</summary>
            <pre style="white-space:pre-wrap;font-size:11px;color:var(--text-secondary);margin-top:8px;max-height:200px;overflow-y:auto;font-family:inherit;background:var(--bg-main);padding:8px;border-radius:4px;">${escapeHtml(jd)}</pre>
        </details>
    ` : '';
    
    const html = `
        <style>
            #tracker-modal .modal-box { width: 95vw; max-width: 1200px; height: 90vh; display: flex; flex-direction: column; overflow: hidden; padding: 0; }
            #tracker-modal .modal-header { padding: 16px 20px; border-bottom: 1px solid var(--border); }
            #tracker-modal .modal-body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; background: var(--bg-main); }
            #tracker-modal .modal-footer { padding: 16px 20px; border-top: 1px solid var(--border); }
            
            .ve-section { flex: 1; min-width: 300px; background: var(--bg-card); border-radius: var(--radius); border: 1px solid var(--border); padding: 16px; margin-bottom: 20px; }
            .ve-section-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 8px; display: flex; justify-content: space-between; }
            
            .ve-item { background: var(--bg-main); border: 1px solid var(--border); border-radius: 4px; padding: 10px; margin-bottom: 8px; position: relative; }
            .ve-controls { position: absolute; right: 8px; top: 8px; display: flex; gap: 4px; }
            .ve-btn { background: var(--bg-card); border: 1px solid var(--border); color: var(--text); border-radius: 4px; cursor: pointer; padding: 2px 6px; font-size: 10px; }
            .ve-btn:hover { background: var(--accent-dim); color: var(--accent-hover); }
            .ve-btn-primary { background: var(--accent); border: 1px solid var(--accent); color: #000; border-radius: 4px; cursor: pointer; padding: 3px 10px; font-size: 10px; font-weight: 600; }
            .ve-btn-primary:hover { background: var(--accent-hover); }
            
            .ve-input { width: 100%; background: var(--bg-main); border: 1px solid var(--border); color: var(--text); padding: 6px; font-size: 12px; border-radius: 4px; margin-bottom: 4px; font-family: inherit; }
            .ve-textarea { width: 100%; background: var(--bg-main); border: 1px solid var(--border); color: var(--text); padding: 6px; font-size: 12px; border-radius: 4px; margin-bottom: 4px; font-family: inherit; min-height: 40px; resize: vertical; }
            
            .ve-bullet-list { padding-left: 10px; margin-top: 8px; border-left: 2px solid var(--border); }
            .ve-bullet { display: flex; gap: 8px; margin-bottom: 4px; align-items: flex-start; }
            .ve-bullet textarea { flex: 1; }
            .ve-bullet-controls { display: flex; flex-direction: column; gap: 2px; }
            .ve-bullet-controls button { font-size: 8px; padding: 1px 4px; }
            
            .ve-editor-columns { display:flex; width:100%; gap:20px; align-items: stretch; flex:1; min-height:0; }
            .ve-col-left { flex:1.5; display:flex; flex-direction:column; gap:20px; overflow-y:auto; padding-right:10px; }
            .ve-col-mid { flex:1; display:flex; flex-direction:column; gap:20px; overflow-y:auto; padding-right:10px; }
            .ve-col-right { flex:1; display:flex; flex-direction:column; gap:10px; overflow-y:hidden; }
        </style>
        
        ${jdHtml}
        
        <div class="ve-editor-columns">
            <!-- LEFT COLUMN: Arrays (Experience, Projects) -->
            <div class="ve-col-left">
                <div class="ve-section" id="ve-experience"></div>
                <div class="ve-section" id="ve-projects"></div>
            </div>
            
            <!-- MIDDLE COLUMN: Metadata & Skills -->
            <div class="ve-col-mid">
                <div class="ve-section" id="ve-meta"></div>
                <div class="ve-section" id="ve-skills"></div>
            </div>

            <!-- RIGHT COLUMN: JSON Editor -->
            <div class="ve-col-right">
                <div class="ve-section-title" style="margin:0; padding-top:16px;">JSON Editor</div>
                <div id="ve-json-editor-container" style="flex:1;min-height:380px;border-radius:6px;overflow:hidden"></div>
            </div>
        </div>
    `;

    showModal(title, html, saveVersionData, 'Save & Rebuild Version');
    
    // Inject the DOM logic after the modal is shown
    setTimeout(renderEditorContent, 50);
}

// ── Rendering Logic ──────────────────────────────────────────────────────────

function renderEditorContent() {
    renderMeta();
    renderExperience();
    renderProjects();
    renderSkills();
    
    const container = document.getElementById('ve-json-editor-container');
    if (container && window.JSONEditor) {
        container.innerHTML = '';
        window._veJsonEditor = new JSONEditor(container, {
            mode: 'code',
            modes: ['code', 'tree', 'form'],
            onChangeText: (val) => {
                try {
                    editorState.mergedRecipe = JSON.parse(val);
                    renderMeta();
                    renderExperience();
                    renderProjects();
                    renderSkills();
                } catch (e) {}
            }
        });
        window._veJsonEditor.set(editorState.mergedRecipe);
    } else {
        syncJsonEditor();
    }
}


function renderMeta() {
    const metaEl = document.getElementById('ve-meta');
    if (!metaEl) return;
    
    const rt = editorState.mergedRecipe.role_title;
    const sumKey = editorState.mergedRecipe.professional_summary;

    if (rt === undefined && sumKey === undefined) {
        metaEl.style.display = 'none';
        return;
    }
    metaEl.style.display = 'block';

    const sumText = sumKey || '';

    let html = `<div class="ve-section-title">Header & Summary</div>`;
    
    if (rt !== undefined) {
        html += `
        <label style="font-size:10px;color:var(--text-secondary)">Role Title</label>
        <input type="text" class="ve-input" id="ve-inp-role" value="${escapeHtml(rt || '')}" onchange="updateMerged('role_title', this.value)">
        `;
    }
    
    if (sumKey !== undefined) {
        html += `
        <label style="font-size:10px;color:var(--text-secondary);margin-top:8px;display:block">Professional Summary</label>
        <textarea class="ve-textarea" id="ve-inp-sum" onchange="updateMerged('professional_summary', this.value)" style="height:80px">${escapeHtml(typeof sumText === 'string' ? sumText : '')}</textarea>
        `;
    }
    
    metaEl.innerHTML = html;
}

function renderExperience() {
    const expEl = document.getElementById('ve-experience');
    if (!expEl) return;
    
    if (editorState.mergedRecipe.experience === undefined) {
        expEl.style.display = 'none';
        return;
    }
    expEl.style.display = 'block';
    
    const exp = editorState.mergedRecipe.experience;
    let html = `<div class="ve-section-title">Experience</div>`;
    
    if (!Array.isArray(exp) || exp.length === 0) {
        html += `<p style="font-size:11px;color:var(--text-secondary)">No experience items.</p>`;
    } else {
        exp.forEach((expData, eIdx) => {
            const role = escapeHtml(expData.role || '');
            const company = escapeHtml(expData.company || '');
            const loc = escapeHtml(expData.location || '');
            const date = escapeHtml(expData.date || '');
            
            let bulletsHtml = `<div class="ve-bullet-list">`;
            (expData.highlights || []).forEach((hl, hIdx) => {
                bulletsHtml += `
                    <div class="ve-bullet">
                        <textarea class="ve-textarea" style="min-height:30px" onchange="updateExpHighlight(${eIdx}, ${hIdx}, this.value)">${escapeHtml(hl)}</textarea>
                        <div class="ve-bullet-controls">
                            <button class="ve-btn" style="color:var(--error)" onclick="deleteExpHighlight(${eIdx}, ${hIdx})"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">close</span></button>
                        </div>
                    </div>
                `;
            });
            bulletsHtml += `
                <button class="ve-btn" onclick="addHighlightToExp(${eIdx})" style="margin-top:4px">+ Add Highlight</button>
            </div>`;
            
            html += `
                <div class="ve-item">
                    <div class="ve-controls">
                        <button class="ve-btn" onclick="moveArrayItem('experience', ${eIdx}, -1)"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">arrow_drop_up</span></button>
                        <button class="ve-btn" onclick="moveArrayItem('experience', ${eIdx}, 1)"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">arrow_drop_down</span></button>
                        <button class="ve-btn" style="color:var(--error)" onclick="veRemoveExp(${eIdx})"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">close</span> Remove</button>
                    </div>
                    <label style="font-size:10px;color:var(--text-secondary)">Role</label>
                    <input type="text" class="ve-input" value="${role}" onchange="updateExpField(${eIdx}, 'role', this.value)">
                    <label style="font-size:10px;color:var(--text-secondary)">Company</label>
                    <input type="text" class="ve-input" value="${company}" onchange="updateExpField(${eIdx}, 'company', this.value)">
                    <label style="font-size:10px;color:var(--text-secondary)">Location</label>
                    <input type="text" class="ve-input" value="${loc}" onchange="updateExpField(${eIdx}, 'location', this.value)">
                    <label style="font-size:10px;color:var(--text-secondary)">Date</label>
                    <input type="text" class="ve-input" value="${date}" onchange="updateExpField(${eIdx}, 'date', this.value)">
                    
                    <div style="font-size:10px;color:var(--text-secondary);margin-top:8px">Highlights</div>
                    ${bulletsHtml}
                </div>
            `;
        });
    }
    
    html += `<button class="ve-btn-primary" onclick="veAddExp()" style="margin-top:8px">+ Add Experience</button>`;
    
    expEl.innerHTML = html;
}

function renderProjects() {
    const projEl = document.getElementById('ve-projects');
    if (!projEl) return;
    
    if (editorState.mergedRecipe.projects === undefined) {
        projEl.style.display = 'none';
        return;
    }
    projEl.style.display = 'block';
    
    const projects = editorState.mergedRecipe.projects;
    
    let html = `<div class="ve-section-title">Projects</div>`;
    
    if (projects.length === 0) {
        html += `<p style="font-size:11px;color:var(--text-secondary)">No projects in this recipe.</p>`;
    } else {
        projects.forEach((projData, pIdx) => {
            const name = escapeHtml(projData.name || '');
            const desc = escapeHtml(projData.description || '');
            
            let bulletsHtml = `<div class="ve-bullet-list">`;
            (projData.highlights || []).forEach((hl, hIdx) => {
                bulletsHtml += `
                    <div class="ve-bullet">
                        <textarea class="ve-textarea" style="min-height:30px" onchange="updateProjectHighlight(${pIdx}, ${hIdx}, this.value)">${escapeHtml(hl)}</textarea>
                        <div class="ve-bullet-controls">
                            <button class="ve-btn" onclick="moveHighlight(${pIdx}, ${hIdx}, -1)"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">arrow_drop_up</span></button>
                            <button class="ve-btn" onclick="moveHighlight(${pIdx}, ${hIdx}, 1)"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">arrow_drop_down</span></button>
                            <button class="ve-btn" style="color:var(--error)" onclick="deleteHighlight(${pIdx}, ${hIdx})"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">close</span></button>
                        </div>
                    </div>
                `;
            });
            bulletsHtml += `
                <button class="ve-btn" onclick="addHighlightToProject(${pIdx})" style="margin-top:4px">+ Add Highlight</button>
            </div>`;
            
            html += `
                <div class="ve-item">
                    <div class="ve-controls">
                        <button class="ve-btn" onclick="moveArrayItem('projects', ${pIdx}, -1)"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">arrow_drop_up</span></button>
                        <button class="ve-btn" onclick="moveArrayItem('projects', ${pIdx}, 1)"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">arrow_drop_down</span></button>
                        <button class="ve-btn" style="color:var(--error)" onclick="veRemoveProject(${pIdx})"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">close</span> Remove</button>
                    </div>
                    <label style="font-size:10px;color:var(--text-secondary)">Project Name</label>
                    <input type="text" class="ve-input" value="${name}" onchange="updateProjectField(${pIdx}, 'name', this.value)">
                    <label style="font-size:10px;color:var(--text-secondary)">Description</label>
                    <input type="text" class="ve-input" value="${desc}" onchange="updateProjectField(${pIdx}, 'description', this.value)">
                    
                    <div style="font-size:10px;color:var(--text-secondary);margin-top:8px">Highlights</div>
                    ${bulletsHtml}
                </div>
            `;
        });
    }
    
    html += `<button class="ve-btn-primary" onclick="veAddProject()" style="margin-top:8px">+ Add Project</button>`;
    
    projEl.innerHTML = html;
}

function renderSkills() {
    const skEl = document.getElementById('ve-skills');
    if (!skEl) return;
    
    const skills = editorState.mergedRecipe.skills;
    if (!skills) {
        skEl.style.display = 'none';
        return;
    }
    skEl.style.display = 'block';
    
    let html = `<div class="ve-section-title">Skills</div>`;
    
    if (Array.isArray(skills)) {
        skills.forEach((skData, sIdx) => {
            if (typeof skData === 'string') {
                html += `<div class="ve-item"><input type="text" class="ve-input" value="${escapeHtml(skData)}" onchange="updateRecipeField('skills[${sIdx}]', this.value)"></div>`;
            } else if (typeof skData === 'object' && skData !== null) {
                const name = escapeHtml(skData.name || skData.title || `Skill Group ${sIdx+1}`);
                const kws = escapeHtml(skData.keywords || (Array.isArray(skData.items) ? skData.items.join(', ') : skData.items) || '');
                html += `
                    <div class="ve-item">
                        <div class="ve-controls">
                            <button class="ve-btn" onclick="moveArrayItem('skills', ${sIdx}, -1)"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">arrow_drop_up</span></button>
                            <button class="ve-btn" onclick="moveArrayItem('skills', ${sIdx}, 1)"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">arrow_drop_down</span></button>
                            <button class="ve-btn" style="color:var(--error)" onclick="veRemoveSkill(${sIdx})"><span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">close</span> Remove</button>
                        </div>
                        <input type="text" class="ve-input" style="font-weight:bold" value="${name}" onchange="updateLibraryItemField('skills', ${sIdx}, 'name', this.value)">
                        <textarea class="ve-textarea" onchange="updateLibraryItemField('skills', ${sIdx}, 'keywords', this.value)">${kws}</textarea>
                    </div>
                `;
            }
        });
    } else if (typeof skills === 'object') {
        Object.keys(skills).forEach((skKey) => {
            const item = skills[skKey];
            const name = escapeHtml(typeof item === 'object' ? (item.name || skKey) : skKey);
            const kws = escapeHtml(typeof item === 'object' ? (item.keywords || (Array.isArray(item.items) ? item.items.join(', ') : item.items) || JSON.stringify(item)) : String(item));
            html += `
                <div class="ve-item">
                    <input type="text" class="ve-input" style="font-weight:bold" value="${name}" readonly>
                    <textarea class="ve-textarea" readonly>${kws}</textarea>
                </div>
            `;
        });
    } else if (typeof skills === 'string') {
        html += `<div class="ve-item"><textarea class="ve-textarea" onchange="updateRecipeField('skills', this.value)">${escapeHtml(skills)}</textarea></div>`;
    }
    
    html += `<button class="ve-btn-primary" onclick="veAddSkill()" style="margin-top:8px">+ Add Skill</button>`;
    
    skEl.innerHTML = html;
}

// ── Updates & Interactions ───────────────────────────────────────────────────

window.syncJsonEditor = function() {
    const el = document.getElementById('ve-json-editor');
    if (el && document.activeElement !== el) {
        el.value = JSON.stringify(editorState.mergedRecipe, null, 2);
    }
};

window.updateFromJson = function(val) {
    try {
        editorState.mergedRecipe = JSON.parse(val);
        renderMeta();
        renderExperience();
        renderProjects();
        renderSkills();
    } catch (e) {
        // Ignore JSON errors while typing
    }
};

window.updateMerged = function(key, val) {
    editorState.mergedRecipe[key] = val;
    syncJsonEditor();
};

window.updateProjectField = function(idx, field, val) {
    if(!editorState.mergedRecipe.projects) return;
    if(editorState.mergedRecipe.projects[idx]) {
        editorState.mergedRecipe.projects[idx][field] = val;
        syncJsonEditor();
    }
}

window.updateProjectHighlight = function(idx, hIdx, val) {
    if(!editorState.mergedRecipe.projects || !editorState.mergedRecipe.projects[idx]) return;
    if(!editorState.mergedRecipe.projects[idx].highlights) editorState.mergedRecipe.projects[idx].highlights = [];
    editorState.mergedRecipe.projects[idx].highlights[hIdx] = val;
    syncJsonEditor();
}

window.moveHighlight = function(idx, hIdx, dir) {
    if(!editorState.mergedRecipe.projects || !editorState.mergedRecipe.projects[idx]) return;
    const arr = editorState.mergedRecipe.projects[idx].highlights;
    if(!arr) return;
    const newIdx = hIdx + dir;
    if(newIdx < 0 || newIdx >= arr.length) return;
    [arr[hIdx], arr[newIdx]] = [arr[newIdx], arr[hIdx]];
    syncJsonEditor();
    renderProjects();
}

window.deleteHighlight = function(idx, hIdx) {
    if(!editorState.mergedRecipe.projects || !editorState.mergedRecipe.projects[idx]) return;
    const arr = editorState.mergedRecipe.projects[idx].highlights;
    if(arr) {
        arr.splice(hIdx, 1);
        syncJsonEditor();
        renderProjects();
    }
}

window.addHighlightToProject = function(idx) {
    if(!editorState.mergedRecipe.projects || !editorState.mergedRecipe.projects[idx]) return;
    if(!editorState.mergedRecipe.projects[idx].highlights) editorState.mergedRecipe.projects[idx].highlights = [];
    editorState.mergedRecipe.projects[idx].highlights.push("New highlight");
    syncJsonEditor();
    renderProjects();
}

window.veAddProject = function() {
    if(!editorState.mergedRecipe.projects) editorState.mergedRecipe.projects = [];
    editorState.mergedRecipe.projects.push({name: "New Project", description: "", highlights: []});
    syncJsonEditor();
    renderProjects();
}

window.veRemoveProject = function(idx) {
    if(!editorState.mergedRecipe.projects) return;
    editorState.mergedRecipe.projects.splice(idx, 1);
    syncJsonEditor();
    renderProjects();
}

window.updateExperienceField = function(idx, field, val) {
    if(!editorState.mergedRecipe.experience) return;
    if(editorState.mergedRecipe.experience[idx]) {
        editorState.mergedRecipe.experience[idx][field] = val;
        syncJsonEditor();
    }
}

window.updateExperienceHighlight = function(idx, hIdx, val) {
    if(!editorState.mergedRecipe.experience || !editorState.mergedRecipe.experience[idx]) return;
    if(!editorState.mergedRecipe.experience[idx].highlights) editorState.mergedRecipe.experience[idx].highlights = [];
    editorState.mergedRecipe.experience[idx].highlights[hIdx] = val;
    syncJsonEditor();
}

window.moveExpHighlight = function(idx, hIdx, dir) {
    if(!editorState.mergedRecipe.experience || !editorState.mergedRecipe.experience[idx]) return;
    const arr = editorState.mergedRecipe.experience[idx].highlights;
    if(!arr) return;
    const newIdx = hIdx + dir;
    if(newIdx < 0 || newIdx >= arr.length) return;
    [arr[hIdx], arr[newIdx]] = [arr[newIdx], arr[hIdx]];
    syncJsonEditor();
    renderExperience();
}

window.deleteExpHighlight = function(idx, hIdx) {
    if(!editorState.mergedRecipe.experience || !editorState.mergedRecipe.experience[idx]) return;
    const arr = editorState.mergedRecipe.experience[idx].highlights;
    if(arr) {
        arr.splice(hIdx, 1);
        syncJsonEditor();
        renderExperience();
    }
}

window.addHighlightToExperience = function(idx) {
    if(!editorState.mergedRecipe.experience || !editorState.mergedRecipe.experience[idx]) return;
    if(!editorState.mergedRecipe.experience[idx].highlights) editorState.mergedRecipe.experience[idx].highlights = [];
    editorState.mergedRecipe.experience[idx].highlights.push("New highlight");
    syncJsonEditor();
    renderExperience();
}

window.veAddExperience = function() {
    if(!editorState.mergedRecipe.experience) editorState.mergedRecipe.experience = [];
    editorState.mergedRecipe.experience.push({role: "New Role", company: "Company", location: "", date: "", highlights: []});
    syncJsonEditor();
    renderExperience();
}

window.veRemoveExperience = function(idx) {
    if(!editorState.mergedRecipe.experience) return;
    editorState.mergedRecipe.experience.splice(idx, 1);
    syncJsonEditor();
    renderExperience();
}

window.updateSkillField = function(idx, field, val) {
    if(!editorState.mergedRecipe.skills) return;
    if(editorState.mergedRecipe.skills[idx]) {
        editorState.mergedRecipe.skills[idx][field] = val;
        syncJsonEditor();
    }
}

window.veAddSkill = function() {
    if(!editorState.mergedRecipe.skills) editorState.mergedRecipe.skills = [];
    editorState.mergedRecipe.skills.push({name: "New Category", keywords: ""});
    syncJsonEditor();
    renderSkills();
}

window.veRemoveSkill = function(idx) {
    if(!editorState.mergedRecipe.skills) return;
    editorState.mergedRecipe.skills.splice(idx, 1);
    syncJsonEditor();
    renderSkills();
}

export function openBookmarkEditor(bmId, bmData, name, onSave) {
    editorState.appId = null;
    editorState.versionId = bmId;
    editorState.appData = null;
    editorState.versionData = { name: name };
    const recipeObj = (bmData && typeof bmData === 'object') ? (bmData.recipe || bmData.resume_template || bmData) : bmData;
    editorState.mergedRecipe = deepClone(recipeObj);

    const title = `Edit Bookmark: ${escapeHtml(name)}`;
    
    const html = `
        <div class="ve-modal-content">
            <div class="ve-col-left">
                <div id="ve-meta" class="ve-section-container"></div>
                <div id="ve-experience" class="ve-section-container"></div>
                <div id="ve-projects" class="ve-section-container"></div>
                <div id="ve-skills" class="ve-section-container"></div>
            </div>
            <div class="ve-col-right">
                <div class="ve-section-title" style="margin:0; padding-top:16px;">JSON Editor</div>
                <div id="ve-json-editor-container" style="flex:1;min-height:380px;border-radius:6px;overflow:hidden"></div>
            </div>
        </div>
    `;

    showModal(title, html, () => onSave(editorState.mergedRecipe), 'Save Bookmark');
    setTimeout(renderEditorContent, 50);
}
