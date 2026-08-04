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

// Global actions
window.exportJSON = function() {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'resume_config.json';
    a.click();
};

window.exportWorkspace = function() {
    const a = document.createElement('a');
    a.href = '/download-workspace-archive?token=' + localStorage.getItem('token');
    a.download = 'resume_workspace_backup.zip';
    a.click();
};

window.signOut = function() {
    localStorage.removeItem('token');
    window.location.href = '/login';
};

window.exportAllPDFs = function() {
    const a = document.createElement('a');
    a.href = '/download-all-pdfs?token=' + localStorage.getItem('token');
    a.download = 'all_resumes.zip';
    a.click();
};

window.importJSON = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            state.data = JSON.parse(e.target.result);
            alert('<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">check</span> Configuration loaded locally (Click Save to Server to persist)');
            state.notify();
        } catch(err) {
            alert('Invalid JSON file');
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
