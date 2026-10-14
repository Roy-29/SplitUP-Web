import React, { useMemo } from 'react';
import { formatSimple } from '../lib/CurrencyManager';

const avatarColors = [
  '#00b894', // Green
  '#0984e3', // Blue
  '#6c5ce7', // Purple
  '#d63031', // Red
  '#e1b12c', // Yellow
  '#e84393'  // Pink
];

export function avatarColorForName(name) {
  if (!name) return avatarColors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % avatarColors.length;
  return avatarColors[index];
}

export default function GroupCard({ group, onClick, onDeleteGroup, onShowQr, currencyCode = 'BDT' }) {
  const avatarColor = useMemo(() => avatarColorForName(group.name), [group.name]);
  const initial = group.name ? group.name.charAt(0).toUpperCase() : '?';

  return (
    <div 
      className="glass-panel group-card" 
      onClick={onClick}
      style={{ 
        padding: '20px', 
        display: 'flex', 
        alignItems: 'center', 
        cursor: 'pointer',
        gap: '16px',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Avatar Box */}
      <div 
        className="group-avatar-box"
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '18px',
          background: `${avatarColor}20`, // 12% opacity roughly
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        <span style={{ fontSize: '24px', fontWeight: 'bold', color: avatarColor }}>
          {initial}
        </span>
      </div>

      {/* Info Column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {group.name}
          </h3>
          {onDeleteGroup && (
            <button 
              className="btn-icon delete-btn" 
              style={{ width: '32px', height: '32px' }} 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (window.confirm(`Are you sure you want to delete group "${group.name}"?\nAll associated expenses, settlements, and member records will be permanently deleted.`)) {
                  onDeleteGroup(group.id);
                }
              }}
              title="Delete group"
            >
              <i className="ph ph-trash"></i>
            </button>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '4px 8px', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {group.memberCount || 0} members
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>•</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{group.expenseCount || 0} items</span>
          {group.joinCode && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(group.joinCode);
                  alert(`Join code "${group.joinCode}" copied to clipboard! Share it with friends to invite them.`);
                }}
                style={{
                  background: 'rgba(108, 92, 231, 0.15)',
                  border: '1px solid rgba(108, 92, 231, 0.3)',
                  color: 'var(--accent-secondary)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.73rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Click to copy join code"
              >
                <i className="ph ph-copy"></i> Code: {group.joinCode}
              </span>

              {onShowQr && (
                <button
                  type="button"
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowQr(group);
                  }}
                  style={{
                    width: '26px',
                    height: '26px',
                    background: 'rgba(108, 92, 231, 0.2)',
                    color: 'var(--accent-primary)',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Show Group QR Code"
                >
                  <i className="ph ph-qr-code"></i>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Amount Column */}
      <div className="group-amount-box" style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-primary)' }}>
          {formatSimple(group.totalExpense || 0, currencyCode)}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Spent</div>
      </div>
    </div>
  );
}
