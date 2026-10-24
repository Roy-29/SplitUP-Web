import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  isTursoConfigured, 
  tursoCreateGroup, 
  tursoAddMember, 
  tursoInviteUserToGroup,
  tursoSearchUsers, 
  tursoGetSuggestedUsers 
} from '../lib/turso';
import { LocalDatabase } from '../store/db';
import UserAvatar from './UserAvatar';
import './Modal.css';

export default function NewGroupModal({ isOpen, onClose, onSuccess, currentUser }) {
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Initialize selected users with current user as the creator
  useEffect(() => {
    if (currentUser) {
      const creatorUsername = currentUser.username || (currentUser.email ? currentUser.email.split('@')[0] : 'you');
      setSelectedUsers([{
        id: currentUser.id,
        name: currentUser.name,
        username: creatorUsername,
        email: currentUser.email,
        avatar: currentUser.avatar || '',
        isCreator: true
      }]);
    } else {
      setSelectedUsers([]);
    }
    setGroupName('');
    setSearchQuery('');
    setSearchResults([]);
    setErrorMsg('');
  }, [isOpen, currentUser]);

  // Load suggested registered users when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadSuggestions = async () => {
      try {
        const excludeIds = selectedUsers.flatMap(u => [u.id, u.email, u.username].filter(Boolean));
        if (isTursoConfigured) {
          const suggestions = await tursoGetSuggestedUsers(excludeIds, 6);
          setSuggestedUsers(suggestions);
        } else {
          const suggestions = LocalDatabase.searchUsers('', excludeIds);
          setSuggestedUsers(suggestions);
        }
      } catch (err) {
        console.warn("Could not load suggested users:", err);
      }
    };

    loadSuggestions();
  }, [isOpen, selectedUsers.length]);

  // Debounced search for registered users
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const excludeIds = selectedUsers.flatMap(u => [u.id, u.email, u.username].filter(Boolean));
        let results = [];
        if (isTursoConfigured) {
          results = await tursoSearchUsers(trimmed, excludeIds);
        } else {
          results = LocalDatabase.searchUsers(trimmed, excludeIds);
        }
        setSearchResults(results);
      } catch (err) {
        console.error("Search users error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, selectedUsers]);

  if (!isOpen) return null;

  const handleSelectUser = (user) => {
    if (selectedUsers.some(u => String(u.id) === String(user.id))) return;
    setSelectedUsers(prev => [...prev, user]);
    setSearchQuery('');
    setSearchResults([]);
    setErrorMsg('');
  };

  const handleRemoveUser = (userId) => {
    setSelectedUsers(prev => prev.filter(u => String(u.id) !== String(userId)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!groupName.trim()) {
      setErrorMsg('Please enter a group name.');
      return;
    }

    if (selectedUsers.length < 1) {
      setErrorMsg('Please select at least one member or ensure you are logged in.');
      return;
    }

    setIsLoading(true);

    try {
      if (isTursoConfigured) {
        const group = await tursoCreateGroup(groupName.trim(), currentUser?.id || 'user');
        
        // Add creator immediately
        await tursoAddMember(group.id, currentUser.name, currentUser.email || '', currentUser.id, currentUser.phone || '');

        // Dispatch invitations to all other selected registered users
        const otherUsers = selectedUsers.filter(u => String(u.id) !== String(currentUser.id));
        let invitedCount = 0;
        for (const u of otherUsers) {
          try {
            await tursoInviteUserToGroup(group.id, u.id, currentUser);
            invitedCount++;
          } catch (invErr) {
            console.warn(`Could not invite ${u.name}:`, invErr);
          }
        }

        const notice = invitedCount > 0 
          ? `Invitations sent to ${invitedCount} member(s). Once they accept from their notifications, they will appear in the group.`
          : 'You can share this code or invite friends anytime!';

        alert(`Group "${group.name}" created successfully!\n\nJoin Code: ${group.joinCode}\n\n${notice}`);
      } else {
        const groupId = `grp_${Date.now()}`;
        for (const u of selectedUsers) {
          LocalDatabase.addMember({
            groupId,
            name: u.name,
            email: u.email || '',
            userId: u.id,
            phone: u.phone || ''
          });
        }
      }

      setIsLoading(false);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Error creating group:", err);
      setErrorMsg(err.message || 'Failed to create group.');
      setIsLoading(false);
    }
  };

  const displayedList = searchQuery.trim() ? searchResults : suggestedUsers;

  return createPortal(
    <div className="modal-overlay animate-fade-in" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal-content glass-panel" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="modal-icon" style={{ background: 'rgba(108, 92, 231, 0.15)', color: 'var(--accent-primary)' }}>
              <i className="ph ph-users-three"></i>
            </div>
            <div>
              <h2>Create Group</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '2px' }}>
                Search registered users to build your circle
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} title="Close">
            <i className="ph ph-x"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {errorMsg && (
            <div style={{ 
              background: 'rgba(235, 77, 75, 0.12)', 
              border: '1px solid rgba(235, 77, 75, 0.3)', 
              color: 'var(--danger)', 
              borderRadius: '8px', 
              padding: '10px 14px', 
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <i className="ph ph-warning-circle" style={{ fontSize: '1.1rem' }}></i>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Group Name Field */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.88rem', fontWeight: 600 }}>Group Name *</label>
            <input 
              type="text" 
              placeholder="e.g., Weekend Trip, Flatmates, Boi Mela" 
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              required
              className="form-input"
              autoFocus
            />
          </div>

          {/* Selected Members Section */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>Group Members ({selectedUsers.length})</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                {selectedUsers.length >= 2 ? 'Ready to create' : 'Add at least 1 more member'}
              </span>
            </label>

            {/* Selected Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '40px', padding: '6px 0' }}>
              {selectedUsers.map(user => (
                <div 
                  key={user.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    background: user.isCreator ? 'rgba(108, 92, 231, 0.2)' : 'var(--bg-tertiary)', 
                    border: `1px solid ${user.isCreator ? 'rgba(108, 92, 231, 0.4)' : 'var(--glass-border)'}`,
                    padding: '4px 10px', 
                    borderRadius: '20px', 
                    fontSize: '0.84rem', 
                    color: 'var(--text-primary)'
                  }}
                >
                  <UserAvatar user={user} size={24} fontSize="0.65rem" />
                  <span style={{ fontWeight: 600 }}>{user.name}</span>
                  {user.username && (
                    <span style={{ color: 'var(--accent-secondary)', fontSize: '0.75rem', opacity: 0.9 }}>
                      @{user.username}
                    </span>
                  )}
                  {user.isCreator ? (
                    <span style={{ fontSize: '0.68rem', background: 'var(--accent-primary)', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                      Creator
                    </span>
                  ) : (
                    <i 
                      className="ph ph-x" 
                      style={{ cursor: 'pointer', opacity: 0.6, fontSize: '0.85rem', marginLeft: '2px' }} 
                      onClick={() => handleRemoveUser(user.id)}
                      title="Remove member"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Search Registered Users Section */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="ph ph-magnifying-glass" style={{ color: 'var(--accent-primary)' }}></i>
              Search Registered Users
            </label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Search by @username, email, or full name..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '36px' }}
              />
              <i 
                className={`ph ${isSearching ? 'ph-spinner ph-spin' : 'ph-user-focus'}`} 
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              {searchQuery && (
                <i 
                  className="ph ph-x"
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-muted)' }}
                />
              )}
            </div>

            {/* Search Results / Suggestions Dropdown */}
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {searchQuery.trim() ? `Search Results (${searchResults.length})` : 'Suggested Contacts'}
              </div>

              {isSearching ? (
                <div style={{ padding: '14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <i className="ph ph-spinner ph-spin" style={{ marginRight: '6px' }}></i> Searching registered accounts...
                </div>
              ) : displayedList.length === 0 ? (
                <div style={{ 
                  padding: '16px', 
                  textAlign: 'center', 
                  background: 'var(--bg-tertiary)', 
                  borderRadius: '10px', 
                  border: '1px dashed var(--glass-border)',
                  color: 'var(--text-muted)',
                  fontSize: '0.83rem'
                }}>
                  {searchQuery.trim() ? (
                    <>
                      <i className="ph ph-user-circle-dashed" style={{ fontSize: '1.6rem', display: 'block', marginBottom: '4px', opacity: 0.6 }}></i>
                      <span>No registered user found for "<strong>{searchQuery}</strong>".</span>
                      <div style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-secondary)' }}>
                        Users must have a registered SplitUP account to be added.
                      </div>
                    </>
                  ) : (
                    <span>All your registered contacts are already added.</span>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                  {displayedList.map(u => (
                    <div 
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: '1px solid var(--glass-border)',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      className="hover-card"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <UserAvatar user={u} size={32} fontSize="0.75rem" />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{u.name}</span>
                            {u.username && (
                              <span style={{ fontSize: '0.74rem', color: 'var(--accent-secondary)' }}>
                                @{u.username}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.email}
                          </div>
                        </div>
                      </div>

                      <button 
                        type="button" 
                        className="btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectUser(u);
                        }}
                        style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px' }}
                      >
                        <i className="ph ph-plus"></i> Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Unregistered friend note */}
            <div style={{ 
              marginTop: '12px', 
              padding: '10px 12px', 
              background: 'rgba(108, 92, 231, 0.08)', 
              borderRadius: '8px', 
              border: '1px solid rgba(108, 92, 231, 0.2)',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.4
            }}>
              <i className="ph ph-info" style={{ color: 'var(--accent-primary)', marginRight: '5px' }}></i>
              Can't find a friend? Share your group's invite code after creating so they can sign up and join with their unique identity.
            </div>
          </div>

          {/* Footer Actions */}
          <div className="modal-footer" style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={isLoading || !groupName.trim() || selectedUsers.length < 2}
            >
              {isLoading ? (
                <span><i className="ph ph-spinner ph-spin"></i> Creating...</span>
              ) : (
                <>
                  <i className="ph ph-check"></i> Create Group ({selectedUsers.length} members)
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
