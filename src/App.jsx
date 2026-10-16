import { useState, useEffect, useRef } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'
import { LocalDatabase } from './store/db'
import { calculateBalances, simplifyDebts, getTotalGroupBalance } from './lib/BalanceCalculator'
import DashboardView from './components/DashboardView'
import NewExpenseModal from './components/NewExpenseModal'
import SettleUpModal from './components/SettleUpModal'
import GroupsView from './components/GroupsView'
import ExpensesView from './components/ExpensesView'
import AnalyticsView from './components/AnalyticsView'
import SettingsView from './components/SettingsView'
import NewGroupModal from './components/NewGroupModal'
import JoinGroupModal from './components/JoinGroupModal'
import GroupDetailsModal from './components/GroupDetailsModal'
import ExpenseDetailsModal from './components/ExpenseDetailsModal'
import NewTopicModal from './components/NewTopicModal'
import TopicDetailsModal from './components/TopicDetailsModal'
import UserAvatar from './components/UserAvatar'
import AuthScreen from './components/AuthScreen'
import { 
  isTursoConfigured, 
  tursoGetCurrentUser, 
  tursoGetMembers, 
  tursoGetExpenses, 
  tursoGetSettlements, 
  tursoGetGroups, 
  tursoGetPersonalExpenses,
  tursoGetPersonalTopics,
  tursoAddPersonalTopic,
  tursoDeletePersonalTopic,
  tursoDeleteExpense,
  tursoDeleteSettlement,
  tursoDeleteGroup,
  initTursoTables, 
  tursoSignOut,
  tursoSyncCurrentUser 
} from './lib/turso';
import './components/Modal.css'
import './App.css'

import { formatSimple, formatCompact } from './lib/CurrencyManager'

function JoinRouteHandler({ currentUser, onJoinSuccess }) {
  const { code } = useParams();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);

  return (
    <JoinGroupModal
      isOpen={isOpen}
      initialCode={code}
      currentUser={currentUser}
      onSuccess={() => {
        onJoinSuccess?.();
        navigate('/groups', { replace: true });
      }}
      onClose={() => {
        setIsOpen(false);
        navigate('/groups', { replace: true });
      }}
    />
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const isSettingsPage = location.pathname === '/settings';
  const isDashboard = location.pathname === '/' || location.pathname === '/dashboard';
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [data, setData] = useState({
    currentUser: null,
    members: [],
    expenses: [],
    personalExpenses: [],
    personalTopics: [],
    settlements: [],
    myBalance: null,
    totalOwed: 0,
    totalToReceive: 0,
    simplifiedDebts: [],
    activities: [],
    groups: []
  })
  
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseModalMode, setExpenseModalMode] = useState('PERSONAL');
  const [expenseModalGroupId, setExpenseModalGroupId] = useState(null);
  const [expenseModalTopic, setExpenseModalTopic] = useState('');
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleModalGroupId, setSettleModalGroupId] = useState(null);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [isNewTopicModalOpen, setIsNewTopicModalOpen] = useState(false);
  const [selectedGroupForDetails, setSelectedGroupForDetails] = useState(null);
  const [selectedExpenseForDetails, setSelectedExpenseForDetails] = useState(null);
  const [selectedTopicForDetails, setSelectedTopicForDetails] = useState(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef(null);

  useEffect(() => {
    if (!isNotificationsOpen) return;

    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isNotificationsOpen]);

  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('splitup_theme') || 'dark';
  });

  // Currency state
  const [currencyCode, setCurrencyCode] = useState(() => {
    return localStorage.getItem('splitup_currency') || 'BDT';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('splitup_theme', theme);
  }, [theme]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const user = tursoGetCurrentUser();
        if (user) {
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.warn("Session check error:", err);
        setIsAuthenticated(false);
      } finally {
        setIsAuthChecking(false);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (location.pathname.startsWith('/join/')) {
      const code = location.pathname.split('/join/')[1]?.split('/')[0]?.trim().toUpperCase();
      if (code) {
        sessionStorage.setItem('pending_join_code', code);
      }
    }
  }, [location.pathname]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const openExpenseModal = (mode = 'PERSONAL', groupId = null, topic = '') => {
    setExpenseModalMode(mode);
    setExpenseModalGroupId(groupId);
    setExpenseModalTopic(topic || '');
    setIsExpenseModalOpen(true);
  };

  const openSettleModal = (groupId = null) => {
    setSettleModalGroupId(groupId);
    setIsSettleModalOpen(true);
  };

  const loadData = async () => {
    // Initialize offline DB fallback
    LocalDatabase.init()
    let members = LocalDatabase.getMembers()
    let expenses = LocalDatabase.getExpenses()
    let settlements = LocalDatabase.getSettlements()
    let personalExpenses = []
    let personalTopics = []
    let mockGroups = [];

    // Determine current user strictly from authenticated session
    let loggedUser = tursoGetCurrentUser();
    if (!loggedUser) {
      setIsAuthenticated(false);
      return;
    }

    if (isTursoConfigured) {
      try {
        await initTursoTables();
        const synced = await tursoSyncCurrentUser(loggedUser.id, loggedUser.email);
        if (synced) loggedUser = synced;
        const [tMembers, tExpenses, tSettlements, tGroups, tPersonal, tTopics] = await Promise.all([
          tursoGetMembers(),
          tursoGetExpenses(),
          tursoGetSettlements(),
          tursoGetGroups(loggedUser),
          tursoGetPersonalExpenses(loggedUser),
          tursoGetPersonalTopics(loggedUser)
        ]);

        mockGroups = (tGroups || []).map(g => ({
          id: g.id,
          name: g.name,
          joinCode: g.joinCode,
          memberCount: (tMembers || []).filter(m => String(m.groupId) === String(g.id)).length,
          expenseCount: (tExpenses || []).filter(e => String(e.groupId) === String(g.id)).length,
          totalExpense: (tExpenses || []).filter(e => String(e.groupId) === String(g.id)).reduce((s, e) => s + e.amount, 0),
          lastExpenseDate: (tExpenses || []).filter(e => String(e.groupId) === String(g.id)).map(e => e.date).sort((a,b)=>b-a)[0] || g.createdAt
        }));

        const userGroupIds = new Set(mockGroups.map(g => String(g.id)));

        // Strictly isolate members, expenses, and settlements to the user's actual groups
        members = (tMembers || []).filter(m => userGroupIds.has(String(m.groupId)));
        expenses = (tExpenses || []).filter(e => userGroupIds.has(String(e.groupId)));
        settlements = (tSettlements || []).filter(s => userGroupIds.has(String(s.groupId)));
        personalExpenses = tPersonal || [];
        personalTopics = tTopics || [];
      } catch (error) {
        console.warn("Turso query failed, falling back to local database. Reason:", error.message);
        personalExpenses = LocalDatabase.getPersonalExpenses();
        personalTopics = LocalDatabase.getPersonalTopics();
      }
    } else {
      personalTopics = LocalDatabase.getPersonalTopics();
    }

    const currentUser = {
      ...loggedUser,
      id: loggedUser.id,
      name: loggedUser.name,
      email: loggedUser.email,
      avatar: loggedUser.avatar || null
    };

    // If user has groups, ensure currentUser is included in members if not already there
    if (mockGroups.length > 0) {
      const userInMembers = members.some(m => String(m.id) === String(currentUser.id) || String(m.userId) === String(currentUser.id) || (m.email && m.email.toLowerCase() === currentUser.email?.toLowerCase()));
      if (!userInMembers) {
        members = [{
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          groupId: mockGroups[0].id,
          userId: currentUser.id
        }, ...members];
      }
    } else {
      // If user has NO groups created, members should be empty so no other names appear!
      members = [];
    }

    // Run the domain logic!
    const balances = calculateBalances(members, expenses, settlements)
    const simplifiedDebts = simplifyDebts(balances)
    const { totalOwed, totalToReceive } = getTotalGroupBalance(balances)

    const myBalance = balances.find(b => b.memberId === currentUser?.id) || {
      memberId: currentUser?.id,
      netBalance: 0,
      totalPaid: 0,
      totalShare: 0
    };

    // Only show debts related to current user
    const myDebts = simplifiedDebts.filter(d => 
      d.fromMemberId === currentUser?.id || d.toMemberId === currentUser?.id
    )

    // Unified Activity Feed
    const activities = [
      ...expenses.map(e => ({ type: 'EXPENSE', date: e.date, data: e })),
      ...settlements.map(s => ({ type: 'SETTLEMENT', date: s.date, data: s }))
    ].sort((a, b) => b.date - a.date);

    setData({
      currentUser,
      members,
      expenses: expenses.sort((a,b) => b.date - a.date),
      personalExpenses,
      personalTopics,
      settlements,
      activities,
      myBalance,
      totalOwed,
      totalToReceive,
      myDebts,
      groups: mockGroups
    });

    setSelectedGroupForDetails(prev => {
      if (!prev) return null;
      return mockGroups.find(g => String(g.id) === String(prev.id)) || prev;
    });

    setSelectedTopicForDetails(prev => {
      if (!prev) return null;
      return personalTopics.find(t => String(t.id) === String(prev.id)) || prev;
    });
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  if (isAuthChecking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ color: 'var(--accent-primary)', fontSize: '2rem' }}>
          <i className="ph ph-spinner ph-spin"></i>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={
          <AuthScreen 
            onLoginSuccess={() => {
              setIsAuthenticated(true);
              loadData();
              const pending = sessionStorage.getItem('pending_join_code');
              if (pending) {
                sessionStorage.removeItem('pending_join_code');
                navigate(`/join/${pending}`, { replace: true });
              } else {
                navigate('/dashboard');
              }
            }}
          />
        } />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (!data.currentUser) return null; // loading

  const formatCurrency = (amount) => {
    return formatSimple(amount, currencyCode);
  }

  const formatCurrencyCompact = (amount) => {
    return formatCompact(amount, currencyCode);
  }

  const { currentUser, myBalance, expenses, personalExpenses, myDebts, activities, groups, totalOwed, totalToReceive } = data;
  const currentActiveGroupId = groups.length > 0 ? groups[0].id : '1';

  const handleDeleteExpense = async (expenseId) => {
    setData(prev => ({
      ...prev,
      personalExpenses: (prev.personalExpenses || []).filter(e => String(e.id) !== String(expenseId)),
      expenses: (prev.expenses || []).filter(e => String(e.id) !== String(expenseId)),
      activities: (prev.activities || []).filter(a => String(a.data?.id) !== String(expenseId))
    }));
    try {
      await tursoDeleteExpense(expenseId);
      LocalDatabase.deleteExpense(expenseId);
    } catch (err) {
      console.error("Failed to delete expense:", err);
    }
    loadData();
  };

  const handleDeleteSettlement = async (settlementId) => {
    setData(prev => ({
      ...prev,
      settlements: (prev.settlements || []).filter(s => String(s.id) !== String(settlementId)),
      activities: (prev.activities || []).filter(a => String(a.data?.id) !== String(settlementId))
    }));
    try {
      await tursoDeleteSettlement(settlementId);
      LocalDatabase.deleteSettlement(settlementId);
    } catch (err) {
      console.error("Failed to delete settlement:", err);
    }
    loadData();
  };

  const handleDeleteGroup = async (groupId) => {
    setData(prev => ({
      ...prev,
      groups: (prev.groups || []).filter(g => String(g.id) !== String(groupId)),
      expenses: (prev.expenses || []).filter(e => String(e.groupId) !== String(groupId)),
      activities: (prev.activities || []).filter(a => String(a.data?.groupId) !== String(groupId))
    }));
    try {
      await tursoDeleteGroup(groupId);
    } catch (err) {
      console.error("Failed to delete group:", err);
    }
    loadData();
  };

  const handleDeleteTopic = async (topicId) => {
    setData(prev => ({
      ...prev,
      personalTopics: (prev.personalTopics || []).filter(t => String(t.id) !== String(topicId))
    }));
    try {
      if (isTursoConfigured) {
        await tursoDeletePersonalTopic(topicId);
      } else {
        LocalDatabase.deletePersonalTopic(topicId);
      }
    } catch (err) {
      console.error("Failed to delete topic:", err);
    }
    loadData();
  };

  const getHeaderInfo = () => {
    if (location.pathname === '/groups') {
      return { title: 'Groups & Circles 👥', subtitle: 'Manage shared groups, invite friends, and split bills' };
    }
    if (location.pathname === '/expenses') {
      return { title: 'Expenses & Ledger 💳', subtitle: 'Track your personal wallet, group bills, and settlements' };
    }
    if (location.pathname === '/analytics') {
      return { title: 'Spending Analytics 📊', subtitle: 'Visual insights, category breakdown, and spending habits' };
    }
    return { 
      title: `Welcome back, ${currentUser.name?.split(' ')[0]} 👋`, 
      subtitle: 'Track your shared expenses & personal wallet.' 
    };
  };
  const headerInfo = getHeaderInfo();

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <NavLink 
          to="/dashboard" 
          className="brand animate-fade-in" 
          title="Go to Dashboard"
        >
          <div className="brand-icon">
            <i className="ph ph-intersect"></i>
          </div>
          <div>
            <h1>SplitUP</h1>
          </div>
        </NavLink>

        <nav className="nav-links">
          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => `nav-item animate-fade-in delay-1 ${isActive ? 'active' : ''}`}
          >
            <i className="ph ph-squares-four"></i>
            <span>Dashboard</span>
          </NavLink>
          <NavLink 
            to="/groups" 
            className={({ isActive }) => `nav-item animate-fade-in delay-2 ${isActive ? 'active' : ''}`}
          >
            <i className="ph ph-users-three"></i>
            <span>Groups</span>
          </NavLink>
          <NavLink 
            to="/expenses" 
            className={({ isActive }) => `nav-item animate-fade-in delay-3 ${isActive ? 'active' : ''}`}
          >
            <i className="ph ph-receipt"></i>
            <span>Expenses</span>
          </NavLink>
          <NavLink 
            to="/analytics" 
            className={({ isActive }) => `nav-item animate-fade-in delay-4 ${isActive ? 'active' : ''}`}
          >
            <i className="ph ph-chart-pie-slice"></i>
            <span>Analytics</span>
          </NavLink>
          <NavLink 
            to="/settings" 
            className={({ isActive }) => `nav-item animate-fade-in delay-5 ${isActive ? 'active' : ''}`}
          >
            <i className="ph ph-gear"></i>
            <span>Settings</span>
          </NavLink>
        </nav>

        <NavLink 
          to="/settings"
          className={({ isActive }) => `user-profile animate-fade-in delay-4 ${isActive ? 'active' : ''}`}
          style={({ isActive }) => ({
            cursor: 'pointer',
            outline: isActive ? '2px solid var(--accent-primary)' : 'none'
          })}
        >
          <UserAvatar user={currentUser} size={40} className="avatar" />
          <div className="user-info">
            <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600 }}>{currentUser.name}</h4>
            <p style={{ marginTop: '2px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentUser.email}</p>
          </div>
        </NavLink>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {!isSettingsPage && (
          <header className={`header animate-fade-in ${isDashboard ? 'header-dashboard' : 'header-subpage'}`}>
            {/* Mobile Brand Badge (Top-Left on Mobile) */}
            <NavLink 
              to="/dashboard" 
              className="mobile-header-brand"
              title="SplitUP"
            >
              <div className="mobile-header-brand-icon">
                <i className="ph ph-intersect"></i>
              </div>
              <div className="mobile-header-brand-info">
                <span className="mobile-header-brand-name">SplitUP</span>
              </div>
            </NavLink>

            <div className="header-title">
              <h2>{headerInfo.title}</h2>
              <p>{headerInfo.subtitle}</p>
            </div>

            <div className="header-actions">
              <div className="header-icons">
                <button className="btn-icon" onClick={toggleTheme} title="Toggle Theme">
                  {theme === 'dark' ? <i className="ph ph-sun"></i> : <i className="ph ph-moon"></i>}
                </button>
                
                {/* Notification Popover Dropdown */}
                <div className="notification-wrapper" ref={notificationRef}>
                <button 
                  type="button"
                  id="notification-trigger-btn"
                  className={`btn-icon notification-trigger-btn ${isNotificationsOpen ? 'active' : ''}`} 
                  onClick={() => setIsNotificationsOpen(prev => !prev)} 
                  title="Notifications"
                  aria-label="Toggle notifications"
                >
                  <i className="ph ph-bell"></i>
                  <span className="notification-dot"></span>
                </button>

                {isNotificationsOpen && (
                  <div 
                    className="notification-dropdown"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="notification-dropdown-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>Notifications</h4>
                        <span className="notification-count-tag">Live</span>
                      </div>
                      <button 
                        type="button" 
                        className="notification-close-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsNotificationsOpen(false);
                        }}
                      >
                        <i className="ph ph-x"></i>
                      </button>
                    </div>

                    <div className="notification-list">
                      {/* Turso Cloud Sync Status */}
                      <div className="notification-item" onClick={() => { setIsNotificationsOpen(false); navigate('/settings'); }}>
                        <div className={`notification-icon-box ${isTursoConfigured ? 'success' : 'warning'}`}>
                          <i className={`ph ${isTursoConfigured ? 'ph-cloud-check' : 'ph-cloud-slash'}`}></i>
                        </div>
                        <div className="notification-body">
                          <div className="notification-body-header">
                            <span className="notification-item-title">
                              {isTursoConfigured ? 'Turso Cloud Synced' : 'Offline Cache Mode'}
                            </span>
                            <span className="notification-time">Sync</span>
                          </div>
                          <p className="notification-item-desc">
                            {isTursoConfigured 
                              ? 'All shared groups, debts, and balances are securely stored in the cloud.' 
                              : 'Connected to local storage. Tap to configure Turso Cloud in Settings.'}
                          </p>
                        </div>
                      </div>

                      {/* Financial Balance Summary */}
                      <div className="notification-item" onClick={() => { setIsNotificationsOpen(false); navigate('/dashboard'); }}>
                        <div className={`notification-icon-box ${totalToReceive > 0 ? 'info' : (totalOwed > 0 ? 'warning' : 'success')}`}>
                          <i className={`ph ${totalToReceive > 0 ? 'ph-hand-coins' : (totalOwed > 0 ? 'ph-wallet' : 'ph-check-circle')}`}></i>
                        </div>
                        <div className="notification-body">
                          <div className="notification-body-header">
                            <span className="notification-item-title">
                              {totalToReceive > 0 
                                ? 'Receivable Reminder' 
                                : (totalOwed > 0 ? 'Pending Payables' : 'Finances Balanced')}
                            </span>
                            <span className="notification-time">Balance</span>
                          </div>
                          <p className="notification-item-desc">
                            {totalToReceive > 0 
                              ? `You have a total of ${formatCurrency(totalToReceive)} to receive from your friends.`
                              : (totalOwed > 0 
                                ? `You have an outstanding balance of ${formatCurrency(totalOwed)} across your groups.`
                                : 'All debts settled! You have no outstanding dues.')}
                          </p>
                        </div>
                      </div>

                      {/* Latest Activity Notice */}
                      {activities && activities.length > 0 && (() => {
                        const act = activities[0];
                        const d = act.data || {};
                        const isExp = act.type === 'EXPENSE';
                        const title = isExp ? (d.title || 'Group Expense') : (d.title || 'Settlement');
                        const amount = d.amount || 0;
                        const payer = d.payerName || d.paidByName || (isExp && d.paidBy === currentUser.id ? 'You' : 'Member');
                        return (
                          <div className="notification-item" onClick={() => { setIsNotificationsOpen(false); navigate('/expenses'); }}>
                            <div className="notification-icon-box accent">
                              <i className={`ph ${isExp ? 'ph-receipt' : 'ph-handshake'}`}></i>
                            </div>
                            <div className="notification-body">
                              <div className="notification-body-header">
                                <span className="notification-item-title" style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {title}
                                </span>
                                <span className="notification-time">Latest</span>
                              </div>
                              <p className="notification-item-desc">
                                {isExp ? 'Expense' : 'Settlement'} of {formatCurrency(amount)} by {payer}.
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="notification-dropdown-footer">
                      <button 
                        type="button" 
                        className="notification-view-all"
                        onClick={() => {
                          setIsNotificationsOpen(false);
                          navigate('/expenses');
                        }}
                      >
                        <span>View All Transactions</span>
                        <i className="ph ph-arrow-right"></i>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button className="btn-primary header-new-expense" onClick={() => openExpenseModal('PERSONAL')}>
              <i className="ph ph-plus"></i>
              <span>New Expense</span>
            </button>
          </div>
          </header>
        )}

        {/* Routes View */}
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={
            <DashboardView 
              currentUser={currentUser}
              myBalance={myBalance}
              myDebts={myDebts}
              activities={activities}
              groups={groups}
              expenses={expenses}
              formatCurrency={formatCurrency}
              formatCurrencyCompact={formatCurrencyCompact}
              onNewExpenseClick={() => openExpenseModal('PERSONAL')}
              onNewGroupClick={() => setIsNewGroupModalOpen(true)}
              onSettleUpClick={() => openSettleModal()}
              onSelectGroup={(grp) => setSelectedGroupForDetails(grp)}
              onSelectExpense={(item, type) => setSelectedExpenseForDetails({ ...item, ...(type ? { type } : {}) })}
            />
          } />
          <Route path="/groups" element={
            <GroupsView 
              groups={groups} 
              members={data.members}
              expenses={data.expenses}
              settlements={data.settlements}
              onNewGroupClick={() => setIsNewGroupModalOpen(true)} 
              currentUser={currentUser}
              currencyCode={currencyCode}
              onDeleteGroup={handleDeleteGroup}
              onRefreshData={loadData}
              onAddExpense={(mode, grpId) => openExpenseModal(mode, grpId)}
              onSettleUp={(grpId) => openSettleModal(grpId)}
              onDeleteExpense={handleDeleteExpense}
              onDeleteSettlement={handleDeleteSettlement}
              onSelectExpense={(item) => setSelectedExpenseForDetails(item)}
            />
          } />
          <Route path="/expenses" element={
            <ExpensesView 
              activities={activities} 
              personalExpenses={personalExpenses}
              personalTopics={data.personalTopics}
              currencyCode={currencyCode}
              onNewExpenseClick={(mode, grpId, topic) => openExpenseModal(mode, grpId, topic)}
              onNewTopicClick={() => setIsNewTopicModalOpen(true)}
              onSelectExpense={(item, type) => setSelectedExpenseForDetails({ ...item, ...(type ? { type } : {}) })}
              onSelectTopic={(topic) => setSelectedTopicForDetails(topic)}
              onDeleteExpense={handleDeleteExpense}
              onDeleteSettlement={handleDeleteSettlement}
              onDeleteTopic={handleDeleteTopic}
            />
          } />
          <Route path="/analytics" element={
            <AnalyticsView 
              expenses={expenses} 
              currentUser={currentUser} 
            />
          } />
          <Route path="/settings" element={
            <SettingsView 
              currentUser={currentUser} 
              theme={theme} 
              setTheme={setTheme} 
              currencyCode={currencyCode}
              setCurrencyCode={setCurrencyCode}
              onRefreshData={loadData}
              onResetData={() => {
                if (window.confirm("Are you sure you want to reset all test data? This cannot be undone.")) {
                  LocalDatabase.clearData();
                  loadData();
                  alert("Test data reset successfully!");
                }
              }}
              onLogout={() => {
                tursoSignOut();
                setIsAuthenticated(false);
                navigate('/login');
              }} 
            />
          } />
          <Route path="/join/:code" element={
            <JoinRouteHandler 
              currentUser={currentUser} 
              onJoinSuccess={loadData} 
            />
          } />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>

      {/* New Expense Modal */}
      <NewExpenseModal 
        isOpen={isExpenseModalOpen}
        initialMode={expenseModalMode}
        currentGroupId={expenseModalGroupId || currentActiveGroupId}
        initialTopic={expenseModalTopic}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setExpenseModalGroupId(null);
          setExpenseModalTopic('');
        }}
        onSuccess={loadData}
        currentUser={currentUser}
        groups={groups}
        members={data.members}
        personalTopics={data.personalTopics}
      />

      {/* Settle Up Modal */}
      <SettleUpModal 
        isOpen={isSettleModalOpen}
        onClose={() => {
          setIsSettleModalOpen(false);
          setSettleModalGroupId(null);
        }}
        onSuccess={loadData}
        currentGroupId={settleModalGroupId || currentActiveGroupId}
        currentUser={currentUser}
        suggestedDebts={myDebts}
        currencyCode={currencyCode}
        members={data.members}
      />

      {/* New Group Modal */}
      <NewGroupModal
        isOpen={isNewGroupModalOpen}
        onClose={() => setIsNewGroupModalOpen(false)}
        onSuccess={loadData}
        currentUser={currentUser}
      />

      {/* Expense / Settlement Details Modal */}
      <ExpenseDetailsModal
        isOpen={!!selectedExpenseForDetails}
        onClose={() => setSelectedExpenseForDetails(null)}
        expense={selectedExpenseForDetails}
        currentUser={currentUser}
        currencyCode={currencyCode}
        onDeleteExpense={handleDeleteExpense}
        onDeleteSettlement={handleDeleteSettlement}
        onFilterTopic={(topicName) => {
          setSelectedExpenseForDetails(null);
          const found = (data.personalTopics || []).find(t => t.name.toLowerCase() === topicName.toLowerCase());
          if (found) {
            setSelectedTopicForDetails(found);
          }
        }}
      />

      {/* New Subject / Topic Modal */}
      <NewTopicModal
        isOpen={isNewTopicModalOpen}
        onClose={() => setIsNewTopicModalOpen(false)}
        onSuccess={loadData}
        currentUser={currentUser}
        currencyCode={currencyCode}
      />

      {/* Topic / Subject Details Modal */}
      <TopicDetailsModal
        isOpen={!!selectedTopicForDetails}
        onClose={() => setSelectedTopicForDetails(null)}
        topic={selectedTopicForDetails}
        expenses={data.personalExpenses}
        currencyCode={currencyCode}
        onAddExpense={(topicName) => openExpenseModal('PERSONAL', null, topicName)}
        onDeleteTopic={handleDeleteTopic}
        onDeleteExpense={handleDeleteExpense}
        onSelectExpense={(item) => setSelectedExpenseForDetails(item)}
      />

      {/* Group Details Modal */}
      <GroupDetailsModal
        isOpen={!!selectedGroupForDetails}
        onClose={() => setSelectedGroupForDetails(null)}
        group={selectedGroupForDetails}
        currentUser={currentUser}
        members={data.members}
        expenses={data.expenses}
        settlements={data.settlements}
        currencyCode={currencyCode}
        onAddExpense={(mode, grpId) => {
          setSelectedGroupForDetails(null);
          openExpenseModal(mode, grpId);
        }}
        onSettleUp={(grpId) => {
          setSelectedGroupForDetails(null);
          openSettleModal(grpId);
        }}
        onShowQr={() => {}}
        onDeleteGroup={handleDeleteGroup}
        onDeleteExpense={handleDeleteExpense}
        onDeleteSettlement={handleDeleteSettlement}
        onSelectExpense={(item) => setSelectedExpenseForDetails(item)}
      />
    </div>
  )
}

export default App

