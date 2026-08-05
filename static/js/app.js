import { api } from './api.js';

export const state = {
    data: { personal: {}, library: {}, recipes: {} },
    currentEditingRole: null,
    selectedDashFile: null,
    listeners: [],

    subscribe(cb)  { this.listeners.push(cb); },
    notify()       { for (const l of this.listeners) l(); },

    async loadConfig() {
        try {
            this.data = await api.fetchConfig();
            try {
                const res = await fetch('/api/settings');
                this.settings = await res.json();
            } catch(se) {
                this.settings = {};
            }
            this.notify();
        } catch(e) { console.error('Server offline', e); }
    },

    async saveConfig() {
        const ok = await api.saveConfig(this.data);
        if (ok) { await alert('<span class="material-symbols-outlined" style="font-size: 1.1em; vertical-align: middle; line-height: 1;">check</span> Configuration saved to file successfully'); this.notify(); }
        else      await alert(' Error saving configuration');
    }
};

export const ui = {
    switchTab(tabId) {
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
            v.classList.add('hidden');
        });
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

        const view = document.getElementById(`${tabId}-view`);
        if (view) { view.classList.remove('hidden'); view.classList.add('active'); }

        const btn = document.getElementById(`tab-${tabId}`);
        if (btn) btn.classList.add('active');

        // Close mobile nav/sidebar on tab switch
        document.querySelectorAll('.header-nav, #header-actions').forEach(el => el.classList.remove('open'));
        document.querySelectorAll('.sidebar, .tracker-sidebar').forEach(el => el.classList.remove('open'));
        const backdrop = document.getElementById('sidebar-backdrop');
        if (backdrop) backdrop.classList.remove('visible');
    }
};

window.addEventListener('DOMContentLoaded', () => state.loadConfig());
