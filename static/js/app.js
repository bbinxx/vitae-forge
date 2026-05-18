import { api } from './api.js';

export const state = {
    data: { personal: {}, library: {}, recipes: {} },
    currentEditingRole: null,
    selectedDashFile: null,
    listeners: [],
    
    subscribe(callback) {
        this.listeners.push(callback);
    },
    
    notify() {
        for (const listener of this.listeners) {
            listener();
        }
    },
    
    async loadConfig() {
        try {
            this.data = await api.fetchConfig();
            this.notify();
        } catch (e) {
            console.error("Server offline", e);
        }
    },

    async saveConfig() {
        const ok = await api.saveConfig(this.data);
        if (ok) {
            alert("✓ Configuration saved to file successfully");
            this.notify();
        } else {
            alert("❌ Error saving configuration");
        }
    }
};

export const ui = {
    switchTab(tabId) {
        document.querySelectorAll('.view-content').forEach(v => v.classList.add('hidden'));
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('bg-gray-800', 'text-white'));
        
        const view = document.getElementById(`${tabId}-view`);
        if (view) {
            view.classList.remove('hidden');
        }
        
        const btn = document.getElementById(`tab-${tabId}`);
        if (btn) btn.classList.add('bg-gray-800', 'text-white');
    }
};

window.addEventListener('DOMContentLoaded', () => {
    state.loadConfig();
});
