import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, NavLink } from 'react-router-dom';
import { 
  tursoSignOut, 
  tursoUpdateUserProfile, 
  tursoExportAllData, 
  tursoRestoreData,
  isTursoConfigured 
} from '../lib/turso';
import { currencies } from '../lib/CurrencyManager';
import UserAvatar from './UserAvatar';
import CustomSelect from './CustomSelect';
import './SettingsView.css';

export default function SettingsView({ 
  currentUser, 
  onLogout, 
  theme, 
  setTheme, 
  currencyCode, 
  setCurrencyCode, 
  onRefreshData,
  onResetData 
}) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const avatarFileInputRef = useRef(null);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'currency', 'theme', 'editProfile', 'privacy', 'version', 'restore'
  
  // Edit Profile form state
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profileBio, setProfileBio] = useState(currentUser?.shortProfile || '');
  const [profileAvatar, setProfileAvatar] = useState(currentUser?.avatar || '');
  const [profileBkash, setProfileBkash] = useState(currentUser?.bkashNumber || '');
  const [profileNagad, setProfileNagad] = useState(currentUser?.nagadNumber || '');
  const [profileRocket, setProfileRocket] = useState(currentUser?.rocketNumber || '');
  const [profilePrimaryMfs, setProfilePrimaryMfs] = useState(currentUser?.primaryMfs || 'BKASH');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);

  // Sync state if currentUser changes
  React.useEffect(() => {
    setProfileName(currentUser?.name || '');
    setProfileBio(currentUser?.shortProfile || '');
    setProfileAvatar(currentUser?.avatar || '');
    setProfileBkash(currentUser?.bkashNumber || '');
    setProfileNagad(currentUser?.nagadNumber || '');
    setProfileRocket(currentUser?.rocketNumber || '');
    setProfilePrimaryMfs(currentUser?.primaryMfs || 'BKASH');
  }, [currentUser]);

  // Compress image helper using canvas to keep avatar size compact (<35KB)
  const compressImage = (file, maxWidth = 256, maxHeight = 256) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image file.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  };

  const handleAvatarFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WebP)', 'error');
      return;
    }

    try {
      showToast('Processing photo...', 'info');
      const compressedDataUrl = await compressImage(file, 256, 256);
      setProfileAvatar(compressedDataUrl);

      // Save directly to database & storage immediately if not in the edit modal
      if (activeModal !== 'editProfile') {
        await tursoUpdateUserProfile(currentUser.id, { 
          name: currentUser.name,
          shortProfile: currentUser.shortProfile,
          avatar: compressedDataUrl 
        });
        if (onRefreshData) await onRefreshData();
        showToast('Profile photo updated successfully!');
      }
    } catch (err) {
      showToast('Could not process image: ' + err.message, 'error');
    } finally {
      if (avatarFileInputRef.current) avatarFileInputRef.current.value = '';
    }
  };

  // Currency search state
  const [currencySearch, setCurrencySearch] = useState('');

  // Backup / Restore state
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState(null);
  const [selectedBackupData, setSelectedBackupData] = useState(null);

  // Toast notification
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleLogoutClick = () => {
    tursoSignOut();
    onLogout();
  };

  // ---------------- Profile Update ----------------
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileMessage(null);
    try {
      await tursoUpdateUserProfile(currentUser.id, {
        name: profileName,
        shortProfile: profileBio,
        avatar: profileAvatar,
        bkashNumber: profileBkash,
        nagadNumber: profileNagad,
        rocketNumber: profileRocket,
        primaryMfs: profilePrimaryMfs
      });
      if (onRefreshData) await onRefreshData();
      showToast("Profile & MFS payment accounts updated!");
      setActiveModal(null);
    } catch (err) {
      setProfileMessage({ type: 'error', text: err.message || "Failed to update profile." });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ---------------- Backup (Export) ----------------
  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const data = await tursoExportAllData(currentUser?.id);
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `splitup_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast("Backup exported successfully! File downloaded.");
    } catch (err) {
      showToast("Failed to export backup: " + err.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // ---------------- Restore (Import) ----------------
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.groups && !parsed.expenses) {
          setRestoreMessage({ type: 'error', text: "Invalid SplitUP backup format." });
          return;
        }
        setSelectedBackupData(parsed);
        setRestoreMessage({ 
          type: 'info', 
          text: `Found ${parsed.groups?.length || 0} groups, ${parsed.expenses?.length || 0} expenses, ${parsed.members?.length || 0} members.` 
        });
      } catch (err) {
        setRestoreMessage({ type: 'error', text: "Failed to parse JSON file." });
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!selectedBackupData) return;
    setIsRestoring(true);
    setRestoreMessage(null);
    try {
      await tursoRestoreData(selectedBackupData, currentUser?.id);
      if (onRefreshData) await onRefreshData();
      showToast("Data restored successfully!");
      setActiveModal(null);
      setSelectedBackupData(null);
    } catch (err) {
      setRestoreMessage({ type: 'error', text: err.message || "Failed to restore data." });
    } finally {
      setIsRestoring(false);
    }
  };

  // Current currency object
  const currentCurrency = currencies.find(c => c.code === currencyCode) || currencies[0];

  // Filtered currencies
  const filteredCurrencies = currencies.filter(c => 
    c.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.symbol.includes(currencySearch)
  );

  return (
    <>
      <div className="settings-container animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className={`settings-toast ${toast.type}`}>
          <i className={toast.type === 'error' ? "ph ph-warning-circle" : "ph ph-check-circle"}></i>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="settings-top-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="settings-back-btn" onClick={() => navigate('/dashboard')} title="Back to Dashboard">
            <i className="ph ph-arrow-left"></i>
          </button>
          <h2>Settings</h2>
        </div>
      </div>

      {/* Profile & Account Section (Top 1st) */}
      <div className="settings-group">
        <div className="settings-group-title">Profile & Account</div>
        <div className="profile-account-card">
          <div className="profile-card-header">
            <div className="profile-avatar-wrapper" style={{ position: 'relative' }}>
              <div 
                className="profile-avatar" 
                style={{ cursor: 'pointer' }}
                onClick={() => avatarFileInputRef.current?.click()}
                title="Click to change profile photo"
              >
                <UserAvatar user={currentUser} size={54} fontSize="1.3rem" />
              </div>
              <button 
                type="button" 
                className="avatar-camera-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  avatarFileInputRef.current?.click();
                }}
                title="Upload profile photo"
              >
                <i className="ph ph-camera"></i>
              </button>
            </div>

            <input 
              type="file" 
              ref={avatarFileInputRef} 
              style={{ display: 'none' }} 
              accept="image/png, image/jpeg, image/webp" 
              onChange={handleAvatarFileSelect} 
            />

            <div className="profile-details">
              <div className="profile-name-row">
                <span className="profile-name">{currentUser?.name || 'User'}</span>
                <span className="online-badge">
                  <span className="online-dot"></span>
                  Online
                </span>
                <button 
                  className="edit-profile-btn" 
                  title="Edit Profile"
                  onClick={() => {
                    setProfileName(currentUser?.name || '');
                    setProfileBio(currentUser?.shortProfile || '');
                    setProfileAvatar(currentUser?.avatar || '');
                    setProfileMessage(null);
                    setActiveModal('editProfile');
                  }}
                >
                  <i className="ph ph-pencil-simple"></i>
                </button>
              </div>
              <div className="profile-email">{currentUser?.email}</div>
            </div>

            <button className="sign-out-btn" onClick={handleLogoutClick} title="Sign Out">
              Sign Out
            </button>
          </div>

          {/* Bio / Short Profile row */}
          <div className="profile-card-divider"></div>
          <div 
            className="profile-bio-row interactive"
            onClick={() => {
              setProfileName(currentUser?.name || '');
              setProfileBio(currentUser?.shortProfile || '');
              setActiveModal('editProfile');
            }}
          >
            <span className="profile-bio-text">
              {currentUser?.shortProfile ? currentUser.shortProfile : <span className="bio-placeholder">+ Add bio / status note</span>}
            </span>
            <i className="ph ph-caret-right item-arrow-sm"></i>
          </div>
        </div>
      </div>

      {/* Bangladesh Payment Methods (MFS) Section */}
      <div className="settings-group">
        <div className="settings-group-title">🇧🇩 Bangladesh Payment Methods (MFS)</div>
        <div className="settings-card">
          {/* bKash */}
          <div 
            className="settings-item interactive"
            onClick={() => setActiveModal('editMfs')}
          >
            <div className="settings-icon-circle" style={{ background: '#fde8f1', color: '#E2136E' }}>
              <i className="ph ph-wallet"></i>
            </div>
            <div className="settings-item-content">
              <div className="settings-item-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>bKash</span>
                {currentUser?.primaryMfs === 'BKASH' && (
                  <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: '#E2136E', color: '#fff', fontWeight: 700 }}>Default</span>
                )}
              </div>
              <div className="settings-item-value">
                {currentUser?.bkashNumber ? currentUser.bkashNumber : <span style={{ color: 'var(--text-tertiary)' }}>Not set • Tap to configure</span>}
              </div>
            </div>
            <i className="ph ph-caret-right item-arrow"></i>
          </div>

          {/* Nagad */}
          <div 
            className="settings-item interactive"
            onClick={() => setActiveModal('editMfs')}
          >
            <div className="settings-icon-circle" style={{ background: '#fef4e8', color: '#F7941D' }}>
              <i className="ph ph-lightning"></i>
            </div>
            <div className="settings-item-content">
              <div className="settings-item-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Nagad</span>
                {currentUser?.primaryMfs === 'NAGAD' && (
                  <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: '#F7941D', color: '#fff', fontWeight: 700 }}>Default</span>
                )}
              </div>
              <div className="settings-item-value">
                {currentUser?.nagadNumber ? currentUser.nagadNumber : <span style={{ color: 'var(--text-tertiary)' }}>Not set • Tap to configure</span>}
              </div>
            </div>
            <i className="ph ph-caret-right item-arrow"></i>
          </div>

          {/* Rocket */}
          <div 
            className="settings-item interactive"
            onClick={() => setActiveModal('editMfs')}
          >
            <div className="settings-icon-circle" style={{ background: '#f4e9f5', color: '#8C3494' }}>
              <i className="ph ph-rocket-launch"></i>
            </div>
            <div className="settings-item-content">
              <div className="settings-item-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Rocket</span>
                {currentUser?.primaryMfs === 'ROCKET' && (
                  <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: '#8C3494', color: '#fff', fontWeight: 700 }}>Default</span>
                )}
              </div>
              <div className="settings-item-value">
                {currentUser?.rocketNumber ? currentUser.rocketNumber : <span style={{ color: 'var(--text-tertiary)' }}>Not set • Tap to configure</span>}
              </div>
            </div>
            <i className="ph ph-caret-right item-arrow"></i>
          </div>

          {/* Payment Gateway APIs */}
          <div 
            className="settings-item interactive"
            onClick={() => setActiveModal('mfsApiDocs')}
          >
            <div className="settings-icon-circle" style={{ background: 'rgba(0, 184, 148, 0.12)', color: '#00b894' }}>
              <i className="ph ph-code"></i>
            </div>
            <div className="settings-item-content">
              <div className="settings-item-label">Merchant Gateway APIs</div>
              <div className="settings-item-value" style={{ color: '#00b894' }}>
                bKash Tokenized & Nagad PGW (Sandbox Ready)
              </div>
            </div>
            <i className="ph ph-caret-right item-arrow"></i>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="settings-group">
        <div className="settings-group-title">Preferences</div>
        <div className="settings-card">
          {/* Default Currency */}
          <div 
            className="settings-item interactive" 
            onClick={() => { setActiveModal('currency'); setCurrencySearch(''); }}
          >
            <div className="settings-icon-circle">
              <i className="ph ph-arrows-clockwise"></i>
            </div>
            <div className="settings-item-content">
              <div className="settings-item-label">Default Currency</div>
              <div className="settings-item-value">
                {currentCurrency.flagEmoji} {currentCurrency.name} ({currentCurrency.symbol})
              </div>
            </div>
            <i className="ph ph-caret-right item-arrow"></i>
          </div>

          {/* Theme */}
          <div 
            className="settings-item interactive"
            onClick={() => setActiveModal('theme')}
          >
            <div className="settings-icon-circle">
              <i className="ph ph-moon"></i>
            </div>
            <div className="settings-item-content">
              <div className="settings-item-label">Theme</div>
              <div className="settings-item-value">
                {theme === 'system' ? 'System' : (theme === 'dark' ? 'Dark' : 'Light')}
              </div>
            </div>
            <i className="ph ph-caret-right item-arrow"></i>
          </div>
        </div>
      </div>

      {/* Data Section */}
      <div className="settings-group">
        <div className="settings-group-title">Data</div>
        <div className="settings-card">
          {/* Backup Data */}
          <div 
            className="settings-item interactive" 
            onClick={handleExportBackup}
          >
            <div className="settings-icon-circle">
              <i className="ph ph-cloud-arrow-up"></i>
            </div>
            <div className="settings-item-content">
              <div className="settings-item-label">
                {isExporting ? 'Exporting...' : 'Backup Data'}
              </div>
              <div className="settings-item-value">Export your data to a JSON backup file</div>
            </div>
            <i className="ph ph-caret-right item-arrow"></i>
          </div>

          {/* Restore Data */}
          <div 
            className="settings-item interactive" 
            onClick={() => {
              setActiveModal('restore');
              setSelectedBackupData(null);
              setRestoreMessage(null);
            }}
          >
            <div className="settings-icon-circle">
              <i className="ph ph-clock-counter-clockwise"></i>
            </div>
            <div className="settings-item-content">
              <div className="settings-item-label">Restore Data</div>
              <div className="settings-item-value">Import data from a backup file</div>
            </div>
            <i className="ph ph-caret-right item-arrow"></i>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="settings-group">
        <div className="settings-group-title">About</div>
        <div className="settings-card">
          {/* Privacy Policy */}
          <div 
            className="settings-item interactive"
            onClick={() => setActiveModal('privacy')}
          >
            <div className="settings-icon-circle">
              <i className="ph ph-shield-check"></i>
            </div>
            <div className="settings-item-content">
              <div className="settings-item-label">Privacy Policy</div>
              <div className="settings-item-value">View our privacy policy</div>
            </div>
            <i className="ph ph-caret-right item-arrow"></i>
          </div>

          {/* Version */}
          <div 
            className="settings-item interactive"
            onClick={() => setActiveModal('version')}
          >
            <div className="settings-icon-circle">
              <i className="ph ph-info"></i>
            </div>
            <div className="settings-item-content">
              <div className="settings-item-label">Version</div>
              <div className="settings-item-value">2.3.20 (Web Edition)</div>
            </div>
            <i className="ph ph-caret-right item-arrow"></i>
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="settings-footer">
        <p>Made with ❤️ by SplitUP Team</p>
      </div>
    </div>

    {/* ================= MODALS (Rendered via Portal to body) ================= */}
    {activeModal && createPortal(
      <>
        {/* 1. Currency Selector Modal */}
      {activeModal === 'currency' && (
        <div className="settings-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="settings-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-sheet-header">
              <h3>Select Default Currency</h3>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>
                <i className="ph ph-x"></i>
              </button>
            </div>

            <div className="currency-search-bar">
              <i className="ph ph-magnifying-glass"></i>
              <input 
                type="text" 
                placeholder="Search currency or country..." 
                value={currencySearch}
                onChange={(e) => setCurrencySearch(e.target.value)}
                autoFocus
              />
              {currencySearch && (
                <button className="clear-search-btn" onClick={() => setCurrencySearch('')}>
                  <i className="ph ph-x"></i>
                </button>
              )}
            </div>

            <div className="currency-list">
              {filteredCurrencies.map((c) => {
                const isSelected = c.code === currencyCode;
                return (
                  <div 
                    key={c.code}
                    className={`currency-list-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setCurrencyCode(c.code);
                      localStorage.setItem('splitup_currency', c.code);
                      showToast(`Currency updated to ${c.code} (${c.symbol})`);
                      setActiveModal(null);
                    }}
                  >
                    <span className="currency-flag">{c.flagEmoji}</span>
                    <div className="currency-info">
                      <div className="currency-name">{c.name}</div>
                      <div className="currency-code">{c.code} • {c.symbol}</div>
                    </div>
                    {isSelected && (
                      <i className="ph ph-check-circle selected-check"></i>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. Theme Modal */}
      {activeModal === 'theme' && (
        <div className="settings-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-dialog-header">
              <h3>App Theme</h3>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>
                <i className="ph ph-x"></i>
              </button>
            </div>

            <div className="theme-options-list">
              <div 
                className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => { setTheme('dark'); setActiveModal(null); }}
              >
                <div className="theme-icon-box dark">
                  <i className="ph ph-moon"></i>
                </div>
                <div className="theme-option-text">
                  <div className="theme-title">Dark Mode</div>
                  <div className="theme-desc">Comfortable and eye-soothing in low light</div>
                </div>
                {theme === 'dark' && <i className="ph ph-check selected-check"></i>}
              </div>

              <div 
                className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                onClick={() => { setTheme('light'); setActiveModal(null); }}
              >
                <div className="theme-icon-box light">
                  <i className="ph ph-sun"></i>
                </div>
                <div className="theme-option-text">
                  <div className="theme-title">Light Mode</div>
                  <div className="theme-desc">Bright, crisp and high-contrast view</div>
                </div>
                {theme === 'light' && <i className="ph ph-check selected-check"></i>}
              </div>

              <div 
                className={`theme-option ${theme === 'system' ? 'active' : ''}`}
                onClick={() => {
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  setTheme(prefersDark ? 'dark' : 'light');
                  localStorage.setItem('splitup_theme_preference', 'system');
                  setActiveModal(null);
                }}
              >
                <div className="theme-icon-box system">
                  <i className="ph ph-laptop"></i>
                </div>
                <div className="theme-option-text">
                  <div className="theme-title">System Default</div>
                  <div className="theme-desc">Matches your device's system appearance</div>
                </div>
                {localStorage.getItem('splitup_theme_preference') === 'system' && (
                  <i className="ph ph-check selected-check"></i>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Edit Profile Modal */}
      {activeModal === 'editProfile' && (
        <div className="settings-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-dialog-header">
              <h3>Edit Profile</h3>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>
                <i className="ph ph-x"></i>
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="modal-form">
              {profileMessage && (
                <div className={`modal-alert ${profileMessage.type}`}>
                  {profileMessage.text}
                </div>
              )}

              {/* Profile Photo Upload & Preview */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Profile Picture</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px' }}>
                  <UserAvatar 
                    user={{ ...currentUser, avatar: profileAvatar }} 
                    size={64} 
                    fontSize="1.5rem" 
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="btn-secondary"
                      style={{ padding: '6px 14px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => avatarFileInputRef.current?.click()}
                    >
                      <i className="ph ph-upload-simple"></i>
                      <span>{profileAvatar ? 'Change Photo' : 'Upload Photo'}</span>
                    </button>
                    {profileAvatar && (
                      <button 
                        type="button" 
                        style={{ 
                          padding: '4px 8px', 
                          fontSize: '0.78rem', 
                          background: 'none', 
                          border: 'none', 
                          color: '#f43f5e', 
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        onClick={() => setProfileAvatar('')}
                      >
                        <i className="ph ph-trash"></i>
                        <span>Remove Photo</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Display Name</label>
                <div className="input-with-icon">
                  <i className="ph ph-user"></i>
                  <input 
                    type="text" 
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    required
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Bio / Status Note</label>
                <div className="input-with-icon">
                  <i className="ph ph-chat-teardrop-text"></i>
                  <input 
                    type="text" 
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    placeholder="e.g. mm or Traveling with friends"
                    maxLength={100}
                  />
                </div>
                <span className="field-hint">Visible to members in your groups</span>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit MFS Numbers Modal */}
      {activeModal === 'editMfs' && (
        <div className="settings-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-dialog-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🇧🇩</span>
                <h3>Bangladesh MFS Numbers</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>
                <i className="ph ph-x"></i>
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="modal-form">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 0, marginBottom: '16px' }}>
                These numbers will be displayed to your friends when they settle up debts with you.
              </p>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#E2136E' }}>●</span> bKash Personal Number
                </label>
                <div className="input-with-icon">
                  <i className="ph ph-phone"></i>
                  <input 
                    type="tel"
                    placeholder="01XXXXXXXXX"
                    value={profileBkash}
                    onChange={(e) => setProfileBkash(e.target.value)}
                    maxLength={14}
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#F7941D' }}>●</span> Nagad Personal Number
                </label>
                <div className="input-with-icon">
                  <i className="ph ph-phone"></i>
                  <input 
                    type="tel"
                    placeholder="01XXXXXXXXX"
                    value={profileNagad}
                    onChange={(e) => setProfileNagad(e.target.value)}
                    maxLength={14}
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#8C3494' }}>●</span> Rocket Number (12 digits)
                </label>
                <div className="input-with-icon">
                  <i className="ph ph-phone"></i>
                  <input 
                    type="tel"
                    placeholder="01XXXXXXXXX-X"
                    value={profileRocket}
                    onChange={(e) => setProfileRocket(e.target.value)}
                    maxLength={14}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Preferred Primary Payout Method</label>
                <CustomSelect 
                  value={profilePrimaryMfs}
                  onChange={val => setProfilePrimaryMfs(val)}
                  options={[
                    { value: 'BKASH', label: 'bKash', icon: '🌸' },
                    { value: 'NAGAD', label: 'Nagad', icon: '🟠' },
                    { value: 'ROCKET', label: 'Rocket', icon: '🟣' }
                  ]}
                  placeholder="Select primary payout"
                />
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? 'Saving...' : 'Save MFS Numbers'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MFS API Developer Integration Modal */}
      {activeModal === 'mfsApiDocs' && (
        <div className="settings-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-dialog-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph ph-code" style={{ color: '#00b894' }}></i>
                <h3>Bangladesh MFS API Integration</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>
                <i className="ph ph-x"></i>
              </button>
            </div>

            <div style={{ padding: '4px 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <div style={{ background: 'rgba(0, 184, 148, 0.1)', border: '1px solid rgba(0, 184, 148, 0.25)', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00b894', fontWeight: 700, marginBottom: '4px' }}>
                  <i className="ph ph-check-circle"></i>
                  <span>Ready in Sandbox & Test Mode</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                  bKash Tokenized Checkout (v1.2.0-beta) and Nagad PGW are fully implemented in <code>src/lib/mfs/</code>. Test PIN is <code>12345</code> and test OTP is <code>123456</code>.
                </p>
              </div>

              <h4 style={{ color: 'var(--text-primary)', margin: '14px 0 6px' }}>Live Merchant Credentials:</h4>
              <p style={{ fontSize: '0.8rem', margin: '0 0 10px' }}>
                To connect live merchant payments, configure your <code>.env</code> file:
              </p>
              <pre style={{ background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.78rem', overflowX: 'auto', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
{`# bKash Tokenized Checkout API
VITE_BKASH_APP_KEY=your_app_key
VITE_BKASH_APP_SECRET=your_app_secret
VITE_BKASH_USERNAME=your_username
VITE_BKASH_PASSWORD=your_password
VITE_BKASH_BASE_URL=https://tokenized.pay.bka.sh/v1.2.0-beta

# Nagad PGW
VITE_NAGAD_MERCHANT_ID=your_merchant_id`}
              </pre>

              <div style={{ marginTop: '20px', textAlign: 'right' }}>
                <button type="button" className="btn-primary" onClick={() => setActiveModal(null)}>
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Restore Data Modal */}
      {activeModal === 'restore' && (
        <div className="settings-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-dialog-header">
              <h3>Restore Data</h3>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>
                <i className="ph ph-x"></i>
              </button>
            </div>

            <div className="restore-modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
                Select a previously saved <code>.json</code> backup file to restore your groups, expenses, and personal tracker.
              </p>

              <input 
                type="file" 
                ref={fileInputRef} 
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              <button 
                type="button"
                className="file-select-box"
                onClick={() => fileInputRef.current?.click()}
              >
                <i className="ph ph-file-arrow-up" style={{ fontSize: '2rem', color: '#00bfa5' }}></i>
                <span>Choose Backup JSON File</span>
              </button>

              {restoreMessage && (
                <div className={`modal-alert ${restoreMessage.type}`} style={{ marginTop: '16px' }}>
                  {restoreMessage.text}
                </div>
              )}

              <div className="form-actions" style={{ marginTop: '20px' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn-primary" 
                  disabled={!selectedBackupData || isRestoring}
                  onClick={handleConfirmRestore}
                >
                  {isRestoring ? 'Restoring...' : 'Confirm Restore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Privacy Policy Modal */}
      {activeModal === 'privacy' && (
        <div className="settings-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-dialog-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph ph-shield-check" style={{ color: '#00bfa5', fontSize: '1.4rem' }}></i>
                <h3>Privacy Policy</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>
                <i className="ph ph-x"></i>
              </button>
            </div>

            <div className="legal-content">
              <h4>1. Data Ownership</h4>
              <p>Your expenses, groups, and settlements belong solely to you and your group members. SplitUP does not sell or distribute personal data to third parties.</p>

              <h4>2. Database & Cloud Sync</h4>
              <p>When configured, data is securely synchronized with your private Turso SQLite database over encrypted HTTPS/TLS connections.</p>

              <h4>3. Google Authentication</h4>
              <p>When signing in with Google OAuth, we only access your public profile name and verified email address to establish your user identity.</p>

              <h4>4. Local Backups</h4>
              <p>You can export and download your complete dataset at any time from the Data section in Settings.</p>
            </div>

            <div className="form-actions" style={{ padding: '0 24px 20px', marginTop: '16px' }}>
              <button className="btn-primary" onClick={() => setActiveModal(null)} style={{ width: '100%', justifyContent: 'center' }}>
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Version Modal */}
      {activeModal === 'version' && (
        <div className="settings-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-dialog-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ph ph-info" style={{ color: '#00bfa5', fontSize: '1.4rem' }}></i>
                <h3>About SplitUP</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveModal(null)}>
                <i className="ph ph-x"></i>
              </button>
            </div>

            <div className="version-content">
              <div className="version-badge-container">
                <div className="brand-icon-sm">
                  <i className="ph ph-intersect"></i>
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem' }}>SplitUP Web</h4>
                  <span className="version-tag">Version 2.3.20</span>
                </div>
              </div>

              <div className="features-list">
                <div className="feature-item">
                  <i className="ph ph-check"></i> Multi-Currency Support (31 currencies & flags)
                </div>
                <div className="feature-item">
                  <i className="ph ph-check"></i> Group Expense Splitting with Join Codes
                </div>
                <div className="feature-item">
                  <i className="ph ph-check"></i> Personal Wallet & Custom Expense Tracker
                </div>
                <div className="feature-item">
                  <i className="ph ph-check"></i> Full Turso Cloud & SQLite Sync
                </div>
                <div className="feature-item">
                  <i className="ph ph-check"></i> JSON Data Backup & Restore
                </div>
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '16px' }}>
                Developed with love for seamless bill sharing.
              </p>
            </div>

            <div className="form-actions" style={{ padding: '0 24px 20px', marginTop: '16px' }}>
              <button className="btn-primary" onClick={() => setActiveModal(null)} style={{ width: '100%', justifyContent: 'center' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </>,
      document.body
    )}
    </>
  );
}
