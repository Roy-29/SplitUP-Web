import React, { useState } from 'react';
import { isTursoConfigured, tursoCreateGroup, tursoAddMember } from '../lib/turso';
import './Modal.css';

export default function NewGroupModal({ isOpen, onClose, onSuccess, currentUser }) {
  const [groupName, setGroupName] = useState('');
  const [memberName, setMemberName] = useState('');
  const [members, setMembers] = useState(currentUser ? [currentUser.name] : []);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleAddMember = (e) => {
    e.preventDefault();
    const trimmed = memberName.trim();
    if (trimmed && !members.includes(trimmed)) {
      setMembers([...members, trimmed]);
      setMemberName('');
    }
  };

  const handleRemoveMember = (name) => {
    setMembers(members.filter(m => m !== name));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || members.length < 2) return;

    setIsLoading(true);
    
    try {
      if (isTursoConfigured) {
        const group = await tursoCreateGroup(groupName.trim(), currentUser?.id || 'user');
        for (const m of members) {
          if (currentUser && m === currentUser.name) {
            await tursoAddMember(group.id, currentUser.name, currentUser.email || '', currentUser.id);
          } else {
            const isEmail = m.includes('@');
            await tursoAddMember(group.id, isEmail ? m.split('@')[0] : m, isEmail ? m.trim().toLowerCase() : '');
          }
        }
        alert(`Group "${group.name}" created successfully!\nInvite Code: ${group.joinCode}\n(You can share this code with friends so they can join!)`);
      }
      setIsLoading(false);
      setGroupName('');
      setMemberName('');
      setMembers(currentUser ? [currentUser.name] : []);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Error creating group:", err);
      setIsLoading(false);
      onSuccess?.();
      onClose();
    }
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="modal-icon" style={{ background: 'rgba(108, 92, 231, 0.15)', color: 'var(--accent-primary)' }}>
              <i className="ph ph-users-three"></i>
            </div>
            <div>
              <h2>Create Group</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '2px' }}>Add members to start splitting</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <i className="ph ph-x"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Group Name</label>
            <input 
              type="text" 
              placeholder="e.g., Weekend Trip, Flatmates" 
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Members ({members.length})</label>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {members.map(name => (
                <div key={name} style={{ 
                  display: 'flex', alignItems: 'center', gap: '6px', 
                  background: 'rgba(108, 92, 231, 0.1)', padding: '6px 12px', 
                  borderRadius: '16px', fontSize: '0.85rem', color: 'var(--text-primary)'
                }}>
                  {name}
                  {name !== currentUser?.name && (
                    <i 
                      className="ph ph-x" 
                      style={{ cursor: 'pointer', opacity: 0.6 }} 
                      onClick={() => handleRemoveMember(name)}
                    />
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="Enter name and press Add" 
                value={memberName}
                onChange={e => setMemberName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddMember(e);
                  }
                }}
                className="form-input"
                style={{ flex: 1 }}
              />
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={handleAddMember}
                disabled={!memberName.trim()}
                style={{ padding: '0 16px' }}
              >
                Add
              </button>
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: '32px' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={isLoading || !groupName.trim() || members.length < 2}
            >
              {isLoading ? (
                <span><i className="ph ph-spinner ph-spin"></i> Creating...</span>
              ) : (
                'Create Group'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
