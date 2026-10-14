import React, { useState, useEffect } from 'react';
import { avatarColorForName } from './GroupCard';

export default function UserAvatar({ 
  user, 
  size, 
  className = '', 
  style = {}, 
  fontSize,
  showOnline = false 
}) {
  const [imageError, setImageError] = useState(false);

  const name = user?.name || user?.email || 'User';
  const avatarUrl = user?.avatar;
  const avatarColor = avatarColorForName(name);

  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  // Generate clean 1-2 character initials
  const initials = name
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const defaultFontSize = fontSize || (size ? `${Math.round(size * 0.4)}px` : '0.95rem');

  return (
    <div
      className={`user-avatar-root ${className}`}
      style={{
        position: 'relative',
        width: size ? `${size}px` : '100%',
        height: size ? `${size}px` : '100%',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
        background: avatarUrl && !imageError ? 'var(--bg-tertiary)' : `${avatarColor}25`,
        color: avatarColor,
        fontWeight: 700,
        fontSize: defaultFontSize,
        userSelect: 'none',
        ...style
      }}
    >
      {avatarUrl && !imageError ? (
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%',
            display: 'block'
          }}
        />
      ) : (
        <span style={{ lineHeight: 1 }}>{initials}</span>
      )}

      {showOnline && (
        <span 
          className="header-online-status" 
          style={{
            position: 'absolute',
            bottom: '2px',
            right: '2px',
            width: '8px',
            height: '8px',
            backgroundColor: 'var(--success)',
            border: '2px solid var(--bg-secondary)',
            borderRadius: '50%'
          }}
        />
      )}
    </div>
  );
}
