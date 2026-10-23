import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatSimple } from '../lib/CurrencyManager';
import { normalizeCategory } from './ExpensesView';
import { useConfirm } from './ConfirmModal';
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
};

function getCategoryMeta(catName = '') {
  const normalized = normalizeCategory(catName);
  if (CATEGORY_META[normalized]) return CATEGORY_META[normalized];
  for (const [key, val] of Object.entries(CATEGORY_META)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return { icon: 'ph-tag', color: '#a29bfe', bg: 'rgba(162, 155, 254, 0.15)' };
}

export default function TopicDetailsModal({
  isOpen,
  onClose,
  topic,
  expenses = [],
  currencyCode = 'BDT',
  onAddExpense,
  onDeleteTopic,
  onDeleteExpense,
  onUpdateTopic,
  onSelectExpense
}) {
  const { confirm } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    budget: ''
  });

  useEffect(() => {
    if (isOpen && topic) {
      setIsEditing(false);
      setIsSaving(false);
      setEditForm({
        name: topic.name || '',
        description: topic.description || '',
        budget: topic.budget ? String(topic.budget) : ''
      });
    }
  }, [isOpen, topic]);

  if (!isOpen || !topic) return null;

  // Filter expenses belonging to this topic
  const topicExpenses = expenses.filter(e => {
    if (topic.isUntagged) {
      return !e.topic || e.topic.trim() === '';
    }
    return e.topic && e.topic.toLowerCase().trim() === topic.name.toLowerCase().trim();
  });

  const filteredExpenses = searchTerm.trim() 
    ? topicExpenses.filter(e => 
        (e.title && e.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.category && e.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.notes && e.notes.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : topicExpenses;

  const totalSpent = topicExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const budget = topic.budget || 0;
  const hasBudget = budget > 0;
  const budgetPercent = hasBudget ? Math.min(Math.round((totalSpent / budget) * 100), 100) : 0;
  const isOverBudget = hasBudget && totalSpent > budget;
  const budgetRemaining = hasBudget ? budget - totalSpent : 0;

  const topicColor = topic.color || '#6c5ce7';
  const topicIcon = topic.icon || 'ph-folder-simple';

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDeleteTopic = async () => {
    if (topic.isUntagged) return;
    const ok = await confirm({
      title: 'Delete Subject?',
      message: `Are you sure you want to delete the subject "${topic.name}"? The expenses inside will remain preserved as general personal expenses.`,
      confirmText: 'Delete Subject'
    });
    if (ok) {
      onDeleteTopic?.(topic.id);
      onClose();
    }
  };

  const handleSaveTopic = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) return;

    setIsSaving(true);
    try {
      if (onUpdateTopic) {
        await onUpdateTopic(topic.id, {
          name: editForm.name.trim(),
          description: editForm.description.trim(),
          budget: parseFloat(editForm.budget) || 0
        });
      }
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update topic:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content glass-panel animate-fade-in" 
        style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: `${topicColor}25`,
              color: topicColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem'
            }}>
              <i className={`ph ${isEditing ? 'ph-pencil-line' : topicIcon}`}></i>
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', margin: 0, color: 'var(--text-primary)' }}>
                {isEditing ? `Edit Subject: ${topic.name}` : topic.name}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '2px 0 0' }}>
                {isEditing ? 'Update subject title, target budget, and details' : (topic.description || 'Personal expense collection')}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {!topic.isUntagged && !isEditing && (
              <button 
                type="button" 
                className="btn-icon" 
                onClick={() => setIsEditing(true)} 
                title="Edit Subject"
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

        {/* Edit Form */}
        {isEditing ? (
          <form onSubmit={handleSaveTopic} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Subject Name</label>
              <input 
                type="text" 
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Tour, Grocery, Tuition..."
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Target Budget ({currencyCode})</label>
              <input 
                type="number" 
                step="any"
                min="0"
                value={editForm.budget}
                onWheel={e => e.target.blur()}
                onChange={(e) => setEditForm(prev => ({ ...prev, budget: e.target.value }))}
                placeholder="0.00 (Optional)"
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Description (Optional)</label>
              <textarea 
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="What is this subject or project for?"
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

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '16px',
              borderTop: '1px solid var(--glass-border)'
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
          <>
            {/* Financial Overview Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.12) 0%, rgba(0, 184, 148, 0.08) 100%)',
              border: '1px solid var(--glass-border)',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Spent in this Subject
                  </span>
                  <div style={{ fontSize: '2.1rem', fontWeight: 800, color: topicColor, marginTop: '2px' }}>
                    {formatSimple(totalSpent, currencyCode)}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {topicExpenses.length} expense{topicExpenses.length === 1 ? '' : 's'} recorded
                  </span>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    onAddExpense?.(topic.name);
                    onClose();
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    fontSize: '0.9rem',
                    background: topicColor
                  }}
                >
                  <i className="ph ph-plus-circle"></i>
                  Add Expense
                </button>
              </div>

              {/* Budget progress bar if budget set */}
              {hasBudget && (
                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Target Budget: <strong style={{ color: 'var(--text-primary)' }}>{formatSimple(budget, currencyCode)}</strong>
                    </span>
                    <span style={{ 
                      fontWeight: 600, 
                      color: isOverBudget ? 'var(--danger)' : (budgetPercent > 80 ? 'var(--warning)' : 'var(--success)') 
                    }}>
                      {isOverBudget 
                        ? `Over budget by ${formatSimple(Math.abs(budgetRemaining), currencyCode)}` 
                        : `${formatSimple(budgetRemaining, currencyCode)} remaining (${budgetPercent}%)`}
                    </span>
                  </div>
                  <div style={{
                    height: '8px',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.1)',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${budgetPercent}%`,
                      borderRadius: '4px',
                      background: isOverBudget ? 'var(--danger)' : (budgetPercent > 80 ? 'var(--warning)' : 'var(--success)'),
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* Expenses inside this Topic */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)' }}>
                  Expenses in this Subject ({filteredExpenses.length})
                </h3>

                {topicExpenses.length > 3 && (
                  <div style={{ position: 'relative', width: '200px' }}>
                    <input 
                      type="text"
                      placeholder="Search expenses..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{
                        padding: '6px 10px 6px 30px',
                        fontSize: '0.82rem',
                        width: '100%',
                        borderRadius: '20px'
                      }}
                    />
                    <i className="ph ph-magnifying-glass" style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                      fontSize: '0.85rem'
                    }}></i>
                  </div>
                )}
              </div>

              {filteredExpenses.length === 0 ? (
                <div style={{
                  padding: '30px 20px',
                  textAlign: 'center',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '12px',
                  border: '1px dashed var(--glass-border)'
                }}>
                  <i className="ph ph-receipt" style={{ fontSize: '2rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}></i>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {topicExpenses.length === 0 ? 'No expenses added to this subject yet.' : 'No expenses match your search.'}
                  </p>
                  {topicExpenses.length === 0 && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        onAddExpense?.(topic.name);
                        onClose();
                      }}
                      style={{ marginTop: '12px', fontSize: '0.85rem' }}
                    >
                      <i className="ph ph-plus"></i> Add First Expense
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredExpenses.map((item) => {
                    const cMeta = getCategoryMeta(item.category);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          onSelectExpense?.(item);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '12px',
                          border: '1px solid var(--glass-border)',
                          cursor: onSelectExpense ? 'pointer' : 'default',
                          transition: 'all 0.2s ease'
                        }}
                        className="hover-lift"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: cMeta.bg,
                            color: cMeta.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem'
                          }}>
                            <i className={`ph ${cMeta.icon}`}></i>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                              {item.title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                              <span style={{ fontSize: '0.75rem', color: cMeta.color, fontWeight: 500 }}>
                                {normalizeCategory(item.category)}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>•</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {formatDate(item.date)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {formatSimple(item.amount, currencyCode)}
                          </span>
                          {onDeleteExpense && (
                            <button
                              type="button"
                              className="btn-icon delete-btn"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const ok = await confirm({
                                  title: 'Delete Expense?',
                                  message: `Are you sure you want to delete "${item.title}"?`,
                                  confirmText: 'Delete Expense'
                                });
                                if (ok) {
                                  onDeleteExpense(item.id);
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

            {/* Footer actions */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '20px',
              paddingTop: '12px',
              borderTop: '1px solid var(--glass-border)',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              {!topic.isUntagged && onDeleteTopic ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleDeleteTopic}
                  style={{
                    color: 'var(--danger)',
                    borderColor: 'rgba(214, 48, 49, 0.3)',
                    background: 'rgba(214, 48, 49, 0.1)',
                    fontSize: '0.82rem',
                    padding: '6px 12px'
                  }}
                >
                  <i className="ph ph-trash"></i> Delete Subject
                </button>
              ) : <div />}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {!topic.isUntagged && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setIsEditing(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      fontSize: '0.88rem'
                    }}
                  >
                    <i className="ph ph-pencil-simple" style={{ color: 'var(--accent-primary)' }}></i> Edit Subject
                  </button>
                )}

                <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '8px 18px' }}>
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
