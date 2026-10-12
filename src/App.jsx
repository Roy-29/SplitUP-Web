import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom'
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
import AuthScreen from './components/AuthScreen'
import { 
  isTursoConfigured, 
  tursoGetCurrentUser, 
  tursoGetMembers, 
  tursoGetExpenses, 
  tursoGetSettlements, 
  tursoGetGroups, 
  tursoGetPersonalExpenses,
  tursoDeleteExpense,
  initTursoTables, 
  tursoSignOut 
} from './lib/turso';
import './components/Modal.css'
import './App.css'

import { formatSimple, formatCompact } from './lib/CurrencyManager'

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const isSettingsPage = location.pathname === '/settings';
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [data, setData] = useState({
    currentUser: null,
    members: [],
    expenses: [],
    personalExpenses: [],
    settlements: [],
    myBalance: null,
    totalOwed: 0,
    totalToReceive: 0,
    simplifiedDebts: [],
    activities: [],
    groups: []
  })
  
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseModalMode, setExpenseModalMode] = useState('GROUP');
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  
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

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const openExpenseModal = (mode = 'GROUP') => {
    setExpenseModalMode(mode);
    setIsExpenseModalOpen(true);
  };

  const loadData = async () => {
    // Initialize offline DB fallback
    LocalDatabase.init()
    let members = LocalDatabase.getMembers()
    let expenses = LocalDatabase.getExpenses()
    let settlements = LocalDatabase.getSettlements()
    let personalExpenses = []
    let mockGroups = [];

    // Determine current user strictly from authenticated session
    const loggedUser = tursoGetCurrentUser();
    if (!loggedUser) {
      setIsAuthenticated(false);
      return;
    }

    if (isTursoConfigured) {
      try {
        await initTursoTables();
        const [tMembers, tExpenses, tSettlements, tGroups, tPersonal] = await Promise.all([
          tursoGetMembers(),
          tursoGetExpenses(),
          tursoGetSettlements(),
          tursoGetGroups(loggedUser),
          tursoGetPersonalExpenses(loggedUser.id)
        ]);

        members = tMembers || [];
        expenses = tExpenses || [];
        settlements = tSettlements || [];
        personalExpenses = tPersonal || [];
        mockGroups = (tGroups || []).map(g => ({
          id: g.id,
          name: g.name,
          joinCode: g.joinCode,
          memberCount: members.filter(m => String(m.groupId) === String(g.id)).length,
          expenseCount: expenses.filter(e => String(e.groupId) === String(g.id)).length,
          totalExpense: expenses.filter(e => String(e.groupId) === String(g.id)).reduce((s, e) => s + e.amount, 0),
          lastExpenseDate: expenses.filter(e => String(e.groupId) === String(g.id)).map(e => e.date).sort((a,b)=>b-a)[0] || g.createdAt
        }));
      } catch (error) {
        console.warn("Turso query failed, falling back to local database. Reason:", error.message);
      }
    }

    // Link logged-in user to members
    let memberMatch = members.find(m => String(m.id) === String(loggedUser.id) || m.email === loggedUser.email || String(m.userId) === String(loggedUser.id));
    if (!memberMatch) {
      memberMatch = {
        id: loggedUser.id,
        name: loggedUser.name,
        email: loggedUser.email,
        groupId: mockGroups.length > 0 ? mockGroups[0].id : '1',
        userId: loggedUser.id
      };
      members = [memberMatch, ...members];
    }

    const currentUser = {
      ...loggedUser,
      id: memberMatch.id,
      name: loggedUser.name || memberMatch.name,
      email: loggedUser.email || memberMatch.email,
      avatar: loggedUser.avatar || null
    };

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
      settlements,
      activities,
      myBalance,
      totalOwed,
      totalToReceive,
      myDebts,
      groups: mockGroups
    })
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
              navigate('/dashboard');
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

  const { currentUser, myBalance, expenses, personalExpenses, myDebts, activities, groups } = data;
  const currentActiveGroupId = groups.length > 0 ? groups[0].id : '1';

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand animate-fade-in">
          <div className="brand-icon">
            <i className="ph ph-intersect"></i>
          </div>
          <div>
            <h1>SplitUP</h1>
            <span style={{ 
              fontSize: '0.68rem', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '4px',
              color: isTursoConfigured ? 'var(--success)' : 'var(--text-muted)',
              fontWeight: 600,
              letterSpacing: '0.5px'
            }}>
              <span style={{ 
                width: '6px', 
                height: '6px', 
                borderRadius: '50%', 
                backgroundColor: isTursoConfigured ? 'var(--success)' : '#e17055' 
              }}></span>
              {isTursoConfigured ? 'Turso Cloud' : 'Turso Setup'}
            </span>
          </div>
        </div>

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
          <div className="avatar">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt={currentUser.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              currentUser.name?.substring(0, 2).toUpperCase()
            )}
          </div>
          <div className="user-info">
            <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600 }}>{currentUser.name}</h4>
            <p style={{ marginTop: '2px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentUser.email}</p>
          </div>
        </NavLink>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {!isSettingsPage && (
          <header className="header animate-fade-in">
            <div className="header-title">
              <h2>Welcome back, {currentUser.name?.split(' ')[0]} 👋</h2>
              <p>Track your shared expenses & personal wallet.</p>
            </div>
            <div className="header-actions">
              <NavLink to="/settings" className="header-user-btn" title="View Profile & Settings">
                <div className="header-avatar-circle">
                  {currentUser.avatar ? (
                    <img src={currentUser.avatar} alt={currentUser.name} />
                  ) : (
                    <span>{currentUser.name?.substring(0, 2).toUpperCase() || 'US'}</span>
                  )}
                  <span className="header-online-status"></span>
                </div>
                <span className="header-username">{currentUser.name?.split(' ')[0]}</span>
              </NavLink>
              <button className="btn-icon" onClick={toggleTheme} title="Toggle Theme">
                {theme === 'dark' ? <i className="ph ph-sun"></i> : <i className="ph ph-moon"></i>}
              </button>
              <button className="btn-icon" onClick={() => alert("No new notifications at this moment!")} title="Notifications">
                <i className="ph ph-bell"></i>
              </button>
              <button className="btn-primary" onClick={() => openExpenseModal('PERSONAL')}>
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
              onSettleUpClick={() => setIsSettleModalOpen(true)}
            />
          } />
          <Route path="/groups" element={
            <GroupsView 
              groups={groups} 
              onNewGroupClick={() => setIsNewGroupModalOpen(true)} 
              currentUser={currentUser}
              onRefreshData={loadData}
            />
          } />
          <Route path="/expenses" element={
            <ExpensesView 
              activities={activities} 
              personalExpenses={personalExpenses}
              onNewExpenseClick={openExpenseModal}
              onDeleteExpense={async (expenseId) => {
                await tursoDeleteExpense(expenseId);
                loadData();
              }}
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
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>

      <NewExpenseModal 
        isOpen={isExpenseModalOpen}
        initialMode={expenseModalMode}
        onClose={() => setIsExpenseModalOpen(false)}
        onSuccess={loadData}
        currentGroupId={currentActiveGroupId}
        currentUser={currentUser}
        groups={groups}
        members={data.members}
      />

      <SettleUpModal 
        isOpen={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
        onSuccess={loadData}
        currentGroupId={currentActiveGroupId}
        currentUser={currentUser}
        suggestedDebts={myDebts}
      />

      <NewGroupModal
        isOpen={isNewGroupModalOpen}
        onClose={() => setIsNewGroupModalOpen(false)}
        onSuccess={loadData}
        currentUser={currentUser}
      />
    </div>
  )
}

export default App
