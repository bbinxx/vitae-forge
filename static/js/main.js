import { ui, state } from './app.js';
import './dashboard.js';
import './editor.js';
import './library.js';

// Expose switchTab globally
window.switchTab = ui.switchTab.bind(ui);

// Global actions
window.exportJSON = function() {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(blob); 
    a.download = 'resume_config.json'; 
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
