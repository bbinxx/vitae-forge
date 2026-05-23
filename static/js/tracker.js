/**
 * tracker.js — Application Tracker Module
 * Manages job application tracking, resume assignments, and pipeline view.
 */

import { api } from './api.js';

// ── State ────────────────────────────────────────────────────────────────────
let applications = [];
let currentAppId = null;
let filterStatus = 'all';
let filterSearch = '';
let resumes = []; // Available PDF files

const STATUS_CONFIG = {
    'Bookmarked':  { color: '#6366f1', bg: 'rgba(99,102,241,0.15)',  icon: '🔖' },
    'Applied':     { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  icon: '📤' },
    'Screening':   { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  icon: '🔍' },
    'Interview':   { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  icon: '🗣️' },
    'Offer':       { color: '#10b981', bg: 'rgba(16,185,129,0.15)',  icon: '🎉' },
    'Rejected':    { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   icon: '✗'  },
    'Withdrawn':   { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', icon: '↩️' },
};

// ── API Helpers ───────────────────────────────────────────────────────────────
const trackerApi = {
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
    async addTimeline(id, event) {
        const res = await fetch(`/applications/${id}/timeline`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });
        return await res.json();
    },
    async getStats() {
        const res = await fetch('/applications/stats/summary');
        return await res.json();
    },
    async buildForApp(appId, role, onLine) {
        const res = await fetch(`/applications/${appId}/build/${role}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            onLine(decoder.decode(value));
        }
    }
};

// ── Render Functions ──────────────────────────────────────────────────────────

function statusBadge(status) {
    const cfg = STATUS_CONFIG[status] || { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', icon: '?' };
    return `<span class="status-badge" style="color:${cfg.color};background:${cfg.bg};border-color:${cfg.color}30">${cfg.icon} ${status}</span>`;
}

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateRelative(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff}d ago`;
    return formatDate(iso);
}

export async function loadTracker() {
    [applications, resumes] = await Promise.all([
        trackerApi.list(),
        fetch('/list-files').then(r => r.json()).catch(() => [])
    ]);
    renderStats();
    renderList();
    if (currentAppId) {
        const app = applications.find(a => a.id === currentAppId);
        if (app) renderDetail(app);
    } else {
        document.getElementById('app-detail-panel').innerHTML = renderEmptyDetail();
    }
}

function renderStats() {
    const stats = {};
    for (const s of Object.keys(STATUS_CONFIG)) stats[s] = 0;
    for (const a of applications) {
        const s = a.status || 'Bookmarked';
        if (s in stats) stats[s]++;
    }

    const container = document.getElementById('tracker-stats-bar');
    if (!container) return;

    container.innerHTML = `
        <div class="stat-item stat-total">
            <span class="stat-num">${applications.length}</span>
            <span class="stat-label">Total</span>
        </div>
        ${Object.entries(STATUS_CONFIG).map(([s, cfg]) => `
        <div class="stat-item" style="--accent:${cfg.color}" onclick="window.filterByStatus('${s}')" title="Filter: ${s}">
            <span class="stat-num" style="color:${cfg.color}">${stats[s]}</span>
            <span class="stat-label">${cfg.icon} ${s}</span>
        </div>
        `).join('')}
    `;
}

function renderList() {
    const list = document.getElementById('app-list');
    if (!list) return;

    let filtered = applications;
    if (filterStatus !== 'all') {
        filtered = filtered.filter(a => a.status === filterStatus);
    }
    if (filterSearch) {
        const q = filterSearch.toLowerCase();
        filtered = filtered.filter(a =>
            a.company?.toLowerCase().includes(q) ||
            a.role?.toLowerCase().includes(q) ||
            a.location?.toLowerCase().includes(q)
        );
    }

    // Sort by updated_at desc
    filtered = [...filtered].sort((a, b) =>
        new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
    );

    if (filtered.length === 0) {
        list.innerHTML = `<div class="app-empty-list">No applications found. <button class="link-btn" onclick="window.openNewAppModal()">Add one →</button></div>`;
        return;
    }

    list.innerHTML = filtered.map(app => {
        const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG['Bookmarked'];
        const isActive = app.id === currentAppId;
        return `
        <div class="app-list-item ${isActive ? 'active' : ''}" onclick="window.openAppDetail('${app.id}')"
             style="${isActive ? `border-left-color:${cfg.color}` : ''}">
            <div class="app-list-header">
                <span class="app-company">${escHtml(app.company)}</span>
                ${statusBadge(app.status)}
            </div>
            <div class="app-role">${escHtml(app.role)}</div>
            <div class="app-meta">
                ${app.location ? `<span>📍 ${escHtml(app.location)}</span>` : ''}
                ${app.assigned_pdf ? `<span class="resume-chip">📄 ${escHtml(app.assigned_pdf)}</span>` : '<span class="resume-chip unassigned">📄 No resume</span>'}
                <span class="app-date">${formatDateRelative(app.updated_at)}</span>
            </div>
        </div>`;
    }).join('');
}

function renderEmptyDetail() {
    return `
    <div class="detail-empty">
        <div class="detail-empty-icon">📋</div>
        <p>Select an application to view details</p>
        <button class="btn btn-primary" onclick="window.openNewAppModal()">+ New Application</button>
    </div>`;
}

function renderDetail(app) {
    currentAppId = app.id;
    renderList(); // refresh active state

    const cfg = STATUS_CONFIG[app.status] || { color: '#6366f1' };
    const panel = document.getElementById('app-detail-panel');
    const pdfFiles = resumes.filter(r => !r.name.includes('LIVE_PREVIEW_TEMP')).map(r => r.name);

    const statusOptions = Object.keys(STATUS_CONFIG).map(s =>
        `<option value="${s}" ${app.status === s ? 'selected' : ''}>${s}</option>`
    ).join('');

    const resumeOptions = pdfFiles.map(f =>
        `<option value="${f}" ${app.assigned_pdf === f ? 'selected' : ''}>${f}</option>`
    ).join('');

    const timelineHtml = (app.timeline || []).slice().reverse().map(e => {
        const ecfg = STATUS_CONFIG[e.status] || { color: '#6b7280', icon: '•' };
        return `
        <div class="timeline-entry">
            <div class="timeline-dot" style="background:${ecfg.color}"></div>
            <div class="timeline-body">
                <div class="timeline-status" style="color:${ecfg.color}">${ecfg.icon || ''} ${escHtml(e.status)}</div>
                <div class="timeline-note">${escHtml(e.note || '')}</div>
                <div class="timeline-date">${formatDate(e.date)}</div>
            </div>
        </div>`;
    }).join('') || '<div class="timeline-empty">No timeline events yet</div>';

    panel.innerHTML = `
    <div class="detail-header" style="border-bottom-color:${cfg.color}30">
        <div class="detail-header-left">
            <div class="detail-company">${escHtml(app.company)}</div>
            <div class="detail-role">${escHtml(app.role)}</div>
            <div class="detail-submeta">
                ${app.location ? `<span>📍 ${escHtml(app.location)}</span>` : ''}
                ${app.deadline ? `<span>⏰ Deadline: ${formatDate(app.deadline)}</span>` : ''}
                ${app.salary_range ? `<span>💰 ${escHtml(app.salary_range)}</span>` : ''}
                <span class="detail-created">Created ${formatDate(app.created_at)}</span>
            </div>
        </div>
        <div class="detail-header-actions">
            ${app.job_url ? `<a href="${escHtml(app.job_url)}" target="_blank" class="btn btn-sm btn-outline">🔗 Job Posting</a>` : ''}
            <button class="btn btn-sm btn-danger" onclick="window.deleteApp('${app.id}')">🗑 Delete</button>
        </div>
    </div>

    <div class="detail-body">
        <div class="detail-left">
            <!-- Status + Resume Assignment -->
            <div class="detail-section">
                <div class="section-label">Status</div>
                <select class="input-field" onchange="window.updateAppField('${app.id}', 'status', this.value)">
                    ${statusOptions}
                </select>
            </div>

            <div class="detail-section">
                <div class="section-label">Assigned Resume PDF</div>
                <select class="input-field" onchange="window.updateAppField('${app.id}', 'assigned_pdf', this.value)">
                    <option value="">— None —</option>
                    ${resumeOptions}
                </select>
                <div class="resume-actions">
                ${app.assigned_pdf ? `<button class="btn btn-sm btn-outline" onclick="window.previewAssignedResume('${app.assigned_pdf}')">👁 Preview</button>` : ''}
                ${app.archived_pdf ? `<a class="btn btn-sm btn-success" href="/applications/${app.id}/archived-resume" target="_blank" download>⬇ Download Archived</a>` : ''}
                <button class="btn btn-sm btn-secondary" onclick="window.openBuildForAppModal('${app.id}')">⚙ Build &amp; Assign</button>
                <button class="btn btn-sm btn-secondary" onclick="window.openCustomizeModal('${app.id}')">✏ Customize &amp; Build</button>
            </div>
            </div>

            <div class="detail-section">
                <div class="section-label">Contact</div>
                <input type="text" class="input-field mb-1" placeholder="Contact Name" value="${escHtml(app.contact_name || '')}"
                    onchange="window.updateAppField('${app.id}', 'contact_name', this.value)">
                <input type="email" class="input-field" placeholder="Contact Email" value="${escHtml(app.contact_email || '')}"
                    onchange="window.updateAppField('${app.id}', 'contact_email', this.value)">
            </div>

            <div class="detail-section">
                <div class="section-label">Notes</div>
                <textarea class="input-field textarea" rows="5" placeholder="Add notes, requirements, links..."
                    onchange="window.updateAppField('${app.id}', 'notes', this.value)">${escHtml(app.notes || '')}</textarea>
            </div>

            <div class="detail-section">
                <div class="section-label">Job Posting URL</div>
                <input type="url" class="input-field" placeholder="https://..." value="${escHtml(app.job_url || '')}"
                    onchange="window.updateAppField('${app.id}', 'job_url', this.value)">
            </div>

            <div class="detail-section detail-section-row">
                <div class="flex-1">
                    <div class="section-label">Deadline</div>
                    <input type="date" class="input-field" value="${app.deadline || ''}"
                        onchange="window.updateAppField('${app.id}', 'deadline', this.value)">
                </div>
                <div class="flex-1">
                    <div class="section-label">Salary Range</div>
                    <input type="text" class="input-field" placeholder="e.g. ₹8-12 LPA" value="${escHtml(app.salary_range || '')}"
                        onchange="window.updateAppField('${app.id}', 'salary_range', this.value)">
                </div>
            </div>
        </div>

        <div class="detail-right">
            <!-- Timeline -->
            <div class="timeline-panel">
                <div class="timeline-header">
                    <span>Activity Timeline</span>
                    <button class="btn btn-sm btn-outline" onclick="window.openAddTimelineModal('${app.id}')">+ Event</button>
                </div>
                <div class="timeline-list">${timelineHtml}</div>
            </div>
        </div>
    </div>`;
}

// ── Modal: New Application ────────────────────────────────────────────────────

function openNewAppModal() {
    const statusOptions = Object.keys(STATUS_CONFIG).map(s =>
        `<option value="${s}" ${s === 'Applied' ? 'selected' : ''}>${s}</option>`
    ).join('');

    showModal('New Application', `
        <div class="modal-grid-2">
            <div class="field-group">
                <label>Company *</label>
                <input type="text" id="new-company" class="input-field" placeholder="Google, Amazon...">
            </div>
            <div class="field-group">
                <label>Role *</label>
                <input type="text" id="new-role" class="input-field" placeholder="Software Engineer...">
            </div>
        </div>
        <div class="modal-grid-2">
            <div class="field-group">
                <label>Location</label>
                <input type="text" id="new-location" class="input-field" placeholder="Bangalore, Remote...">
            </div>
            <div class="field-group">
                <label>Status</label>
                <select id="new-status" class="input-field">${statusOptions}</select>
            </div>
        </div>
        <div class="field-group">
            <label>Job URL</label>
            <input type="url" id="new-job-url" class="input-field" placeholder="https://...">
        </div>
        <div class="modal-grid-2">
            <div class="field-group">
                <label>Deadline</label>
                <input type="date" id="new-deadline" class="input-field">
            </div>
            <div class="field-group">
                <label>Salary Range</label>
                <input type="text" id="new-salary" class="input-field" placeholder="₹8-12 LPA">
            </div>
        </div>
        <div class="field-group">
            <label>Notes</label>
            <textarea id="new-notes" class="input-field textarea" rows="3" placeholder="Initial notes..."></textarea>
        </div>
    `, async () => {
        const company = document.getElementById('new-company').value.trim();
        const role = document.getElementById('new-role').value.trim();
        if (!company || !role) { alert('Company and Role are required'); return false; }
        const app = await trackerApi.create({
            company, role,
            location: document.getElementById('new-location').value.trim(),
            status: document.getElementById('new-status').value,
            job_url: document.getElementById('new-job-url').value.trim(),
            deadline: document.getElementById('new-deadline').value,
            salary_range: document.getElementById('new-salary').value.trim(),
            notes: document.getElementById('new-notes').value.trim(),
        });
        await loadTracker();
        renderDetail(app);
        return true;
    }, 'Create');
}

// ── Modal: Build & Assign ─────────────────────────────────────────────────────

function openBuildForAppModal(appId) {
    // Get available recipes from window.state if available
    let recipeOptions = '';
    try {
        const recipes = Object.keys(window._resumeState?.data?.recipes || {});
        recipeOptions = recipes.map(r => `<option value="${r}">${r}</option>`).join('');
    } catch(e) {
        recipeOptions = `<option value="standard">standard</option><option value="backend">backend</option>`;
    }

    showModal('Build & Assign Resume', `
        <p class="modal-desc">Build a resume from a recipe and automatically assign it to this application.</p>
        <div class="field-group">
            <label>Resume Recipe</label>
            <select id="build-recipe" class="input-field">${recipeOptions}</select>
        </div>
        <div id="build-log" class="log-box" style="display:none"></div>
    `, async () => {
        const role = document.getElementById('build-recipe').value;
        const logEl = document.getElementById('build-log');
        logEl.style.display = 'block';
        logEl.textContent = 'Building...\n';
        await trackerApi.buildForApp(appId, role, line => {
            logEl.textContent += line;
            logEl.scrollTop = logEl.scrollHeight;
        });
        await loadTracker();
        const app = applications.find(a => a.id === appId);
        if (app) renderDetail(app);
        return true;
    }, 'Build & Assign');
}

// ── Modal: Customize Resume ───────────────────────────────────────────────────

function openCustomizeModal(appId) {
    let recipeOptions = '';
    try {
        const recipes = Object.keys(window._resumeState?.data?.recipes || {});
        recipeOptions = recipes.map(r => `<option value="${r}">${r}</option>`).join('');
    } catch(e) {
        recipeOptions = `<option value="standard">standard</option><option value="backend">backend</option>`;
    }

    showModal('Customize & Build Resume', `
        <p class="modal-desc">Create a custom snapshot resume for this specific application by tweaking the base recipe. The snapshot is saved as a new recipe and then built.</p>
        <div class="modal-grid-2">
            <div class="field-group">
                <label>Base Recipe</label>
                <select id="cust-base" class="input-field">${recipeOptions}</select>
            </div>
            <div class="field-group">
                <label>Snapshot Name</label>
                <input type="text" id="cust-name" class="input-field" placeholder="google_swe" maxlength="30">
            </div>
        </div>
        <div class="field-group">
            <label>Custom Role Title (optional override)</label>
            <input type="text" id="cust-role-title" class="input-field" placeholder="Leave blank to keep base">
        </div>
        <div class="field-group">
            <label>Custom Summary Override (optional)</label>
            <input type="text" id="cust-summary" class="input-field" placeholder="Library key, e.g. sd, bc, mob, sys">
        </div>
        <div id="cust-log" class="log-box" style="display:none"></div>
    `, async () => {
        const baseName = document.getElementById('cust-base').value;
        const snapName = document.getElementById('cust-name').value.trim();
        if (!snapName) { alert('Snapshot name is required'); return false; }

        const customizations = {};
        const roleTitle = document.getElementById('cust-role-title').value.trim();
        const summary = document.getElementById('cust-summary').value.trim();
        if (roleTitle) customizations.role_title = roleTitle;
        if (summary) customizations.professional_summary = summary;

        // Create snapshot
        const snapRes = await fetch('/snapshot-resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base_recipe: baseName, customizations, snapshot_name: snapName })
        }).then(r => r.json());

        if (!snapRes.ok) { alert('Failed to create snapshot: ' + snapRes.detail); return false; }

        // Build the snapshot
        const logEl = document.getElementById('cust-log');
        logEl.style.display = 'block';
        logEl.textContent = `Snapshot created: ${snapRes.recipe_key}\nBuilding...\n`;

        await trackerApi.buildForApp(appId, snapRes.recipe_key, line => {
            logEl.textContent += line;
            logEl.scrollTop = logEl.scrollHeight;
        });

        await loadTracker();
        const app = applications.find(a => a.id === appId);
        if (app) renderDetail(app);
        return true;
    }, 'Create Snapshot & Build');
}

// ── Modal: Add Timeline Event ─────────────────────────────────────────────────

function openAddTimelineModal(appId) {
    const app = applications.find(a => a.id === appId);
    const statusOptions = Object.keys(STATUS_CONFIG).map(s =>
        `<option value="${s}" ${app?.status === s ? 'selected' : ''}>${s}</option>`
    ).join('');

    showModal('Add Timeline Event', `
        <div class="modal-grid-2">
            <div class="field-group">
                <label>Status</label>
                <select id="tl-status" class="input-field">${statusOptions}</select>
            </div>
            <div class="field-group">
                <label>Date</label>
                <input type="date" id="tl-date" class="input-field" value="${new Date().toISOString().split('T')[0]}">
            </div>
        </div>
        <div class="field-group">
            <label>Note</label>
            <input type="text" id="tl-note" class="input-field" placeholder="e.g. HR reached out, technical interview scheduled...">
        </div>
    `, async () => {
        const status = document.getElementById('tl-status').value;
        const date = document.getElementById('tl-date').value;
        const note = document.getElementById('tl-note').value.trim();
        await trackerApi.addTimeline(appId, {
            status, note,
            date: date ? new Date(date).toISOString() : new Date().toISOString()
        });
        // Also update app status
        await trackerApi.update(appId, { status, timeline_note: note });
        await loadTracker();
        const app = applications.find(a => a.id === appId);
        if (app) renderDetail(app);
        return true;
    }, 'Add Event');
}

// ── Shared Modal Utility ──────────────────────────────────────────────────────

export function closeModal() {
    const modal = document.getElementById('tracker-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

function showModal(title, bodyHtml, onConfirm, confirmLabel = 'Confirm') {
    let modal = document.getElementById('tracker-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'tracker-modal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    modal.innerHTML = `
    <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
            <span class="modal-title">${title}</span>
            <button class="modal-close" onclick="window.closeModal()">✕</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-footer">
            <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="modal-confirm-btn">${confirmLabel}</button>
        </div>
    </div>`;
    modal.style.display = 'flex';
    modal.onclick = () => { window.closeModal(); };

    document.getElementById('modal-confirm-btn').onclick = async () => {
        const result = await onConfirm();
        if (result !== false) window.closeModal();
    };
}

// ── Utility ───────────────────────────────────────────────────────────────────

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Global Event Bindings ─────────────────────────────────────────────────────

export function initTracker(resumeState) {
    window._resumeState = resumeState;

    window.closeModal = closeModal;
    window.openNewAppModal = openNewAppModal;
    window.openAppDetail = (id) => {
        const app = applications.find(a => a.id === id);
        if (app) renderDetail(app);
    };
    window.updateAppField = async (id, field, value) => {
        const payload = { [field]: value };
        await trackerApi.update(id, payload);
        await loadTracker();
        const app = applications.find(a => a.id === id);
        if (app) renderDetail(app);
    };
    window.deleteApp = async (id) => {
        if (!confirm('Delete this application?')) return;
        await trackerApi.delete(id);
        currentAppId = null;
        await loadTracker();
    };
    window.filterByStatus = (status) => {
        filterStatus = filterStatus === status ? 'all' : status;
        renderList();
    };
    window.previewAssignedResume = (filename) => {
        // Switch to dashboard and preview the PDF
        window.switchTab('dashboard');
        setTimeout(() => window.dashPreview(filename), 200);
    };
    window.openBuildForAppModal = openBuildForAppModal;
    window.openCustomizeModal = openCustomizeModal;
    window.openAddTimelineModal = openAddTimelineModal;

    // Search input
    const searchEl = document.getElementById('app-search');
    if (searchEl) {
        searchEl.addEventListener('input', e => {
            filterSearch = e.target.value;
            renderList();
        });
    }
}
