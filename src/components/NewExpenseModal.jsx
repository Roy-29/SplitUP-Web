import React, { useState, useEffect } from 'react';
import { LocalDatabase } from '../store/db';
import { isTursoConfigured, tursoAddExpense, tursoAddPersonalExpense } from '../lib/turso';
import './Modal.css';

const PERSONAL_CATEGORIES = [
  { id: 'Groceries', name: 'Groceries', icon: 'ph-shopping-cart', color: '#00b894' },
  { id: 'Shopping', name: 'Shopping', icon: 'ph-bag', color: '#e84393' },
  { id: 'Food & Dining', name: 'Food & Dining', icon: 'ph-pizza', color: '#e17055' },
  { id: 'Books & Education', name: 'Books & Learning', icon: 'ph-book-open', color: '#0984e3' },
  { id: 'Bills & Utilities', name: 'Bills & Utilities', icon: 'ph-lightning', color: '#fdcb6e' },
  { id: 'Transport & Travel', name: 'Transport & Travel', icon: 'ph-bus', color: '#6c5ce7' },
  { id: 'Health & Medical', name: 'Health & Medical', icon: 'ph-first-aid', color: '#d63031' },
  { id: 'Other', name: 'Other (Custom)', icon: 'ph-tag', color: '#a29bfe' }
];

export default function NewExpenseModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  currentGroupId, 
  currentUser, 
  members = [],
  groups = [],
  initialMode = 'PERSONAL'
}) {
  const [expenseType, setExpenseType] = useState(initialMode || 'PERSONAL');
  const [selectedGroupId, setSelectedGroupId] = useState(currentGroupId || (groups.length > 0 ? groups[0].id : '1'));
  
  const [form, setForm] = useState({
    title: '',
    amount: '',
    notes: '',
    selectedPayerId: currentUser ? currentUser.id : (members.length > 0 ? members[0].id : ''),
    selectedCategory: '',
    personalCategory: '',
    customCategoryName: '',
    isEqualSplit: true,
    selectedMembers: new Set(members.map(m => m.id)),
    customAmounts: {}
  });

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setForm({
      title: '',
      amount: '',
      notes: '',
      selectedPayerId: currentUser ? currentUser.id : (members.length > 0 ? members[0].id : ''),
      selectedCategory: '',
      personalCategory: '',
      customCategoryName: '',
      isEqualSplit: true,
      selectedMembers: new Set(members.map(m => m.id)),
      customAmounts: {}
    });
    setError('');
  };

  useEffect(() => {
    if (isOpen) {
      setExpenseType(initialMode || 'PERSONAL');
      setSelectedGroupId(currentGroupId || (groups.length > 0 ? groups[0].id : '1'));
      resetForm();
    }
  }, [isOpen, initialMode, currentGroupId]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const amountValue = parseFloat(form.amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    if (form.title.trim() === '') {
      setError('Please enter an expense title.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (expenseType === 'PERSONAL') {
        // Handle Personal Expense - Category is completely optional
        let categoryName = form.personalCategory || form.customCategoryName.trim() || 'General';

        if (categoryName === 'Other' && form.customCategoryName.trim()) {
          categoryName = form.customCategoryName.trim();
        }

        const activeCurrency = localStorage.getItem('splitup_currency') || 'BDT';
        const personalExpense = {
          userId: currentUser?.id,
          userName: currentUser?.name || 'User',
          title: form.title.trim(),
          amount: amountValue,
          category: categoryName,
          notes: form.notes.trim(),
          currencyCode: activeCurrency,
          date: Date.now()
        };

        if (isTursoConfigured) {
          await tursoAddPersonalExpense(personalExpense);
        } else {
          LocalDatabase.addPersonalExpense(personalExpense);
        }

        setIsSubmitting(false);
        resetForm();
        onSuccess?.();
        onClose();
        return;
      }

      // Handle Group Expense - Category is optional (defaults to OTHER)
      const selectedCategory = form.selectedCategory || 'OTHER';

      if (form.selectedMembers.size === 0) {
        setError('Please select at least one member.');
        setIsSubmitting(false);
        return;
      }

      const activeMembers = members.filter(m => String(m.groupId) === String(selectedGroupId));
      const effectiveMembers = activeMembers.length > 0 ? activeMembers : members;

      const payer = effectiveMembers.find(m => String(m.id) === String(form.selectedPayerId)) || effectiveMembers[0] || { id: currentUser?.id, name: currentUser?.name };
      
      let participants = [];
      if (form.isEqualSplit) {
        const perPerson = Number((amountValue / form.selectedMembers.size).toFixed(2));
        participants = Array.from(form.selectedMembers).map(memberId => ({
          memberId: memberId,
          memberName: effectiveMembers.find(m => m.id === memberId)?.name || '',
          shareAmount: perPerson
        }));
      } else {
        let totalShares = 0;
        const customParts = [];
        for (const memberId of form.selectedMembers) {
          const shareStr = form.customAmounts[memberId];
          const shareAmt = parseFloat(shareStr) || 0;
          totalShares += shareAmt;
          customParts.push({
            memberId: memberId,
            memberName: effectiveMembers.find(m => m.id === memberId)?.name || '',
            shareAmount: shareAmt
          });
        }

        if (Math.abs(totalShares - amountValue) > 0.05) {
          setError(`Custom shares total (${totalShares.toFixed(2)}) must equal the total amount (${amountValue.toFixed(2)}).`);
          setIsSubmitting(false);
          return;
        }
        participants = customParts;
      }

      const newExpense = {
        id: Date.now(),
        groupId: selectedGroupId,
        userId: currentUser?.id,
        title: form.title.trim(),
        amount: amountValue,
        paidBy: payer.id,
        payerName: payer.name,
        date: Date.now(),
        notes: form.notes.trim(),
        category: form.selectedCategory,
        currencyCode: 'BDT',
        participants: participants
      };

      LocalDatabase.addExpense(newExpense);

      if (isTursoConfigured) {
        await tursoAddExpense(newExpense);
      }

      setIsSubmitting(false);
      resetForm();
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Expense creation error:", err);
      setError(err.message || 'Failed to save expense.');
      setIsSubmitting(false);
    }
  };

  const handleMemberToggle = (memberId) => {
    const next = new Set(form.selectedMembers);
    if (next.has(memberId)) {
      next.delete(memberId);
    } else {
      next.add(memberId);
    }
    setForm({ ...form, selectedMembers: next });
  };

  const activeGroupMembers = members.filter(m => String(m.groupId) === String(selectedGroupId));
  const displayMembers = activeGroupMembers.length > 0 ? activeGroupMembers : (groups.length > 0 ? [] : (currentUser ? [currentUser] : []));

  return (
    <div className="modal-overlay animate-fade-in" onClick={handleClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div>
            <h2>New Expense</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '2px 0 0' }}>
              {expenseType === 'PERSONAL' ? 'Track your individual daily spending' : 'Split equally or unequally with group members'}
            </p>
          </div>
          <button type="button" className="btn-icon" onClick={handleClose} style={{ width: '32px', height: '32px' }}>
            <i className="ph ph-x"></i>
          </button>
        </div>

        {/* Mode Selector Toggle */}
        <div className="toggle-group" style={{ marginBottom: '20px' }}>
          <button 
            type="button" 
            className={`toggle-btn ${expenseType === 'PERSONAL' ? 'active' : ''}`}
            onClick={() => setExpenseType('PERSONAL')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <i className="ph ph-user"></i>
            <span>Personal Tracker</span>
          </button>
          <button 
            type="button" 
            className={`toggle-btn ${expenseType === 'GROUP' ? 'active' : ''}`}
            onClick={() => setExpenseType('GROUP')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <i className="ph ph-users-three"></i>
            <span>Group Expense</span>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="error-message" style={{ color: '#ff7675', background: 'rgba(214, 48, 49, 0.1)', padding: '10px', borderRadius: '8px', fontSize: '0.85rem' }}>{error}</div>}

          {/* Group Expense Specific: Group Picker */}
          {expenseType === 'GROUP' && (
            <div className="form-group">
              <label>Select Group</label>
              {groups.length > 0 ? (
                <div className="select-wrapper">
                  <select 
                    value={selectedGroupId}
                    onChange={e => {
                      const newGid = e.target.value;
                      setSelectedGroupId(newGid);
                      const groupMems = members.filter(m => String(m.groupId) === String(newGid));
                      setForm(prev => ({
                        ...prev,
                        selectedMembers: new Set(groupMems.map(m => m.id)),
                        selectedPayerId: groupMems[0]?.id || currentUser?.id
                      }));
                    }}
                  >
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>👥 {g.name}</option>
                    ))}
                  </select>
                  <i className="ph ph-caret-down select-arrow"></i>
                </div>
              ) : (
                <div style={{ background: 'rgba(253, 203, 110, 0.1)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--warning)' }}>
                  <i className="ph ph-info" style={{ marginRight: '6px' }}></i>
                  No groups created yet. Please create a group first, or switch to <strong>Personal Expense</strong>.
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div className="form-group">
            <label>Expense Title / Description</label>
            <input 
              type="text" 
              placeholder={expenseType === 'PERSONAL' ? "e.g., Grocery shopping, Books, Electronics" : "e.g., Dinner, Cox's Bazar Hotel"}
              value={form.title} 
              onChange={e => setForm({...form, title: e.target.value})} 
              required
            />
          </div>

          {/* Amount & Category */}
          <div className="form-row">
            <div className="form-group">
              <label>Amount</label>
              <input 
                type="number" 
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.amount} 
                onKeyDown={e => {
                  if (['+', '-', 'e', 'E'].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                onChange={e => {
                  const val = e.target.value.replace(/[+\-eE]/g, '');
                  setForm({...form, amount: val});
                }} 
                required
              />
            </div>
                       {expenseType === 'GROUP' ? (
              <div className="form-group">
                <label>Category (Optional)</label>
                <div className="select-wrapper">
                  <select 
                    value={form.selectedCategory}
                    onChange={e => setForm({...form, selectedCategory: e.target.value})}
                  >
                    <option value="">General / Other (Optional)</option>
                    <option value="FOOD">🍽️ Food & Dining</option>
                    <option value="TRAVEL">✈️ Travel & Transport</option>
                    <option value="GROCERIES">🛒 Groceries</option>
                    <option value="ENTERTAINMENT">🎮 Entertainment</option>
                    <option value="UTILITIES">⚡ Utilities & Bills</option>
                    <option value="OTHER">🏷️ Other</option>
                  </select>
                  <i className="ph ph-caret-down select-arrow"></i>
                </div>
              </div>
            ) : null}
          </div>

          {/* Personal Expense Specific: Category Badges */}
          {expenseType === 'PERSONAL' && (
            <div className="form-group">
              <label>Category (Optional)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '4px' }}>
                {PERSONAL_CATEGORIES.map(cat => {
                  const isSelected = form.personalCategory === cat.id;
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setForm({ ...form, personalCategory: isSelected ? '' : cat.id })}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '10px 4px',
                        borderRadius: '10px',
                        border: isSelected ? `2px solid ${cat.color}` : '1px solid var(--glass-border)',
                        background: isSelected ? `${cat.color}20` : 'var(--bg-tertiary)',
                        color: isSelected ? cat.color : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: isSelected ? 600 : 500,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <i className={`ph ${cat.icon}`} style={{ fontSize: '1.25rem' }}></i>
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>

              {form.personalCategory === 'Other' && (
                <input 
                  type="text" 
                  placeholder="Custom category name (e.g., Tuition, Subscriptions)"
                  value={form.customCategoryName}
                  onChange={e => setForm({ ...form, customCategoryName: e.target.value })}
                  style={{ marginTop: '10px' }}
                />
              )}
            </div>
          )}

          {/* Notes */}
          <div className="form-group">
            <label>Notes / Memo (Optional)</label>
            <input 
              type="text" 
              placeholder="e.g., Purchased from supermarket"
              value={form.notes} 
              onChange={e => setForm({...form, notes: e.target.value})} 
            />
          </div>

          {/* Group Expense Specific: Payer & Split */}
          {expenseType === 'GROUP' && (
            <>
              <div className="form-group">
                <label>Paid by</label>
                <div className="select-wrapper">
                  <select 
                    value={form.selectedPayerId}
                    onChange={e => setForm({...form, selectedPayerId: e.target.value})}
                  >
                    {displayMembers.map(m => (
                      <option key={m.id} value={m.id}>
                        👤 {m.name} {m.id === currentUser?.id ? '(You)' : ''}
                      </option>
                    ))}
                  </select>
                  <i className="ph ph-caret-down select-arrow"></i>
                </div>
              </div>

              <div className="split-options">
                <label>Split between members</label>
                <div className="toggle-group" style={{ marginTop: '6px' }}>
                  <button 
                    type="button" 
                    className={`toggle-btn ${form.isEqualSplit ? 'active' : ''}`}
                    onClick={() => setForm({...form, isEqualSplit: true})}
                  >
                    Equally
                  </button>
                  <button 
                    type="button" 
                    className={`toggle-btn ${!form.isEqualSplit ? 'active' : ''}`}
                    onClick={() => setForm({...form, isEqualSplit: false})}
                  >
                    Custom Amounts
                  </button>
                </div>
              </div>

              <div className="members-list">
                <label>Included in split ({form.selectedMembers.size})</label>
                {displayMembers.map(m => (
                  <div key={m.id} className="member-checkbox-row">
                    <label className="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={form.selectedMembers.has(m.id)}
                        onChange={() => handleMemberToggle(m.id)}
                      />
                      <span>{m.name} {m.id === currentUser?.id ? '(You)' : ''}</span>
                    </label>
                    {!form.isEqualSplit && form.selectedMembers.has(m.id) && (
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0"
                        placeholder="0.00"
                        className="custom-amount-input"
                        value={form.customAmounts[m.id] || ''}
                        onKeyDown={e => {
                          if (['+', '-', 'e', 'E'].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[+\-eE]/g, '');
                          setForm({
                            ...form, 
                            customAmounts: {
                              ...form.customAmounts, 
                              [m.id]: val
                            }
                          });
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="modal-footer" style={{ marginTop: '16px' }}>
            <button type="button" className="btn-secondary" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (expenseType === 'PERSONAL' ? 'Save Personal Expense' : 'Add Group Expense')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
