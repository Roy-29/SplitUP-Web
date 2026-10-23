import React, { useState, useEffect } from 'react';
import { isTursoConfigured, tursoSignUp, tursoSignIn, tursoGoogleSignIn, tursoCheckUsernameAvailability } from '../lib/turso';
import { GoogleLogin } from '@react-oauth/google';
import './AuthScreen.css';

export default function AuthScreen({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  
  const [usernameCheck, setUsernameCheck] = useState({
    status: 'idle', // 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
    message: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const hasGoogleClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  useEffect(() => {
    if (!isSignUp) {
      setUsernameCheck({ status: 'idle', message: '' });
      return;
    }

    const trimmed = username.trim().toLowerCase().replace(/^@/, '');
    if (!trimmed) {
      setUsernameCheck({ status: 'idle', message: '' });
      return;
    }

    if (trimmed.length < 3) {
      setUsernameCheck({ status: 'invalid', message: 'At least 3 characters' });
      return;
    }

    if (!/^[a-z0-9_]{3,30}$/.test(trimmed)) {
      setUsernameCheck({ status: 'invalid', message: 'Letters, numbers & _ only (max 30)' });
      return;
    }

    setUsernameCheck({ status: 'checking', message: 'Checking availability...' });

    const timer = setTimeout(async () => {
      try {
        const res = await tursoCheckUsernameAvailability(trimmed);
        if (res.available) {
          setUsernameCheck({ status: 'available', message: `@${trimmed} is available` });
        } else {
          setUsernameCheck({ status: 'taken', message: res.reason || `@${trimmed} is already taken` });
        }
      } catch (_) {
        setUsernameCheck({ status: 'idle', message: '' });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [username, isSignUp]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!isTursoConfigured) {
        throw new Error(
          "Turso is not configured yet. Please add VITE_TURSO_DATABASE_URL and VITE_TURSO_AUTH_TOKEN to your .env file."
        );
      }

      if (isSignUp && username.trim()) {
        if (usernameCheck.status === 'taken') {
          throw new Error(`The username @${username.trim()} is already taken. Please choose another.`);
        }
        if (usernameCheck.status === 'invalid') {
          throw new Error(usernameCheck.message || "Invalid username format.");
        }
      }

      let user;
      if (isSignUp) {
        user = await tursoSignUp(name, emailOrUsername, password, '', username);
      } else {
        user = await tursoSignIn(emailOrUsername, password);
      }
      
      onLoginSuccess(user);
    } catch (err) {
      console.error("Auth Error:", err);
      setError(err.message || "An error occurred during authentication.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setError("Failed to retrieve Google credentials.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const user = await tursoGoogleSignIn(credentialResponse.credential);
      onLoginSuccess(user);
    } catch (err) {
      console.error("Google Auth Error:", err);
      setError(err.message || "Failed to authenticate with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel animate-fade-in">
        <div className="auth-header">
          <div className="brand-logo" style={{ margin: '0 auto 16px' }}>
            <i className="ph-fill ph-lightning" style={{ color: 'var(--accent-primary)', fontSize: '2rem' }}></i>
          </div>
          <h2>{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
          <p>Split expenses easily with friends</p>
        </div>

        {!isTursoConfigured && (
          <div style={{
            background: 'rgba(108, 92, 231, 0.1)',
            border: '1px solid rgba(108, 92, 231, 0.3)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '18px',
            fontSize: '0.85rem',
            lineHeight: 1.5,
            color: 'var(--text-secondary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', fontWeight: '600', marginBottom: '4px' }}>
              <i className="ph ph-database"></i> Turso Database
            </div>
            Ready for your Turso credentials. Add <code>VITE_TURSO_DATABASE_URL</code> & <code>VITE_TURSO_AUTH_TOKEN</code> in <code>.env</code> to connect.
          </div>
        )}

        <div className="auth-toggle">
          <button 
            className={`toggle-btn ${!isSignUp ? 'active' : ''}`}
            onClick={() => { setIsSignUp(false); setError(null); }}
            type="button"
          >
            Sign In
          </button>
          <button 
            className={`toggle-btn ${isSignUp ? 'active' : ''}`}
            onClick={() => { setIsSignUp(true); setError(null); }}
            type="button"
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {isSignUp && (
            <>
              <div className="form-group">
                <label>Full Name *</label>
                <div className="input-wrapper">
                  <i className="ph ph-user"></i>
                  <input 
                    type="text" 
                    placeholder="e.g. John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ margin: 0 }}>Unique Username (Optional)</label>
                  {usernameCheck.status !== 'idle' && (
                    <span className={`username-status-badge ${usernameCheck.status}`}>
                      {usernameCheck.status === 'checking' && <i className="ph ph-spinner ph-spin"></i>}
                      {usernameCheck.status === 'available' && <i className="ph-bold ph-check"></i>}
                      {usernameCheck.status === 'taken' && <i className="ph-bold ph-x"></i>}
                      {usernameCheck.status === 'invalid' && <i className="ph ph-warning-circle"></i>}
                      <span>{usernameCheck.message}</span>
                    </span>
                  )}
                </div>
                <div className={`input-wrapper ${usernameCheck.status === 'available' ? 'input-success' : (usernameCheck.status === 'taken' || usernameCheck.status === 'invalid') ? 'input-error' : ''}`}>
                  <i className="ph ph-at"></i>
                  <input 
                    type="text" 
                    placeholder="e.g. roy or swapnil"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    maxLength={30}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                  Friends can search and find you using your unique @username
                </span>
              </div>
            </>
          )}

          <div className="form-group">
            <label>{isSignUp ? 'Email Address *' : 'Email or @Username *'}</label>
            <div className="input-wrapper">
              <i className={isSignUp ? "ph ph-envelope-simple" : "ph ph-user"}></i>
              <input 
                type={isSignUp ? "email" : "text"}
                placeholder={isSignUp ? "name@example.com" : "name@example.com or @username"}
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password *</label>
            <div className="input-wrapper">
              <i className="ph ph-lock-key"></i>
              <input 
                type="password" 
                placeholder={isSignUp ? "At least 8 characters" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </div>

          {error && (
            <div className="auth-error">
              <i className="ph ph-warning-circle"></i>
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn-primary auth-submit" disabled={isLoading}>
            {isLoading ? (
              <span><i className="ph ph-spinner ph-spin"></i> Processing...</span>
            ) : (
              isSignUp ? 'Create Account' : 'Sign In'
            )}
          </button>
        </form>

        {/* Google Authentication */}
        {hasGoogleClientId ? (
          <>
            <div className="auth-divider">
              <span>OR</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError("Google Sign-In was cancelled or failed.")}
                theme="filled_black"
                shape="pill"
                size="large"
                text="continue_with"
                width="100%"
              />
            </div>
          </>
        ) : (
          <div style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            textAlign: 'center',
            fontSize: '0.8rem',
            color: 'var(--text-muted)'
          }}>
            <i className="ph ph-google-logo" style={{ verticalAlign: 'middle', marginRight: '4px' }}></i>
            To enable Google Sign-In, add <code>VITE_GOOGLE_CLIENT_ID</code> to your <code>.env</code> file.
          </div>
        )}
      </div>
    </div>
  );
}
