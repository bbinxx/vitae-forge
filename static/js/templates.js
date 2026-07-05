import { state } from './app.js';

(function(){
    const style = document.createElement('style');
    style.textContent = `
        .template-preview-loading .material-symbols-outlined { animation: tplSpin 1s linear infinite; }
        @keyframes tplSpin { to { transform: rotate(360deg); } }
        .template-preview-loading { position:relative; }
        .template-preview-loading.active::after {
            content:''; position:absolute; inset:0; background:var(--bg-main);
            opacity:0.7; pointer-events:auto; border-radius:4px; z-index:2;
        }
        .template-preview-loading.active #template-preview-empty {
            z-index:3; position:relative;
        }
    `;
    document.head.appendChild(style);
})();

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
    previewCurrentTemplate();
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
    const container = document.getElementById('template-preview-container');
    if (!iframe || !empty) return;
    
    empty.textContent = "Generating PDF Preview...";
    empty.classList.remove('hidden');
    iframe.classList.add('hidden');
    if (container) container.classList.add('active');
    
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
    } finally {
        if (container) container.classList.remove('active');
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

window.showTemplateGuide = function() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
    <div style="background:var(--bg-card);border-radius:12px;max-width:820px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,0.5)">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 24px;border-bottom:1px solid var(--border);flex-shrink:0">
            <h2 style="font-size:15px;font-weight:700;margin:0">Template Authoring Guide</h2>
            <button onclick="this.closest('div[style]').parentElement.remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;padding:4px">&times;</button>
        </div>
        <div style="flex:1;overflow-y:auto;padding:24px;font-size:12px;line-height:1.7;color:var(--text-primary)">

        <p style="color:var(--text-secondary);margin-bottom:16px">Templates are LaTeX <code>.tex</code> files with placeholders and section markers. The system replaces placeholders with your resume data and removes inactive sections at build time.</p>

        <h3 style="font-size:13px;margin:20px 0 8px">Available Placeholders</h3>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead><tr style="background:var(--bg-main)">
                <th style="text-align:left;padding:6px 10px;border-bottom:1px solid var(--border);font-weight:600">Placeholder</th>
                <th style="text-align:left;padding:6px 10px;border-bottom:1px solid var(--border);font-weight:600">Description</th>
                <th style="text-align:left;padding:6px 10px;border-bottom:1px solid var(--border);font-weight:600">Source</th>
            </tr></thead>
            <tbody>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;NAME&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Full name</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Personal info</td></tr>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;ROLE_TITLE&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Job title / role</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Library recipe</td></tr>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;EMAIL&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Email address</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Personal info</td></tr>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;PHONE&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Phone number (display)</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Personal info</td></tr>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;PHONE_URI&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Phone (digits only, for <code>tel:</code> links)</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Personal info (auto)</td></tr>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;LINKEDIN&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">LinkedIn handle</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Personal info</td></tr>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;GITHUB&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">GitHub handle</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Personal info</td></tr>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;SUMMARY&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Professional summary</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Library recipe</td></tr>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;SKILLS&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Skills table rows</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Generated from library</td></tr>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;PROJECTS&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Projects section content</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Generated from library</td></tr>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;EDUCATION&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Education entries</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Generated from library</td></tr>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;CERTIFICATIONS&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Certifications table rows</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Generated from library</td></tr>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;ACHIEVEMENTS&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Achievements table rows</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Generated from library</td></tr>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;ADDITIONAL&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Additional info table rows</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Generated from library</td></tr>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;PHOTO_PATH&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Profile photo file path</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Uploaded photo</td></tr>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;COMPANY_NAME&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Company name (cover letters)</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Recipe config</td></tr>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;COVER_LETTER&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Cover letter body text</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Recipe config</td></tr>
                <tr><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft);font-family:var(--mono);font-size:10px"><code>&lt;&lt;DATE&gt;&gt;</code></td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">Current date (auto-inserted)</td><td style="padding:5px 10px;border-bottom:1px solid var(--border-soft)">System</td></tr>
            </tbody>
        </table>

        <h3 style="font-size:13px;margin:24px 0 8px">Section Markers</h3>
        <p style="color:var(--text-secondary);margin-bottom:8px">Wrap optional sections in comment markers. When a section is toggled off in the recipe, the entire block is removed:</p>
        <pre style="background:#0b1119;padding:12px;border-radius:6px;font-size:10px;color:#22c55e;overflow-x:auto;margin-bottom:12px;white-space:pre-wrap">% [SECTION:ROLE_TITLE]
\\textbf{<<ROLE_TITLE>>}
% [/SECTION:ROLE_TITLE]</pre>
        <p style="color:var(--text-secondary);margin-bottom:8px">Available sections:</p>
        <pre style="background:#0b1119;padding:12px;border-radius:6px;font-size:10px;color:#22c55e;overflow-x:auto;margin-bottom:12px">ROLE_TITLE   SUMMARY   SKILLS   PROJECTS   EDUCATION
CERTIFICATIONS   ACHIEVEMENTS   LANGUAGES   PHOTO</pre>
        <p style="color:var(--text-secondary);font-size:11px">The <code>PHOTO</code> section is only available in the <strong>With Photo</strong> variant.</p>

        <h3 style="font-size:13px;margin:24px 0 8px">LaTeX Requirements</h3>
        <p style="color:var(--text-secondary);margin-bottom:8px">Your template must use <code>\\documentclass{article}</code> or another standard class. These packages are recommended and preloaded in system templates:</p>
        <pre style="background:#0b1119;padding:12px;border-radius:6px;font-size:10px;color:#22c55e;overflow-x:auto;margin-bottom:12px">geometry, hyperref, titlesec, enumitem, array, tabularx, parskip</pre>
        <p style="color:var(--text-secondary);font-size:11px">For photo templates: <code>graphicx</code>, <code>xcolor</code> are also needed. You can use any standard LaTeX packages — they must be installed on the server (TeX Live).</p>

        <h3 style="font-size:13px;margin:24px 0 8px">Creating a Custom Template</h3>
        <ol style="padding-left:20px;color:var(--text-secondary);line-height:2">
            <li><strong>Clone</strong> an existing system template using the <em>Clone to Custom</em> button, or click <em>+ New</em> to start from scratch.</li>
            <li><strong>Edit</strong> the LaTeX source in the editor. Use placeholders where resume data should appear.</li>
            <li><strong>Preview</strong> by clicking <em>Update Preview</em> — the system renders it with dummy data.</li>
            <li><strong>Save</strong> to the cloud when you're happy. Your template will appear in the sidebar.</li>
        </ol>

        <h3 style="font-size:13px;margin:24px 0 8px">Tips for ATS-Friendly Templates</h3>
        <ul style="padding-left:20px;color:var(--text-secondary);line-height:2">
            <li>Avoid tables, columns, and complex layouts — parsers often misread them.</li>
            <li>Use standard section headings (<code>\\section*{Experience}</code>).</li>
            <li>Keep font sizes 10-12pt and margins 0.5-1 inch.</li>
            <li>Avoid images, icons, and non-standard characters.</li>
            <li>Use <code>\\href</code> for clickable links (email, phone, LinkedIn, GitHub).</li>
        </ul>

        </div>
    </div>`;
    document.body.appendChild(overlay);
};

window.openTemplate = openTemplate;
window.switchVariant = switchVariant;
window.downloadTpl = downloadTpl;
window.cloneTemplate = cloneTemplate;
window.createNewTemplate = createNewTemplate;
window.saveCustomTemplate = saveCustomTemplate;
window.deleteCustomTemplate = deleteCustomTemplate;
window.previewCurrentTemplate = previewCurrentTemplate;
window.updateTemplateContent = updateTemplateContent;
