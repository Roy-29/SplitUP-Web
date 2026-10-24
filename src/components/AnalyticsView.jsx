import React, { useState, useMemo } from 'react';
import { formatSimple, getSymbol } from '../lib/CurrencyManager';
import { getCategoryMeta, normalizeCategory } from './ExpensesView';
import CustomSelect from './CustomSelect';
import './AnalyticsView.css';

export default function AnalyticsView({
  expenses = [],
  personalExpenses = [],
  personalTopics = [],
  groups = [],
  members = [],
  settlements = [],
  currentUser,
  currencyCode = 'BDT',
  formatCurrency,
  onNewExpenseClick
}) {
  const [scope, setScope] = useState('ALL'); // 'ALL' | 'PERSONAL' | 'GROUP'
  const [selectedGroupId, setSelectedGroupId] = useState('ALL');
  const [selectedTopic, setSelectedTopic] = useState('ALL');
  const [timeRange, setTimeRange] = useState('THIS_MONTH'); // 'THIS_MONTH' | 'LAST_30_DAYS' | 'LAST_3_MONTHS' | 'ALL_TIME'
  
  // Interactive chart state
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);

  const activeCurrency = currencyCode || localStorage.getItem('splitup_currency') || 'BDT';
  const currencySymbol = getSymbol(activeCurrency);
  const formatAmt = (val) => formatCurrency ? formatCurrency(val) : formatSimple(val, activeCurrency);

  // 1. Filtered Dataset based on Scope, Sub-filter, and Time Range
  const filteredExpenses = useMemo(() => {
    const now = Date.now();
    let minDate = 0;
    if (timeRange === 'THIS_MONTH') {
      const d = new Date();
      minDate = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    } else if (timeRange === 'LAST_30_DAYS') {
      minDate = now - 30 * 24 * 60 * 60 * 1000;
    } else if (timeRange === 'LAST_3_MONTHS') {
      minDate = now - 90 * 24 * 60 * 60 * 1000;
    }

    let items = [];

    // Group expenses
    if (scope === 'ALL' || scope === 'GROUP') {
      let grp = (expenses || []).map(e => ({
        ...e,
        isPersonal: false,
        category: e.category || 'OTHER',
        date: e.date || now,
        amount: Number(e.amount) || 0
      }));
      if (selectedGroupId !== 'ALL') {
        grp = grp.filter(e => String(e.groupId) === String(selectedGroupId));
      }
      items.push(...grp);
    }

    // Personal expenses
    if (scope === 'ALL' || scope === 'PERSONAL') {
      let pers = (personalExpenses || []).map(e => ({
        ...e,
        isPersonal: true,
        category: e.category || 'General',
        date: e.date || now,
        amount: Number(e.amount) || 0
      }));
      if (selectedTopic !== 'ALL') {
        pers = pers.filter(e => (e.topic || 'General') === selectedTopic);
      }
      items.push(...pers);
    }

    if (minDate > 0) {
      items = items.filter(e => e.date >= minDate);
    }

    return items.sort((a, b) => b.date - a.date);
  }, [expenses, personalExpenses, scope, selectedGroupId, selectedTopic, timeRange]);

  // 2. Category Aggregation & Breakdown
  const categoryData = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const map = {};
    const countMap = {};

    filteredExpenses.forEach(e => {
      const cat = normalizeCategory(e.category || (e.isPersonal ? 'General' : 'OTHER'));
      map[cat] = (map[cat] || 0) + e.amount;
      countMap[cat] = (countMap[cat] || 0) + 1;
    });

    const list = Object.entries(map).map(([name, amount]) => {
      const meta = getCategoryMeta(name);
      const percentage = total > 0 ? (amount / total) * 100 : 0;
      return {
        name,
        amount,
        count: countMap[name] || 1,
        percentage,
        color: meta.color || '#a29bfe',
        icon: meta.icon || 'ph-tag'
      };
    }).sort((a, b) => b.amount - a.amount);

    return { total, list };
  }, [filteredExpenses]);

  // 3. KPI Metrics
  const totalSpent = categoryData.total;
  const transactionCount = filteredExpenses.length;

  const daysInPeriod = useMemo(() => {
    if (timeRange === 'THIS_MONTH') return Math.max(1, new Date().getDate());
    if (timeRange === 'LAST_30_DAYS') return 30;
    if (timeRange === 'LAST_3_MONTHS') return 90;
    if (filteredExpenses.length > 0) {
      const earliest = filteredExpenses[filteredExpenses.length - 1].date;
      return Math.max(1, Math.ceil((Date.now() - earliest) / (1000 * 60 * 60 * 24)));
    }
    return 1;
  }, [timeRange, filteredExpenses]);

  const dailyAverage = totalSpent / daysInPeriod;
  const topCategory = categoryData.list[0] || null;
  const largestExpense = useMemo(() => {
    return filteredExpenses.reduce((max, e) => e.amount > (max?.amount || 0) ? e : max, null);
  }, [filteredExpenses]);

  // 4. Timeline Trend Data (Interactive Multi-bar chart)
  const timelineData = useMemo(() => {
    if (filteredExpenses.length === 0) return [];

    if (timeRange === 'THIS_MONTH' || timeRange === 'LAST_30_DAYS') {
      const daysCount = timeRange === 'THIS_MONTH' ? Math.max(7, new Date().getDate()) : 30;
      const numBuckets = Math.min(8, Math.max(5, Math.ceil(daysCount / 4)));
      const now = Date.now();
      const bucketDuration = (daysCount * 24 * 60 * 60 * 1000) / numBuckets;
      const buckets = [];

      for (let i = 0; i < numBuckets; i++) {
        const start = now - (numBuckets - i) * bucketDuration;
        const end = start + bucketDuration;
        const startD = new Date(start);
        const label = `${startD.getDate()} ${startD.toLocaleString('en-US', { month: 'short' })}`;
        const inBucket = filteredExpenses.filter(e => e.date >= start && e.date < end);
        const amount = inBucket.reduce((s, e) => s + e.amount, 0);
        buckets.push({ label, amount, count: inBucket.length });
      }
      return buckets;
    } else {
      const monthsCount = timeRange === 'LAST_3_MONTHS' ? 3 : 6;
      const monthMap = {};
      const order = [];
      const d = new Date();

      for (let i = monthsCount - 1; i >= 0; i--) {
        const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
        const key = `${dt.getFullYear()}-${dt.getMonth()}`;
        const label = dt.toLocaleString('en-US', { month: 'short' });
        monthMap[key] = { label, amount: 0, count: 0 };
        order.push(key);
      }

      filteredExpenses.forEach(e => {
        const ed = new Date(e.date);
        const key = `${ed.getFullYear()}-${ed.getMonth()}`;
        if (monthMap[key]) {
          monthMap[key].amount += e.amount;
          monthMap[key].count += 1;
        }
      });

      return order.map(k => monthMap[k]);
    }
  }, [filteredExpenses, timeRange]);

  const maxTimelineAmount = useMemo(() => {
    return Math.max(...timelineData.map(b => b.amount), 1);
  }, [timelineData]);

  // 5. Smart AI Financial Insights Engine
  const smartInsights = useMemo(() => {
    const insights = [];
    if (filteredExpenses.length === 0) return insights;

    // Insight 1: Dominant Category & Budget Saver
    if (topCategory && topCategory.percentage >= 30) {
      const cut15 = topCategory.amount * 0.15;
      insights.push({
        id: 'top_cat',
        type: 'warning',
        icon: topCategory.icon || 'ph-tag',
        iconBg: `${topCategory.color}25`,
        iconColor: topCategory.color,
        title: `${topCategory.name} Takes ${topCategory.percentage.toFixed(0)}% of Outflow`,
        description: `You spent ${formatAmt(topCategory.amount)} on ${topCategory.name}. Trimming discretionary spending in this category by 15% could save you around ${formatAmt(cut15)} this cycle.`
      });
    }

    // Insight 2: Daily Velocity
    if (dailyAverage > 0) {
      const projected30 = dailyAverage * 30;
      insights.push({
        id: 'burn_rate',
        type: 'info',
        icon: 'ph-lightning',
        iconBg: 'rgba(108, 92, 231, 0.18)',
        iconColor: '#6c5ce7',
        title: `Daily Burn Rate: ${formatAmt(dailyAverage)} / day`,
        description: `Based on your current activity rate in ${timeRange.replace('_', ' ').toLowerCase()}, your 30-day projected spending will be approximately ${formatAmt(projected30)}.`
      });
    }

    // Insight 3: Weekend vs Weekday Surge
    let weekendTotal = 0;
    let weekdayTotal = 0;
    filteredExpenses.forEach(e => {
      const day = new Date(e.date).getDay();
      if (day === 5 || day === 6 || day === 0) { // Friday, Saturday, Sunday
        weekendTotal += e.amount;
      } else {
        weekdayTotal += e.amount;
      }
    });

    const weekendPct = totalSpent > 0 ? (weekendTotal / totalSpent) * 100 : 0;
    if (weekendPct >= 45 && totalSpent > 500) {
      insights.push({
        id: 'weekend_surge',
        type: 'trend',
        icon: 'ph-calendar-check',
        iconBg: 'rgba(225, 112, 85, 0.18)',
        iconColor: '#e17055',
        title: `Weekend Spending Surge (${weekendPct.toFixed(0)}%)`,
        description: `Almost half your expenses occur on weekends (${formatAmt(weekendTotal)}). Planning leisure activities and groceries ahead can help curb impulsive spikes.`
      });
    }

    // Insight 4: Personal Subject / Project Budget Health
    if (personalTopics.length > 0 && (scope === 'ALL' || scope === 'PERSONAL')) {
      const topicsWithBudget = personalTopics.filter(t => t.budget && t.budget > 0);
      topicsWithBudget.forEach(topic => {
        const spentOnTopic = personalExpenses
          .filter(e => e.topic === topic.name)
          .reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const ratio = (spentOnTopic / topic.budget) * 100;
        if (ratio >= 80) {
          insights.push({
            id: `topic_budget_${topic.name}`,
            type: 'danger',
            icon: 'ph-warning-octagon',
            iconBg: 'rgba(214, 48, 49, 0.18)',
            iconColor: '#d63031',
            title: `Subject Budget Alert: "${topic.name}" at ${ratio.toFixed(0)}%`,
            description: `You've spent ${formatAmt(spentOnTopic)} out of ${formatAmt(topic.budget)} budget for "${topic.name}". Only ${formatAmt(Math.max(0, topic.budget - spentOnTopic))} remains.`
          });
        }
      });
    }

    // Insight 5: Categorization Quality Tip
    const otherCat = categoryData.list.find(c => c.name.toLowerCase() === 'other' || c.name.toLowerCase() === 'general');
    if (otherCat && otherCat.percentage >= 25 && totalSpent > 500) {
      insights.push({
        id: 'categorization_tip',
        type: 'tip',
        icon: 'ph-sparkle',
        iconBg: 'rgba(0, 191, 165, 0.18)',
        iconColor: '#00bfa5',
        title: 'Unlock Deeper Financial Insights',
        description: `${otherCat.percentage.toFixed(0)}% of your expenses are filed as "${otherCat.name}". Tagging specific categories like Food, Utilities, or Travel gives you clearer spending intelligence.`
      });
    }

    return insights;
  }, [filteredExpenses, topCategory, dailyAverage, totalSpent, personalTopics, personalExpenses, scope, timeRange, categoryData]);

  // Donut chart calculations
  const donutRadius = 75;
  const donutCircumference = 2 * Math.PI * donutRadius; // ~471.24
  let accumulatedPercent = 0;

  // Selected or Hovered Category Info for Donut Center
  const activeHoverCategory = hoveredCategory 
    ? categoryData.list.find(c => c.name === hoveredCategory)
    : null;

  return (
    <div className="analytics-container animate-fade-in">
      {/* 1. Header & Controls Bar */}
      <div className="analytics-control-panel glass-panel">
        <div className="panel-header-row">
          <div className="analytics-title-group">
            <div className="analytics-icon-badge">
              <i className="ph-fill ph-chart-donut"></i>
            </div>
            <div>
              <h2>Spending Analytics & Insights</h2>
              <p>Visual breakdowns, interactive timelines, and smart financial intelligence</p>
            </div>
          </div>

          {onNewExpenseClick && (
            <button 
              type="button" 
              className="btn-primary analytics-new-btn"
              onClick={onNewExpenseClick}
            >
              <i className="ph ph-plus"></i>
              <span>Add Expense</span>
            </button>
          )}
        </div>

        {/* Filter Navigation Controls */}
        <div className="analytics-filters-bar">
          {/* Scope Selector: All, Personal, Group */}
          <div className="analytics-scope-tabs">
            <button
              type="button"
              className={`scope-tab ${scope === 'ALL' ? 'active' : ''}`}
              onClick={() => { setScope('ALL'); setSelectedGroupId('ALL'); setSelectedTopic('ALL'); }}
            >
              <i className="ph ph-globe"></i>
              <span>All Outflow</span>
            </button>
            <button
              type="button"
              className={`scope-tab ${scope === 'PERSONAL' ? 'active' : ''}`}
              onClick={() => { setScope('PERSONAL'); setSelectedGroupId('ALL'); }}
            >
              <i className="ph ph-wallet"></i>
              <span>Personal Wallet</span>
            </button>
            <button
              type="button"
              className={`scope-tab ${scope === 'GROUP' ? 'active' : ''}`}
              onClick={() => { setScope('GROUP'); setSelectedTopic('ALL'); }}
            >
              <i className="ph ph-users-three"></i>
              <span>Group Bills</span>
            </button>
          </div>

          {/* Secondary Sub-filters & Time-Range Picker */}
          <div className="analytics-subfilters">
            {/* If Personal is active, allow filtering by Topic/Subject */}
            {scope === 'PERSONAL' && personalTopics.length > 0 && (
              <div className="subfilter-item">
                <CustomSelect
                  value={selectedTopic}
                  onChange={setSelectedTopic}
                  options={[
                    { value: 'ALL', label: 'All Subjects', icon: 'ph-folder-simple', sublabel: `${personalTopics.length} topics` },
                    ...personalTopics.map(t => ({ 
                      value: t.name, 
                      label: t.name, 
                      icon: t.icon || 'ph-folder',
                      sublabel: t.budget ? formatAmt(t.budget) : undefined
                    }))
                  ]}
                  placeholder="Filter by Subject"
                />
              </div>
            )}

            {/* If Group is active, allow filtering by Specific Group */}
            {scope === 'GROUP' && groups.length > 0 && (
              <div className="subfilter-item">
                <CustomSelect
                  value={selectedGroupId}
                  onChange={setSelectedGroupId}
                  options={[
                    { value: 'ALL', label: 'All Groups', icon: 'ph-users-three', sublabel: `${groups.length} groups` },
                    ...groups.map(g => ({ 
                      value: g.id, 
                      label: g.name, 
                      icon: 'ph-users',
                      sublabel: g.memberCount ? `${g.memberCount} members` : undefined
                    }))
                  ]}
                  placeholder="Filter by Group"
                />
              </div>
            )}

            {/* Time Period Selector */}
            <div className="time-range-segmented">
              <button
                type="button"
                className={`time-chip ${timeRange === 'THIS_MONTH' ? 'active' : ''}`}
                onClick={() => setTimeRange('THIS_MONTH')}
              >
                This Month
              </button>
              <button
                type="button"
                className={`time-chip ${timeRange === 'LAST_30_DAYS' ? 'active' : ''}`}
                onClick={() => setTimeRange('LAST_30_DAYS')}
              >
                30 Days
              </button>
              <button
                type="button"
                className={`time-chip ${timeRange === 'LAST_3_MONTHS' ? 'active' : ''}`}
                onClick={() => setTimeRange('LAST_3_MONTHS')}
              >
                3 Months
              </button>
              <button
                type="button"
                className={`time-chip ${timeRange === 'ALL_TIME' ? 'active' : ''}`}
                onClick={() => setTimeRange('ALL_TIME')}
              >
                All Time
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="kpi-grid">
        {/* Total Spending */}
        <div className="kpi-card glass-panel">
          <div className="kpi-header">
            <span className="kpi-label">Total Outflow</span>
            <div className="kpi-icon-pill" style={{ background: 'rgba(108, 92, 231, 0.15)', color: '#6c5ce7' }}>
              <i className="ph ph-currency-circle-dollar"></i>
            </div>
          </div>
          <div className="kpi-value">{formatAmt(totalSpent)}</div>
          <div className="kpi-meta">
            <i className="ph ph-receipt"></i>
            <span>{transactionCount} transactions in {timeRange.replace('_', ' ').toLowerCase()}</span>
          </div>
        </div>

        {/* Daily Burn Rate */}
        <div className="kpi-card glass-panel">
          <div className="kpi-header">
            <span className="kpi-label">Daily Burn Rate</span>
            <div className="kpi-icon-pill" style={{ background: 'rgba(0, 191, 165, 0.15)', color: '#00bfa5' }}>
              <i className="ph ph-lightning"></i>
            </div>
          </div>
          <div className="kpi-value">{formatAmt(dailyAverage)} <span className="kpi-unit">/ day</span></div>
          <div className="kpi-meta">
            <i className="ph ph-clock-clockwise"></i>
            <span>Averaged over {daysInPeriod} active days</span>
          </div>
        </div>

        {/* Top Category */}
        <div className="kpi-card glass-panel">
          <div className="kpi-header">
            <span className="kpi-label">Top Spending Area</span>
            <div className="kpi-icon-pill" style={{ background: `${topCategory?.color || '#a29bfe'}25`, color: topCategory?.color || '#a29bfe' }}>
              <i className={`ph ${topCategory?.icon || 'ph-tag'}`}></i>
            </div>
          </div>
          <div className="kpi-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {topCategory ? topCategory.name : 'N/A'}
          </div>
          <div className="kpi-meta">
            {topCategory ? (
              <span>{formatAmt(topCategory.amount)} ({topCategory.percentage.toFixed(0)}% of total)</span>
            ) : (
              <span>No recorded expenses</span>
            )}
          </div>
        </div>

        {/* Largest Single Expense */}
        <div className="kpi-card glass-panel">
          <div className="kpi-header">
            <span className="kpi-label">Largest Expense</span>
            <div className="kpi-icon-pill" style={{ background: 'rgba(232, 67, 147, 0.15)', color: '#e84393' }}>
              <i className="ph ph-trend-up"></i>
            </div>
          </div>
          <div className="kpi-value">
            {largestExpense ? formatAmt(largestExpense.amount) : '0.00'}
          </div>
          <div className="kpi-meta">
            <i className="ph ph-shopping-bag"></i>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {largestExpense ? largestExpense.title : 'None yet'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Empty State or Charts Content */}
      {filteredExpenses.length === 0 ? (
        <div className="analytics-empty-state glass-panel">
          <div className="empty-icon-wrap">
            <i className="ph ph-chart-bar"></i>
          </div>
          <h3>No Spending Data in this Filter</h3>
          <p>We couldn't find any expenses matching your current scope and time range filter.</p>
          {onNewExpenseClick && (
            <button type="button" className="btn-primary" onClick={onNewExpenseClick} style={{ marginTop: '12px' }}>
              <i className="ph ph-plus"></i> Record an Expense
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Main Visual Charts Grid */}
          <div className="charts-main-grid">
            {/* Chart 1: Interactive SVG Donut / Category Ring */}
            <div className="chart-card glass-panel">
              <div className="chart-card-header">
                <div>
                  <h3>Category Distribution</h3>
                  <p>Interactive breakdown across spending types</p>
                </div>
                <span className="chart-badge">{categoryData.list.length} Categories</span>
              </div>

              <div className="donut-chart-container">
                <div className="donut-svg-wrapper">
                  <svg className="donut-svg" viewBox="0 0 240 240">
                    <circle
                      cx="120"
                      cy="120"
                      r={donutRadius}
                      fill="transparent"
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeWidth="24"
                    />

                    {categoryData.list.map((cat, idx) => {
                      const strokeLength = (cat.percentage / 100) * donutCircumference;
                      const strokeOffset = (accumulatedPercent / 100) * donutCircumference;
                      accumulatedPercent += cat.percentage;
                      const isHovered = hoveredCategory === cat.name;

                      return (
                        <circle
                          key={cat.name}
                          cx="120"
                          cy="120"
                          r={donutRadius}
                          fill="transparent"
                          stroke={cat.color}
                          strokeWidth={isHovered ? 30 : 24}
                          strokeDasharray={`${Math.max(1, strokeLength - 2)} ${donutCircumference}`}
                          strokeDashoffset={-strokeOffset}
                          className="donut-segment"
                          style={{
                            transition: 'stroke-width 0.25s ease, filter 0.25s ease',
                            filter: isHovered ? `drop-shadow(0 0 8px ${cat.color}90)` : 'none',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={() => setHoveredCategory(cat.name)}
                          onMouseLeave={() => setHoveredCategory(null)}
                        />
                      );
                    })}
                  </svg>

                  {/* Donut Center Display */}
                  <div className="donut-center-content">
                    {activeHoverCategory ? (
                      <div className="donut-center-info animate-fade-in">
                        <i className={`ph ${activeHoverCategory.icon}`} style={{ color: activeHoverCategory.color, fontSize: '1.4rem' }}></i>
                        <span className="donut-center-cat-name" style={{ color: activeHoverCategory.color }}>
                          {activeHoverCategory.name}
                        </span>
                        <div className="donut-center-amount">{formatAmt(activeHoverCategory.amount)}</div>
                        <span className="donut-center-pct">{activeHoverCategory.percentage.toFixed(1)}%</span>
                      </div>
                    ) : (
                      <div className="donut-center-info">
                        <span className="donut-center-label">TOTAL SPENT</span>
                        <div className="donut-center-amount">{formatAmt(totalSpent)}</div>
                        <span className="donut-center-pct">{filteredExpenses.length} items</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Donut Legend List */}
                <div className="donut-legend-list">
                  {categoryData.list.map(cat => {
                    const isHovered = hoveredCategory === cat.name;
                    return (
                      <div
                        key={cat.name}
                        className={`legend-item ${isHovered ? 'hovered' : ''}`}
                        onMouseEnter={() => setHoveredCategory(cat.name)}
                        onMouseLeave={() => setHoveredCategory(null)}
                      >
                        <div className="legend-icon-badge" style={{ backgroundColor: `${cat.color}22`, color: cat.color }}>
                          <i className={`ph ${cat.icon}`}></i>
                        </div>
                        <div className="legend-text-info">
                          <div className="legend-name-row">
                            <span className="legend-name">{cat.name}</span>
                            <span className="legend-percentage">{cat.percentage.toFixed(1)}%</span>
                          </div>
                          <div className="legend-amount">{formatAmt(cat.amount)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Chart 2: Interactive Spending Timeline (Bar Chart) */}
            <div className="chart-card glass-panel">
              <div className="chart-card-header">
                <div>
                  <h3>Spending Timeline & Trend</h3>
                  <p>Outflow volume tracked across chronological periods</p>
                </div>
                <div className="chart-legend-pill">
                  <span className="legend-dot-indicator"></span>
                  <span>Volume ({currencySymbol})</span>
                </div>
              </div>

              <div className="timeline-chart-container">
                <div className="timeline-bars-wrapper">
                  {timelineData.map((bucket, idx) => {
                    const heightPct = maxTimelineAmount > 0 ? (bucket.amount / maxTimelineAmount) * 100 : 0;
                    const isHovered = hoveredBarIndex === idx;
                    const isPeak = bucket.amount === maxTimelineAmount && bucket.amount > 0;

                    return (
                      <div
                        key={idx}
                        className="timeline-bar-column"
                        onMouseEnter={() => setHoveredBarIndex(idx)}
                        onMouseLeave={() => setHoveredBarIndex(null)}
                      >
                        {/* Hover Tooltip */}
                        {isHovered && (
                          <div className="bar-tooltip glass-panel animate-fade-in">
                            <div className="tooltip-title">{bucket.label}</div>
                            <div className="tooltip-amount">{formatAmt(bucket.amount)}</div>
                            <div className="tooltip-count">{bucket.count} transaction{bucket.count !== 1 ? 's' : ''}</div>
                          </div>
                        )}

                        <div className="bar-track">
                          {isPeak && <span className="peak-flame-tag" title="Peak Spending Period">🔥</span>}
                          <div
                            className={`bar-fill ${isPeak ? 'peak' : ''} ${isHovered ? 'hovered' : ''}`}
                            style={{ height: `${Math.max(6, heightPct)}%` }}
                          ></div>
                        </div>

                        <span className={`bar-label ${isHovered ? 'highlight' : ''}`}>
                          {bucket.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 4. AI Smart Financial Advisor & Proactive Suggestions */}
          <div className="smart-advisor-section glass-panel">
            <div className="advisor-header">
              <div className="advisor-title-group">
                <div className="advisor-sparkle-icon">
                  <i className="ph-fill ph-sparkle"></i>
                </div>
                <div>
                  <h3>SplitUP Smart Financial Insights</h3>
                  <p>Automated intelligence and tailored suggestions based on your spending patterns</p>
                </div>
              </div>
              <span className="ai-badge">AI Powered</span>
            </div>

            <div className="advisor-cards-grid">
              {smartInsights.map(item => (
                <div key={item.id} className={`advisor-insight-card ${item.type}`}>
                  <div className="insight-card-top">
                    <div className="insight-icon" style={{ backgroundColor: item.iconBg, color: item.iconColor }}>
                      <i className={`ph ${item.icon}`}></i>
                    </div>
                    <span className={`insight-type-tag ${item.type}`}>{item.type.toUpperCase()}</span>
                  </div>
                  <h4 className="insight-title">{item.title}</h4>
                  <p className="insight-desc">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Detailed Category Ranking & Progress Meters */}
          <div className="category-breakdown-card glass-panel">
            <div className="breakdown-header">
              <div>
                <h3>Category Spending Breakdown</h3>
                <p>Comprehensive ranking and budget allocation percentage</p>
              </div>
            </div>

            <div className="category-meters-list">
              {categoryData.list.map((cat, idx) => (
                <div key={cat.name} className="category-meter-item">
                  <div className="meter-left-info">
                    <div className="meter-icon" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                      <i className={`ph ${cat.icon}`}></i>
                    </div>
                    <div className="meter-text">
                      <div className="meter-title-row">
                        <span className="meter-name">{cat.name}</span>
                        <span className="meter-count">{cat.count} expenses</span>
                      </div>
                      <div className="meter-bar-track">
                        <div
                          className="meter-bar-fill"
                          style={{
                            width: `${cat.percentage}%`,
                            background: `linear-gradient(90deg, ${cat.color}, ${cat.color}dd)`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="meter-right-info">
                    <div className="meter-amount">{formatAmt(cat.amount)}</div>
                    <span className="meter-percentage-badge">{cat.percentage.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 6. Top High-Impact Expenses List */}
          <div className="recent-high-impact-card glass-panel">
            <div className="high-impact-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="impact-icon-badge">
                  <i className="ph ph-receipt"></i>
                </div>
                <div>
                  <h3>Highest Value Transactions</h3>
                  <p>Top single outflows recorded in this active window</p>
                </div>
              </div>
            </div>

            <div className="impact-expenses-list">
              {filteredExpenses.slice(0, 5).map(e => {
                const meta = getCategoryMeta(e.category);
                const dateStr = new Date(e.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

                return (
                  <div key={e.id} className="impact-expense-item">
                    <div className="impact-item-left">
                      <div className="impact-cat-icon" style={{ backgroundColor: `${meta.color}20`, color: meta.color }}>
                        <i className={`ph ${meta.icon}`}></i>
                      </div>
                      <div>
                        <div className="impact-item-title">{e.title}</div>
                        <div className="impact-item-meta">
                          <span>{dateStr}</span>
                          <span>•</span>
                          <span className={`impact-scope-pill ${e.isPersonal ? 'personal' : 'group'}`}>
                            {e.isPersonal ? 'Personal' : (e.payerName ? `Paid by ${e.payerName}` : 'Group')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="impact-item-amount">
                      {formatAmt(e.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
