import React, { useState } from 'react';
import GroupCard from './GroupCard';
import JoinGroupModal from './JoinGroupModal';
import GroupQrModal from './GroupQrModal';

export default function GroupsView({ 
  groups, 
  onNewGroupClick, 
  currentUser, 
  onDeleteGroup, 
  currencyCode = 'BDT', 
  onRefreshData 
}) {
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectedQrGroup, setSelectedQrGroup] = useState(null);

  return (
    <>
      <div className="glass-panel animate-fade-in delay-2" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Your Groups</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Manage your shared expenses and invite friends</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-secondary" onClick={() => setIsJoinModalOpen(true)}>
              <i className="ph ph-qr-code"></i>
              Join with Code / QR
            </button>
            <button className="btn-primary" onClick={onNewGroupClick}>
              <i className="ph ph-plus"></i>
              New Group
            </button>
          </div>
        </div>

        {groups && groups.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {groups.map(group => (
              <GroupCard 
                key={group.id} 
                group={group} 
                onDeleteGroup={onDeleteGroup}
                onShowQr={setSelectedQrGroup}
                currencyCode={currencyCode}
                onClick={() => console.log('Group clicked:', group.id)} 
              />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--bg-item)', border: '1px solid var(--glass-border)', borderRadius: '16px' }}>
            <div style={{ 
              width: '64px', height: '64px', background: 'rgba(108, 92, 231, 0.1)', 
              color: 'var(--accent-primary)', fontSize: '32px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
            }}>
              <i className="ph ph-users-three"></i>
            </div>
            <h3 style={{ marginBottom: '8px' }}>No groups yet</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Create your first group to start splitting, or join an existing group with an invite code or QR scan.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setIsJoinModalOpen(true)}>
                <i className="ph ph-qr-code"></i> Join with Code / QR
              </button>
              <button className="btn-primary" onClick={onNewGroupClick}>
                <i className="ph ph-plus"></i> Create Group
              </button>
            </div>
          </div>
        )}
      </div>

      <JoinGroupModal 
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onSuccess={onRefreshData}
        currentUser={currentUser}
      />

      <GroupQrModal
        isOpen={!!selectedQrGroup}
        onClose={() => setSelectedQrGroup(null)}
        group={selectedQrGroup}
      />
    </>
  );
}
