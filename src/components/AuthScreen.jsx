import React, { useState } from 'react';
import { isTursoConfigured, tursoSignUp, tursoSignIn, tursoGoogleSignIn } from '../lib/turso';
import { GoogleLogin } from '@react-oauth/google';
import './AuthScreen.css';

export default function AuthScreen({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const hasGoogleClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

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

      let user;
      if (isSignUp) {
        user = await tursoSignUp(name, email, password);
      } else {
        user = await tursoSignIn(email, password);
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
            </>
          )}

          <div className="form-group">
            <label>Email *</label>
            <div className="input-wrapper">
              <i className="ph ph-envelope-simple"></i>
              <input 
                type="email" 
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
