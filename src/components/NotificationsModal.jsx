import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './NotificationsModal.css';

function formatFullTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Just now';
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationsModal({
  isOpen,
  onClose,
  notifications = [],
  unreadCount = 0,
  currentUser,
  onMarkAllRead,
  onNotificationClick,
  onApproveJoinRequest,
  onDeclineJoinRequest,
  onAcceptInvitation,
  onDeclineInvitation,
  isActingOnNotif = false
}) {
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'UNREAD' | 'REQUESTS' | 'ACTIVITIES'
  const [searchQuery, setSearchQuery] = useState('');

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Tab counts
  const counts = useMemo(() => {
    const unread = notifications.filter(n => n.status === 'UNREAD').length;
    const requests = notifications.filter(n => n.type === 'JOIN_REQUEST' || n.type === 'GROUP_INVITATION').length;
    const activities = notifications.filter(n => 
      n.type === 'EXPENSE_ADDED' || n.type === 'EXPENSE_UPDATED' || n.type === 'SETTLEMENT_RECORDED' ||
      n.type === 'JOIN_APPROVED' || n.type === 'INVITATION_ACCEPTED' || n.type === 'JOIN_DECLINED' || n.type === 'INVITATION_DECLINED'
    ).length;
    return {
      all: notifications.length,
      unread,
      requests,
      activities
    };
  }, [notifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      // Tab filter
      if (activeTab === 'UNREAD' && n.status !== 'UNREAD') return false;
      if (activeTab === 'REQUESTS' && n.type !== 'JOIN_REQUEST' && n.type !== 'GROUP_INVITATION') return false;
      if (activeTab === 'ACTIVITIES') {
        const isActivity = n.type === 'EXPENSE_ADDED' || n.type === 'EXPENSE_UPDATED' || n.type === 'SETTLEMENT_RECORDED' ||
          n.type === 'JOIN_APPROVED' || n.type === 'INVITATION_ACCEPTED' || n.type === 'JOIN_DECLINED' || n.type === 'INVITATION_DECLINED';
        if (!isActivity) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (n.title || '').toLowerCase().includes(q);
        const descMatch = (n.message || '').toLowerCase().includes(q);
        const groupMatch = (n.data?.groupName || '').toLowerCase().includes(q);
        const inviterMatch = (n.data?.inviterName || n.data?.inviterUsername || '').toLowerCase().includes(q);
        const requesterMatch = (n.data?.requesterName || n.data?.requesterUsername || '').toLowerCase().includes(q);
        return titleMatch || descMatch || groupMatch || inviterMatch || requesterMatch;
      }

      return true;
    });
  }, [notifications, activeTab, searchQuery]);

  if (!isOpen) return null;

  return createPortal(
    <div className="notif-modal-overlay" onClick={onClose}>
      <div 
        className="notif-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-modal-title"
      >
        {/* Modal Header */}
        <div className="notif-modal-header">
          <div className="notif-modal-title-group">
            <div className="notif-modal-icon-badge">
              <i className="ph ph-bell"></i>
            </div>
            <div>
              <h3 id="notif-modal-title">All Notifications</h3>
              <p>
                {notifications.length} total • {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
          </div>

          <div className="notif-modal-header-actions">
            {unreadCount > 0 && onMarkAllRead && (
              <button
                type="button"
                className="notif-modal-mark-read-btn"
                onClick={onMarkAllRead}
                title="Mark all notifications as read"
              >
                <i className="ph ph-checks"></i>
                <span>Mark all read</span>
              </button>
            )}
            <button
              type="button"
              className="notif-modal-close-btn"
              onClick={onClose}
              title="Close notifications (Esc)"
              aria-label="Close"
            >
              <i className="ph ph-x"></i>
            </button>
          </div>
        </div>

        {/* Modal Controls: Search & Tabs */}
        <div className="notif-modal-controls">
          <div className="notif-search-wrapper">
            <i className="ph ph-magnifying-glass notif-search-icon"></i>
            <input
              type="text"
              className="notif-search-input"
              placeholder="Search notifications by group, person, or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <i
                className="ph ph-x notif-search-clear"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              ></i>
            )}
          </div>

          <div className="notif-filter-tabs">
            <button
              type="button"
              className={`notif-filter-tab ${activeTab === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveTab('ALL')}
            >
              <span>All</span>
              <span className="notif-tab-badge">{counts.all}</span>
            </button>
            <button
              type="button"
              className={`notif-filter-tab ${activeTab === 'UNREAD' ? 'active' : ''}`}
              onClick={() => setActiveTab('UNREAD')}
            >
              <span>Unread</span>
              <span className="notif-tab-badge">{counts.unread}</span>
            </button>
            <button
              type="button"
              className={`notif-filter-tab ${activeTab === 'REQUESTS' ? 'active' : ''}`}
              onClick={() => setActiveTab('REQUESTS')}
            >
              <span>Requests & Invites</span>
              <span className="notif-tab-badge">{counts.requests}</span>
            </button>
            <button
              type="button"
              className={`notif-filter-tab ${activeTab === 'ACTIVITIES' ? 'active' : ''}`}
              onClick={() => setActiveTab('ACTIVITIES')}
            >
              <span>Activities</span>
              <span className="notif-tab-badge">{counts.activities}</span>
            </button>
          </div>
        </div>

        {/* Modal Body / Notification Cards */}
        <div className="notif-modal-body">
          {filteredNotifications.length === 0 ? (
            <div className="notif-empty-state">
              <div className="notif-empty-icon">
                <i className={searchQuery ? 'ph ph-magnifying-glass' : 'ph ph-bell-slash'}></i>
              </div>
              <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600 }}>
                {searchQuery ? 'No matching notifications' : 'No notifications in this view'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', maxWidth: '320px', lineHeight: 1.4 }}>
                {searchQuery
                  ? `No notifications found matching "${searchQuery}". Try a different keyword.`
                  : activeTab === 'UNREAD'
                  ? "Great job! You have read all your notifications."
                  : "You will receive updates here whenever there are group requests, invitations, or new expenses."}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '6px 14px', marginTop: '6px' }}
                  onClick={() => setSearchQuery('')}
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            filteredNotifications.map(notif => {
              const isUnread = notif.status === 'UNREAD';
              const isJoinRequest = notif.type === 'JOIN_REQUEST';
              const isInvitation = notif.type === 'GROUP_INVITATION';
              const isPending = notif.status === 'UNREAD' || notif.status === 'PENDING';

              let iconClass = 'ph-bell';
              let iconBoxType = 'info';

              if (isJoinRequest) {
                iconClass = 'ph-user-plus';
                iconBoxType = 'warning';
              } else if (isInvitation) {
                iconClass = 'ph-envelope-simple';
                iconBoxType = 'accent';
              } else if (notif.type === 'JOIN_APPROVED' || notif.type === 'INVITATION_ACCEPTED') {
                iconClass = 'ph-check-circle';
                iconBoxType = 'success';
              } else if (notif.type === 'JOIN_DECLINED' || notif.type === 'INVITATION_DECLINED') {
                iconClass = 'ph-x-circle';
                iconBoxType = 'warning';
              } else if (notif.type === 'EXPENSE_ADDED' || notif.type === 'EXPENSE_UPDATED') {
                iconClass = 'ph-receipt';
                iconBoxType = 'accent';
              } else if (notif.type === 'SETTLEMENT_RECORDED') {
                iconClass = 'ph-handshake';
                iconBoxType = 'success';
              }

              return (
                <div
                  key={notif.id}
                  className={`notif-card ${isUnread ? 'unread' : ''}`}
                  onClick={() => onNotificationClick?.(notif)}
                  title="Click to view details"
                >
                  <div className={`notif-card-icon-box ${iconBoxType}`}>
                    <i className={`ph ${iconClass}`}></i>
                  </div>

                  <div className="notif-card-body">
                    <div className="notif-card-header">
                      <div className="notif-card-title">
                        {isUnread && <span className="notif-unread-dot" title="Unread"></span>}
                        <span>{notif.title}</span>
                      </div>
                      <span className="notif-card-time" title={formatFullTime(notif.createdAt)}>
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                    </div>

                    <p className="notif-card-desc">{notif.message}</p>

                    {/* Metadata tags */}
                    <div className="notif-card-tags">
                      {notif.data?.groupName && (
                        <span className="notif-tag group-tag">
                          <i className="ph ph-users-three"></i>
                          <span>{notif.data.groupName}</span>
                        </span>
                      )}
                      {(notif.data?.inviterUsername || notif.data?.inviterName) && (
                        <span className="notif-tag">
                          <i className="ph ph-user"></i>
                          <span>From: {notif.data.inviterUsername ? `@${notif.data.inviterUsername.replace(/^@/, '')}` : notif.data.inviterName}</span>
                        </span>
                      )}
                      {(notif.data?.requesterUsername || notif.data?.requesterName) && (
                        <span className="notif-tag">
                          <i className="ph ph-user"></i>
                          <span>From: {notif.data.requesterUsername ? `@${notif.data.requesterUsername.replace(/^@/, '')}` : notif.data.requesterName}</span>
                        </span>
                      )}
                    </div>

                    {/* Join Request Actions */}
                    {isJoinRequest && (
                      <div className="notif-card-actions" onClick={(e) => e.stopPropagation()}>
                        {isPending ? (
                          <>
                            <button
                              type="button"
                              className="notif-btn notif-btn-approve"
                              disabled={isActingOnNotif}
                              onClick={(e) => onApproveJoinRequest?.(e, notif)}
                              title="Approve join request"
                            >
                              <i className="ph ph-check"></i>
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              className="notif-btn notif-btn-decline"
                              disabled={isActingOnNotif}
                              onClick={(e) => onDeclineJoinRequest?.(e, notif)}
                              title="Decline join request"
                            >
                              <i className="ph ph-x"></i>
                              <span>Decline</span>
                            </button>
                          </>
                        ) : notif.status === 'RESOLVED' || notif.status === 'APPROVED' ? (
                          <span className="notif-status-badge approved">Approved ✓</span>
                        ) : (
                          <span className="notif-status-badge declined">Declined ✕</span>
                        )}
                      </div>
                    )}

                    {/* Group Invitation Actions */}
                    {isInvitation && (
                      <div className="notif-card-actions" onClick={(e) => e.stopPropagation()}>
                        {isPending ? (
                          <>
                            <button
                              type="button"
                              className="notif-btn notif-btn-approve"
                              disabled={isActingOnNotif}
                              onClick={(e) => onAcceptInvitation?.(e, notif)}
                              title="Accept invitation"
                            >
                              <i className="ph ph-check"></i>
                              <span>Accept</span>
                            </button>
                            <button
                              type="button"
                              className="notif-btn notif-btn-decline"
                              disabled={isActingOnNotif}
                              onClick={(e) => onDeclineInvitation?.(e, notif)}
                              title="Decline invitation"
                            >
                              <i className="ph ph-x"></i>
                              <span>Decline</span>
                            </button>
                          </>
                        ) : notif.status === 'RESOLVED' || notif.status === 'ACCEPTED' ? (
                          <span className="notif-status-badge approved">Accepted ✓</span>
                        ) : (
                          <span className="notif-status-badge declined">Declined ✕</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="notif-modal-footer">
          <span className="notif-modal-footer-stats">
            Showing {filteredNotifications.length} of {notifications.length} notification{notifications.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '6px 16px' }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
