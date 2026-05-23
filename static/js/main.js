import { ui, state } from './app.js';
import './dashboard.js';
import './editor.js';
import './library.js';
import { loadTracker, initTracker } from './tracker.js';

// Expose switchTab globally
window.switchTab = (tabId) => {
    ui.switchTab(tabId);
    if (tabId === 'tracker') loadTracker();
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
    a.href = '/download-workspace-archive';
    a.download = 'resume_workspace_backup.zip';
    a.click();
};

window.exportAllPDFs = function() {
    const a = document.createElement('a');
    a.href = '/download-all-pdfs';
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
            alert('✓ Configuration loaded locally (Click Save to Server to persist)');
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
