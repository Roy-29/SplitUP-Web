import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { formatSimple } from '../lib/CurrencyManager';
import { calculateBalances, simplifyDebts } from '../lib/BalanceCalculator';
import { avatarColorForName } from './GroupCard';
import { normalizeCategory } from './ExpensesView';
import './Modal.css';

const CATEGORY_META = {
  'Groceries': { icon: 'ph-shopping-cart', color: '#00b894', bg: 'rgba(0, 184, 148, 0.15)' },
  'Shopping': { icon: 'ph-bag', color: '#e84393', bg: 'rgba(232, 67, 147, 0.15)' },
  'Food & Dining': { icon: 'ph-pizza', color: '#e17055', bg: 'rgba(225, 112, 85, 0.15)' },
  'Books & Learning': { icon: 'ph-book-open', color: '#0984e3', bg: 'rgba(9, 132, 227, 0.15)' },
  'Bills & Utilities': { icon: 'ph-lightning', color: '#fdcb6e', bg: 'rgba(253, 203, 110, 0.15)' },
  'Transport & Travel': { icon: 'ph-bus', color: '#6c5ce7', bg: 'rgba(108, 92, 231, 0.15)' },
  'Health & Medical': { icon: 'ph-first-aid', color: '#d63031', bg: 'rgba(214, 48, 49, 0.15)' },
  'Other': { icon: 'ph-tag', color: '#a29bfe', bg: 'rgba(162, 155, 254, 0.15)' },
  'FOOD': { icon: 'ph-pizza', color: '#e17055', bg: 'rgba(225, 112, 85, 0.15)' },
  'TRAVEL': { icon: 'ph-airplane-tilt', color: '#0984e3', bg: 'rgba(9, 132, 227, 0.15)' },
  'GROCERIES': { icon: 'ph-shopping-cart', color: '#00b894', bg: 'rgba(0, 184, 148, 0.15)' },
  'ENTERTAINMENT': { icon: 'ph-game-controller', color: '#fdcb6e', bg: 'rgba(253, 203, 110, 0.15)' },
  'UTILITIES': { icon: 'ph-lightning', color: '#e84393', bg: 'rgba(232, 67, 147, 0.15)' },
  'HEALTH': { icon: 'ph-heartbeat', color: '#d63031', bg: 'rgba(214, 48, 49, 0.15)' },
};

function getCategoryMeta(catName = '') {
  const normalized = normalizeCategory(catName);
  if (CATEGORY_META[normalized]) return CATEGORY_META[normalized];
  for (const [key, val] of Object.entries(CATEGORY_META)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return { icon: 'ph-tag', color: '#a29bfe', bg: 'rgba(162, 155, 254, 0.15)' };
}

export default function GroupDetailsModal({
  isOpen,
  onClose,
  group,
  currentUser,
  members = [],
  expenses = [],
  settlements = [],
  currencyCode = 'BDT',
  onAddExpense,
  onSettleUp,
  onShowQr,
  onDeleteGroup,
  onDeleteExpense,
  onDeleteSettlement,
  onSelectExpense
}) {
  const [activeTab, setActiveTab] = useState('EXPENSES'); // 'EXPENSES' | 'MEMBERS' | 'SETTLEMENTS'
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen || !group) return null;

  const avatarColor = avatarColorForName(group.name);
  const initial = group.name ? group.name.charAt(0).toUpperCase() : '?';

  // Filter members, expenses, and settlements for this specific group
  const groupMembers = members.filter(m => String(m.groupId) === String(group.id));
  const effectiveMembers = groupMembers.length > 0 ? groupMembers : (currentUser ? [{ id: currentUser.id, name: currentUser.name, email: currentUser.email }] : []);

  const groupExpenses = expenses.filter(e => String(e.groupId) === String(group.id));
  const groupSettlements = settlements.filter(s => String(s.groupId) === String(group.id));

  // Compute domain balances and simplified debts for this specific group
  const groupBalances = useMemo(() => {
    return calculateBalances(effectiveMembers, groupExpenses, groupSettlements);
  }, [effectiveMembers, groupExpenses, groupSettlements]);

  const groupDebts = useMemo(() => {
    return simplifyDebts(groupBalances);
  }, [groupBalances]);

  // Current user's balance in this group
  const myBalance = groupBalances.find(b => String(b.memberId) === String(currentUser?.id)) || { netBalance: 0, totalPaid: 0 };
  const totalGroupSpent = groupExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Filter expenses by search
  const filteredExpenses = searchTerm.trim()
    ? groupExpenses.filter(e => 
        (e.title && e.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.payerName && e.payerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.category && e.category.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : groupExpenses;

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleCopyCode = () => {
    if (!group.joinCode) return;
    navigator.clipboard.writeText(group.joinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content glass-panel animate-fade-in" 
        style={{ maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto', padding: '24px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: `${avatarColor}25`,
              color: avatarColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              fontWeight: 800,
              flexShrink: 0
            }}>
              {initial}
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', margin: 0, color: 'var(--text-primary)' }}>
                {group.name}
              </h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {effectiveMembers.length} member{effectiveMembers.length === 1 ? '' : 's'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>•</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {groupExpenses.length} expense{groupExpenses.length === 1 ? '' : 's'}
                </span>

                {group.joinCode && (
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    style={{
                      background: 'rgba(108, 92, 231, 0.15)',
                      border: '1px solid rgba(108, 92, 231, 0.3)',
                      color: 'var(--accent-secondary)',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Click to copy join code"
                  >
                    <i className={`ph ${copiedCode ? 'ph-check' : 'ph-copy'}`}></i>
                    {copiedCode ? 'Copied!' : `Code: ${group.joinCode}`}
                  </button>
                )}

                {onShowQr && (
                  <button
                    type="button"
                    onClick={() => onShowQr(group)}
                    style={{
                      background: 'rgba(108, 92, 231, 0.15)',
                      border: '1px solid rgba(108, 92, 231, 0.3)',
                      color: 'var(--accent-primary)',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Show QR Code"
                  >
                    <i className="ph ph-qr-code"></i> QR
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {onDeleteGroup && (
              <button 
                type="button" 
                className="btn-icon delete-btn" 
                style={{ width: '32px', height: '32px' }}
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete group "${group.name}"?\nAll associated expenses and settlements will be permanently deleted.`)) {
                    onDeleteGroup(group.id);
                    onClose();
                  }
                }}
                title="Delete group"
              >
                <i className="ph ph-trash"></i>
              </button>
            )}
            <button type="button" className="btn-icon" onClick={onClose} style={{ width: '32px', height: '32px' }}>
              <i className="ph ph-x"></i>
            </button>
          </div>
        </div>

        {/* Financial Stat Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--glass-border)',
            borderRadius: '12px',
            padding: '14px 16px'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Group Spent
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {formatSimple(totalGroupSpent, currencyCode)}
            </div>
          </div>

          <div style={{
            background: myBalance.netBalance > 0 
              ? 'rgba(0, 184, 148, 0.1)' 
              : (myBalance.netBalance < 0 ? 'rgba(214, 48, 49, 0.1)' : 'var(--bg-tertiary)'),
            border: `1px solid ${myBalance.netBalance > 0 ? 'rgba(0, 184, 148, 0.3)' : (myBalance.netBalance < 0 ? 'rgba(214, 48, 49, 0.3)' : 'var(--glass-border)')}`,
            borderRadius: '12px',
            padding: '14px 16px'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Your Group Balance
            </div>
            <div style={{ 
              fontSize: '1.45rem', 
              fontWeight: 800, 
              color: myBalance.netBalance > 0 ? 'var(--success)' : (myBalance.netBalance < 0 ? 'var(--danger)' : 'var(--text-primary)'), 
              marginTop: '2px' 
            }}>
              {myBalance.netBalance > 0 ? `+${formatSimple(myBalance.netBalance, currencyCode)}` : (myBalance.netBalance < 0 ? `-${formatSimple(Math.abs(myBalance.netBalance), currencyCode)}` : 'Settled')}
            </div>
          </div>

          <div style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--glass-border)',
            borderRadius: '12px',
            padding: '14px 16px'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              You Paid
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--accent-secondary)', marginTop: '2px' }}>
              {formatSimple(myBalance.totalPaid || 0, currencyCode)}
            </div>
          </div>
        </div>

        {/* Quick Action Bar for Group */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => {
              onAddExpense?.('GROUP', group.id);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'center' }}
          >
            <i className="ph ph-plus"></i> Add Group Expense
          </button>

          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => {
              onSettleUp?.(group.id);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'center' }}
          >
            <i className="ph ph-hand-coins"></i> Settle Up
          </button>
        </div>

        {/* Group Tabs */}
        <div className="toggle-group" style={{ margin: '0 0 16px 0', width: '100%' }}>
          <button 
            type="button" 
            className={`toggle-btn ${activeTab === 'EXPENSES' ? 'active' : ''}`}
            onClick={() => setActiveTab('EXPENSES')}
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
          >
            <i className="ph ph-receipt"></i>
            <span>Expenses ({groupExpenses.length})</span>
          </button>
          <button 
            type="button" 
            className={`toggle-btn ${activeTab === 'MEMBERS' ? 'active' : ''}`}
            onClick={() => setActiveTab('MEMBERS')}
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
          >
            <i className="ph ph-users"></i>
            <span>Members ({effectiveMembers.length})</span>
          </button>
          <button 
            type="button" 
            className={`toggle-btn ${activeTab === 'SETTLEMENTS' ? 'active' : ''}`}
            onClick={() => setActiveTab('SETTLEMENTS')}
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
          >
            <i className="ph ph-handshake"></i>
            <span>Debts & History ({groupDebts.length})</span>
          </button>
        </div>

        {/* TAB 1: GROUP EXPENSES */}
        {activeTab === 'EXPENSES' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                All Group Bills ({filteredExpenses.length})
              </h4>
              {groupExpenses.length > 3 && (
                <input 
                  type="text" 
                  placeholder="Filter expenses..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ padding: '6px 12px', fontSize: '0.82rem', maxWidth: '170px' }}
                />
              )}
            </div>

            {filteredExpenses.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '36px 16px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px'
              }}>
                <i className="ph ph-receipt" style={{ fontSize: '2.5rem', color: 'var(--text-muted)', marginBottom: '8px' }}></i>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem' }}>No expenses recorded yet</h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Add a bill to split it among members of {group.name}.
                </p>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={() => onAddExpense?.('GROUP', group.id)}
                  style={{ margin: '0 auto', fontSize: '0.85rem' }}
                >
                  <i className="ph ph-plus"></i> Add First Expense
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                {filteredExpenses.map(expense => {
                  const meta = getCategoryMeta(expense.category);
                  const isPayer = String(expense.paidBy) === String(currentUser?.id);

                  return (
                    <div
                      key={expense.id}
                      onClick={() => onSelectExpense?.({ ...expense, groupName: group.name })}
                      style={{
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        borderRadius: '10px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--glass-border)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      className="hover-card"
                      title="Click to view details"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: meta.bg,
                          color: meta.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <i className={`ph ${meta.icon}`} style={{ fontSize: '1.25rem' }}></i>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {expense.title}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span style={{ color: meta.color, fontWeight: 500 }}>{normalizeCategory(expense.category)}</span>
                            <span>•</span>
                            <span>Paid by {isPayer ? 'You' : expense.payerName}</span>
                            <span>•</span>
                            <span>{formatDate(expense.date)}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {formatSimple(expense.amount, currencyCode)}
                        </span>
                        {onDeleteExpense && (
                          <button
                            type="button"
                            className="btn-icon delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete expense "${expense.title}"?`)) {
                                onDeleteExpense(expense.id);
                              }
                            }}
                            style={{ width: '28px', height: '28px' }}
                            title="Delete expense"
                          >
                            <i className="ph ph-trash" style={{ fontSize: '0.85rem' }}></i>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MEMBERS & BALANCES */}
        {activeTab === 'MEMBERS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {effectiveMembers.map(member => {
              const b = groupBalances.find(bal => String(bal.memberId) === String(member.id)) || { netBalance: 0, totalPaid: 0 };
              const isCurrentUser = String(member.id) === String(currentUser?.id) || (member.email && member.email === currentUser?.email);
              const mColor = avatarColorForName(member.name);

              return (
                <div
                  key={member.id}
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    borderRadius: '10px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--glass-border)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: `${mColor}20`,
                      color: mColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '1rem',
                      flexShrink: 0
                    }}>
                      {member.name ? member.name.charAt(0).toUpperCase() : 'M'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{member.name}</span>
                        {isCurrentUser && (
                          <span style={{ fontSize: '0.7rem', background: 'rgba(108, 92, 231, 0.2)', color: 'var(--accent-secondary)', padding: '1px 6px', borderRadius: '4px' }}>
                            You
                          </span>
                        )}
                        {String(group.createdBy) === String(member.userId || member.id) && (
                          <span style={{ fontSize: '0.7rem', background: 'rgba(253, 203, 110, 0.2)', color: 'var(--warning)', padding: '1px 6px', borderRadius: '4px' }}>
                            Creator
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {member.email || (member.phone ? `Phone: ${member.phone}` : 'Group Member')}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ 
                      fontSize: '0.95rem', 
                      fontWeight: 700, 
                      color: b.netBalance > 0 ? 'var(--success)' : (b.netBalance < 0 ? 'var(--danger)' : 'var(--text-muted)') 
                    }}>
                      {b.netBalance > 0 
                        ? `+${formatSimple(b.netBalance, currencyCode)}` 
                        : (b.netBalance < 0 ? `-${formatSimple(Math.abs(b.netBalance), currencyCode)}` : 'Settled')}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      Paid: {formatSimple(b.totalPaid || 0, currencyCode)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: SETTLEMENTS & DEBT HISTORY */}
        {activeTab === 'SETTLEMENTS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Simplified Group Debts */}
            <div>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                Active Debts in this Group ({groupDebts.length})
              </h4>
              {groupDebts.length === 0 ? (
                <div style={{
                  padding: '20px',
                  textAlign: 'center',
                  background: 'rgba(0, 184, 148, 0.08)',
                  border: '1px solid rgba(0, 184, 148, 0.2)',
                  borderRadius: '10px',
                  color: 'var(--success)'
                }}>
                  <i className="ph ph-check-circle" style={{ fontSize: '1.5rem', marginBottom: '4px' }}></i>
                  <div style={{ fontWeight: 600 }}>All group debts are completely settled!</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {groupDebts.map((debt, idx) => {
                    const iAmDebtor = String(debt.fromMemberId) === String(currentUser?.id);
                    const iAmCreditor = String(debt.toMemberId) === String(currentUser?.id);

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          borderRadius: '10px',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--glass-border)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                          <span style={{ fontWeight: iAmDebtor ? 700 : 500, color: iAmDebtor ? 'var(--danger)' : 'var(--text-primary)' }}>
                            {iAmDebtor ? 'You' : debt.fromMemberName}
                          </span>
                          <i className="ph ph-arrow-right" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}></i>
                          <span style={{ fontWeight: iAmCreditor ? 700 : 500, color: iAmCreditor ? 'var(--success)' : 'var(--text-primary)' }}>
                            {iAmCreditor ? 'You' : debt.toMemberName}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {formatSimple(debt.amount, currencyCode)}
                          </span>
                          {iAmDebtor && onSettleUp && (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => onSettleUp(group.id)}
                              style={{ padding: '4px 10px', fontSize: '0.78rem', height: '28px' }}
                            >
                              Settle
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Past Settlements History */}
            {groupSettlements.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                  Settlement History ({groupSettlements.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {groupSettlements.map(stl => (
                    <div
                      key={stl.id}
                      onClick={() => onSelectExpense?.({ ...stl, isSettlement: true })}
                      style={{
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        borderRadius: '8px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--glass-border)',
                        cursor: 'pointer'
                      }}
                      title="Click to view details"
                    >
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {stl.payerName} paid {stl.payeeName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Via {stl.paymentMethod || 'Cash'} • {formatDate(stl.date)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.95rem' }}>
                          {formatSimple(stl.amount, currencyCode)}
                        </span>
                        {onDeleteSettlement && (
                          <button
                            type="button"
                            className="btn-icon delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm("Delete settlement record?")) {
                                onDeleteSettlement(stl.id);
                              }
                            }}
                            style={{ width: '26px', height: '26px' }}
                            title="Delete settlement"
                          >
                            <i className="ph ph-trash" style={{ fontSize: '0.8rem' }}></i>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Close Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--glass-border)' }}>
          <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '8px 20px' }}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
