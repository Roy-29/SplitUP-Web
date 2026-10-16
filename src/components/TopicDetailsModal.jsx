import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatSimple } from '../lib/CurrencyManager';
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
  onSelectExpense
}) {
  const [searchTerm, setSearchTerm] = useState('');

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

  const handleDeleteTopic = () => {
    if (topic.isUntagged) return;
    if (window.confirm(`Are you sure you want to delete the subject "${topic.name}"?\n(The expenses inside will remain preserved as general personal expenses)`)) {
      onDeleteTopic?.(topic.id);
      onClose();
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content glass-panel animate-fade-in" 
        style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}
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
              <i className={`ph ${topicIcon}`}></i>
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', margin: 0, color: 'var(--text-primary)' }}>
                {topic.name}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '2px 0 0' }}>
                {topic.description || 'Personal expense collection'}
              </p>
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} style={{ width: '32px', height: '32px' }}>
            <i className="ph ph-x"></i>
          </button>
        </div>

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
              Expenses in "{topic.name}" ({topicExpenses.length})
            </h3>
            {topicExpenses.length > 3 && (
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.82rem',
                  maxWidth: '180px',
                  borderRadius: '8px'
                }}
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
              <i className="ph ph-receipt" style={{ fontSize: '2.5rem', color: 'var(--text-muted)', marginBottom: '10px' }}></i>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem' }}>No expenses in this subject yet</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Add your first expense under "{topic.name}" to keep track of spending.
              </p>
              <button 
                type="button"
                className="btn-primary" 
                onClick={() => {
                  onAddExpense?.(topic.name);
                  onClose();
                }}
                style={{ margin: '0 auto', fontSize: '0.85rem' }}
              >
                <i className="ph ph-plus"></i> Add Expense to "{topic.name}"
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
              {filteredExpenses.map(item => {
                const meta = getCategoryMeta(item.category);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelectExpense?.(item);
                    }}
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
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: meta.bg,
                        color: meta.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <i className={`ph ${meta.icon}`} style={{ fontSize: '1.2rem' }}></i>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.title}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span style={{ color: meta.color, fontWeight: 500 }}>{normalizeCategory(item.category)}</span>
                          <span>•</span>
                          <span>{formatDate(item.date)}</span>
                          {item.notes && (
                            <>
                              <span>•</span>
                              <span style={{ fontStyle: 'italic', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.notes}
                              </span>
                            </>
                          )}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete expense "${item.title}"?`)) {
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
          borderTop: '1px solid var(--glass-border)'
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

          <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '8px 18px' }}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
