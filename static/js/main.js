import { ui, state } from './app.js';
import './dashboard.js?v=3';
import './library.js?v=3';
import { loadSettings } from './settings.js';
import { loadTracker, initTracker } from './tracker.js?v=4';
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

// ── Full Backup / Restore ─────────────────────────────────────────────────────
window.exportBackup = function() {
    const token = localStorage.getItem('token');
    if (!token) return;
    const a = document.createElement('a');
    a.href = '/api/export-backup?token=' + token;
    a.download = 'resume_backup.json';
    a.click();
};

window.importBackup = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
        try {
            const backup = JSON.parse(e.target.result);
            const res = await fetch('/api/import-backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(backup),
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                alert('Backup restored successfully! Refreshing data...');
                window.location.reload();
            } else {
                alert('Restore failed: ' + (data.detail || data.message || 'Unknown error'));
            }
        } catch(err) {
            alert('Invalid backup file: ' + err.message);
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
