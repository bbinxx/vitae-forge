import { ui, state } from './app.js';
import './library.js?v=3';
import { loadSettings } from './settings.js';
import { loadTracker, initTracker } from './tracker.js?v=5';
import { loadSavedResumes } from './saved_resumes.js?v=1';
import { loadTemplates } from './templates.js?v=1';

// Expose switchTab globally
window.switchTab = (tabId) => {
    ui.switchTab(tabId);
    if (tabId === 'tracker') loadTracker();
    if (tabId === 'saved-resumes') loadSavedResumes();
    if (tabId === 'templates') loadTemplates();
    if (tabId === 'settings') loadSettings();
};

// ── Toast helper (for module scope) ──────────────────────────────────────────
function toast(msg, type, duration) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: 'check', error: 'close', info: 'info' };
    const t = document.createElement('div');
    t.className = `toast toast-${type || 'info'}`;
    t.innerHTML = `
        <span class="toast-icon"><span class="material-symbols-outlined" style="font-size:1.1em;vertical-align:middle;line-height:1">${icons[type] || 'info'}</span></span>
        <span class="toast-msg">${msg}</span>
        <button class="toast-dismiss" onclick="this.parentElement.remove()"><span class="material-symbols-outlined" style="font-size:1.1em;vertical-align:middle;line-height:1">close</span></button>`;
    container.appendChild(t);
    setTimeout(() => { t.classList.add('toast-out'); setTimeout(() => t.remove(), 220); }, duration || 3000);
}

function showLoadingOverlay(msg) {
    let overlay = document.getElementById('backup-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'backup-loading-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:99999;flex-direction:column;gap:16px';
        overlay.innerHTML = '<div style="background:var(--bg-card,#1e293b);border:1px solid var(--border,#334155);border-radius:12px;padding:32px 40px;max-width:420px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5)"><div class="spinner" style="width:36px;height:36px;border:3px solid var(--border,#334155);border-top-color:var(--accent,#7c3aed);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px"></div><div id="backup-status-msg" style="color:var(--text-primary,#f1f5f9);font-size:13px;line-height:1.5">Processing...</div><div id="backup-status-detail" style="color:var(--text-muted,#94a3b8);font-size:11px;margin-top:8px"></div></div>';
        document.body.appendChild(overlay);
        if (!document.getElementById('backup-spinner-style')) {
            const style = document.createElement('style');
            style.id = 'backup-spinner-style';
            style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
            document.head.appendChild(style);
        }
    }
    overlay.style.display = 'flex';
    document.getElementById('backup-status-msg').textContent = msg || 'Processing...';
    document.getElementById('backup-status-detail').textContent = '';
    return overlay;
}

function updateLoadingOverlay(msg, detail) {
    const msgEl = document.getElementById('backup-status-msg');
    const detEl = document.getElementById('backup-status-detail');
    if (msgEl) msgEl.textContent = msg;
    if (detEl && detail) detEl.textContent = detail;
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('backup-loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

async function readSSEStream(response, onEvent) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const event = JSON.parse(line.slice(6));
                    onEvent(event);
                } catch {}
            }
        }
    }
}

// ── Full Backup / Restore ─────────────────────────────────────────────────────
window.exportBackup = async function() {
    const token = localStorage.getItem('token');
    if (!token) return;

    showLoadingOverlay('Exporting backup...');

    try {
        const res = await fetch('/api/export-backup', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: '{}',
        });
        if (!res.ok) {
            hideLoadingOverlay();
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            toast('Export failed: ' + (err.detail || res.statusText), 'error');
            return;
        }

        let lastPayload = null;
        await readSSEStream(res, (event) => {
            const labels = {
                personal: 'Personal info',
                library: 'Library entries',
                recipes: 'Resume recipes',
                settings: 'Settings',
                applications: 'Applications',
                checkpoints: 'Checkpoints',
                profile_photo: 'Profile photo',
                r2_images: 'R2 images',
                bookmarks: 'Bookmarks',
                finalizing: 'Generating backup file',
            };
            const label = labels[event.step] || event.step;
            if (event.step === 'file' && event.status === 'ready') {
                updateLoadingOverlay('Download ready', `${event.content.filename} (${(event.content.size / 1024).toFixed(1)} KB)`);
            } else if (event.step === 'data' && event.status === 'complete' && event.payload) {
                lastPayload = event.payload;
            } else {
                const icon = event.status === 'done' ? '\u2705' : '\u23F3';
                updateLoadingOverlay(`Exporting ${label}...`, `${icon} ${event.status}`);
            }
        });

        if (lastPayload) {
            const blob = new Blob([JSON.stringify(lastPayload, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            const ts = new Date().toISOString().slice(0, 19).replace(/[T:-]/g, '');
            a.download = `resume_backup_${ts}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
            hideLoadingOverlay();
            toast('Backup downloaded successfully!', 'success');
        } else {
            hideLoadingOverlay();
            toast('Export completed but no data received', 'warning');
        }
    } catch (err) {
        hideLoadingOverlay();
        toast('Export failed: ' + err.message, 'error');
    }
};

window.importBackup = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoadingOverlay('Restoring backup...');

    const reader = new FileReader();
    reader.onload = async e => {
        try {
            const backup = JSON.parse(e.target.result);
            updateLoadingOverlay('Uploading backup to server...');

            const res = await fetch('/api/import-backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(backup),
            });
            if (!res.ok) {
                hideLoadingOverlay();
                const err = await res.json().catch(() => ({ detail: res.statusText }));
                toast('Restore failed: ' + (err.detail || res.statusText), 'error');
                return;
            }

            let restoreOk = false;
            await readSSEStream(res, (event) => {
                const labels = {
                    personal: 'Personal info',
                    library: 'Library entries',
                    recipes: 'Resume recipes',
                    settings: 'Settings',
                    applications: 'Applications',
                    checkpoints: 'Checkpoints',
                    profile_photo: 'Profile photo',
                    r2_images: 'R2 images',
                    bookmarks: 'Bookmarks',
                };
                const label = labels[event.step] || event.step;
                const icon = event.status === 'done' ? '\u2705' : (event.status === 'error' ? '\u274C' : '\u23F3');
                updateLoadingOverlay(
                    event.status === 'error' ? `Error restoring ${label}` : `Restoring ${label}...`,
                    `${icon} ${event.status}${event.count !== undefined ? ' (' + event.count + ' items)' : ''}`
                );
                if (event.step === 'complete' && event.status === 'done') {
                    restoreOk = true;
                    hideLoadingOverlay();
                    toast('Backup restored successfully! Reloading...', 'success');
                    setTimeout(() => window.location.reload(), 1500);
                }
            });

            if (!restoreOk) {
                hideLoadingOverlay();
                toast('Restore did not complete as expected', 'warning');
            }
        } catch(err) {
            hideLoadingOverlay();
            toast('Invalid backup file: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
};

window.saveConfigToServer = () => state.saveConfig();

// Init tracker with shared state reference
initTracker(state);

// ── Material Icon Helper ──────────────────────────────────────────────────────
window.icon = (name) =>
  `<span class="material-symbols-outlined" style="font-size:1.1em;vertical-align:middle;line-height:1">${name}</span>`;

// Responsive header nav toggle
window.toggleHeaderNav = function() {
  const nav = document.getElementById('header-nav');
  const actions = document.getElementById('header-actions');
  nav.classList.toggle('open');
  if (actions) actions.classList.toggle('open');
};

// Close sidebar on mobile
window.closeSidebar = function() {
  document.querySelectorAll('.sidebar, .tracker-sidebar').forEach(el => {
    el.classList.remove('open');
  });
  const backdrop = document.getElementById('sidebar-backdrop');
  if (backdrop) backdrop.classList.remove('visible');
};

// Open sidebar on mobile via slide-in overlay
document.addEventListener('click', function(e) {
  const sidebar = e.target.closest('.sidebar, .tracker-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const isMobile = window.innerWidth <= 480;
  if (isMobile && sidebar && !sidebar.classList.contains('open')) {
    sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('visible');
  }
});

// Close nav when clicking outside
document.addEventListener('click', function(e) {
  if (window.innerWidth > 768) return;
  const nav = document.getElementById('header-nav');
  const hamburger = e.target.closest('.hamburger');
  if (!e.target.closest('.header-nav') && !hamburger && nav.classList.contains('open')) {
    nav.classList.remove('open');
    const actions = document.getElementById('header-actions');
    if (actions) actions.classList.remove('open');
  }
});
