import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatSimple } from '../lib/CurrencyManager';
import { normalizeCategory } from './ExpensesView';
import UserAvatar from './UserAvatar';
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
  'General': { icon: 'ph-tag', color: '#a29bfe', bg: 'rgba(162, 155, 254, 0.15)' },
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

export default function ExpenseDetailsModal({
  isOpen,
  onClose,
  expense,
  currentUser,
  currencyCode = 'BDT',
  onDeleteExpense,
  onDeleteSettlement,
  onFilterTopic
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedTrx, setCopiedTrx] = useState(false);

  if (!isOpen || !expense) return null;

  const isSettlement = expense.isSettlement || expense.type === 'SETTLEMENT' || (expense.paidTo !== undefined && expense.payerName !== undefined);
  const isPersonal = expense.isPersonal || expense.groupId === 'personal' || (!isSettlement && !expense.groupId);
  const isGroupExpense = !isSettlement && !isPersonal;

  const meta = getCategoryMeta(expense.category || 'General');

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown Date';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCopyTrx = (trxId) => {
    if (!trxId) return;
    navigator.clipboard.writeText(trxId);
    setCopiedTrx(true);
    setTimeout(() => setCopiedTrx(false), 2000);
  };

  const handleDelete = () => {
    if (isSettlement) {
      if (window.confirm("Are you sure you want to delete this settlement record?")) {
        onDeleteSettlement?.(expense.id);
        onClose();
      }
    } else {
      if (window.confirm(`Are you sure you want to delete "${expense.title || 'this expense'}"?`)) {
        onDeleteExpense?.(expense.id);
        onClose();
      }
    }
  };

  // Participant parsing if stored as string JSON
  let participants = [];
  if (isGroupExpense && expense.participants) {
    if (Array.isArray(expense.participants)) {
      participants = expense.participants;
    } else if (typeof expense.participants === 'string') {
      try {
        participants = JSON.parse(expense.participants);
      } catch (_) {
        participants = [];
      }
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content glass-panel animate-fade-in" 
        style={{ maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: isSettlement ? 'rgba(0, 184, 148, 0.15)' : meta.bg,
              color: isSettlement ? 'var(--success)' : meta.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem'
            }}>
              <i className={`ph ${isSettlement ? 'ph-handshake' : meta.icon}`}></i>
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
                {isSettlement ? 'Settlement Details' : (isPersonal ? 'Personal Expense Details' : 'Group Expense Details')}
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {isPersonal ? 'Private wallet record' : (isSettlement ? 'Debt resolution record' : (expense.groupName || 'Group shared bill'))}
              </span>
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} style={{ width: '32px', height: '32px' }}>
            <i className="ph ph-x"></i>
          </button>
        </div>

        {/* Amount & Title Hero Box */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.12) 0%, rgba(0, 184, 148, 0.08) 100%)',
          border: '1px solid rgba(108, 92, 231, 0.25)',
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center',
          marginBottom: '16px'
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {isSettlement ? 'Settled Amount' : 'Total Amount'}
          </div>
          <div style={{ 
            fontSize: '2.4rem', 
            fontWeight: 800, 
            color: isSettlement ? 'var(--success)' : 'var(--text-primary)',
            marginTop: '4px',
            marginBottom: '8px'
          }}>
            {formatSimple(expense.amount || 0, currencyCode)}
          </div>
          <h3 style={{ 
            margin: 0, 
            fontSize: '1.15rem', 
            fontWeight: 600, 
            color: 'var(--text-primary)',
            wordBreak: 'break-word'
          }}>
            {expense.title || (isSettlement ? `${expense.payerName} paid ${expense.payeeName}` : 'Expense')}
          </h3>
        </div>

        {/* Meta badges row */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
          {/* Category Badge */}
          {!isSettlement && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: meta.color,
              background: meta.bg,
              padding: '4px 10px',
              borderRadius: '8px'
            }}>
              <i className={`ph ${meta.icon}`}></i>
              {normalizeCategory(expense.category)}
            </span>
          )}

          {/* Subject / Topic Badge */}
          {expense.topic && (
            <span 
              onClick={() => {
                if (onFilterTopic) {
                  onFilterTopic(expense.topic);
                  onClose();
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#a29bfe',
                background: 'rgba(108, 92, 231, 0.15)',
                border: '1px solid rgba(108, 92, 231, 0.3)',
                padding: '4px 10px',
                borderRadius: '8px',
                cursor: onFilterTopic ? 'pointer' : 'default'
              }}
              title={onFilterTopic ? `Click to view topic: ${expense.topic}` : undefined}
            >
              <i className="ph ph-folder-simple"></i>
              Subject: {expense.topic}
            </span>
          )}

          {/* Date Badge */}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            background: 'var(--bg-tertiary)',
            padding: '4px 10px',
            borderRadius: '8px'
          }}>
            <i className="ph ph-calendar"></i>
            {formatDate(expense.date)}
          </span>
        </div>

        {/* Detailed Info Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
          {/* Group Expense Payer & Split Info */}
          {isGroupExpense && (
            <div style={{
              background: 'var(--bg-tertiary)',
              borderRadius: '12px',
              padding: '14px 16px',
              border: '1px solid var(--glass-border)'
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Paid By
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}>
                  {expense.payerName ? expense.payerName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    {expense.payerName || 'Group Member'} {expense.paidBy === currentUser?.id ? '(You)' : ''}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Paid the entire bill of {formatSimple(expense.amount || 0, currencyCode)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Group Participants Shares Breakdown */}
          {isGroupExpense && participants.length > 0 && (
            <div style={{
              background: 'var(--bg-tertiary)',
              borderRadius: '12px',
              padding: '14px 16px',
              border: '1px solid var(--glass-border)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Split Between ({participants.length} Members)
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                  {formatSimple((expense.amount || 0) / participants.length, currencyCode)} / person
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {participants.map((p, idx) => {
                  const isUser = String(p.memberId) === String(currentUser?.id);
                  return (
                    <div 
                      key={p.memberId || idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 0',
                        borderBottom: idx !== participants.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          background: isUser ? 'rgba(0, 184, 148, 0.2)' : 'rgba(108, 92, 231, 0.2)',
                          color: isUser ? 'var(--success)' : 'var(--accent-secondary)',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {p.memberName ? p.memberName.charAt(0).toUpperCase() : 'M'}
                        </div>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: isUser ? 600 : 400 }}>
                          {p.memberName || 'Member'} {isUser ? '(You)' : ''}
                        </span>
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {formatSimple(p.shareAmount || 0, currencyCode)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Settlement Method & Parties */}
          {isSettlement && (
            <div style={{
              background: 'var(--bg-tertiary)',
              borderRadius: '12px',
              padding: '14px 16px',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>From (Payer)</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {expense.payerName || 'Payer'}
                  </div>
                </div>
                <div style={{ color: 'var(--success)', fontSize: '1.4rem', padding: '0 8px' }}>
                  <i className="ph ph-arrow-right"></i>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>To (Receiver)</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {expense.payeeName || 'Receiver'}
                  </div>
                </div>
              </div>

              <div style={{ 
                borderTop: '1px solid rgba(255,255,255,0.06)', 
                paddingTop: '10px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Payment Method</span>
                <span style={{ 
                  fontWeight: 600, 
                  fontSize: '0.85rem', 
                  color: 'var(--text-primary)',
                  background: 'rgba(0, 184, 148, 0.1)',
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}>
                  {expense.paymentMethod || 'Cash'}
                </span>
              </div>

              {expense.trxId && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '8px 12px',
                  borderRadius: '8px'
                }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Transaction ID (TrxID)</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-secondary)', fontSize: '0.88rem' }}>
                      {expense.trxId}
                    </div>
                  </div>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => handleCopyTrx(expense.trxId)}
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    <i className={`ph ${copiedTrx ? 'ph-check' : 'ph-copy'}`}></i>
                    {copiedTrx ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Notes / Memo Box */}
          {expense.notes && (
            <div style={{
              background: 'var(--bg-tertiary)',
              borderRadius: '12px',
              padding: '14px 16px',
              border: '1px solid var(--glass-border)'
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>
                Notes / Memo
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                {expense.notes}
              </p>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--glass-border)' }}>
          {((isSettlement && onDeleteSettlement) || (!isSettlement && onDeleteExpense)) ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleDelete}
              style={{
                color: 'var(--danger)',
                borderColor: 'rgba(214, 48, 49, 0.3)',
                background: 'rgba(214, 48, 49, 0.1)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="ph ph-trash"></i>
              Delete Record
            </button>
          ) : <div />}

          <button type="button" className="btn-primary" onClick={onClose} style={{ padding: '8px 20px' }}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
