import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function DashboardView({
  currentUser,
  myBalance,
  myDebts = [],
  activities = [],
  groups = [],
  expenses = [],
  formatCurrency,
  formatCurrencyCompact,
  onNewExpenseClick,
  onNewGroupClick,
  onSettleUpClick
}) {
  const navigate = useNavigate();

  const totalOwedToMe = myDebts
    .filter(d => d.toMemberId === currentUser.id)
    .reduce((sum, d) => sum + d.amount, 0);

  const totalIOwe = myDebts
    .filter(d => d.fromMemberId === currentUser.id)
    .reduce((sum, d) => sum + d.amount, 0);

  const pendingPaymentsCount = myDebts.filter(d => d.fromMemberId === currentUser.id).length;
  const pendingCollectionsCount = myDebts.filter(d => d.toMemberId === currentUser.id).length;

  return (
    <>
      {/* Dashboard Stats */}
      <div className="dashboard-grid">
        <div className="glass-panel stat-card balance-card animate-fade-in delay-1">
          <div className="stat-header">
            <span>Your Total Balance</span>
            <div className="stat-icon purple">
              <i className="ph ph-wallet"></i>
            </div>
          </div>
          <div className="stat-value text-gradient">
            {myBalance?.netBalance > 0 ? '+' : ''}{formatCurrency(myBalance?.netBalance || 0)}
          </div>
          <div className="stat-footer">
            <span className="trend-up"><i className="ph ph-trend-up"></i> Real-time</span>
            <span>Based on smart settlement</span>
          </div>
        </div>

        <div className="glass-panel stat-card owed-card animate-fade-in delay-2">
          <div className="stat-header">
            <span>You are Owed</span>
            <div className="stat-icon green">
              <i className="ph ph-arrow-down-left"></i>
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {formatCurrency(totalOwedToMe)}
          </div>
          <div className="stat-footer">
            From {pendingCollectionsCount} simplified transaction{pendingCollectionsCount === 1 ? '' : 's'}
          </div>
        </div>

        <div className="glass-panel stat-card owe-card animate-fade-in delay-3">
          <div className="stat-header">
            <span>You Owe</span>
            <div className="stat-icon red">
              <i className="ph ph-arrow-up-right"></i>
            </div>
          </div>
          <div className="stat-value">
            {formatCurrency(totalIOwe)}
          </div>
          <div className="stat-footer">
            <span className="trend-down">
              <i className="ph ph-warning-circle"></i> {pendingPaymentsCount} pending payment{pendingPaymentsCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="content-grid">
        {/* Left Column: Recent Activity */}
        <div className="glass-panel animate-fade-in delay-3 dashboard-activity-panel" style={{ padding: '24px' }}>
          <div className="section-title">
            <h3>Recent Expenses & Activity</h3>
            <Link to="/expenses" className="view-all" style={{ textDecoration: 'none' }}>
              View all
            </Link>
          </div>
          
          <div className="activity-list">
            {activities && activities.length > 0 ? (
              activities.slice(0, 5).map((activity, idx) => {
                if (activity.type === 'SETTLEMENT') {
                  const s = activity.data;
                  const iPaid = s.paidBy === currentUser.id;
                  const iReceived = s.paidTo === currentUser.id;
                  
                  let title = '';
                  let subtitle = '';
                  let amountClass = '';
                  let relationText = '';

                  const trxTag = s.trxId ? ` • Trx: ${s.trxId}` : '';
                  const methodStr = `Via ${s.paymentMethod || 'Cash'}${trxTag} • ${new Date(s.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}`;

                  if (iPaid) {
                    title = `You paid ${s.payeeName}`;
                    subtitle = methodStr;
                    amountClass = 'amount-positive';
                    relationText = 'Settled';
                  } else if (iReceived) {
                    title = `${s.payerName} paid you`;
                    subtitle = methodStr;
                    amountClass = 'amount-negative';
                    relationText = 'Received';
                  } else {
                    title = `${s.payerName} paid ${s.payeeName}`;
                    subtitle = methodStr;
                    relationText = 'Not involved';
                  }

                  return (
                    <div 
                      className="activity-item" 
                      key={`settlement-${s.id || idx}`} 
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate('/expenses')}
                    >
                      <div className="activity-icon" style={{ background: '#00b8941A', color: '#00b894', borderRadius: '50%' }}>
                        <i className="ph ph-handshake"></i>
                      </div>
                      <div className="activity-details">
                        <h4>{title}</h4>
                        <p>{subtitle}</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <div className="activity-amount" style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                          {formatCurrency(s.amount)}
                        </div>
                        <div className={`activity-amount ${amountClass}`} style={{ fontSize: '0.8rem', fontWeight: '500' }}>
                          {relationText}
                        </div>
                      </div>
                    </div>
                  );
                }

                // EXPENSE
                const expense = activity.data;
                const iPaid = expense.paidBy === currentUser.id;
                const myShare = expense.participants?.find(p => p.memberId === currentUser.id)?.shareAmount || 0;
                
                let relationText = "";
                let amountClass = "";
                
                if (iPaid) {
                  const othersOwe = expense.amount - myShare;
                  if (othersOwe > 0) {
                    relationText = `Lent ${formatCurrency(othersOwe)}`;
                    amountClass = "amount-positive";
                  } else {
                    relationText = `Paid ${formatCurrency(expense.amount)}`;
                    amountClass = "amount-negative";
                  }
                } else {
                  if (myShare > 0) {
                    relationText = `Owe ${formatCurrency(myShare)}`;
                    amountClass = "amount-negative";
                  } else {
                    relationText = "Not involved";
                    amountClass = "";
                  }
                }

                let categoryColor = '#6c5ce7';
                let iconClass = 'ph-receipt';
                
                switch(expense.category) {
                  case 'FOOD': categoryColor = '#e17055'; iconClass = 'ph-pizza'; break;
                  case 'TRAVEL': categoryColor = '#0984e3'; iconClass = 'ph-airplane-tilt'; break;
                  case 'GROCERIES': categoryColor = '#00b894'; iconClass = 'ph-shopping-cart'; break;
                  case 'ENTERTAINMENT': categoryColor = '#fdcb6e'; iconClass = 'ph-game-controller'; break;
                  case 'UTILITIES': categoryColor = '#e84393'; iconClass = 'ph-lightning'; break;
                  case 'HEALTH': categoryColor = '#d63031'; iconClass = 'ph-heartbeat'; break;
                  default: categoryColor = '#6c5ce7'; iconClass = 'ph-receipt';
                }

                return (
                  <div 
                    className="activity-item" 
                    key={`expense-${expense.id || idx}`} 
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate('/expenses')}
                  >
                    <div className="activity-icon" style={{ background: `${categoryColor}1A`, color: categoryColor, borderRadius: '50%' }}>
                      <i className={`ph ${iconClass}`}></i>
                    </div>
                    <div className="activity-details">
                      <h4>{expense.title}</h4>
                      <p>Paid by {expense.payerName} • {new Date(expense.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <div className="activity-amount" style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>
                        {formatCurrency(expense.amount)}
                      </div>
                      <div className={`activity-amount ${amountClass}`} style={{ fontSize: '0.8rem', fontWeight: '500' }}>
                        {relationText}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                <i className="ph ph-receipt" style={{ fontSize: '2.5rem', marginBottom: '8px', opacity: 0.6 }}></i>
                <p style={{ margin: 0 }}>No expenses recorded yet.</p>
                <button 
                  className="btn-secondary" 
                  onClick={onNewExpenseClick}
                  style={{ marginTop: '12px', fontSize: '0.85rem' }}
                >
                  <i className="ph ph-plus"></i> Add First Expense
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Actions & Groups */}
        <div className="dashboard-side-panel animate-fade-in delay-4">
          <div className="glass-panel dashboard-quick-actions-card" style={{ padding: '24px' }}>
            <div className="section-title">
              <h3>Quick Actions</h3>
            </div>
            <div className="quick-actions">
              <button className="action-btn" onClick={onNewGroupClick}>
                <i className="ph ph-users-three"></i>
                <span>New Group</span>
              </button>
              <button className="action-btn" onClick={onNewExpenseClick}>
                <i className="ph ph-receipt"></i>
                <span>Add Expense</span>
              </button>
              <button className="action-btn" onClick={onSettleUpClick}>
                <i className="ph ph-hand-coins"></i>
                <span>Settle Up</span>
              </button>
              <button className="action-btn" onClick={() => navigate('/analytics')}>
                <i className="ph ph-chart-pie-slice"></i>
                <span>Analytics</span>
              </button>
            </div>
          </div>

          <div className="glass-panel dashboard-groups-card" style={{ padding: '24px' }}>
            <div className="section-title">
              <h3>Your Groups</h3>
              <Link to="/groups" className="view-all" style={{ textDecoration: 'none' }}>
                View all
              </Link>
            </div>
            {groups && groups.length > 0 ? (
              groups.slice(0, 3).map(group => (
                <div 
                  key={group.id} 
                  className="activity-item" 
                  style={{ cursor: 'pointer', marginBottom: '8px' }}
                  onClick={() => navigate('/groups')}
                >
                  <div className="activity-icon" style={{ background: 'rgba(9, 132, 227, 0.15)', color: '#0984e3', borderRadius: '50%' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>{group.name?.charAt(0) || 'G'}</span>
                  </div>
                  <div className="activity-details">
                    <h4>{group.name}</h4>
                    <p>{group.memberCount || 0} members • {group.expenseCount || 0} expenses</p>
                  </div>
                  <div className="activity-amount" style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>
                    {formatCurrency(group.totalExpense || 0)}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--bg-item)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>No groups created yet.</p>
                <button className="btn-secondary" onClick={onNewGroupClick} style={{ fontSize: '0.85rem' }}>
                  <i className="ph ph-plus"></i> Create Group
                </button>
              </div>
            )}
          </div>

          <div className="glass-panel dashboard-suggestions-card" style={{ padding: '24px' }}>
            <div className="section-title">
              <h3>Smart Suggestions</h3>
            </div>
            
            {myDebts.length > 0 ? (
              myDebts.map((debt, index) => {
                const iOwe = debt.fromMemberId === currentUser.id;
                const targetName = iOwe ? debt.toMemberName : debt.fromMemberName;
                const actionText = iOwe ? `Settle up with ${targetName}` : `Remind ${targetName}`;
                const descText = iOwe ? `Paying ${targetName} ${formatCurrencyCompact(debt.amount)} will simplify your debts.` 
                                      : `${targetName} owes you ${formatCurrencyCompact(debt.amount)}.`;
                
                return (
                  <div 
                    key={index} 
                    className="activity-item" 
                    style={{ background: 'rgba(108, 92, 231, 0.1)', borderColor: 'rgba(108, 92, 231, 0.2)', marginBottom: '12px', cursor: 'pointer' }}
                    onClick={onSettleUpClick}
                  >
                    <div className="activity-icon" style={{ background: 'transparent', color: 'var(--accent-primary)' }}>
                      <i className="ph ph-lightbulb"></i>
                    </div>
                    <div className="activity-details">
                      <h4>{actionText}</h4>
                      <p>{descText}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="activity-item" style={{ background: 'rgba(0, 184, 148, 0.1)', borderColor: 'rgba(0, 184, 148, 0.2)' }}>
                <div className="activity-icon" style={{ background: 'transparent', color: 'var(--success)' }}>
                  <i className="ph ph-check-circle"></i>
                </div>
                <div className="activity-details">
                  <h4>All settled up!</h4>
                  <p>You have no pending debts to simplify.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
