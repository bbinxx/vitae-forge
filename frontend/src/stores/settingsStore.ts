import { useState, useEffect } from 'react';
import { Setting, SystemStatus } from '../types';
import { api, apiFetch } from '../services/api';

class SettingsStore {
  private settings: Setting = {
    export_folder: '',
    file_name_prefix: 'RESUME-',
    theme: 'dark',
    density: 'comfortable',
    editor_font_size: 13,
    editor_tab_size: 2,
    editor_word_wrap: true,
    editor_minimap: false
  };
  private status: SystemStatus = {
    server_ok: true,
    latex_ok: true,
    pdf_engine_ok: true
  };
  private loading = false;
  private listeners = new Set<() => void>();

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  getSettings() { return this.settings; }
  getStatus() { return this.status; }
  isLoading() { return this.loading; }

  async load() {
    this.loading = true;
    this.notify();
    try {
      const data = await api.getSettings();
      if (data && typeof data === 'object') {
        this.settings = { ...this.settings, ...data };
      }
      await this.checkStatus();
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      this.loading = false;
      this.notify();
    }
  }

  async save(data: Setting) {
    try {
      await api.saveSettings(data);
      this.settings = data;
      this.notify();
    } catch (e: any) {
      alert('Failed to save settings: ' + e.message);
    }
  }

  async checkStatus() {
    try {
      const config = await api.getConfig().catch(() => null);
      const isLatexOk = config ? config.latex_available !== false : true;
      this.status = {
        server_ok: true,
        latex_ok: isLatexOk,
        pdf_engine_ok: true,
        version: 'v1.1.0'
      };
      this.notify();
    } catch {
      this.status = {
        server_ok: false,
        latex_ok: false,
        pdf_engine_ok: false
      };
      this.notify();
    }
  }
}

export const settingsStore = new SettingsStore();

export function useSettings() {
  const [settings, setSettings] = useState(settingsStore.getSettings());
  const [status, setStatus] = useState(settingsStore.getStatus());
  const [loading, setLoading] = useState(settingsStore.isLoading());

  useEffect(() => {
    const unsubscribe = settingsStore.subscribe(() => {
      setSettings(settingsStore.getSettings());
      setStatus(settingsStore.getStatus());
      setLoading(settingsStore.isLoading());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return { 
    settings, 
    status, 
    loading, 
    load: () => settingsStore.load(),
    saveSettings: (data: Setting) => settingsStore.save(data) 
  };
}
