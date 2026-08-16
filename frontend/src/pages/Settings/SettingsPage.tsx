import React, { useState, useEffect } from 'react';
import { useSettings, settingsStore } from '../../stores/settingsStore';
import { api } from '../../services/api';
import { Setting } from '../../types';

export default function SettingsPage() {
  const { settings, status, loading, saveSettings } = useSettings();
  const [prefix, setPrefix] = useState('');
  const [folder, setFolder] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
  const [saving, setSaving] = useState(false);

  // Profile image upload states
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    settingsStore.load();
    loadPhotoUrl();
  }, []);

  const loadPhotoUrl = async () => {
    try {
      const res = await api.getSettingsPhotoUrl();
      if (res && res.url) {
        setPhotoUrl(res.url);
      } else {
        setPhotoUrl(null);
      }
    } catch (err) {
      console.error('Failed to load settings photo URL:', err);
    }
  };

  useEffect(() => {
    if (settings) {
      setPrefix(settings.file_name_prefix || '');
      setFolder(settings.export_folder || '');
      setTheme(settings.theme || 'dark');
      setDensity(settings.density || 'comfortable');
      if (settings.photo_r2_key) {
        loadPhotoUrl();
      }
    }
  }, [settings]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const res = await api.uploadSettingsPhoto(file);
      if (res && res.photo_r2_key) {
        const updated: Setting = {
          ...settings,
          file_name_prefix: prefix.trim(),
          export_folder: folder.trim(),
          theme,
          density,
          photo_r2_key: res.photo_r2_key
        };
        await saveSettings(updated);
        await loadPhotoUrl();
        alert('Profile picture uploaded successfully!');
      }
    } catch (err: any) {
      alert('Failed to upload image: ' + err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated: Setting = {
        ...settings,
        file_name_prefix: prefix.trim(),
        export_folder: folder.trim(),
        theme,
        density
      };
      await saveSettings(updated);
      alert('Settings updated successfully!');
    } catch (err: any) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePickFolder = async () => {
    try {
      const res = await fetch('/api/settings/pick-folder').then(r => r.json());
      if (res && res.folder) {
        setFolder(res.folder);
      }
    } catch (err) {
      console.error('Folder picker error:', err);
    }
  };

  const handleClearLocalData = () => {
    if (confirm('Danger! This will clear cached jobs and resume configurations. Continue?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>System Settings</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Configure PDF exports, local environments, and editor defaults.</p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Profile photo card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Profile Image (LaTeX Photo templates)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'var(--bg-surface)',
              border: '2px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0
            }}>
              {photoUrl ? (
                <img src={photoUrl} alt="Profile preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--text-muted)' }}>person</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Upload a JPEG/PNG picture. This image will automatically render when using templates that include a profile photo.
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="file"
                  id="settings-photo-file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handlePhotoUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => document.getElementById('settings-photo-file')?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? 'Uploading...' : 'Choose Image'}
                </button>
                {photoUrl && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)', fontSize: '0.75rem' }}
                    onClick={async () => {
                      if (confirm('Remove profile photo?')) {
                        const updated: Setting = {
                          ...settings,
                          file_name_prefix: prefix.trim(),
                          export_folder: folder.trim(),
                          theme,
                          density,
                          photo_r2_key: ''
                        };
                        await saveSettings(updated);
                        setPhotoUrl(null);
                        alert('Profile picture removed!');
                      }
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* General settings card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>General Settings</span>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px' }}>
              File Name Prefix
            </label>
            <input
              type="text"
              className="input-field"
              value={prefix}
              onChange={e => setPrefix(e.target.value)}
              placeholder="e.g. YOUR_NAME-"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px' }}>
              Local PDF Export Folder Path
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="input-field"
                style={{ flex: 1 }}
                value={folder}
                onChange={e => setFolder(e.target.value)}
                placeholder="/home/user/Documents"
              />
              <button type="button" className="btn btn-secondary" onClick={handlePickFolder}>
                Browse
              </button>
            </div>
          </div>
        </div>

        {/* Theme Preferences */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Appearance</span>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px' }}>Theme Mode</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['dark', 'light', 'system'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setTheme(t)}
                  style={{
                    flex: 1,
                    background: theme === t ? 'var(--accent)' : 'transparent',
                    color: theme === t ? '#ffffff' : 'var(--text-primary)',
                    border: '1px solid var(--border)'
                  }}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px' }}>Layout Density</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['compact', 'comfortable'] as const).map(d => (
                <button
                  key={d}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setDensity(d)}
                  style={{
                    flex: 1,
                    background: density === d ? 'var(--accent)' : 'transparent',
                    color: density === d ? '#ffffff' : 'var(--text-primary)',
                    border: '1px solid var(--border)'
                  }}
                >
                  {d.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(220, 38, 38, 0.2)',
          borderRadius: 'var(--radius)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--danger)' }}>Danger Zone</span>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Irreversibly wipe state parameters and local configurations.</p>
          <div>
            <button type="button" className="btn btn-danger btn-sm" onClick={handleClearLocalData}>
              Clear Local Cache
            </button>
          </div>
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
