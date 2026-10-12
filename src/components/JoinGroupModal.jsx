import React, { useState } from 'react';
import { isTursoConfigured, tursoJoinGroupByCode } from '../lib/turso';
import './Modal.css';

export default function JoinGroupModal({ isOpen, onClose, onSuccess, currentUser }) {
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const trimmed = joinCode.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError('Please enter a valid Join Code (e.g. SP8921).');
      return;
    }

    setIsLoading(true);

    try {
      if (isTursoConfigured) {
        const result = await tursoJoinGroupByCode(trimmed, currentUser);
        if (result.alreadyMember) {
          setSuccessMsg(`You are already a member of "${result.name}"!`);
        } else {
          setSuccessMsg(`Successfully joined "${result.name}"!`);
        }
        setTimeout(() => {
          setIsLoading(false);
          setJoinCode('');
          setSuccessMsg('');
          onSuccess?.();
          onClose();
        }, 1200);
      } else {
        setError('Turso database is not connected.');
        setIsLoading(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to join group. Please check the code.');
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="modal-icon" style={{ background: 'rgba(108, 92, 231, 0.15)', color: 'var(--accent-primary)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ph ph-sign-in" style={{ fontSize: '1.25rem' }}></i>
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Join a Group</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '2px 0 0' }}>Enter 6-character group invite code</p>
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} style={{ width: '32px', height: '32px' }}>
            <i className="ph ph-x"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="error-message" style={{ color: '#ff7675', background: 'rgba(214, 48, 49, 0.1)', padding: '10px', borderRadius: '8px', fontSize: '0.85rem' }}>{error}</div>}
          {successMsg && <div style={{ color: 'var(--success)', background: 'rgba(0, 184, 148, 0.1)', padding: '10px', borderRadius: '8px', fontSize: '0.85rem' }}>{successMsg}</div>}

          <div className="form-group">
            <label>Group Join Code</label>
            <input 
              type="text" 
              placeholder="e.g. SP8921" 
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={8}
              required
              style={{ 
                letterSpacing: '3px', 
                fontSize: '1.25rem', 
                fontWeight: 'bold', 
                textAlign: 'center',
                textTransform: 'uppercase'
              }}
              autoFocus
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Ask the group creator to share their 6-character code found on the group card.
            </span>
          </div>

          <div className="modal-footer" style={{ marginTop: '16px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Joining...' : 'Join Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
