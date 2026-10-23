import React, { useState } from 'react';
import GroupCard from './GroupCard';
import JoinGroupModal from './JoinGroupModal';
import GroupQrModal from './GroupQrModal';
import GroupDetailsModal from './GroupDetailsModal';

export default function GroupsView({ 
  groups = [], 
  members = [],
  expenses = [],
  settlements = [],
  onNewGroupClick, 
  currentUser, 
  onDeleteGroup, 
  onUpdateGroup,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  currencyCode = 'BDT', 
  onRefreshData,
  onAddExpense,
  onSettleUp,
  onDeleteExpense,
  onDeleteSettlement,
  onSelectExpense,
  initialSelectedGroup = null
}) {
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectedQrGroup, setSelectedQrGroup] = useState(null);
  const [selectedGroupDetails, setSelectedGroupDetails] = useState(initialSelectedGroup);

  return (
    <>
      <div className="glass-panel animate-fade-in delay-2" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Your Groups</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Click on any group to view full details, add shared expenses, settle balances, and manage members
            </p>
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
                onClick={() => setSelectedGroupDetails(group)} 
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

      {/* Interactive Group Details Modal */}
      <GroupDetailsModal
        isOpen={!!selectedGroupDetails}
        onClose={() => setSelectedGroupDetails(null)}
        group={selectedGroupDetails ? (groups.find(g => String(g.id) === String(selectedGroupDetails.id)) || selectedGroupDetails) : null}
        currentUser={currentUser}
        members={members}
        expenses={expenses}
        settlements={settlements}
        currencyCode={currencyCode}
        onAddExpense={(mode, grpId) => {
          setSelectedGroupDetails(null);
          onAddExpense?.(mode, grpId);
        }}
        onSettleUp={(grpId, targetDebt) => {
          setSelectedGroupDetails(null);
          onSettleUp?.(grpId, targetDebt);
        }}
        onShowQr={(grp) => {
          setSelectedQrGroup(grp);
        }}
        onDeleteGroup={(grpId) => {
          setSelectedGroupDetails(null);
          onDeleteGroup?.(grpId);
        }}
        onUpdateGroup={onUpdateGroup}
        onAddMember={onAddMember}
        onUpdateMember={onUpdateMember}
        onDeleteMember={onDeleteMember}
        onDeleteExpense={onDeleteExpense}
        onDeleteSettlement={onDeleteSettlement}
        onSelectExpense={onSelectExpense}
      />
    </>
  );
}
