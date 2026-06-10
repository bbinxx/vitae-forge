import { state } from './app.js';

const SYSTEM_TEMPLATES = [
    { id: 'standard', type: 'resume', label: 'Standard Resume', files: { plain: 'template.tex', photo: 'template_photo.tex' }, is_system: true },
    { id: 'cover_letter', type: 'cover_letter', label: 'Standard Cover Letter', files: { plain: 'cover_letter.tex' }, is_system: true },
];

let customTemplates = [];
let loadedContent = {}; // Stores content for both system and custom templates
let selectedTemplateId = 'standard';
let selectedVariant = 'plain';

export async function loadTemplates() {
    await fetchCustomTemplates();
    
    // Ensure all system templates are loaded in memory
    await loadSystemTemplates();

    renderTemplateSidebar();
    renderTemplateContent();
}

async function fetchCustomTemplates() {
    try {
        const res = await fetch('/api/templates');
        if (res.ok) {
            const data = await res.json();
            customTemplates = data.templates || [];
        }
    } catch (e) {
        console.error("Failed to load custom templates", e);
    }
}

async function loadSystemTemplates() {
    const allFiles = new Set();
    for (const t of SYSTEM_TEMPLATES) {
        for (const variant of Object.values(t.files)) {
            allFiles.add(variant);
        }
    }
    try {
        const results = await Promise.all([...allFiles].map(async file => {
            const res = await fetch(`/api/template/${file}`);
            if (!res.ok) throw new Error(`Failed to load ${file}`);
            const data = await res.json();
            return { file, content: data.content };
        }));
        for (const r of results) {
            for (const t of SYSTEM_TEMPLATES) {
                for (const [variant, file] of Object.entries(t.files)) {
                    if (file === r.file) {
                        if (!loadedContent[t.id]) loadedContent[t.id] = {};
                        loadedContent[t.id][variant] = r.content;
                    }
                }
            }
        }
    } catch (e) {
        console.error("System templates load error:", e);
    }
}

function renderTemplateSidebar() {
    const listResume = document.getElementById('templates-list-resume');
    const listCover = document.getElementById('templates-list-cover');
    if (!listResume || !listCover) return;
    
    const allTemplates = [...SYSTEM_TEMPLATES, ...customTemplates];
    
    const resumes = allTemplates.filter(t => t.type === 'resume');
    const covers = allTemplates.filter(t => t.type === 'cover_letter');
    
    const renderBtn = (t) => `
        <button class="btn btn-secondary" style="width:100%;justify-content:flex-start;${selectedTemplateId === t.id ? 'background:var(--accent-dim);border-color:var(--accent);color:var(--accent)' : ''}" onclick="window.openTemplate('${t.id}')">
            <span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px;margin-right:4px;color:${t.is_system ? '#7c3aed' : '#22c55e'}">${t.is_system ? 'description' : 'edit_document'}</span>
            ${t.label || t.name} ${t.is_system ? '(System)' : ''}
        </button>
    `;
    
    listResume.innerHTML = resumes.map(renderBtn).join('');
    listCover.innerHTML = covers.map(renderBtn).join('');
}

export function openTemplate(templateId) {
    selectedTemplateId = templateId;
    selectedVariant = 'plain';
    
    const isCustom = customTemplates.find(t => t.id === templateId);
    if (isCustom) {
        if (!loadedContent[templateId]) {
            loadedContent[templateId] = { plain: isCustom.content, photo: isCustom.content };
        }
    }
    
    // Clear preview pane
    const iframe = document.getElementById('template-preview-iframe');
    const empty = document.getElementById('template-preview-empty');
    if (iframe && empty) {
        iframe.src = '';
        iframe.classList.add('hidden');
        empty.classList.remove('hidden');
        empty.textContent = "Click 'Update Preview' to generate PDF";
    }

    renderTemplateSidebar();
    renderTemplateContent();
}

export function switchVariant(variant) {
    selectedVariant = variant;
    renderTemplateContent();
}

function renderTemplateContent() {
    const editorForm = document.getElementById('template-editor-form');
    const empty = document.getElementById('template-editor-empty');
    if (!editorForm || !empty) return;

    editorForm.classList.remove('hidden');
    empty.classList.add('hidden');

    const tpl = [...SYSTEM_TEMPLATES, ...customTemplates].find(t => t.id === selectedTemplateId);
    if (!tpl) return;

    const hasPhoto = tpl.is_system ? !!tpl.files?.photo : true;
    const content = loadedContent[tpl.id]?.[selectedVariant] || '';

    let topActions = '';
    if (tpl.is_system) {
        topActions = `
            <button class="btn btn-secondary btn-sm" onclick="window.cloneTemplate('${tpl.id}', '${tpl.type}')">
                <span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">content_copy</span> Clone to Custom
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.downloadTpl()">
                <span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">download</span> Download .tex
            </button>
        `;
    } else {
        topActions = `
            <button class="btn btn-success btn-sm" onclick="window.saveCustomTemplate('${tpl.id}')">
                <span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">cloud_upload</span> Save to Cloud
            </button>
            <button class="btn btn-danger btn-sm" onclick="window.deleteCustomTemplate('${tpl.id}')">
                <span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">delete</span> Delete
            </button>
        `;
    }

    editorForm.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-shrink:0">
                <div style="display:flex;align-items:center;gap:10px">
                    <h2 style="font-size:12px;font-weight:700;color:var(--text-primary)">${tpl.label || tpl.name}</h2>
                    ${hasPhoto ? `
                        <div class="view-toggle" style="display:inline-flex">
                            <button class="view-toggle-btn ${selectedVariant === 'plain' ? 'active' : ''}" onclick="window.switchVariant('plain')"><span class="material-symbols-outlined" style="font-size:12px;vertical-align:-2px">text_snippet</span> Without Photo</button>
                            <button class="view-toggle-btn ${selectedVariant === 'photo' ? 'active' : ''}" onclick="window.switchVariant('photo')"><span class="material-symbols-outlined" style="font-size:12px;vertical-align:-2px">photo</span> With Photo</button>
                        </div>
                    ` : `<span style="font-size:10px;color:var(--text-muted);padding:4px 10px;background:var(--bg-card);border-radius:var(--radius-sm);border:1px solid var(--border-soft)">No photo variant</span>`}
                </div>
                <div style="display:flex;gap:8px">
                    ${topActions}
                </div>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;min-height:0">
                <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;display:flex;justify-content:space-between">
                    <span>${tpl.is_system ? 'Read-only System Template' : 'Editable Custom Template'}</span>
                </div>
                <textarea id="tpl-source-editor" class="tpl-source" spellcheck="false" ${tpl.is_system ? 'readonly' : ''} style="flex:1;resize:none;background:#0b1119;color:#22c55e;border:1px solid var(--border);border-radius:var(--radius);padding:14px;font-family:var(--mono);font-size:11px;line-height:1.6;white-space:pre;overflow:auto" onchange="window.updateTemplateContent()">${escapeHtml(content)}</textarea>
            </div>
        </div>
    `;
}

export function updateTemplateContent() {
    const editor = document.getElementById('tpl-source-editor');
    if (!editor) return;
    if (!loadedContent[selectedTemplateId]) loadedContent[selectedTemplateId] = {};
    loadedContent[selectedTemplateId][selectedVariant] = editor.value;
}

export async function cloneTemplate(sourceId, type) {
    const name = prompt("Enter a name for your custom template:");
    if (!name) return;
    
    const newId = 'custom_' + Date.now();
    const content = loadedContent[sourceId]?.[selectedVariant] || '';
    
    const newTpl = {
        id: newId,
        type: type,
        name: name,
        content: content
    };
    
    try {
        const res = await fetch(`/api/templates/${newId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTpl)
        });
        if (res.ok) {
            customTemplates.push(newTpl);
            loadedContent[newId] = { plain: content, photo: content };
            openTemplate(newId);
        }
    } catch(e) {
        alert("Failed to clone template");
    }
}

export async function saveCustomTemplate(templateId) {
    const tpl = customTemplates.find(t => t.id === templateId);
    if (!tpl) return;
    
    // update template object with current content
    updateTemplateContent();
    tpl.content = loadedContent[templateId][selectedVariant];
    
    const btn = document.querySelector(`button[onclick="window.saveCustomTemplate('${templateId}')"]`);
    if(btn) btn.innerHTML = 'Saving...';

    try {
        const res = await fetch(`/api/templates/${templateId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tpl)
        });
        if (res.ok) {
            if(btn) btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">check</span> Saved';
            setTimeout(() => {
                if(btn) btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">cloud_upload</span> Save to Cloud';
            }, 2000);
        } else {
            alert("Failed to save template");
            if(btn) btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">cloud_upload</span> Save to Cloud';
        }
    } catch(e) {
        alert("Failed to save template");
    }
}

export async function deleteCustomTemplate(templateId) {
    if(!confirm("Are you sure you want to delete this custom template?")) return;
    
    try {
        const res = await fetch(`/api/templates/${templateId}`, { method: 'DELETE' });
        if(res.ok) {
            customTemplates = customTemplates.filter(t => t.id !== templateId);
            openTemplate('standard');
        }
    } catch(e) {
        alert("Failed to delete template");
    }
}

export async function createNewTemplate(type) {
    const name = prompt(`Enter a name for your new ${type === 'resume' ? 'Resume' : 'Cover Letter'} template:`);
    if (!name) return;
    
    const newId = 'custom_' + Date.now();
    const content = type === 'resume' 
        ? "% Empty Resume Template\n\\documentclass{article}\n\\begin{document}\n\\end{document}" 
        : "% Empty Cover Letter Template\n\\documentclass{article}\n\\begin{document}\n\\end{document}";
    
    const newTpl = {
        id: newId,
        type: type,
        name: name,
        content: content
    };
    
    try {
        const res = await fetch(`/api/templates/${newId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTpl)
        });
        if (res.ok) {
            customTemplates.push(newTpl);
            loadedContent[newId] = { plain: content, photo: content };
            openTemplate(newId);
        }
    } catch(e) {
        alert("Failed to create template");
    }
}

export async function previewCurrentTemplate() {
    updateTemplateContent();
    const content = loadedContent[selectedTemplateId]?.[selectedVariant];
    if (!content) return;
    
    const tpl = [...SYSTEM_TEMPLATES, ...customTemplates].find(t => t.id === selectedTemplateId);
    
    const iframe = document.getElementById('template-preview-iframe');
    const empty = document.getElementById('template-preview-empty');
    if (!iframe || !empty) return;
    
    empty.textContent = "Generating PDF Preview...";
    empty.classList.remove('hidden');
    iframe.classList.add('hidden');
    
    // Build dummy config
    const dummyConfig = {
        personal: {
            name: "John Doe",
            email: "john@example.com",
            phone: "+1 (555) 123-4567",
            linkedin: "linkedin.com/in/johndoe",
            github: "github.com/johndoe"
        },
        library: {
            role_title: { "role1": "Senior Software Engineer" },
            professional_summary: { "sum1": "Experienced engineer with a passion for scalable web applications." },
            skills: { "sk1": { name: "Languages", keywords: "Python, JavaScript, Go" } },
            projects: { "proj1": { name: "Project X", tech: "React, Node.js", date: "Jan 2023", points: ["Built cool feature", "Scaled to 10k users"] } },
            education: { "edu1": { institution: "University of Tech", degree: "B.S. Computer Science", date: "2018 - 2022" } },
            certifications: { "cert1": { name: "AWS Certified", issuer: "Amazon", year: "2023" } },
            achievements: { "ach1": { name: "Hackathon Winner", issuer: "Tech Corp", year: "2022" } },
            additional_info: { "add1": { name: "Languages", content: "English (Native), Spanish (Fluent)" } }
        },
        recipes: {
            "dummy_role": {
                short_name: "Software Engineer",
                role_title: "role1",
                professional_summary: "sum1",
                skills: ["sk1"],
                projects: ["proj1"],
                education: ["edu1"],
                certifications: ["cert1"],
                achievements: ["ach1"],
                additional_info: ["add1"]
            }
        },
        // For cover letter
        cover_letter: "Dear Hiring Manager,\n\nI am writing to express my interest in the Software Engineer position. I believe my skills match the requirements.\n\nSincerely,\nJohn Doe",
        company: "Acme Corp",
        date: "Today"
    };

    try {
        const res = await fetch('/api/preview-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            },
            body: JSON.stringify({
                type: tpl.type === 'cover_letter' ? 'cover_letter' : 'resume',
                include_photo: selectedVariant === 'photo',
                config: dummyConfig,
                template_content: content
            })
        });

        if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            iframe.src = url;
            iframe.classList.remove('hidden');
            empty.classList.add('hidden');
        } else {
            empty.textContent = "Failed to generate preview. Check console or LaTeX syntax.";
            const err = await res.text();
            console.error("Preview Error:", err);
        }
    } catch (e) {
        empty.textContent = "Error communicating with server.";
        console.error("Preview Network Error:", e);
    }
}

export function downloadTpl() {
    const tpl = [...SYSTEM_TEMPLATES, ...customTemplates].find(t => t.id === selectedTemplateId);
    if (!tpl) return;
    const content = loadedContent[tpl.id]?.[selectedVariant];
    if (!content) return;
    const filename = tpl.is_system ? tpl.files[selectedVariant] : `${tpl.id}.tex`;
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}

function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.openTemplate = openTemplate;
window.switchVariant = switchVariant;
window.downloadTpl = downloadTpl;
window.cloneTemplate = cloneTemplate;
window.createNewTemplate = createNewTemplate;
window.saveCustomTemplate = saveCustomTemplate;
window.deleteCustomTemplate = deleteCustomTemplate;
window.previewCurrentTemplate = previewCurrentTemplate;
window.updateTemplateContent = updateTemplateContent;
