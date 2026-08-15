import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api.js';

export default function SettingsPage() {
  const [settings, setSettings] = useState({ export_folder: '', file_name_prefix: 'BIBIN_RAJU-' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await apiFetch('/api/settings');
        if (data && typeof data === 'object') {
          setSettings(prev => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });
      setMessage('Settings saved successfully!');
    } catch (err) {
      setMessage('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePickFolder = async () => {
    try {
      const res = await apiFetch('/api/settings/pick-folder');
      if (res && res.folder) {
        setSettings(prev => ({ ...prev, export_folder: res.folder }));
      }
    } catch (err) {
      console.error('Folder picker error:', err);
    }
  };

  if (loading) return <div>Loading settings...</div>;

  return (
    <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>System Settings</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Configure local PDF export paths and file naming conventions.</p>
      </div>

      {message && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: '0.85rem' }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSave} style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
            File Name Prefix
          </label>
          <input 
            type="text" 
            className="input-field" 
            style={{ width: '100%' }}
            value={settings.file_name_prefix || ''}
            onChange={e => setSettings({ ...settings, file_name_prefix: e.target.value })}
            placeholder="e.g. BIBIN_RAJU-"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
            Local Export Folder Path
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              className="input-field" 
              style={{ flex: 1 }}
              value={settings.export_folder || ''}
              onChange={e => setSettings({ ...settings, export_folder: e.target.value })}
              placeholder="/home/user/Documents/Resumes"
            />
            <button type="button" className="btn btn-secondary" onClick={handlePickFolder}>
              Browse...
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
