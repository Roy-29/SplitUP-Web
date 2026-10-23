import React, { useState } from 'react';
import { formatSimple } from '../lib/CurrencyManager';
import { useConfirm } from './ConfirmModal';
import './ExpensesView.css';

export const LEGACY_CATEGORY_MAP = {
  'বাজার': 'Groceries',
  'শপিং': 'Shopping',
  'খাবার': 'Food & Dining',
  'বই': 'Books & Learning',
  'বিল': 'Bills & Utilities',
  'বিল ও ইউটিলিটি': 'Bills & Utilities',
  'যাতায়াত': 'Transport & Travel',
  'মেডিকেল': 'Health & Medical',
  'স্বাস্থ্য / ঔষধ': 'Health & Medical',
  'অন্যান্য': 'Other'
};

export function normalizeCategory(cat) {
  if (!cat) return 'Other';
  const trimmed = String(cat).trim();
  return LEGACY_CATEGORY_MAP[trimmed] || trimmed;
}

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

export function getCategoryMeta(catName = '') {
  const normalized = normalizeCategory(catName);
  if (CATEGORY_META[normalized]) return CATEGORY_META[normalized];
  for (const [key, val] of Object.entries(CATEGORY_META)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return { icon: 'ph-tag', color: '#a29bfe', bg: 'rgba(162, 155, 254, 0.15)' };
}

export default function ExpensesView({ 
  activities = [], 
  personalExpenses = [], 
  personalTopics = [],
  onNewExpenseClick,
  onNewTopicClick,
  onSelectExpense,
  onSelectTopic,
  onDeleteExpense,
  onDeleteSettlement,
  onDeleteTopic,
  currencyCode = 'BDT'
}) {
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState('PERSONAL'); // 'PERSONAL' | 'GROUP'
  const [personalViewMode, setPersonalViewMode] = useState('TOPICS'); // 'TOPICS' | 'ALL'
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null);

  // Group filter calculations
  const filteredActivities = activities.filter(activity => {
    if (groupFilter === 'ALL') return true;
    if (groupFilter === 'EXPENSES') return activity.type === 'EXPENSE';
    if (groupFilter === 'SETTLEMENTS') return activity.type === 'SETTLEMENT';
    return true;
  });

  // Personal category aggregations
  const categoryStats = personalExpenses.reduce((acc, exp) => {
    const cat = normalizeCategory(exp.category);
    if (!acc[cat]) {
      acc[cat] = { total: 0, count: 0 };
    }
    acc[cat].total += (exp.amount || 0);
    acc[cat].count += 1;
    return acc;
  }, {});

  const totalPersonalSpent = personalExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Filtered personal expenses
  const displayedPersonalExpenses = selectedCategoryFilter 
    ? personalExpenses.filter(e => normalizeCategory(e.category) === selectedCategoryFilter)
    : personalExpenses;

  // Personal topics aggregation
  const topicStats = personalTopics.map(topic => {
    const matched = personalExpenses.filter(e => e.topic && e.topic.toLowerCase().trim() === topic.name.toLowerCase().trim());
    const total = matched.reduce((s, e) => s + (e.amount || 0), 0);
    return {
      ...topic,
      totalSpent: total,
      itemCount: matched.length
    };
  });

  // Also collect any untagged/general personal expenses
  const untaggedExpenses = personalExpenses.filter(e => !e.topic || e.topic.trim() === '');
  const untaggedTotal = untaggedExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="expenses-view glass-panel animate-fade-in">
      {/* Top Header with Main Switcher */}
      <div className="expenses-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="activity-icon" style={{ background: 'rgba(108, 92, 231, 0.15)', color: 'var(--accent-primary)', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className={activeTab === 'PERSONAL' ? "ph ph-wallet" : "ph ph-receipt"} style={{ fontSize: '1.4rem' }}></i>
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', margin: 0 }}>
              {activeTab === 'PERSONAL' ? 'Personal Expenses' : 'Group Activity & Expenses'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '3px 0 0' }}>
              {activeTab === 'PERSONAL' 
                ? 'Track your private expenses by Subject/Topic or individual daily bills' 
                : 'All shared expenses and settlement transactions across your groups'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'PERSONAL' && onNewTopicClick && (
            <button className="btn-secondary" onClick={onNewTopicClick}>
              <i className="ph ph-folder-plus"></i>
              New Subject
            </button>
          )}

          <button className="btn-primary" onClick={() => onNewExpenseClick(activeTab)}>
            <i className="ph ph-plus"></i>
            {activeTab === 'PERSONAL' ? 'Add Personal Expense' : 'Add Group Expense'}
          </button>
        </div>
      </div>

      {/* Main Mode Toggle */}
      <div className="toggle-group" style={{ maxWidth: '440px', margin: '0' }}>
        <button 
          type="button" 
          className={`toggle-btn ${activeTab === 'PERSONAL' ? 'active' : ''}`}
          onClick={() => setActiveTab('PERSONAL')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 16px' }}
        >
          <i className="ph ph-user"></i>
          <span>Personal Expenses ({personalExpenses.length})</span>
        </button>
        <button 
          type="button" 
          className={`toggle-btn ${activeTab === 'GROUP' ? 'active' : ''}`}
          onClick={() => setActiveTab('GROUP')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 16px' }}
        >
          <i className="ph ph-users-three"></i>
          <span>Group Expenses ({activities.length})</span>
        </button>
      </div>

      {/* ================= PERSONAL EXPENSES VIEW ================= */}
      {activeTab === 'PERSONAL' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary Stat Card */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.15) 0%, rgba(0, 184, 148, 0.1) 100%)', 
            border: '1px solid rgba(108, 92, 231, 0.25)',
            borderRadius: '16px',
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Personal Spending
              </span>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {formatSimple(totalPersonalSpent, currencyCode)}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Across {personalTopics.length} subjects • {Object.keys(categoryStats).length} categories • {personalExpenses.length} records
              </span>
            </div>

            {/* Sub-view switcher: By Subjects / Topics vs All Expenses List */}
            <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '10px' }}>
              <button
                type="button"
                onClick={() => setPersonalViewMode('TOPICS')}
                style={{
                  background: personalViewMode === 'TOPICS' ? 'var(--accent-primary)' : 'transparent',
                  color: personalViewMode === 'TOPICS' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <i className="ph ph-folder-simple"></i>
                By Subjects ({personalTopics.length})
              </button>
              <button
                type="button"
                onClick={() => setPersonalViewMode('ALL')}
                style={{
                  background: personalViewMode === 'ALL' ? 'var(--accent-primary)' : 'transparent',
                  color: personalViewMode === 'ALL' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <i className="ph ph-list-dashes"></i>
                All Expenses ({personalExpenses.length})
              </button>
            </div>
          </div>

          {/* ================= SUB-VIEW 1: BY SUBJECTS / TOPICS ================= */}
          {personalViewMode === 'TOPICS' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>
                    Subjects & Projects (বিষয়ভিত্তিক খরচ)
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    যেমন: ট্যুর, মাসিক বাজার, ফ্ল্যাট খরচ, শপিং বা চিকিৎসা — নির্দিষ্ট বিষয়ের অধীনে খরচগুলো সাজিয়ে রাখুন
                  </p>
                </div>

                {onNewTopicClick && (
                  <button 
                    type="button" 
                    className="btn-primary" 
                    onClick={onNewTopicClick}
                    style={{ fontSize: '0.85rem', padding: '8px 14px' }}
                  >
                    <i className="ph ph-plus"></i> New Subject
                  </button>
                )}
              </div>

              {personalTopics.length > 0 || untaggedExpenses.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: '14px'
                }}>
                  {topicStats.map(topic => {
                    const topicColor = topic.color || '#6c5ce7';
                    const topicIcon = topic.icon || 'ph-folder-simple';
                    const hasBudget = topic.budget > 0;
                    const percent = hasBudget ? Math.min(Math.round((topic.totalSpent / topic.budget) * 100), 100) : 0;
                    const isOver = hasBudget && topic.totalSpent > topic.budget;

                    return (
                      <div
                        key={topic.id}
                        onClick={() => onSelectTopic?.(topic)}
                        className="glass-panel hover-card"
                        style={{
                          padding: '18px',
                          borderRadius: '14px',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--glass-border)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          position: 'relative'
                        }}
                        title={`Click to open "${topic.name}" details`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            background: `${topicColor}20`,
                            color: topicColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.35rem'
                          }}>
                            <i className={`ph ${topicIcon}`}></i>
                          </div>

                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px' }}>
                              {topic.itemCount} item{topic.itemCount === 1 ? '' : 's'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNewExpenseClick?.('PERSONAL', null, topic.name);
                              }}
                              style={{
                                background: `${topicColor}25`,
                                border: `1px solid ${topicColor}50`,
                                color: topicColor,
                                width: '28px',
                                height: '28px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                              }}
                              title={`Add expense to "${topic.name}"`}
                            >
                              <i className="ph ph-plus"></i>
                            </button>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '2px' }}>
                            {topic.name}
                          </div>
                          {topic.description && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {topic.description}
                            </div>
                          )}
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: topicColor, marginTop: '6px' }}>
                            {formatSimple(topic.totalSpent, currencyCode)}
                          </div>
                        </div>

                        {/* Budget Bar if budget set */}
                        {hasBudget && (
                          <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Budget: {formatSimple(topic.budget, currencyCode)}</span>
                              <span style={{ fontWeight: 600, color: isOver ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                {isOver ? 'Over budget' : `${percent}%`}
                              </span>
                            </div>
                            <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${percent}%`,
                                background: isOver ? 'var(--danger)' : (percent > 80 ? 'var(--warning)' : topicColor)
                              }} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* General / Untagged Expenses Card */}
                  {untaggedExpenses.length > 0 && (
                    <div
                      onClick={() => onSelectTopic?.({ name: 'General / Untagged', isUntagged: true, color: '#a29bfe', icon: 'ph-tag' })}
                      className="glass-panel hover-card"
                      style={{
                        padding: '18px',
                        borderRadius: '14px',
                        background: 'var(--bg-tertiary)',
                        border: '1px dashed var(--glass-border)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}
                      title="Click to view untagged expenses"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: 'rgba(162, 155, 254, 0.15)',
                          color: '#a29bfe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.35rem'
                        }}>
                          <i className="ph ph-receipt"></i>
                        </div>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px' }}>
                          {untaggedExpenses.length} item{untaggedExpenses.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                          General / Untagged
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          Daily personal purchases without a subject
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#a29bfe', marginTop: '6px' }}>
                          {formatSimple(untaggedTotal, currencyCode)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '48px 24px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '16px'
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(108, 92, 231, 0.15)',
                    color: 'var(--accent-primary)',
                    fontSize: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px'
                  }}>
                    <i className="ph ph-folder-star"></i>
                  </div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Create Your First Subject / Project</h3>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 20px', fontSize: '0.9rem' }}>
                    ট্যুর, মাসিক বাজার, বাসা মেরামত, বা কেনাকাটার মতো বিষয় বা ইভেন্ট তৈরি করুন এবং তার অধীনে একাধিক খরচ যোগ করুন।
                  </p>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    {onNewTopicClick && (
                      <button className="btn-primary" onClick={onNewTopicClick}>
                        <i className="ph ph-folder-plus"></i> Create Subject
                      </button>
                    )}
                    <button className="btn-secondary" onClick={() => onNewExpenseClick('PERSONAL')}>
                      <i className="ph ph-plus"></i> Quick Expense
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= SUB-VIEW 2: CATEGORY STATS & ALL EXPENSES LIST ================= */}
          {personalViewMode === 'ALL' && (
            <>
              {/* Category Cards Grid */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)' }}>
                    Spending by Category
                  </h3>
                  {selectedCategoryFilter && (
                    <button 
                      className="btn-secondary"
                      onClick={() => setSelectedCategoryFilter(null)}
                      style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                    >
                      <i className="ph ph-x"></i> Clear filter
                    </button>
                  )}
                </div>

                {Object.keys(categoryStats).length > 0 ? (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                    gap: '12px' 
                  }}>
                    {Object.entries(categoryStats).map(([catName, stats]) => {
                      const meta = getCategoryMeta(catName);
                      const isSelected = selectedCategoryFilter === catName;
                      return (
                        <div 
                          key={catName}
                          onClick={() => setSelectedCategoryFilter(isSelected ? null : catName)}
                          style={{
                            background: isSelected ? `${meta.color}25` : 'var(--bg-tertiary)',
                            border: isSelected ? `2px solid ${meta.color}` : '1px solid var(--glass-border)',
                            borderRadius: '14px',
                            padding: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                          }}
                          title={`Click to filter by ${catName}`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ 
                              width: '38px', height: '38px', borderRadius: '10px', 
                              background: meta.bg, color: meta.color,
                              display: 'flex', alignItems: 'center', justifyContent: 'center' 
                            }}>
                              <i className={`ph ${meta.icon}`} style={{ fontSize: '1.25rem' }}></i>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '6px' }}>
                              {stats.count} {stats.count === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                              {catName}
                            </div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: meta.color, marginTop: '2px' }}>
                              {formatSimple(stats.total, currencyCode)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-item)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                    Add your first personal expense to see your category breakdown.
                  </div>
                )}
              </div>

              {/* Personal Transactions List */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '1.05rem', margin: 0 }}>
                    {selectedCategoryFilter ? `"${selectedCategoryFilter}" Expenses` : 'All Personal Expenses'} ({displayedPersonalExpenses.length})
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click any item to view full details</span>
                </div>

                {displayedPersonalExpenses.length === 0 ? (
                  <div className="empty-state" style={{ padding: '40px 16px' }}>
                    <i className="ph ph-shopping-bag" style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: '16px' }}></i>
                    <h3>No expenses found</h3>
                    <p>
                      {selectedCategoryFilter 
                        ? `No expenses found in "${selectedCategoryFilter}" category.` 
                        : 'Start tracking your personal groceries, books, shopping, etc.'}
                    </p>
                    <button className="btn-primary" onClick={() => onNewExpenseClick('PERSONAL')} style={{ margin: '16px auto 0' }}>
                      <i className="ph ph-plus"></i> Add Personal Expense
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {displayedPersonalExpenses.map(item => {
                      const meta = getCategoryMeta(item.category);
                      return (
                        <div 
                          key={item.id}
                          className="glass-panel hover-card"
                          onClick={() => onSelectExpense?.(item)}
                          style={{
                            padding: '16px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px',
                            borderRadius: '12px',
                            background: 'var(--bg-tertiary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          title="Click to view details"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                            <div style={{
                              width: '42px', height: '42px', borderRadius: '10px',
                              background: meta.bg, color: meta.color,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <i className={`ph ${meta.icon}`} style={{ fontSize: '1.3rem' }}></i>
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <h4 style={{ margin: '0 0 2px 0', fontSize: '1rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.title}
                              </h4>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ 
                                  fontSize: '0.72rem', 
                                  fontWeight: 600, 
                                  color: meta.color,
                                  background: meta.bg,
                                  padding: '2px 6px',
                                  borderRadius: '4px'
                                }}>
                                  {normalizeCategory(item.category)}
                                </span>

                                {item.topic && (
                                  <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    color: '#a29bfe',
                                    background: 'rgba(108, 92, 231, 0.15)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}>
                                    <i className="ph ph-folder-simple"></i>
                                    {item.topic}
                                  </span>
                                )}

                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>•</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  {formatDate(item.date)}
                                </span>
                                {item.notes && (
                                  <>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>•</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {item.notes}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {formatSimple(item.amount, currencyCode)}
                            </div>
                            {onDeleteExpense && (
                              <button 
                                className="btn-icon delete-btn"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const ok = await confirm({
                                    title: 'Delete Expense?',
                                    message: `Are you sure you want to delete "${item.description || 'this expense'}"?`,
                                    confirmText: 'Delete Expense',
                                    type: 'danger'
                                  });
                                  if (ok) {
                                    onDeleteExpense(item.id);
                                  }
                                }}
                                title="Delete expense"
                                style={{ width: '32px', height: '32px' }}
                              >
                                <i className="ph ph-trash"></i>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ================= GROUP ACTIVITY VIEW ================= */}
      {activeTab === 'GROUP' && (
        <>
          <div className="expenses-filters">
            <button 
              className={`filter-chip ${groupFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setGroupFilter('ALL')}
            >
              All Activity
            </button>
            <button 
              className={`filter-chip ${groupFilter === 'EXPENSES' ? 'active' : ''}`}
              onClick={() => setGroupFilter('EXPENSES')}
            >
              Expenses Only
            </button>
            <button 
              className={`filter-chip ${groupFilter === 'SETTLEMENTS' ? 'active' : ''}`}
              onClick={() => setGroupFilter('SETTLEMENTS')}
            >
              Settlements
            </button>
          </div>

          {filteredActivities.length === 0 ? (
            <div className="empty-state">
              <i className="ph ph-receipt" style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: '16px' }}></i>
              <h3>No group activity yet</h3>
              <p>Group expenses and settlements will appear here.</p>
              <button className="btn-primary" onClick={() => onNewExpenseClick('GROUP')} style={{ margin: '16px auto 0' }}>
                <i className="ph ph-plus"></i> Add Group Expense
              </button>
            </div>
          ) : (
            <div className="timeline-container">
              {filteredActivities.map((activity, index) => {
                const isLast = index === filteredActivities.length - 1;
                const isExpense = activity.type === 'EXPENSE';
                const data = activity.data;
                
                const iconClass = isExpense ? "ph ph-receipt" : "ph ph-handshake";
                const iconColor = isExpense ? "var(--warning)" : "var(--success)";
                const iconBg = isExpense ? "rgba(253, 203, 110, 0.15)" : "rgba(0, 184, 148, 0.15)";
                
                const title = isExpense ? data.title : `${data.payerName} paid ${data.payeeName}`;
                const groupName = isExpense ? (data.groupName || "Group Expense") : "Settlement";

                return (
                  <div 
                    className="timeline-item hover-card" 
                    key={index}
                    onClick={() => onSelectExpense?.({ ...data, isSettlement: !isExpense, type: activity.type })}
                    style={{ cursor: 'pointer', borderRadius: '12px', padding: '12px 14px' }}
                    title="Click to view details"
                  >
                    {!isLast && <div className="timeline-line"></div>}
                    
                    <div className="timeline-dot" style={{ backgroundColor: iconBg, color: iconColor }}>
                      <i className={iconClass}></i>
                    </div>
                    
                    <div className="timeline-content">
                      <div className="timeline-details">
                        <h4>{title}</h4>
                        <div className="timeline-meta">
                          <span>{groupName}</span>
                          <span className="dot-separator">•</span>
                          <span>{formatDate(activity.date)}</span>
                          {isExpense ? (
                            <>
                              <span className="dot-separator">•</span>
                              <span>Paid by {data.payerName}</span>
                            </>
                          ) : (
                            <>
                              <span className="dot-separator">•</span>
                              <span>Via {data.paymentMethod || 'Cash'}{data.trxId ? ` (${data.trxId})` : ''}</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                        <div className="timeline-amount" style={{ color: isExpense ? 'var(--text-primary)' : 'var(--success)' }}>
                          {formatSimple(data.amount, currencyCode)}
                        </div>
                        {((isExpense && onDeleteExpense) || (!isExpense && onDeleteSettlement)) && (
                          <button 
                            className="btn-icon delete-btn"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const ok = await confirm({
                                title: isExpense ? 'Delete Expense?' : 'Delete Settlement?',
                                message: isExpense
                                  ? `Are you sure you want to delete "${data.description || 'this expense'}"?`
                                  : 'Are you sure you want to delete this settlement record?',
                                confirmText: 'Delete',
                                type: 'danger'
                              });
                              if (ok) {
                                if (isExpense) {
                                  onDeleteExpense(data.id);
                                } else {
                                  onDeleteSettlement(data.id);
                                }
                              }
                            }}
                            title={`Delete ${isExpense ? 'expense' : 'settlement'}`}
                            style={{ width: '32px', height: '32px' }}
                          >
                            <i className="ph ph-trash"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
