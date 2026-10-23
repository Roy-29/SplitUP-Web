import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { avatarColorForName } from './GroupCard';
import './Modal.css';

export default function GroupQrModal({ isOpen, onClose, group }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const canvasRef = useRef(null);

  if (!isOpen || !group) return null;

  const joinCode = (group.joinCode || '').toUpperCase();
  const origin = window.location.origin;
  const inviteUrl = `${origin}/join/${joinCode}`;
  const avatarColor = avatarColorForName(group.name);
  const initial = group.name ? group.name.charAt(0).toUpperCase() : '?';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(joinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownload = () => {
    const canvas = document.getElementById('group-qr-canvas');
    if (!canvas) return;

    // Create a composite canvas with a branded white card border and group name
    const padding = 32;
    const bannerHeight = 80;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = canvas.width + padding * 2;
    finalCanvas.height = canvas.height + padding * 2 + bannerHeight;
    const ctx = finalCanvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    // Header Title
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(group.name, finalCanvas.width / 2, 42);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Join Code: ${joinCode}`, finalCanvas.width / 2, 66);

    // Draw QR canvas
    ctx.drawImage(canvas, padding, 80);

    // Footer text
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('SplitUP - Split Expenses Easily', finalCanvas.width / 2, finalCanvas.height - 14);

    const imageUri = finalCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = imageUri;
    a.download = `splitup-${group.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${group.name} on SplitUP`,
          text: `Join my group "${group.name}" on SplitUP to track and split expenses! Use code: ${joinCode}`,
          url: inviteUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return createPortal(
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div 
        className="modal-content glass-panel" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '420px', padding: '24px' }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ marginBottom: '14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
            <div 
              style={{ 
                background: 'rgba(108, 92, 231, 0.15)', 
                color: 'var(--accent-primary)', 
                width: '38px', 
                height: '38px', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              <i className="ph ph-qr-code" style={{ fontSize: '1.25rem' }}></i>
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Group QR Code</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '2px 0 0' }}>
                Scan to join instantly
              </p>
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} style={{ width: '32px', height: '32px' }}>
            <i className="ph ph-x"></i>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div 
          className="modal-body" 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '12px', 
            overflowY: 'auto', 
            overflowX: 'hidden',
            flex: 1, 
            padding: '2px 4px',
            textAlign: 'center'
          }}
        >
          {/* Group Info Badge */}
          <div 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--glass-border)',
              padding: '6px 14px',
              borderRadius: '20px'
            }}
          >
            <div 
              style={{ 
                width: '26px', 
                height: '26px', 
                borderRadius: '50%', 
                background: `${avatarColor}25`, 
                color: avatarColor, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '0.85rem'
              }}
            >
              {initial}
            </div>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{group.name}</span>
          </div>

          {/* QR Code Card */}
          <div 
            style={{
              background: '#ffffff',
              padding: '12px',
              borderRadius: '16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.22)'
            }}
          >
            <QRCodeCanvas 
              id="group-qr-canvas"
              value={inviteUrl}
              size={168}
              level="H"
              marginSize={1}
              ref={canvasRef}
            />
          </div>

          {/* 6-Character Join Code Box */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Invite Code
            </div>
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--glass-border)',
                borderRadius: '10px',
                padding: '4px 12px'
              }}
            >
              <span style={{ 
                fontFamily: 'monospace', 
                fontSize: '1.25rem', 
                fontWeight: '800', 
                letterSpacing: '2.5px',
                color: 'var(--accent-primary)' 
              }}>
                {joinCode}
              </span>
              <button 
                type="button" 
                className="btn-icon"
                onClick={handleCopyCode}
                title="Copy code"
                style={{ width: '28px', height: '28px', color: copiedCode ? 'var(--success)' : 'inherit' }}
              >
                <i className={copiedCode ? "ph ph-check" : "ph ph-copy"}></i>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%', maxWidth: '320px', marginTop: '2px' }}>
            <button 
              type="button" 
              className="btn-secondary"
              onClick={handleCopyLink}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.88rem', padding: '8px 12px' }}
            >
              <i className={copiedLink ? "ph ph-check" : "ph ph-link"}></i>
              {copiedLink ? 'Copied!' : 'Copy Link'}
            </button>

            <button 
              type="button" 
              className="btn-secondary"
              onClick={handleDownload}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.88rem', padding: '8px 12px' }}
            >
              <i className="ph ph-download-simple"></i>
              Download
            </button>
          </div>

          {navigator.share && (
            <button 
              type="button" 
              className="btn-primary"
              onClick={handleShare}
              style={{ width: '100%', maxWidth: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.88rem', padding: '8px 12px' }}
            >
              <i className="ph ph-share-network"></i>
              Share with Friends
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
