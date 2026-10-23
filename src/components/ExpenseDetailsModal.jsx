import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatSimple } from '../lib/CurrencyManager';
import { normalizeCategory } from './ExpensesView';
import CustomSelect from './CustomSelect';
import { isTursoConfigured, tursoAddPersonalTopic } from '../lib/turso';
import { LocalDatabase } from '../store/db';
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

const PERSONAL_CATEGORIES = [
  { id: 'Groceries', name: 'Groceries', icon: 'ph-shopping-cart', color: '#00b894' },
  { id: 'Shopping', name: 'Shopping', icon: 'ph-bag', color: '#e84393' },
  { id: 'Food & Dining', name: 'Food & Dining', icon: 'ph-pizza', color: '#e17055' },
  { id: 'Books & Learning', name: 'Books & Learning', icon: 'ph-book-open', color: '#0984e3' },
  { id: 'Bills & Utilities', name: 'Bills & Utilities', icon: 'ph-lightning', color: '#fdcb6e' },
  { id: 'Transport & Travel', name: 'Transport & Travel', icon: 'ph-bus', color: '#6c5ce7' },
  { id: 'Health & Medical', name: 'Health & Medical', icon: 'ph-first-aid', color: '#d63031' },
  { id: 'Other', name: 'Other', icon: 'ph-tag', color: '#a29bfe' }
];

const GROUP_CATEGORIES = [
  { id: 'FOOD', name: 'Food & Dining', icon: '🍽️' },
  { id: 'TRAVEL', name: 'Travel & Transport', icon: '✈️' },
  { id: 'GROCERIES', name: 'Groceries / Bazar', icon: '🛒' },
  { id: 'ENTERTAINMENT', name: 'Entertainment', icon: '🎮' },
  { id: 'UTILITIES', name: 'Utilities & Rent', icon: '⚡' },
  { id: 'OTHER', name: 'Other', icon: '🏷️' }
];

function getCategoryMeta(catName = '') {
  const normalized = normalizeCategory(catName);
  if (CATEGORY_META[normalized]) return CATEGORY_META[normalized];
  for (const [key, val] of Object.entries(CATEGORY_META)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return { icon: 'ph-tag', color: '#a29bfe', bg: 'rgba(162, 155, 254, 0.15)' };
}

function toDatetimeLocal(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ExpenseDetailsModal({
  isOpen,
  onClose,
  expense,
  currentUser,
  currencyCode = 'BDT',
  personalTopics = [],
  onDeleteExpense,
  onDeleteSettlement,
  onUpdateExpense,
  onUpdateSettlement,
  onFilterTopic
}) {
  const [copiedTrx, setCopiedTrx] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [editForm, setEditForm] = useState({
    title: '',
    amount: '',
    category: '',
    customCategoryName: '',
    topic: '',
    isNewTopic: false,
    newTopicName: '',
    date: '',
    notes: '',
    paymentMethod: 'Cash',
    trxId: ''
  });

  useEffect(() => {
    if (isOpen && expense) {
      setIsEditing(false);
      setError('');
      setIsSaving(false);

      const rawCat = expense.category || 'Other';
      const normCat = normalizeCategory(rawCat);
      const isPersonalStandard = PERSONAL_CATEGORIES.some(c => c.id.toLowerCase() === normCat.toLowerCase());

      setEditForm({
        title: expense.title || '',
        amount: expense.amount !== undefined ? String(expense.amount) : '',
        category: isPersonalStandard ? normCat : 'Other',
        customCategoryName: isPersonalStandard ? '' : (rawCat !== 'Other' && rawCat !== 'General' ? rawCat : ''),
        topic: expense.topic || '',
        isNewTopic: false,
        newTopicName: '',
        date: toDatetimeLocal(expense.date),
        notes: expense.notes || '',
        paymentMethod: expense.paymentMethod || 'Cash',
        trxId: expense.trxId || ''
      });
    }
  }, [isOpen, expense]);

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

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(editForm.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    if (!isSettlement && !editForm.title.trim()) {
      setError('Please provide a title or purpose for this expense.');
      return;
    }

    setIsSaving(true);

    try {
      const timestamp = editForm.date ? new Date(editForm.date).getTime() : (expense.date || Date.now());

      if (isSettlement) {
        if (onUpdateSettlement) {
          await onUpdateSettlement(expense.id, {
            amount: parsedAmount,
            date: timestamp,
            paymentMethod: editForm.paymentMethod || 'Cash',
            trxId: editForm.trxId ? editForm.trxId.trim() : null
          });
        }
      } else {
        // Resolve Category
        let finalCategory = editForm.category || 'Other';
        if (isPersonal) {
          if (editForm.category === 'Other' && editForm.customCategoryName.trim()) {
            finalCategory = editForm.customCategoryName.trim();
          }
        }

        // Resolve Topic / Subject for personal expense
        let finalTopic = '';
        if (isPersonal) {
          if (editForm.isNewTopic && editForm.newTopicName.trim()) {
            finalTopic = editForm.newTopicName.trim();
            // Automatically persist new subject
            const newTpc = {
              userId: currentUser?.id,
              name: finalTopic,
              budget: 0,
              icon: 'ph-folder-simple',
              color: '#6c5ce7',
              createdAt: Date.now()
            };
            if (isTursoConfigured) {
              tursoAddPersonalTopic(newTpc).catch(() => {});
            } else {
              LocalDatabase.addPersonalTopic(newTpc);
            }
          } else if (editForm.topic && editForm.topic !== '__CREATE_NEW__') {
            finalTopic = editForm.topic.trim();
          }
        }

        // Proportional participant share adjustment for group expenses
        let updatedParticipants = participants;
        if (isGroupExpense && participants.length > 0 && expense.amount > 0) {
          const ratio = parsedAmount / expense.amount;
          updatedParticipants = participants.map(p => ({
            ...p,
            shareAmount: Number(((p.shareAmount || 0) * ratio).toFixed(2))
          }));
        }

        if (onUpdateExpense) {
          const updatedFields = {
            title: editForm.title.trim(),
            amount: parsedAmount,
            category: finalCategory,
            date: timestamp,
            notes: editForm.notes.trim()
          };
          if (isPersonal) {
            updatedFields.topic = finalTopic;
          }
          if (isGroupExpense) {
            updatedFields.participants = updatedParticipants;
          }
          await onUpdateExpense(expense.id, updatedFields);
        }
      }

      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save changes:", err);
      setError(err.message || 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content glass-panel animate-fade-in" 
        style={{ maxWidth: '500px', maxHeight: '92vh', overflowY: 'auto', overflowX: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: isEditing ? 'rgba(108, 92, 231, 0.2)' : (isSettlement ? 'rgba(0, 184, 148, 0.15)' : meta.bg),
              color: isEditing ? 'var(--accent-primary)' : (isSettlement ? 'var(--success)' : meta.color),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem'
            }}>
              <i className={`ph ${isEditing ? 'ph-pencil-line' : (isSettlement ? 'ph-handshake' : meta.icon)}`}></i>
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)' }}>
                {isEditing 
                  ? (isSettlement ? 'Edit Settlement' : (isPersonal ? 'Edit Personal Expense' : 'Edit Group Expense'))
                  : (isSettlement ? 'Settlement Details' : (isPersonal ? 'Personal Expense Details' : 'Group Expense Details'))}
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {isEditing
                  ? 'Update transaction amount, category, or note'
                  : (isPersonal ? 'Private wallet record' : (isSettlement ? 'Debt resolution record' : (expense.groupName || 'Group shared bill')))}
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {!isEditing && (
              <button 
                type="button" 
                className="btn-icon" 
                onClick={() => setIsEditing(true)} 
                title="Edit this expense"
                style={{ width: '32px', height: '32px', color: 'var(--accent-primary)' }}
              >
                <i className="ph ph-pencil-simple"></i>
              </button>
            )}
            <button type="button" className="btn-icon" onClick={onClose} style={{ width: '32px', height: '32px' }} title="Close">
              <i className="ph ph-x"></i>
            </button>
          </div>
        </div>

        {/* Edit Mode Content */}
        {isEditing ? (
          <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div style={{
                background: 'rgba(214, 48, 49, 0.15)',
                border: '1px solid rgba(214, 48, 49, 0.3)',
                color: 'var(--danger)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <i className="ph ph-warning-circle" style={{ fontSize: '1.1rem' }}></i>
                <span>{error}</span>
              </div>
            )}

            {/* Expense Title (for expenses only) */}
            {!isSettlement && (
              <div className="form-group">
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Expense Title / Purpose</label>
                <input 
                  type="text" 
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Groceries, Lunch, Taxi..."
                  required
                  autoFocus
                />
              </div>
            )}

            {/* Amount Field */}
            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Amount ({currencyCode})</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="number" 
                  step="any"
                  min="0"
                  value={editForm.amount}
                  onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                  style={{ fontSize: '1.25rem', fontWeight: 700, paddingLeft: '36px' }}
                />
                <span style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 700,
                  fontSize: '1.2rem',
                  color: 'var(--text-muted)'
                }}>
                  ৳
                </span>
              </div>
            </div>

            {/* Personal Category Picker */}
            {isPersonal && !isSettlement && (
              <div className="form-group">
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Category</label>
                <div className="personal-category-grid">
                  {PERSONAL_CATEGORIES.map(cat => {
                    const isSelected = editForm.category === cat.id;
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        className={`personal-category-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => setEditForm(prev => ({ ...prev, category: cat.id }))}
                        style={{
                          borderColor: isSelected ? cat.color : undefined,
                          background: isSelected ? `${cat.color}25` : undefined,
                          color: isSelected ? cat.color : undefined
                        }}
                      >
                        <i className={`ph ${cat.icon}`}></i>
                        <span>{cat.name}</span>
                      </button>
                    );
                  })}
                </div>

                {editForm.category === 'Other' && (
                  <input 
                    type="text" 
                    placeholder="Custom category name (e.g. Tuition, Books)"
                    value={editForm.customCategoryName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, customCategoryName: e.target.value }))}
                    style={{ marginTop: '8px' }}
                  />
                )}
              </div>
            )}

            {/* Group Category Picker */}
            {isGroupExpense && !isSettlement && (
              <div className="form-group">
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Category</label>
                <CustomSelect 
                  value={editForm.category}
                  onChange={(val) => setEditForm(prev => ({ ...prev, category: val }))}
                  options={GROUP_CATEGORIES.map(g => ({
                    value: g.id,
                    label: `${g.icon} ${g.name}`
                  }))}
                  placeholder="Select Category"
                />
              </div>
            )}

            {/* Subject / Topic Picker for Personal Expense */}
            {isPersonal && !isSettlement && (
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Subject / Topic (ঐচ্ছিক বিষয়)</label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Optional</span>
                </div>
                <CustomSelect 
                  value={editForm.topic}
                  onChange={(val) => {
                    if (val === '__CREATE_NEW__') {
                      setEditForm(prev => ({ ...prev, topic: '__CREATE_NEW__', isNewTopic: true }));
                    } else {
                      setEditForm(prev => ({ ...prev, topic: val, isNewTopic: false }));
                    }
                  }}
                  options={[
                    { value: '', label: 'General / No Subject', icon: 'ph-folder' },
                    ...personalTopics.map(t => ({
                      value: t.name,
                      label: `${t.name}${t.budget ? ` (Budget: ${t.budget})` : ''}`,
                      icon: t.icon || 'ph-folder-simple'
                    })),
                    { value: '__CREATE_NEW__', label: '+ Create New Subject...', icon: 'ph-plus' }
                  ]}
                  placeholder="Select a subject (e.g. Tour, Bazar)"
                />

                {editForm.isNewTopic && (
                  <input 
                    type="text" 
                    placeholder='Type new subject name (e.g. "Tour to Sylhet")'
                    value={editForm.newTopicName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, newTopicName: e.target.value }))}
                    style={{ marginTop: '8px' }}
                    autoFocus
                  />
                )}
              </div>
            )}

            {/* Settlement Specific: Method & TrxId */}
            {isSettlement && (
              <>
                <div className="form-group">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Payment Method</label>
                  <CustomSelect 
                    value={editForm.paymentMethod}
                    onChange={(val) => setEditForm(prev => ({ ...prev, paymentMethod: val }))}
                    options={[
                      { value: 'Cash', label: '💵 Cash' },
                      { value: 'bKash', label: '📱 bKash' },
                      { value: 'Nagad', label: '📲 Nagad' },
                      { value: 'Rocket', label: '🚀 Rocket' },
                      { value: 'Bank Transfer', label: '🏛️ Bank Transfer' }
                    ]}
                    placeholder="Payment Method"
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Transaction ID (TrxID)</label>
                  <input 
                    type="text"
                    value={editForm.trxId}
                    onChange={(e) => setEditForm(prev => ({ ...prev, trxId: e.target.value }))}
                    placeholder="e.g. 9J4K28D9 (Optional)"
                  />
                </div>
              </>
            )}

            {/* Date & Time Picker */}
            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Date & Time</label>
              <input 
                type="datetime-local" 
                value={editForm.date}
                onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

            {/* Notes / Remarks */}
            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Notes / Memo (Optional)</label>
              <textarea 
                rows={3}
                value={editForm.notes}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional notes, memo, invoice info..."
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Edit Mode Buttons */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              paddingTop: '16px', 
              borderTop: '1px solid var(--glass-border)',
              marginTop: '8px'
            }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
              >
                Cancel
              </button>

              <button 
                type="submit" 
                className="btn-primary" 
                disabled={isSaving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 22px' }}
              >
                {isSaving ? (
                  <>
                    <i className="ph ph-spinner ph-spin"></i> Saving...
                  </>
                ) : (
                  <>
                    <i className="ph ph-check-circle"></i> Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* View Mode Content */
          <>
            {/* Amount & Title Hero Box */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.12) 0%, rgba(0, 184, 148, 0.08) 100%)',
              border: '1px solid rgba(108, 92, 231, 0.25)',
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'center',
              marginBottom: '16px',
              position: 'relative'
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
              {/* Group Expense Payer Info */}
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

              {/* Group Participants Breakdown */}
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

              {/* Settlement Info */}
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
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              paddingTop: '12px', 
              borderTop: '1px solid var(--glass-border)',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
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
                    gap: '6px',
                    padding: '8px 14px'
                  }}
                >
                  <i className="ph ph-trash"></i>
                  Delete Record
                </button>
              ) : <div />}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsEditing(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    color: 'var(--text-primary)'
                  }}
                >
                  <i className="ph ph-pencil-simple" style={{ color: 'var(--accent-primary)' }}></i>
                  Edit
                </button>

                <button type="button" className="btn-primary" onClick={onClose} style={{ padding: '8px 20px' }}>
                  Close
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
