import React from 'react';
import { formatSimple } from '../lib/CurrencyManager';
import './AnalyticsView.css';

const CATEGORY_COLORS = {
  FOOD: '#FF6B6B',
  TRAVEL: '#4D96FF',
  UTILITIES: '#6C5CE7',
  ENTERTAINMENT: '#00D2D3',
  SHOPPING: '#FDCB6E',
  OTHER: '#B2BEC3'
};

const CATEGORY_ICONS = {
  FOOD: 'ph ph-hamburger',
  TRAVEL: 'ph ph-airplane-tilt',
  UTILITIES: 'ph ph-lightning',
  ENTERTAINMENT: 'ph ph-game-controller',
  SHOPPING: 'ph ph-shopping-bag',
  OTHER: 'ph ph-receipt'
};

export default function AnalyticsView({ expenses, currentUser }) {
  // Compute total expenses
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Group by category
  const categoryTotals = expenses.reduce((acc, expense) => {
    const cat = expense.category || 'OTHER';
    acc[cat] = (acc[cat] || 0) + expense.amount;
    return acc;
  }, {});

  // Sort categories by amount descending
  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amount]) => ({
      name: cat,
      amount,
      percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
    }));

  return (
    <div className="analytics-view glass-panel animate-fade-in">
      <div className="analytics-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="activity-icon" style={{ background: 'rgba(77, 150, 255, 0.15)', color: 'var(--info)' }}>
            <i className="ph ph-chart-pie-slice"></i>
          </div>
          <div>
            <h2>Spending Analytics</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Visual breakdown of your group spending</p>
          </div>
        </div>
      </div>

      <div className="analytics-summary">
        <h3>Total Spending</h3>
        <div className="analytics-total">{formatSimple(totalAmount, 'BDT')}</div>
      </div>

      {sortedCategories.length === 0 ? (
        <div className="empty-state">
          <i className="ph ph-chart-bar" style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: '16px' }}></i>
          <h3>No Data Available</h3>
          <p>Add some expenses to see your spending insights.</p>
        </div>
      ) : (
        <div className="analytics-content">
          <div className="progress-bar-container">
            {sortedCategories.map((cat, idx) => (
              <div 
                key={idx} 
                className="progress-segment" 
                style={{ 
                  width: `${cat.percentage}%`, 
                  backgroundColor: CATEGORY_COLORS[cat.name] || CATEGORY_COLORS.OTHER 
                }}
                title={`${cat.name}: ${cat.percentage.toFixed(1)}%`}
              ></div>
            ))}
          </div>

          <div className="category-list">
            {sortedCategories.map((cat, idx) => {
              const color = CATEGORY_COLORS[cat.name] || CATEGORY_COLORS.OTHER;
              const icon = CATEGORY_ICONS[cat.name] || CATEGORY_ICONS.OTHER;
              return (
                <div key={idx} className="category-item">
                  <div className="category-info">
                    <div className="category-icon" style={{ backgroundColor: `${color}20`, color }}>
                      <i className={icon}></i>
                    </div>
                    <div>
                      <h4>{cat.name}</h4>
                      <span className="category-percentage">{cat.percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="category-amount" style={{ fontWeight: '600' }}>
                    {formatSimple(cat.amount, 'BDT')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
