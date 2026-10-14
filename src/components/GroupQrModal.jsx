import React, { useState, useRef } from 'react';
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

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div 
        className="modal-content glass-panel" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '440px', textAlign: 'center' }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
            <div 
              style={{ 
                background: 'rgba(108, 92, 231, 0.15)', 
                color: 'var(--accent-primary)', 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              <i className="ph ph-qr-code" style={{ fontSize: '1.3rem' }}></i>
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Group QR Code</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '2px 0 0' }}>
                Scan to join instantly
              </p>
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} style={{ width: '32px', height: '32px' }}>
            <i className="ph ph-x"></i>
          </button>
        </div>

        {/* Group Info Badge */}
        <div 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--glass-border)',
            padding: '8px 16px',
            borderRadius: '24px',
            marginBottom: '20px'
          }}
        >
          <div 
            style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '50%', 
              background: `${avatarColor}25`, 
              color: avatarColor, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '0.9rem'
            }}
          >
            {initial}
          </div>
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{group.name}</span>
        </div>

        {/* QR Code Card */}
        <div 
          style={{
            background: '#ffffff',
            padding: '20px',
            borderRadius: '20px',
            display: 'inline-block',
            boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
            marginBottom: '18px'
          }}
        >
          <QRCodeCanvas 
            id="group-qr-canvas"
            value={inviteUrl}
            size={220}
            level="H"
            marginSize={1}
            ref={canvasRef}
          />
        </div>

        {/* 6-Character Join Code Box */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Invite Code
          </div>
          <div 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--glass-border)',
              borderRadius: '12px',
              padding: '6px 14px'
            }}
          >
            <span style={{ 
              fontFamily: 'monospace', 
              fontSize: '1.35rem', 
              fontWeight: '800', 
              letterSpacing: '3px',
              color: 'var(--accent-primary)' 
            }}>
              {joinCode}
            </span>
            <button 
              type="button" 
              className="btn-icon"
              onClick={handleCopyCode}
              title="Copy code"
              style={{ width: '32px', height: '32px', color: copiedCode ? 'var(--success)' : 'inherit' }}
            >
              <i className={copiedCode ? "ph ph-check" : "ph ph-copy"}></i>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <button 
            type="button" 
            className="btn-secondary"
            onClick={handleCopyLink}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <i className={copiedLink ? "ph ph-check" : "ph ph-link"}></i>
            {copiedLink ? 'Link Copied!' : 'Copy Link'}
          </button>

          <button 
            type="button" 
            className="btn-secondary"
            onClick={handleDownload}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
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
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <i className="ph ph-share-network"></i>
            Share with Friends
          </button>
        )}
      </div>
    </div>
  );
}
