import React, { useState } from 'react';

export default function LoginPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim() || 'admin',
          password: password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Authentication failed');
      }

      if (mode === 'login') {
        if (data.access_token) {
          localStorage.setItem('token', data.access_token);
          document.cookie = `auth_token=${data.access_token}; path=/; max-age=604800; SameSite=Lax`;
          if (onLoginSuccess) {
            onLoginSuccess(data.user);
          } else {
            window.location.href = '/';
          }
        } else {
          throw new Error('No token returned from server');
        }
      } else {
        setSuccessMsg('Account created successfully! You can now log in.');
        setMode('login');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#090d16',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: '#f8fafc',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Solid Clean Auth Card (No Gradients) */}
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: '#111827',
        border: '1px solid #1f2937',
        borderRadius: '16px',
        padding: '40px 32px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Header Icon & Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: '#4f46e5',
            marginBottom: '16px',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#ffffff' }}>
              description
            </span>
          </div>
          <h1 style={{
            margin: '0 0 6px 0',
            fontSize: '24px',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            color: '#ffffff',
          }}>
            Vitae Forge
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#9ca3af' }}>
            {mode === 'login' ? 'Enter credentials to sign in to your account' : 'Create an account to manage your resumes'}
          </p>
        </div>

        {/* Auth Mode Toggle Tabs (Solid flat style) */}
        <div style={{
          display: 'flex',
          background: '#1f2937',
          borderRadius: '10px',
          padding: '4px',
          marginBottom: '24px',
        }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '6px',
              border: 'none',
              background: mode === 'login' ? '#4f46e5' : 'transparent',
              color: mode === 'login' ? '#ffffff' : '#9ca3af',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '6px',
              border: 'none',
              background: mode === 'register' ? '#4f46e5' : 'transparent',
              color: mode === 'register' ? '#ffffff' : '#9ca3af',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Register
          </button>
        </div>

        {/* Error / Success Alerts */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#fca5a5',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            color: '#86efac',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#d1d5db',
              marginBottom: '6px',
            }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#6b7280',
                fontSize: '20px',
              }}>
                person
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. alex_dev"
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 40px',
                  background: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#d1d5db',
              marginBottom: '6px',
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#6b7280',
                fontSize: '20px',
              }}>
                lock
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 40px',
                  background: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '8px',
              border: 'none',
              background: '#4f46e5',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '15px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite' }}>sync</span>
                Authenticating...
              </>
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
              </>
            )}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
