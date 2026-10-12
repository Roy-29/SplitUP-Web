import React from 'react';
import { tursoSignOut } from '../lib/turso';
import './SettingsView.css';

export default function SettingsView({ currentUser, onLogout, theme, toggleTheme, onResetData }) {
  const handleLogoutClick = () => {
    tursoSignOut();
    onLogout();
  };

  return (
    <div className="settings-view glass-panel animate-fade-in">
      <div className="settings-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="activity-icon" style={{ background: 'rgba(108, 92, 231, 0.15)', color: 'var(--accent-primary)' }}>
            <i className="ph ph-gear"></i>
          </div>
          <div>
            <h2>Settings & Profile</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage your account and preferences</p>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Profile Information</h3>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-info">
              <span className="settings-label">Name</span>
              <span className="settings-value">{currentUser?.name}</span>
            </div>
            <div className="settings-avatar">
              {currentUser?.name?.substring(0, 2).toUpperCase()}
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-info">
              <span className="settings-label">Email Address</span>
              <span className="settings-value">{currentUser?.email}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Preferences</h3>
        <div className="settings-card">
          <div className="settings-row interactive" onClick={toggleTheme}>
            <div className="settings-info">
              <span className="settings-label">App Theme</span>
              <span className="settings-value">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <i className={theme === 'dark' ? "ph ph-moon" : "ph ph-sun"} style={{ fontSize: '1.2rem', color: 'var(--accent-primary)' }}></i>
          </div>
          <div className="settings-row interactive">
            <div className="settings-info">
              <span className="settings-label">Default Currency</span>
              <span className="settings-value">BDT (৳)</span>
            </div>
            <i className="ph ph-caret-right" style={{ color: 'var(--text-muted)' }}></i>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Account Actions</h3>
        <div className="settings-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
          <button className="btn-secondary danger-btn" onClick={onResetData} style={{ width: '100%', justifyContent: 'center' }}>
            <i className="ph ph-trash"></i>
            Reset Local Test Data
          </button>
          <button className="btn-secondary danger-btn" onClick={handleLogoutClick} style={{ width: '100%', justifyContent: 'center' }}>
            <i className="ph ph-sign-out"></i>
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
