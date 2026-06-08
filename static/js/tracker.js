/**
 * tracker.js — Applications Module (v5 - Enhanced)
 * Bidirectional sync, live PDF preview, JSON editing, preset selector, safe template guard.
 */

import { api } from './api.js';
import { state } from './app.js';

// ── State ─────────────────────────────────────────────────────────────────────
let applications  = [];
let filterSearch  = '';
let distFiles     = [];
let saveDebounce  = null;

// Tracks whether the currently loaded PDF config came from a system recipe
let _loadedFromSystemTemplate = null; // null = no, string = recipe key it came from

// ── Resolve full content (ID refs → actual text objects) ──────────────────────
function resolveFullContent(recipe) {
    const globalLibrary = state.data?.library || {};
    const personal = state.data?.personal || {};
    const out = {};

    // Build a merged library with any recipe-specific overrides included.
    const library = {};
    for (const section of Object.keys(globalLibrary)) {
        library[section] = { ...globalLibrary[section] };
    }
    if (recipe.library && typeof recipe.library === 'object') {
        for (const section of Object.keys(recipe.library)) {
            library[section] = { ...(library[section] || {}), ...recipe.library[section] };
        }
    }

    // Personal info (name, email, phone, etc.) always included at top
    out.personal = { ...personal, ...(recipe.personal || {}) };

    // Sections toggle map
    if (recipe.sections) out.sections = { ...recipe.sections };

    const resolveTextValue = (section, key) => {
        if (!key) return key;
        if (typeof key === 'object') {
            if (key.id && library[section]?.[key.id]) {
                return { id: key.id, ...library[section][key.id], ...key };
            }
            return key;
        }
        const resolved = library[section]?.[key];
        if (typeof resolved === 'string') return resolved;
        if (resolved) return { id: key, ...resolved };
        return key;
    };

    // role_title — resolve string ID → actual title text or object
    if (recipe.role_title) {
        out.role_title = resolveTextValue('role_title', recipe.role_title);
    }

    // professional_summary — resolve string ID → full summary text
    if (recipe.professional_summary) {
        out.professional_summary = resolveTextValue('professional_summary', recipe.professional_summary);
    }

    // education — resolve string ID → full object
    if (recipe.education) {
        if (typeof recipe.education === 'object') {
            out.education = recipe.education.id && library.education?.[recipe.education.id]
                ? { id: recipe.education.id, ...library.education[recipe.education.id], ...recipe.education }
                : recipe.education;
        } else {
            const resolved = library.education?.[recipe.education];
            out.education = resolved ? { id: recipe.education, ...resolved } : { id: recipe.education };
        }
    }

    const resolveItem = (section, item) => {
        if (!item) return item;
        if (typeof item === 'object') {
            if (item.id && library[section]?.[item.id]) {
                return { id: item.id, ...library[section][item.id], ...item };
            }
            return item;
        }
        const libItem = library[section]?.[item];
        if (libItem) return { id: item, ...libItem };
        return { id: item, _note: 'library item not found' };
    };

    // Array sections: skills, projects, certifications, achievements, additional_info
    const arraySections = ['skills', 'projects', 'certifications', 'achievements', 'additional_info'];
    for (const section of arraySections) {
        const entries = recipe[section];
        if (!entries || !Array.isArray(entries)) continue;
        out[section] = entries.map(entry => resolveItem(section, entry));
    }

    return out;
}

const STATUS_CONFIG = {
    'Bookmarked': { color: '#7c3aed', bg: 'rgba(124,58,237,0.15)', icon: '🔖' },
    'Applied':    { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', icon: '📤' },
    'Screening':  { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: '🔍' },
    'Interview':  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', icon: '💬' },
    'Offer':      { color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: '🎉' },
    'Rejected':   { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: '❌' },
    'Withdrawn':  { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', icon: '↩️' },
};

// ── Toast ─────────────────────────────────────────────────────────────────────
export function toast(msg, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `
        <span class="toast-icon">${icons[type] || '✓'}</span>
        <span class="toast-msg">${msg}</span>
        <button class="toast-dismiss" onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(t);
    setTimeout(() => {
        t.classList.add('toast-out');
        setTimeout(() => t.remove(), 220);
    }, duration);
}

// ── Save Indicator ────────────────────────────────────────────────────────────
function setSaveIndicator(state) {
    const el = document.getElementById('tracker-save-indicator');
    if (!el) return;
    if (state === 'saving') {
        el.className = 'save-indicator saving';
        el.textContent = '⏳ Saving…';
    } else if (state === 'saved') {
        el.className = 'save-indicator saved';
        el.textContent = '✓ Saved';
        setTimeout(() => { el.textContent = ''; el.className = 'save-indicator'; }, 2000);
    } else {
        el.className = 'save-indicator';
        el.textContent = '';
    }
}

// ── API ───────────────────────────────────────────────────────────────────────
export const trackerApi = {
    async list() {
        const res = await fetch('/applications');
        const data = await res.json();
        return data.applications || [];
    },
    async create(payload) {
        const res = await fetch('/applications', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await res.json();
    },
    async update(id, payload) {
        const res = await fetch(`/applications/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await res.json();
    },
    async delete(id) {
        const res = await fetch(`/applications/${id}`, { method: 'DELETE' });
        return await res.json();
    },
    async buildForApp(appId, path, onLine) {
        const res = await fetch(`/applications/${path}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            onLine(decoder.decode(value));
        }
    },
};

// ── Utilities ─────────────────────────────────────────────────────────────────
function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtRel(iso) {
    if (!iso) return '';
    const diff = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff}d ago`;
    return fmtDate(iso);
}

// ── Load ──────────────────────────────────────────────────────────────────────
export async function loadTracker() {
    const grid = document.getElementById('apps-grid');
    if (grid) {
        grid.innerHTML = Array(3).fill(0).map(() => `
            <div class="app-card skeleton-card">
                <div class="app-card-header" style="border-bottom:none; margin-bottom: 0px; padding-bottom: 0px;">
                    <div class="skeleton-line" style="width: 70%; height: 18px; margin-bottom: 8px;"></div>
                    <div class="skeleton-line" style="width: 40%; height: 12px;"></div>
                </div>
                <div class="app-card-body" style="gap: 12px; padding-top: 8px;">
                    <div class="skeleton-line" style="width: 90%; height: 12px;"></div>
                    <div class="skeleton-line" style="width: 60%; height: 12px;"></div>
                </div>
                <div class="app-card-footer" style="background: none; border-top: none;">
                    <div class="skeleton-line" style="width: 30%; height: 18px; border-radius: 6px;"></div>
                    <div class="skeleton-line" style="width: 25%; height: 12px;"></div>
                </div>
            </div>
        `).join('');
    }

    try {
        if (window.__PRELOADED_APPS__ && window.__PRELOADED_FILES__) {
            applications = window.__PRELOADED_APPS__;
            distFiles = window.__PRELOADED_FILES__;
            window.__PRELOADED_APPS__ = null;
            window.__PRELOADED_FILES__ = null;
        } else {
            [applications, distFiles] = await Promise.all([
                trackerApi.list(),
                fetch('/list-files').then(r => r.json()).catch(() => []),
            ]);
        }
        const countEl = document.getElementById('apps-count-badge');
        if (countEl) countEl.textContent = applications.length;
        renderGrid();
    } catch (e) {
        console.error('Error loading tracker:', e);
        if (grid) {
            grid.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted)">⚠️ Failed to load applications.</div>`;
        }
    }
}

// ── Grid View (Card-Based) ────────────────────────────────────────────────────
function renderGrid() {
    const grid = document.getElementById('apps-grid');
    if (!grid) return;

    let filtered = [...applications];
    if (filterSearch) {
        const q = filterSearch.toLowerCase();
        filtered = filtered.filter(a =>
            a.company?.toLowerCase().includes(q) ||
            a.role?.toLowerCase().includes(q) ||
            a.location?.toLowerCase().includes(q)
        );
    }
    filtered.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));

    if (filtered.length === 0) {
        grid.className = 'apps-container empty';
        grid.innerHTML = `
        <div class="apps-empty-state">
            <div class="apps-empty-icon">💼</div>
            <div class="apps-empty-title">${filterSearch ? 'No matching applications' : 'No applications yet'}</div>
            <div class="apps-empty-text">
                ${!filterSearch ? 'Start tracking your job applications here' : 'Try searching with different keywords'}
            </div>
            ${!filterSearch ? `<button class="btn btn-primary" style="margin-top:8px" onclick="window.openNewAppModal()">+ Create First Application</button>` : ''}
        </div>`;
        return;
    }

    grid.className = 'apps-container';
    grid.innerHTML = filtered.map(app => {
        const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG['Bookmarked'];
        const hasResume = !!app.assigned_pdf;
        const hasTemplate = app.resume_template && Object.keys(app.resume_template).length > 0;
        
        return `
        <div class="app-card" onclick="window.openAppEditor('${app.id}')">
            <div class="app-card-header">
                <div class="app-card-emoji">${cfg.icon}</div>
                <div class="app-card-title-group">
                    <div class="app-card-company">${esc(app.company)}</div>
                    <div class="app-card-role">${esc(app.role)}</div>
                    <div class="app-card-status" style="color:${cfg.color};background:${cfg.bg}">
                        ${app.status}
                    </div>
                </div>
            </div>
            
            <div class="app-card-body">
                ${app.location ? `
                    <div class="app-card-location">
                        📍 ${esc(app.location)}
                    </div>
                ` : ''}
                ${app.job_url ? `
                    <div class="app-card-info-row">
                        <a href="${esc(app.job_url)}" target="_blank" onclick="event.stopPropagation()" style="color: #7c3aed; text-decoration: none; font-weight: 500;">View Job →</a>
                    </div>
                ` : ''}
                ${app.notes ? `
                    <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4; margin-top: 4px;">
                        "${esc(app.notes.substring(0, 60))}${app.notes.length > 60 ? '...' : ''}"
                    </div>
                ` : ''}
            </div>
            
            <div class="app-card-footer">
                <div class="app-card-meta">
                    <span title="Last updated">${fmtRel(app.updated_at)}</span>
                </div>
                <div class="app-card-chips">
                    ${hasResume ? `<div class="app-card-chip" title="${esc(app.assigned_pdf)}">📄 PDF</div>` : ''}
                    ${hasTemplate ? `<div class="app-card-chip" title="Has custom template">✏️ Template</div>` : ''}
                    ${app.priority ? `<div class="app-card-chip" style="background: rgba(239,68,68,0.1); color: #dc2626; border-color: rgba(239,68,68,0.2);">${app.priority}</div>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

// ── Modal System ──────────────────────────────────────────────────────────────
export function showModal(title, bodyHtml, onConfirm, confirmLabel = 'Confirm', options = {}) {
    let modal = document.getElementById('tracker-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'tracker-modal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    
    const hasTabs = options.tabs && options.tabs.length > 0;
    const tabsHtml = hasTabs ? `
        <div class="modal-tabs">
            ${options.tabs.map((tab, idx) => `
                <button class="modal-tab ${idx === 0 ? 'active' : ''}" 
                        data-tab-index="${idx}"
                        onclick="window.switchModalTab(${idx})">
                    ${tab.icon || ''} ${tab.label}
                </button>
            `).join('')}
        </div>
    ` : '';
    
    const bodyWithTabs = hasTabs ? `
        <div class="modal-tab-content">
            ${options.tabs.map((tab, idx) => `
                <div class="modal-tab-pane ${idx === 0 ? 'active' : ''}" data-pane="${idx}">
                    ${tab.content}
                </div>
            `).join('')}
        </div>
    ` : bodyHtml;
    
    modal.innerHTML = `
    <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
            <span class="modal-title">${title}</span>
            <button class="modal-close" onclick="window.closeModal()">✕</button>
        </div>
        ${tabsHtml}
        <div class="modal-body">${bodyWithTabs}</div>
        <div class="modal-footer">
            <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="modal-confirm-btn">${confirmLabel}</button>
        </div>
    </div>`;
    modal.style.display = 'flex';
    modal.onclick = () => window.closeModal();
    document.getElementById('modal-confirm-btn').onclick = async () => {
        const result = await onConfirm();
        if (result !== false) window.closeModal();
    };
    
    window._currentModalOnConfirm = onConfirm;
}

// ── Tab Switching ──────────────────────────────────────────────────────────────
window.switchModalTab = (index) => {
    const tabs = document.querySelectorAll('.modal-tab');
    const panes = document.querySelectorAll('.modal-tab-pane');
    
    tabs.forEach((tab, i) => {
        tab.classList.toggle('active', i === index);
    });
    panes.forEach((pane, i) => {
        pane.classList.toggle('active', i === index);
    });
    
    // When switching to PDF Config tab (index 1), refresh preview if a PDF is selected
    if (index === 1) {
        setTimeout(() => {
            const sel = document.getElementById('config-template-select');
            if (sel && sel.value) refreshConfigPdfPreview(sel.value);
        }, 50);
    }
};

export function closeModal() {
    const modal = document.getElementById('tracker-modal');
    if (modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
    _loadedFromSystemTemplate = null;
}

// ── New Application Modal ─────────────────────────────────────────────────────
export function openNewAppModal() {
    const statusOpts = Object.keys(STATUS_CONFIG).map(s =>
        `<option value="${s}" ${s === 'Applied' ? 'selected' : ''}>${STATUS_CONFIG[s].icon} ${s}</option>`
    ).join('');

    const pdfFiles = (distFiles || []).filter(f =>
        f.name && f.name.endsWith('.pdf') && !f.name.includes('LIVE_PREVIEW_TEMP')
    );
    const resumeOpts = `<option value="">— None (assign later) —</option>` + pdfFiles.map(f =>
        `<option value="${esc(f.name)}">${esc(f.name)}</option>`
    ).join('');

    // Build preset chips from system recipes
    const recipes = state.data?.recipes || {};
    const presetChips = Object.entries(recipes).map(([key, recipe]) => `
        <div class="preset-chip" id="preset-chip-${key}" onclick="window.selectNewAppPreset('${key}')">
            <div class="preset-chip-name">${esc(recipe.short_name || key)}</div>
            <div class="preset-chip-key">${esc(key)}</div>
        </div>
    `).join('');

    showModal('New Application', `
        <div class="modal-grid-2">
            <div class="field-group">
                <label>Company *</label>
                <input type="text" id="new-company" class="input-field" placeholder="Google, Amazon…" autofocus>
            </div>
            <div class="field-group">
                <label>Role *</label>
                <input type="text" id="new-role" class="input-field" placeholder="Software Engineer…">
            </div>
        </div>
        <div class="modal-grid-2">
            <div class="field-group">
                <label>Status</label>
                <select id="new-status" class="input-field">${statusOpts}</select>
            </div>
            <div class="field-group">
                <label>Priority</label>
                <select id="new-priority" class="input-field">
                    <option>High</option><option selected>Medium</option><option>Low</option>
                </select>
            </div>
        </div>
        <div class="modal-grid-2">
            <div class="field-group">
                <label>Location</label>
                <input type="text" id="new-location" class="input-field" placeholder="Bangalore, Remote…">
            </div>
            <div class="field-group">
                <label>Job URL</label>
                <input type="url" id="new-job-url" class="input-field" placeholder="https://…">
            </div>
        </div>
        <div class="field-group">
            <label>Assign Resume (optional)</label>
            <select id="new-resume" class="input-field">${resumeOpts}</select>
        </div>
        <div class="field-group">
            <label>Notes</label>
            <textarea id="new-notes" class="input-field textarea" rows="2" placeholder="Initial notes…"></textarea>
        </div>

        ${presetChips ? `
        <div class="field-group" style="margin-top:8px">
            <label style="display:flex;align-items:center;gap:8px">
                Start from Preset Template
                <span style="font-size:10px;color:var(--text-muted);font-weight:400">(optional — pre-fills PDF config)</span>
            </label>
            <div class="preset-chip-grid" id="new-app-preset-grid">
                ${presetChips}
            </div>
            <div id="new-app-preset-indicator" style="display:none;margin-top:6px;font-size:11px;color:var(--accent)"></div>
        </div>
        ` : ''}
    `, async () => {
        const company = document.getElementById('new-company').value.trim();
        const role    = document.getElementById('new-role').value.trim();
        if (!company || !role) { toast('Company and Role are required', 'error'); return false; }
        
        // Build payload — include preset template if one was selected
        const payload = {
            company, role,
            location:     document.getElementById('new-location').value.trim(),
            status:       document.getElementById('new-status').value,
            priority:     document.getElementById('new-priority').value,
            job_url:      document.getElementById('new-job-url').value.trim(),
            assigned_pdf: document.getElementById('new-resume').value,
            notes:        document.getElementById('new-notes').value.trim(),
        };
        
        if (window._selectedNewAppPreset) {
            const recipe = state.data?.recipes?.[window._selectedNewAppPreset];
            if (recipe) {
                payload.resume_template = JSON.parse(JSON.stringify(recipe));
            }
        }
        
        const newApp = await trackerApi.create(payload);
        toast(`Created: ${company} — ${role}`, 'success');
        window._selectedNewAppPreset = null;
        await loadTracker();
        return true;
    }, 'Create Application');
    
    // Reset preset selection each time modal opens
    window._selectedNewAppPreset = null;
}

// ── Preset Selector for New App ───────────────────────────────────────────────
window.selectNewAppPreset = (key) => {
    // Toggle selection
    if (window._selectedNewAppPreset === key) {
        window._selectedNewAppPreset = null;
    } else {
        window._selectedNewAppPreset = key;
    }
    
    // Update chip visuals
    document.querySelectorAll('.preset-chip').forEach(chip => {
        chip.classList.remove('selected');
    });
    
    const indicator = document.getElementById('new-app-preset-indicator');
    if (window._selectedNewAppPreset) {
        const chip = document.getElementById(`preset-chip-${window._selectedNewAppPreset}`);
        if (chip) chip.classList.add('selected');
        const recipe = state.data?.recipes?.[window._selectedNewAppPreset];
        if (indicator) {
            indicator.style.display = 'block';
            indicator.textContent = `✓ Using preset: "${recipe?.short_name || window._selectedNewAppPreset}"`;
        }
    } else {
        if (indicator) indicator.style.display = 'none';
    }
};

// ── Edit Application Modal (with Tabs) ─────────────────────────────────────────
export async function openAppEditor(appId) {
    const app = applications.find(a => a.id === appId);
    if (!app) return;

    const cfg = STATUS_CONFIG[app.status] || { color: '#6366f1', icon: '?' };
    const statusOptions = Object.keys(STATUS_CONFIG).map(s =>
        `<option value="${s}" ${app.status === s ? 'selected' : ''}>${STATUS_CONFIG[s].icon} ${s}</option>`
    ).join('');

    const priorityOptions = ['High', 'Medium', 'Low'].map(p =>
        `<option value="${p}" ${(app.priority || 'Medium') === p ? 'selected' : ''}>${p}</option>`
    ).join('');

    const pdfFiles = (distFiles || []).filter(f =>
        f.name && f.name.endsWith('.pdf') && !f.name.includes('LIVE_PREVIEW_TEMP')
    );
    
    // Build resume options — shared between both tabs (same data, same selection)
    const buildResumeOptions = (selectedPdf) =>
        `<option value="">— None —</option>` + pdfFiles.map(f =>
            `<option value="${esc(f.name)}" ${selectedPdf === f.name ? 'selected' : ''}>${esc(f.name)}</option>`
        ).join('');

    const templateJson = (app.resume_template && Object.keys(app.resume_template).length > 0)
        ? JSON.stringify(app.resume_template, null, 2)
        : '';

    // ── TAB 1: Application Details ─────────────────────────────────────────────
    const detailsTab = `
        <div class="field-group">
            <label>Company</label>
            <input type="text" id="edit-company" class="input-field" value="${esc(app.company)}" placeholder="Company name">
        </div>
        <div class="field-group">
            <label>Role / Position</label>
            <input type="text" id="edit-role" class="input-field" value="${esc(app.role)}" placeholder="Job role">
        </div>
        <div class="modal-grid-2">
            <div class="field-group">
                <label>Status</label>
                <select id="edit-status" class="input-field">${statusOptions}</select>
            </div>
            <div class="field-group">
                <label>Priority</label>
                <select id="edit-priority" class="input-field">${priorityOptions}</select>
            </div>
        </div>
        <div class="field-group">
            <label>Location</label>
            <input type="text" id="edit-location" class="input-field" placeholder="City / Remote…" value="${esc(app.location || '')}">
        </div>
        <div class="field-group">
            <label>Job URL</label>
            <input type="url" id="edit-job-url" class="input-field" placeholder="https://…" value="${esc(app.job_url || '')}">
        </div>
        <div class="field-group">
            <label>Notes</label>
            <textarea id="edit-notes" class="input-field textarea" rows="3" placeholder="Notes, requirements, contacts…">${esc(app.notes || '')}</textarea>
        </div>
        <div class="field-group">
            <label>Assigned Resume</label>
            <select id="edit-resume" class="input-field" onchange="window.syncResumeSelection('details', this.value)">
                ${buildResumeOptions(app.assigned_pdf)}
            </select>
        </div>
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); display: flex; gap: 6px;">
            <button class="btn btn-danger" onclick="window.deleteApp('${app.id}'); window.closeModal();">🗑 Delete</button>
        </div>
    `;

    // ── TAB 2: PDF Config/Template Editor ──────────────────────────────────────
    const defaultPdfName = app.assigned_pdf || `${app.role.replace(/\s+/g, '_')}_${app.company.replace(/\s+/g, '_')}`.toLowerCase() + '.pdf';
    const pdfConfigTab = `
        <style>
            .config-pdf-preview-wrap {
                margin-top: 10px;
                border: 1px solid var(--border);
                border-radius: var(--radius);
                overflow: hidden;
                background: #fff;
                display: none;
            }
            .config-pdf-preview-wrap.visible { display: block; }
            .config-pdf-preview-wrap iframe {
                width: 100%;
                height: 380px;
                border: none;
                display: block;
            }
            .config-pdf-preview-bar {
                background: var(--bg-card);
                border-bottom: 1px solid var(--border);
                padding: 6px 10px;
                font-size: 11px;
                color: var(--text-muted);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .template-origin-badge {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                font-size: 10px;
                padding: 3px 8px;
                border-radius: 20px;
                font-weight: 600;
            }
            .template-origin-badge.system {
                background: rgba(245,158,11,0.15);
                color: #d97706;
                border: 1px solid rgba(245,158,11,0.3);
            }
            .template-origin-badge.custom {
                background: rgba(16,185,129,0.12);
                color: #059669;
                border: 1px solid rgba(16,185,129,0.25);
            }
            .save-guard-panel {
                display: none;
                margin-top: 10px;
                background: rgba(245,158,11,0.08);
                border: 1px solid rgba(245,158,11,0.35);
                border-radius: var(--radius);
                padding: 12px;
            }
            .save-guard-panel.visible { display: block; }
            .save-guard-title {
                font-size: 12px;
                font-weight: 600;
                color: #d97706;
                margin-bottom: 8px;
            }
            .save-guard-btns { display: flex; gap: 8px; flex-wrap: wrap; }
        </style>

        <div class="form-grid-2" style="margin-bottom: 8px;">
            <div class="field-group">
                <label style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
                    <span>Resume Template</span>
                    <span id="config-origin-badge" class="template-origin-badge" style="display:none;font-size:9px"></span>
                </label>
                <select id="config-template-select" class="input-field" onchange="window.syncResumeSelection('pdf-config', this.value)" style="border-radius:6px">
                    <option value="">— Choose a template —</option>
                    ${pdfFiles.map(f => `
                        <option value="${esc(f.name)}" ${app.assigned_pdf === f.name ? 'selected' : ''}>
                            ${esc(f.name)}
                        </option>
                    `).join('')}
                </select>
            </div>
            
            <div class="field-group">
                <label>Custom PDF Name</label>
                <input type="text" id="config-pdf-name" class="input-field" style="border-radius:6px" placeholder="e.g. python_dev.pdf" value="${esc(defaultPdfName)}" oninput="window.updateDownloadName(this.value)">
            </div>
        </div>

        <details class="field-group" style="margin-bottom: 12px;">
            <summary style="font-size: 11px; font-weight: 600; color: var(--text-primary); cursor: pointer; user-select: none;">📝 Job Description (AI context)</summary>
            <div style="margin-top: 6px;">
                <textarea id="config-jd" class="input-field textarea" rows="2" placeholder="Paste job description…" style="border-radius:6px; min-height: 60px;">${esc(app.job_description || '')}</textarea>
            </div>
        </details>

        <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
            <!-- JSON Editor & Preview Layout -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;height:calc(90vh - 180px);min-height:400px">
                <!-- Left: JSON Editor -->
                <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
                        <label style="font-weight:600;font-size:12px">Resume Configuration (JSON)</label>
                        <div style="display:flex;gap:4px;flex-wrap:wrap">
                            <button class="btn btn-sm btn-secondary" id="btn-copy-for-ai"
                                style="font-size:9px;padding:3px 8px;white-space:nowrap"
                                onclick="window.copyForAI()"
                                title="Copy JSON + JD to clipboard for AI">
                                📋 Copy
                            </button>
                        </div>
                    </div>
                    <div id="config-json-mode-note" style="display:none;font-size:10px;padding:4px 8px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:6px;color:var(--accent)">
                        ✅ Full content — edit and see live preview
                    </div>
                    <div id="config-json-error" style="display:none; color: #dc2626; font-size: 10px; padding: 4px 8px; background: rgba(239,68,68,0.08); border-radius: 4px;"></div>
                    <textarea id="config-json" class="input-field textarea config-json-editor" spellcheck="false"
                        oninput="window.onConfigJsonInput(this.value)"
                        placeholder='{\n  "role_title": "...",\n  "skills": [...],\n  "projects": [...]\n}'
                        style="flex:1;border:1.5px solid var(--border);border-radius:6px">${esc(templateJson)}</textarea>
                </div>

                <!-- Right: Live PDF Preview -->
                <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
                        <label style="font-weight:600;font-size:12px">Live Preview</label>
                    </div>
                    <div style="flex:1;border:1.5px solid var(--border);border-radius:6px;overflow:hidden;background:#fff;display:flex;flex-direction:column">
                        <div style="background:var(--bg-elevated);border-bottom:1px solid var(--border);padding:6px 10px;font-size:10px;color:var(--text-muted);display:flex;justify-content:space-between;align-items:center">
                            <span id="live-preview-status">📄 PDF Preview</span>
                            <div style="display:flex; gap: 12px; align-items: center;">
                                <a id="live-preview-download" href="#" download style="color:var(--accent);font-size:9px;text-decoration:none;cursor:pointer">Download ↓</a>
                                <a id="live-preview-open" href="#" target="_blank" style="color:var(--accent);font-size:9px;text-decoration:none;cursor:pointer">Open ↗</a>
                            </div>
                        </div>
                        <iframe id="live-preview-iframe" src="" title="Live PDF Preview" style="flex:1;border:none;display:block"></iframe>
                    </div>
                </div>
            </div>

            <!-- Save Guard Panel -->
            <div id="save-guard-panel" class="save-guard-panel">
                <div class="save-guard-title">⚠️ System Preset Detected</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:10px">
                    Cannot modify system templates. Save your changes as:
                </div>
                <div class="save-guard-btns">
                    <button class="btn btn-primary" onclick="window.saveConfigToApp('${app.id}')" style="flex:1">💾 App-Only Copy</button>
                    <button class="btn btn-secondary" onclick="window.saveConfigAsNewPreset('${app.id}')" style="flex:1">✨ New Preset</button>
                </div>
            </div>

            <!-- Action Buttons -->
            <div style="display:flex;gap:6px;justify-content:space-between;align-items:center;flex-wrap:wrap;padding-top:8px;border-top:1px solid var(--border)">
                <button class="btn btn-secondary" onclick="window.validateConfigJson()" style="font-size:11px">✓ Validate</button>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <button class="btn btn-ghost" onclick="window.loadTemplateConfig()" style="font-size:11px">↻ Reload</button>
                    <button class="btn btn-primary" onclick="window.handleConfigSave('${app.id}')" style="font-size:11px">💾 Save</button>
                </div>
            </div>
        </div>
    `;

    showModal(`${app.company} · ${app.role}`, '', async () => {
        const updates = {
            company: document.getElementById('edit-company').value.trim(),
            role: document.getElementById('edit-role').value.trim(),
            status: document.getElementById('edit-status').value,
            priority: document.getElementById('edit-priority').value,
            location: document.getElementById('edit-location').value.trim(),
            job_url: document.getElementById('edit-job-url').value.trim(),
            notes: document.getElementById('edit-notes').value.trim(),
            assigned_pdf: document.getElementById('edit-resume').value,
            job_description: document.getElementById('config-jd')?.value?.trim() || '',
        };
        
        if (!updates.company || !updates.role) {
            toast('Company and Role are required', 'error');
            return false;
        }

        const confirmBtn = document.getElementById('modal-confirm-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = '⏳ Saving & Generating...';
        }

        try {
            setSaveIndicator('saving');
            await trackerApi.update(appId, updates);
            Object.assign(app, updates);
            
            // Check if there is valid JSON in the editor to compile, and either it was edited OR the name was changed
            const jsonText = document.getElementById('config-json')?.value?.trim();
            
            let currentPdfName = document.getElementById('config-pdf-name')?.value?.trim() || '';
            if (currentPdfName && !currentPdfName.endsWith('.pdf')) currentPdfName += '.pdf';
            const originalPdfName = app.assigned_pdf || '';
            const pdfNameChanged = currentPdfName && currentPdfName !== originalPdfName;

            if ((window._configIsDirty || pdfNameChanged) && jsonText && window.validateConfigJson(false)) { 
                const config = JSON.parse(jsonText);
                let pdfName = document.getElementById('config-pdf-name')?.value?.trim();
                if (!pdfName) {
                    pdfName = `${updates.role.replace(/\s+/g, '_')}_${updates.company.replace(/\s+/g, '_')}`.toLowerCase();
                }
                if (!pdfName.endsWith('.pdf')) pdfName += '.pdf';
                
                const response = await fetch(`/applications/${appId}/compile-pdf`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        config: config,
                        pdf_name: pdfName
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.pdf_name) {
                        updates.assigned_pdf = result.pdf_name;
                        app.assigned_pdf = result.pdf_name;
                        const detailsSel = document.getElementById('edit-resume');
                        const configSel = document.getElementById('config-template-select');
                        if (detailsSel) detailsSel.value = result.pdf_name;
                        if (configSel) configSel.value = result.pdf_name;
                        refreshConfigPdfPreview(result.pdf_name);
                    }
                    toast(`✅ Saved and PDF generated as: ${pdfName}.pdf`, 'success');
                } else {
                    const err = await response.json();
                    toast(`❌ App details saved, but PDF compilation failed: ${err.detail || ''}`, 'error');
                }
            } else {
                toast('Application updated', 'success');
            }
            
            setSaveIndicator('saved');
            await loadTracker();
            
        } catch (e) {
            toast(`Error: ${e.message}`, 'error');
        } finally {
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Save Changes';
            }
        }
        
        // Return false to prevent the modal from closing automatically
        return false;
    }, 'Save Changes', {
        tabs: [
            { icon: '📋', label: 'Details', content: detailsTab },
            { icon: '📄', label: 'PDF Config', content: pdfConfigTab }
        ]
    });
    
    // Store app reference for config operations
    window._currentEditingApp = app;
    _loadedFromSystemTemplate = null;
    
    // Init: if app already has an assigned PDF, seed the config tab immediately
    if (app.assigned_pdf) {
        setTimeout(() => {
            const configSel = document.getElementById('config-template-select');
            if (configSel) configSel.value = app.assigned_pdf;
            refreshConfigPdfPreview(app.assigned_pdf);
            window.loadTemplateConfig(app.assigned_pdf);
        }, 80);
    } else if (app.resume_template && Object.keys(app.resume_template).length > 0) {
        setTimeout(() => {
            const expanded = resolveFullContent(app.resume_template);
            document.getElementById('config-json').value = JSON.stringify(expanded, null, 2);
            showExpandedJsonNote();
            updateOriginBadge(null);
        }, 80);
    }
}

// ── Bidirectional Resume Sync ─────────────────────────────────────────────────
window.syncResumeSelection = (source, value) => {
    if (source === 'details') {
        // Details tab changed → update PDF Config tab
        const configSel = document.getElementById('config-template-select');
        if (configSel) configSel.value = value;
        if (value) {
            window.loadTemplateConfig(value);
        } else {
            refreshConfigPdfPreview(null);
        }
    } else if (source === 'pdf-config') {
        // PDF Config tab changed → update Details tab
        const detailsSel = document.getElementById('edit-resume');
        if (detailsSel) detailsSel.value = value;
        if (value) {
            window.loadTemplateConfig(value);
        } else {
            refreshConfigPdfPreview(null);
        }
    }
};

// ── Live PDF Preview ──────────────────────────────────────────────────────────
function refreshConfigPdfPreview(filename) {
    const liveIframe = document.getElementById('live-preview-iframe');
    const liveStatus = document.getElementById('live-preview-status');
    const openLink = document.getElementById('live-preview-open');
    const downloadLink = document.getElementById('live-preview-download');
    
    if (!liveIframe) return;
    
    if (!filename) {
        liveIframe.src = '';
        if (liveStatus) liveStatus.textContent = '📄 Select a template';
        return;
    }
    
    const url = `/pdf/${encodeURIComponent(filename)}`;
    liveIframe.src = url + '#toolbar=0&view=FitH';
    if (liveStatus) liveStatus.textContent = '📄 PDF Preview';
    if (openLink) openLink.href = url;
    if (downloadLink) {
        downloadLink.href = url;
        let pdfName = document.getElementById('config-pdf-name')?.value?.trim() || filename;
        if (pdfName && !pdfName.endsWith('.pdf')) pdfName += '.pdf';
        downloadLink.download = pdfName;
    }
}

// ── Origin Badge ─────────────────────────────────────────────────────────────
function updateOriginBadge(recipeKey) {
    const badge = document.getElementById('config-origin-badge');
    if (!badge) return;
    
    if (recipeKey) {
        badge.style.display = 'inline-flex';
        badge.className = 'template-origin-badge system';
        badge.textContent = `📦 System: ${recipeKey}`;
    } else {
        badge.style.display = 'inline-flex';
        badge.className = 'template-origin-badge custom';
        badge.textContent = '✏️ Custom Config';
    }
}

// ── Delete Application ────────────────────────────────────────────────────────
export async function deleteApp(appId) {
    const app = applications.find(a => a.id === appId);
    if (!app || !confirm(`Delete application: ${app.company} - ${app.role}?\n\nThis cannot be undone.`)) return;
    
    setSaveIndicator('saving');
    await trackerApi.delete(appId);
    setSaveIndicator('saved');
    toast('Application deleted', 'success');
    applications = applications.filter(a => a.id !== appId);
    renderGrid();
}

// ── PDF Config Helpers ────────────────────────────────────────────────────────

// Called when JSON textarea changes
window.onConfigJsonInput = (val) => {
    const errorDiv = document.getElementById('config-json-error');
    try {
        JSON.parse(val);
        if (errorDiv) errorDiv.style.display = 'none';
    } catch (e) {
        if (errorDiv) {
            errorDiv.textContent = `JSON Error: ${e.message}`;
            errorDiv.style.display = 'block';
        }
        return; // Don't generate preview if JSON is invalid
    }
    // If it was from a system template, mark as dirty
    window._configIsDirty = true;
    if (_loadedFromSystemTemplate) {
        updateOriginBadge(_loadedFromSystemTemplate);
    }
    // Generate live preview with debounce
    window._generateLivePreview();
};

// Debounced live preview generator
window._previewDebounceTimer = null;
window._generateLivePreview = () => {
    clearTimeout(window._previewDebounceTimer);
    const statusEl = document.getElementById('live-preview-status');
    if (statusEl) statusEl.textContent = '⏳ Generating...';
    
    window._previewDebounceTimer = setTimeout(async () => {
        try {
            const jsonText = document.getElementById('config-json').value.trim();
            if (!jsonText) return;
            
            const config = JSON.parse(jsonText);
            const app = window._currentEditingApp;
            const pdfName = document.getElementById('config-template-select')?.value;
            
            if (!app || !pdfName) {
                if (statusEl) statusEl.textContent = '📄 Select a template';
                return;
            }
            
            // Call backend preview endpoint
            const response = await fetch(`/api/preview-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_id: app.id,
                    config: config,
                    pdf_name: pdfName
                })
            });
            
            if (!response.ok) throw new Error('Preview generation failed');
            
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const iframe = document.getElementById('live-preview-iframe');
            if (iframe) {
                iframe.src = blobUrl;
                const openLink = document.getElementById('live-preview-open');
                if (openLink) openLink.href = blobUrl;
                const downloadLink = document.getElementById('live-preview-download');
                if (downloadLink) {
                    downloadLink.href = blobUrl;
                    let pdfName = document.getElementById('config-pdf-name')?.value?.trim();
                    if (pdfName && !pdfName.endsWith('.pdf')) pdfName += '.pdf';
                    downloadLink.download = pdfName || 'preview.pdf';
                }
            }
            if (statusEl) statusEl.textContent = '✅ PDF Preview';
        } catch (err) {
            console.error('Preview error:', err);
            if (statusEl) statusEl.textContent = '⚠️ Preview failed';
        }
    }, 800); // 800ms debounce
};

window.updateDownloadName = (val) => {
    const downloadLink = document.getElementById('live-preview-download');
    if (downloadLink) {
        let name = (val || '').trim();
        if (name && !name.endsWith('.pdf')) name += '.pdf';
        downloadLink.download = name || 'preview.pdf';
    }
};

window.loadTemplateConfig = async (overridePdf) => {
    window._configIsDirty = false;
    const templateSelect = document.getElementById('config-template-select');
    const selectedPdf = overridePdf || (templateSelect && templateSelect.value);
    if (!selectedPdf) return;
    
    // Update iframe preview
    refreshConfigPdfPreview(selectedPdf);
    
    // Try to find a matching system recipe from the PDF filename
    const recipes = state.data?.recipes || {};
    const baseName = selectedPdf.replace(/\.pdf$/i, '');
    const parts = baseName.split('_');
    
    let matchingRecipeKey = null;
    const findRecipe = (key) => {
        const lowerKey = key.toLowerCase();
        if (recipes[key]) return key;
        if (recipes[lowerKey]) return lowerKey;
        for (const rKey of Object.keys(recipes)) {
            const recipe = recipes[rKey];
            if (recipe?.short_name?.toLowerCase() === lowerKey) return rKey;
        }
        return null;
    };
    
    for (let i = parts.length - 1; i >= 0; i--) {
        const potentialKey = parts.slice(i).join('_');
        const found = findRecipe(potentialKey);
        if (found) {
            matchingRecipeKey = found;
            break;
        }
    }
    
    const app = window._currentEditingApp;

    // If we're loading the app's own assigned resume and it already has a custom template, preserve that first.
    if (app?.assigned_pdf === selectedPdf && app?.resume_template && Object.keys(app.resume_template).length > 0) {
        const expanded = resolveFullContent(app.resume_template);
        document.getElementById('config-json').value = JSON.stringify(expanded, null, 2);
        showExpandedJsonNote();
        _loadedFromSystemTemplate = null;
        updateOriginBadge(null);
        return;
    }

    if (matchingRecipeKey) {
        const recipe = recipes[matchingRecipeKey];
        if (recipe) {
            const expanded = resolveFullContent(recipe);
            document.getElementById('config-json').value = JSON.stringify(expanded, null, 2);
            showExpandedJsonNote();
            _loadedFromSystemTemplate = matchingRecipeKey;
            updateOriginBadge(matchingRecipeKey);
            toast(`Loaded system template: ${matchingRecipeKey}`, 'info');
            return;
        }
    }

    // No system recipe matched — show the app's own config if available
    if (app?.resume_template && Object.keys(app.resume_template).length > 0) {
        const expanded = resolveFullContent(app.resume_template);
        document.getElementById('config-json').value = JSON.stringify(expanded, null, 2);
            showExpandedJsonNote();
    }
    _loadedFromSystemTemplate = null;
    updateOriginBadge(null);
};

// ── Expand to Full Content (AI-ready) ─────────────────────────────────────────
function showExpandedJsonNote() {
    const modeNote = document.getElementById('config-json-mode-note');
    if (modeNote) {
        modeNote.style.display = 'block';
    }
}

// ── Copy for AI (JSON + JD context prompt) ────────────────────────────────────
window.copyForAI = async () => {
    const textarea = document.getElementById('config-json');
    const jdTextarea = document.getElementById('config-jd');
    if (!textarea) return;

    const jsonContent = textarea.value.trim();
    if (!jsonContent) {
        toast('Nothing to copy — expand or paste a config first', 'error');
        return;
    }

    const jd = jdTextarea?.value?.trim() || '';
    const app = window._currentEditingApp;
    const appContext = app ? `Company: ${app.company}\nRole: ${app.role}` : '';

    let prompt = `You are a resume editing assistant. I will give you my current resume content as JSON and a job description. Please tailor the resume content to match the job description — adjust bullet points, rephrase descriptions, reorder skills by relevance, and improve phrasing. Return ONLY valid JSON in the exact same format, with no extra explanation.\n\n`;

    if (appContext) prompt += `--- Target Job ---\n${appContext}\n\n`;
    if (jd) prompt += `--- Job Description ---\n${jd}\n\n`;

    prompt += `--- Resume JSON (edit this) ---\n${jsonContent}`;

    try {
        await navigator.clipboard.writeText(prompt);
        toast('📋 Copied! Paste into ChatGPT / Gemini / Claude, then paste the response back here', 'success', 5000);
    } catch (e) {
        // Fallback: select all text in textarea
        textarea.select();
        toast('Clipboard blocked — text selected, press Ctrl+C', 'info', 4000);
    }
};

window.validateConfigJson = (showToast = true) => {
    const jsonText = document.getElementById('config-json').value.trim();
    const errorDiv = document.getElementById('config-json-error');
    
    if (!jsonText) {
        if (errorDiv) { errorDiv.textContent = 'JSON is empty'; errorDiv.style.display = 'block'; }
        return false;
    }
    
    try {
        JSON.parse(jsonText);
        if (errorDiv) errorDiv.style.display = 'none';
        if (showToast) toast('✓ JSON is valid', 'success');
        return true;
    } catch (e) {
        if (errorDiv) { errorDiv.textContent = `JSON Error: ${e.message}`; errorDiv.style.display = 'block'; }
        if (showToast) toast('Invalid JSON syntax', 'error');
        return false;
    }
};

// ── Save Guard — dispatch based on origin ─────────────────────────────────────
window.handleConfigSave = (appId) => {
    if (!window.validateConfigJson()) return;
    
    if (_loadedFromSystemTemplate) {
        // Show the save guard panel instead of saving immediately
        const panel = document.getElementById('save-guard-panel');
        if (panel) {
            panel.classList.add('visible');
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    } else {
        window.saveConfigToApp(appId);
    }
};

// Save ONLY to the current application — never touches system recipes
window.saveConfigToApp = async (appId) => {
    const jsonText = document.getElementById('config-json').value.trim();
    if (!window.validateConfigJson()) return;
    
    try {
        const config = JSON.parse(jsonText);
        
        const app = applications.find(a => a.id === appId);
        let pdfName = document.getElementById('config-pdf-name')?.value?.trim();
        if (!pdfName) {
            pdfName = app ? `${app.role.replace(/\s+/g, '_')}_${app.company.replace(/\s+/g, '_')}`.toLowerCase() : 'custom_resume';
        }
        if (!pdfName.endsWith('.pdf')) pdfName += '.pdf';
        
        setSaveIndicator('saving');
        
        const response = await fetch(`/applications/${appId}/compile-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                config: config,
                pdf_name: pdfName
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'PDF compilation failed');
        }
        
        const result = await response.json();
        setSaveIndicator('saved');
        toast(`Configuration saved and PDF generated as ${pdfName}.pdf`, 'success');
        
        if (app) {
            app.resume_template = config;
            app.assigned_pdf = result.pdf_name || app.assigned_pdf;
        }
        
        const previewSelect = document.getElementById('config-template-select');
        if (previewSelect && app?.assigned_pdf) {
            previewSelect.value = app.assigned_pdf;
            refreshConfigPdfPreview(app.assigned_pdf);
        }
        
        // Hide guard panel
        const panel = document.getElementById('save-guard-panel');
        if (panel) panel.classList.remove('visible');
        
        // Clear system origin — now it's a custom config
        _loadedFromSystemTemplate = null;
        updateOriginBadge(null);
        
    } catch (e) {
        toast(`Error saving config: ${e.message}`, 'error');
        setSaveIndicator('saved');
    }
};

// Save as a NEW preset in state.data.recipes (then sync to server) — NEVER overwrites existing
window.saveConfigAsNewPreset = async (appId) => {
    const jsonText = document.getElementById('config-json').value.trim();
    if (!window.validateConfigJson()) return;
    
    const appObj = applications.find(a => a.id === appId);
    const suggestedName = appObj
        ? `${appObj.company.replace(/\s+/g, '_')}_${appObj.role.replace(/\s+/g, '_')}`.toLowerCase()
        : 'new_preset';
    
    const newKey = prompt(
        `Enter a unique key for this new preset:\n(e.g. ${suggestedName})`,
        suggestedName
    );
    if (!newKey || !newKey.trim()) return;
    
    const key = newKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (state.data.recipes[key]) {
        toast(`Preset key "${key}" already exists. Choose a different name.`, 'error');
        return;
    }
    
    try {
        const config = JSON.parse(jsonText);
        
        // Add new recipe to state (not modifying existing)
        state.data.recipes[key] = {
            ...config,
            short_name: config.short_name || newKey.trim(),
        };
        
        // Save full config to server
        const ok = await api.saveConfig(state.data);
        if (!ok) { toast('Failed to save preset to server', 'error'); return; }
        
        // Also save to this app and generate PDF
        setSaveIndicator('saving');
        const pdfName = appObj ? `${appObj.role.replace(/\s+/g, '_')}_${appObj.company.replace(/\s+/g, '_')}`.toLowerCase() : 'custom_resume';
        
        const response = await fetch(`/applications/${appId}/compile-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                config: config,
                pdf_name: pdfName
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'PDF compilation failed');
        }
        
        const result = await response.json();
        setSaveIndicator('saved');
        
        if (appObj) {
            appObj.resume_template = config;
            appObj.assigned_pdf = result.pdf_name || appObj.assigned_pdf;
        }
        
        const previewSelect = document.getElementById('config-template-select');
        if (previewSelect && appObj?.assigned_pdf) {
            previewSelect.value = appObj.assigned_pdf;
            refreshConfigPdfPreview(appObj.assigned_pdf);
        }
        
        state.notify();
        
        toast(`New preset "${key}" saved and PDF generated!`, 'success');
        
        // Hide guard panel
        const panel = document.getElementById('save-guard-panel');
        if (panel) panel.classList.remove('visible');
        
        _loadedFromSystemTemplate = null;
        updateOriginBadge(null);
        
    } catch (e) {
        toast(`Error: ${e.message}`, 'error');
    }
};


// ── Keep legacy alias for backward compatibility ───────────────────────────────
window.saveConfigTemplate = (appId) => window.handleConfigSave(appId);

// ── on Details resume change (legacy) ─────────────────────────────────────────
window.onResumeChange = () => {
    const val = document.getElementById('edit-resume')?.value || '';
    window.syncResumeSelection('details', val);
};

// ── Search ────────────────────────────────────────────────────────────────────
export function setupSearch() {
    const searchEl = document.getElementById('app-search');
    if (!searchEl) return;
    
    searchEl.addEventListener('input', (e) => {
        filterSearch = e.target.value;
        renderGrid();
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────
export function initTracker(resumeState) {
    window._resumeState = resumeState;

    window.closeModal = closeModal;
    window.openNewAppModal = openNewAppModal;
    window.openAppEditor = openAppEditor;
    window.deleteApp = deleteApp;
    
    setupSearch();
}
