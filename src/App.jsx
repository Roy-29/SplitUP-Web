import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'
import { LocalDatabase } from './store/db'
import { calculateBalances, simplifyDebts, getTotalGroupBalance, getUserBalance, isUserInvolved, matchesMember } from './lib/BalanceCalculator'
import DashboardView from './components/DashboardView'
import UserAvatar from './components/UserAvatar'

// Lazy loaded views for optimal bundle splitting and fast initial paint
const GroupsView = lazy(() => import('./components/GroupsView'))
const ExpensesView = lazy(() => import('./components/ExpensesView'))
const AnalyticsView = lazy(() => import('./components/AnalyticsView'))
const SettingsView = lazy(() => import('./components/SettingsView'))
const AuthScreen = lazy(() => import('./components/AuthScreen'))

// Lazy loaded modals to keep initial bundle tiny and memory light
const NewExpenseModal = lazy(() => import('./components/NewExpenseModal'))
const SettleUpModal = lazy(() => import('./components/SettleUpModal'))
const NewGroupModal = lazy(() => import('./components/NewGroupModal'))
const JoinGroupModal = lazy(() => import('./components/JoinGroupModal'))
const GroupDetailsModal = lazy(() => import('./components/GroupDetailsModal'))
const ExpenseDetailsModal = lazy(() => import('./components/ExpenseDetailsModal'))
const NewTopicModal = lazy(() => import('./components/NewTopicModal'))
const TopicDetailsModal = lazy(() => import('./components/TopicDetailsModal'))
const NotificationsModal = lazy(() => import('./components/NotificationsModal'))
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
  tursoUpdatePersonalTopic,
  tursoDeleteExpense,
  tursoUpdateExpense,
  tursoDeleteSettlement,
  tursoUpdateSettlement,
  tursoDeleteGroup,
  tursoAddMember,
  tursoUpdateMember,
  tursoDeleteMember,
  tursoUpdateGroup,
  tursoGetNotifications,
  tursoMarkNotificationAsRead,
  tursoMarkAllNotificationsAsRead,
  tursoApproveJoinRequest,
  tursoDeclineJoinRequest,
  tursoInviteUserToGroup,
  tursoAcceptGroupInvitation,
  tursoDeclineGroupInvitation,
  initTursoTables, 
  tursoSignOut,
  tursoSyncCurrentUser 
} from './lib/turso';
import './components/Modal.css'
import './App.css'

import { formatSimple, formatCompact } from './lib/CurrencyManager'
import { useConfirm } from './components/ConfirmModal'

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

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Just now';
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { confirm } = useConfirm();
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
  const [settleModalTarget, setSettleModalTarget] = useState(null);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [isNewTopicModalOpen, setIsNewTopicModalOpen] = useState(false);
  const [selectedGroupForDetails, setSelectedGroupForDetails] = useState(null);
  const [selectedExpenseForDetails, setSelectedExpenseForDetails] = useState(null);
  const [selectedTopicForDetails, setSelectedTopicForDetails] = useState(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [isActingOnNotif, setIsActingOnNotif] = useState(false);
  const [copiedUsername, setCopiedUsername] = useState(false);
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

  const openSettleModal = (groupId = null, targetDebtOrMember = null) => {
    setSettleModalGroupId(groupId);
    setSettleModalTarget(targetDebtOrMember ? { groupId, debt: targetDebtOrMember } : null);
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

        // Fetch groups, personal expenses and topics in parallel
        const [tGroups, tPersonal, tTopics] = await Promise.all([
          tursoGetGroups(loggedUser),
          tursoGetPersonalExpenses(loggedUser),
          tursoGetPersonalTopics(loggedUser)
        ]);

        const userGroupIds = (tGroups || []).map(g => String(g.id));

        // Strictly fetch members, expenses, settlements ONLY for user's groups
        let tMembers = [];
        let tExpenses = [];
        let tSettlements = [];

        if (userGroupIds.length > 0) {
          [tMembers, tExpenses, tSettlements] = await Promise.all([
            tursoGetMembers(userGroupIds),
            tursoGetExpenses(userGroupIds),
            tursoGetSettlements(userGroupIds)
          ]);
        }

        mockGroups = (tGroups || []).map(g => ({
          id: g.id,
          name: g.name,
          createdBy: g.createdBy,
          joinCode: g.joinCode,
          memberCount: (tMembers || []).filter(m => String(m.groupId) === String(g.id)).length,
          expenseCount: (tExpenses || []).filter(e => String(e.groupId) === String(g.id)).length,
          totalExpense: (tExpenses || []).filter(e => String(e.groupId) === String(g.id)).reduce((s, e) => s + e.amount, 0),
          lastExpenseDate: (tExpenses || []).filter(e => String(e.groupId) === String(g.id)).map(e => e.date).sort((a,b)=>b-a)[0] || g.createdAt
        }));

        members = tMembers || [];
        expenses = tExpenses || [];
        settlements = tSettlements || [];
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

    // Run the domain logic per group to ensure strict group isolation
    const allGroupBalances = [];
    const allSimplifiedDebts = [];

    mockGroups.forEach(g => {
      const gMembers = members.filter(m => String(m.groupId) === String(g.id));
      const gExpenses = expenses.filter(e => String(e.groupId) === String(g.id));
      const gSettlements = settlements.filter(s => String(s.groupId) === String(g.id));

      const gBalances = calculateBalances(gMembers, gExpenses, gSettlements, members);
      const gDebts = simplifyDebts(gBalances, gMembers, g.id, g.name);

      allGroupBalances.push(...gBalances);
      allSimplifiedDebts.push(...gDebts);
    });

    const { totalOwed, totalToReceive } = getTotalGroupBalance(allGroupBalances);
    const myBalance = getUserBalance(allGroupBalances, currentUser, members);

    // Filter debts involving the current user
    const myDebts = allSimplifiedDebts.filter(d => isUserInvolved(d, currentUser, members));

    // Unified Activity Feed with verified payer/payee names
    const activities = [
      ...expenses.map(e => ({ type: 'EXPENSE', date: e.date, data: e })),
      ...settlements.map(s => {
        const payerName = s.payerName || members.find(m => matchesMember(m, s.paidBy))?.name || 'Someone';
        const payeeName = s.payeeName || members.find(m => matchesMember(m, s.paidTo))?.name || 'Someone';
        return {
          type: 'SETTLEMENT',
          date: s.date,
          data: {
            ...s,
            payerName,
            payeeName
          }
        };
      })
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

    // Fetch user notifications
    try {
      let userNotifs = [];
      if (isTursoConfigured) {
        userNotifs = await tursoGetNotifications(currentUser.id);
      } else {
        userNotifs = LocalDatabase.getNotifications(currentUser.id);
      }
      setNotifications(userNotifs);
      setUnreadNotifCount((userNotifs || []).filter(n => n.status === 'UNREAD').length);
    } catch (notifErr) {
      console.warn("Could not load notifications:", notifErr);
    }

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

  // Polling for real-time notifications every 15 seconds
  useEffect(() => {
    if (!isAuthenticated || !data.currentUser?.id) return;
    const fetchNotifs = async () => {
      try {
        let notifs = [];
        if (isTursoConfigured) {
          notifs = await tursoGetNotifications(data.currentUser.id);
        } else {
          notifs = LocalDatabase.getNotifications(data.currentUser.id);
        }
        setNotifications(notifs);
        setUnreadNotifCount((notifs || []).filter(n => n.status === 'UNREAD').length);
      } catch (_) {}
    };
    const interval = setInterval(fetchNotifs, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated, data.currentUser?.id]);

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
      <Suspense fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
          <div style={{ color: 'var(--accent-primary)', fontSize: '2rem' }}>
            <i className="ph ph-spinner ph-spin"></i>
          </div>
        </div>
      }>
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
      </Suspense>
    );
  }

  if (!data.currentUser) return null; // loading

  const formatCurrency = (amount) => {
    return formatSimple(amount, currencyCode);
  }

  const formatCurrencyCompact = (amount) => {
    return formatCompact(amount, currencyCode);
  }

  const { currentUser, myBalance, expenses, personalExpenses, personalTopics, members, settlements, myDebts, activities, groups, totalOwed, totalToReceive } = data;
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

  const handleAddMember = async (groupId, { name, email, phone, userId }) => {
    try {
      let newMem = null;
      if (isTursoConfigured) {
        newMem = await tursoAddMember(groupId, name, email, userId || null, phone);
      } else {
        newMem = LocalDatabase.addMember({ groupId, name, email, phone, userId });
      }
      await loadData();
      return newMem;
    } catch (err) {
      console.error("Failed to add member:", err);
      throw err;
    }
  };

  const handleUpdateMember = async (memberId, updatedFields) => {
    setData(prev => ({
      ...prev,
      members: (prev.members || []).map(m =>
        String(m.id) === String(memberId) ? { ...m, ...updatedFields } : m
      )
    }));
    try {
      if (isTursoConfigured) {
        await tursoUpdateMember(memberId, updatedFields);
      }
      LocalDatabase.updateMember(memberId, updatedFields);
    } catch (err) {
      console.error("Failed to update member:", err);
    }
    loadData();
  };

  const handleDeleteMember = async (memberId, groupId = null) => {
    try {
      if (isTursoConfigured) {
        await tursoDeleteMember(memberId, groupId, currentUser?.id);
      } else {
        LocalDatabase.deleteMember(memberId);
      }
      setData(prev => ({
        ...prev,
        members: (prev.members || []).filter(m => String(m.id) !== String(memberId))
      }));
    } catch (err) {
      console.error("Failed to delete member:", err);
      throw err;
    }
    loadData();
  };

  const handleApproveJoinRequest = async (e, notif) => {
    e?.stopPropagation?.();
    const reqId = notif.data?.requestId;
    if (!reqId) return;
    setIsActingOnNotif(true);
    try {
      if (isTursoConfigured) {
        await tursoApproveJoinRequest(reqId, currentUser);
      }
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, status: 'RESOLVED' } : n));
      setUnreadNotifCount(prev => Math.max(0, prev - 1));
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to approve join request');
    } finally {
      setIsActingOnNotif(false);
    }
  };

  const handleDeclineJoinRequest = async (e, notif) => {
    e?.stopPropagation?.();
    const reqId = notif.data?.requestId;
    if (!reqId) return;
    setIsActingOnNotif(true);
    try {
      if (isTursoConfigured) {
        await tursoDeclineJoinRequest(reqId, currentUser);
      }
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, status: 'DECLINED' } : n));
      setUnreadNotifCount(prev => Math.max(0, prev - 1));
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to decline join request');
    } finally {
      setIsActingOnNotif(false);
    }
  };

  const handleAcceptInvitation = async (e, notif) => {
    e?.stopPropagation?.();
    const reqId = notif.data?.requestId;
    if (!reqId) return;
    setIsActingOnNotif(true);
    try {
      if (isTursoConfigured) {
        await tursoAcceptGroupInvitation(reqId, currentUser);
      }
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, status: 'RESOLVED' } : n));
      setUnreadNotifCount(prev => Math.max(0, prev - 1));
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to accept invitation');
    } finally {
      setIsActingOnNotif(false);
    }
  };

  const handleDeclineInvitation = async (e, notif) => {
    e?.stopPropagation?.();
    const reqId = notif.data?.requestId;
    if (!reqId) return;
    setIsActingOnNotif(true);
    try {
      if (isTursoConfigured) {
        await tursoDeclineGroupInvitation(reqId, currentUser);
      }
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, status: 'DECLINED' } : n));
      setUnreadNotifCount(prev => Math.max(0, prev - 1));
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to decline invitation');
    } finally {
      setIsActingOnNotif(false);
    }
  };

  const handleMarkAllRead = async (e) => {
    e?.stopPropagation?.();
    if (!currentUser?.id) return;
    try {
      if (isTursoConfigured) {
        await tursoMarkAllNotificationsAsRead(currentUser.id);
      } else {
        LocalDatabase.markAllNotificationsAsRead(currentUser.id);
      }
      setNotifications(prev => prev.map(n => ({ ...n, status: 'READ' })));
      setUnreadNotifCount(0);
    } catch (err) {
      console.warn("Could not mark all notifications read:", err);
    }
  };

  const handleNotificationItemClick = (notif) => {
    if (notif.status === 'UNREAD') {
      if (isTursoConfigured) {
        tursoMarkNotificationAsRead(notif.id);
      } else {
        LocalDatabase.markNotificationAsRead(notif.id);
      }
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, status: 'READ' } : n));
      setUnreadNotifCount(prev => Math.max(0, prev - 1));
    }
    if (notif.data?.groupId) {
      const foundGroup = data.groups.find(g => String(g.id) === String(notif.data.groupId));
      if (foundGroup) {
        setSelectedGroupForDetails(foundGroup);
        setIsNotificationsOpen(false);
        navigate('/groups');
        return;
      }
    }
    if (notif.type === 'EXPENSE_ADDED' || notif.type === 'EXPENSE_UPDATED' || notif.type === 'SETTLEMENT_RECORDED') {
      setIsNotificationsOpen(false);
      navigate('/expenses');
    }
  };

  const handleUpdateGroup = async (groupId, updatedFields) => {
    setData(prev => ({
      ...prev,
      groups: (prev.groups || []).map(g =>
        String(g.id) === String(groupId) ? { ...g, ...updatedFields } : g
      )
    }));
    setSelectedGroupForDetails(prev =>
      prev && String(prev.id) === String(groupId) ? { ...prev, ...updatedFields } : prev
    );
    try {
      if (isTursoConfigured) {
        await tursoUpdateGroup(groupId, updatedFields);
      }
      LocalDatabase.updateGroup(groupId, updatedFields);
    } catch (err) {
      console.error("Failed to update group:", err);
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

  const handleUpdateExpense = async (expenseId, updatedFields) => {
    setData(prev => {
      const updateList = (list) => (list || []).map(item => 
        String(item.id) === String(expenseId) ? { ...item, ...updatedFields } : item
      );
      return {
        ...prev,
        expenses: updateList(prev.expenses),
        personalExpenses: updateList(prev.personalExpenses),
        activities: (prev.activities || []).map(a => 
          String(a.data?.id) === String(expenseId)
            ? { ...a, date: updatedFields.date !== undefined ? updatedFields.date : a.date, data: { ...a.data, ...updatedFields } }
            : a
        )
      };
    });

    setSelectedExpenseForDetails(prev => 
      prev && String(prev.id) === String(expenseId) ? { ...prev, ...updatedFields } : prev
    );

    try {
      if (isTursoConfigured) {
        await tursoUpdateExpense(expenseId, updatedFields);
      }
      LocalDatabase.updateExpense(expenseId, updatedFields);
    } catch (err) {
      console.error("Failed to update expense:", err);
    }
    loadData();
  };

  const handleUpdateSettlement = async (settlementId, updatedFields) => {
    setData(prev => ({
      ...prev,
      settlements: (prev.settlements || []).map(s => 
        String(s.id) === String(settlementId) ? { ...s, ...updatedFields } : s
      ),
      activities: (prev.activities || []).map(a => 
        String(a.data?.id) === String(settlementId)
          ? { ...a, date: updatedFields.date !== undefined ? updatedFields.date : a.date, data: { ...a.data, ...updatedFields } }
          : a
      )
    }));

    setSelectedExpenseForDetails(prev => 
      prev && String(prev.id) === String(settlementId) ? { ...prev, ...updatedFields } : prev
    );

    try {
      if (isTursoConfigured) {
        await tursoUpdateSettlement(settlementId, updatedFields);
      }
      LocalDatabase.updateSettlement(settlementId, updatedFields);
    } catch (err) {
      console.error("Failed to update settlement:", err);
    }
    loadData();
  };

  const handleUpdateTopic = async (topicId, updatedFields) => {
    setData(prev => ({
      ...prev,
      personalTopics: (prev.personalTopics || []).map(t => 
        String(t.id) === String(topicId) ? { ...t, ...updatedFields } : t
      )
    }));

    setSelectedTopicForDetails(prev => 
      prev && String(prev.id) === String(topicId) ? { ...prev, ...updatedFields } : prev
    );

    try {
      if (isTursoConfigured) {
        await tursoUpdatePersonalTopic(topicId, updatedFields);
      }
      LocalDatabase.updatePersonalTopic(topicId, updatedFields);
    } catch (err) {
      console.error("Failed to update topic:", err);
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
          title="SplitUP Dashboard"
        >
          <div className="brand-icon">
            <i className="ph ph-intersect"></i>
          </div>
          <div className="brand-text-wrapper">
            <h1>SplitUP</h1>
            <span className="brand-badge">Expense Engine</span>
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
            {data.groups?.length > 0 && (
              <span className="nav-item-badge">{data.groups.length}</span>
            )}
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

        <div className="sidebar-user-box-container animate-fade-in delay-5">
          <NavLink 
            to="/settings"
            className={({ isActive }) => `user-profile ${isActive ? 'active' : ''}`}
            title="Account & Settings (Click to manage)"
          >
            <div className="user-profile-avatar-wrapper">
              <div className="user-avatar-glow" />
              <UserAvatar user={currentUser} size={42} showOnline={true} className="avatar" />
            </div>

            <div className="user-info">
              <div className="user-info-header">
                <h4 className="user-name" title={currentUser.name}>{currentUser.name}</h4>
                <span className="user-status-pill">Active</span>
              </div>
              <div className="user-handle-row">
                <button
                  type="button"
                  className={`user-handle-badge ${copiedUsername ? 'copied' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const cleanHandle = (currentUser.username || currentUser.email?.split('@')[0] || 'user').replace(/^@/, '');
                    navigator.clipboard.writeText(`@${cleanHandle}`);
                    setCopiedUsername(true);
                    setTimeout(() => setCopiedUsername(false), 2000);
                  }}
                  title={copiedUsername ? "Copied to clipboard!" : "Click to copy username"}
                >
                  <i className={`ph ${copiedUsername ? 'ph-check' : 'ph-copy'} copy-icon-hint`}></i>
                  <span>{copiedUsername ? 'Copied!' : `@${(currentUser.username || currentUser.email?.split('@')[0] || 'user').replace(/^@/, '')}`}</span>
                </button>
              </div>
            </div>

            <div className="user-profile-action" title="Settings">
              <i className="ph ph-gear-six"></i>
            </div>
          </NavLink>
        </div>
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
                  {unreadNotifCount > 0 && (
                    <span 
                      className="notification-dot" 
                      title={`${unreadNotifCount} unread notification${unreadNotifCount > 1 ? 's' : ''}`}
                    ></span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div 
                    className="notification-dropdown"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="notification-dropdown-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>Notifications</h4>
                        {unreadNotifCount > 0 ? (
                          <span className="notification-count-tag">{unreadNotifCount} New</span>
                        ) : (
                          <span className="notification-count-tag" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>All read</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {unreadNotifCount > 0 && (
                          <button 
                            type="button" 
                            className="notif-mark-all-btn"
                            onClick={handleMarkAllRead}
                            title="Mark all as read"
                          >
                            Mark all read
                          </button>
                        )}
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
                    </div>

                    <div className="notification-list">
                      {notifications.length === 0 ? (
                        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <i className="ph ph-bell-simple" style={{ fontSize: '2rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'inline-block' }}></i>
                          <p style={{ margin: 0, fontSize: '0.85rem' }}>No notifications yet.</p>
                          <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>You'll get notifications for join requests, invites, and group bills here!</span>
                        </div>
                      ) : (
                        notifications.map(notif => {
                          const isUnread = notif.status === 'UNREAD';
                          const isJoinRequest = notif.type === 'JOIN_REQUEST';
                          const isInvitation = notif.type === 'GROUP_INVITATION';
                          const isPending = notif.status === 'UNREAD' || notif.status === 'PENDING';

                          let iconClass = 'ph-bell';
                          let iconBoxType = 'info';

                          if (isJoinRequest) {
                            iconClass = 'ph-user-plus';
                            iconBoxType = 'warning';
                          } else if (isInvitation) {
                            iconClass = 'ph-envelope-simple';
                            iconBoxType = 'accent';
                          } else if (notif.type === 'JOIN_APPROVED' || notif.type === 'INVITATION_ACCEPTED') {
                            iconClass = 'ph-check-circle';
                            iconBoxType = 'success';
                          } else if (notif.type === 'JOIN_DECLINED' || notif.type === 'INVITATION_DECLINED') {
                            iconClass = 'ph-x-circle';
                            iconBoxType = 'warning';
                          } else if (notif.type === 'EXPENSE_ADDED' || notif.type === 'EXPENSE_UPDATED') {
                            iconClass = 'ph-receipt';
                            iconBoxType = 'accent';
                          } else if (notif.type === 'SETTLEMENT_RECORDED') {
                            iconClass = 'ph-handshake';
                            iconBoxType = 'success';
                          }

                          return (
                            <div 
                              key={notif.id}
                              className={`notification-item ${isUnread ? 'unread' : ''}`}
                              onClick={() => handleNotificationItemClick(notif)}
                            >
                              <div className={`notification-icon-box ${iconBoxType}`}>
                                <i className={`ph ${iconClass}`}></i>
                              </div>
                              <div className="notification-body">
                                <div className="notification-body-header">
                                  <span className="notification-item-title" title={notif.title}>
                                    {notif.title}
                                  </span>
                                  <span className="notification-time">{formatTimeAgo(notif.createdAt)}</span>
                                </div>
                                <p className="notification-item-desc">{notif.message}</p>

                                {/* Admin Join Request Actions */}
                                {isJoinRequest && (
                                  <div className="notif-actions" onClick={(e) => e.stopPropagation()}>
                                    {isPending ? (
                                      <>
                                        <button 
                                          type="button" 
                                          className="notif-btn notif-btn-approve"
                                          disabled={isActingOnNotif}
                                          onClick={(e) => handleApproveJoinRequest(e, notif)}
                                          title="Approve join request"
                                        >
                                          <i className="ph ph-check"></i>
                                          <span>Approve</span>
                                        </button>
                                        <button 
                                          type="button" 
                                          className="notif-btn notif-btn-decline"
                                          disabled={isActingOnNotif}
                                          onClick={(e) => handleDeclineJoinRequest(e, notif)}
                                          title="Decline join request"
                                        >
                                          <i className="ph ph-x"></i>
                                          <span>Decline</span>
                                        </button>
                                      </>
                                    ) : notif.status === 'RESOLVED' || notif.status === 'APPROVED' ? (
                                      <span className="notif-status-badge approved">Approved ✓</span>
                                    ) : (
                                      <span className="notif-status-badge declined">Declined ✕</span>
                                    )}
                                  </div>
                                )}

                                {/* User Group Invitation Actions */}
                                {isInvitation && (
                                  <div className="notif-actions" onClick={(e) => e.stopPropagation()}>
                                    {isPending ? (
                                      <>
                                        <button 
                                          type="button" 
                                          className="notif-btn notif-btn-approve"
                                          disabled={isActingOnNotif}
                                          onClick={(e) => handleAcceptInvitation(e, notif)}
                                          title="Accept invitation"
                                        >
                                          <i className="ph ph-check"></i>
                                          <span>Accept</span>
                                        </button>
                                        <button 
                                          type="button" 
                                          className="notif-btn notif-btn-decline"
                                          disabled={isActingOnNotif}
                                          onClick={(e) => handleDeclineInvitation(e, notif)}
                                          title="Decline invitation"
                                        >
                                          <i className="ph ph-x"></i>
                                          <span>Decline</span>
                                        </button>
                                      </>
                                    ) : notif.status === 'RESOLVED' || notif.status === 'ACCEPTED' ? (
                                      <span className="notif-status-badge approved">Accepted ✓</span>
                                    ) : (
                                      <span className="notif-status-badge declined">Declined ✕</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="notification-dropdown-footer">
                      <button 
                        type="button" 
                        className="notification-view-all"
                        onClick={() => {
                          setIsNotificationsOpen(false);
                          setIsNotificationsModalOpen(true);
                        }}
                        title="View all notifications in full modal"
                      >
                        <i className="ph ph-arrows-out-simple"></i>
                        <span>View All Notifications</span>
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
              members={data.members}
              formatCurrency={formatCurrency}
              formatCurrencyCompact={formatCurrencyCompact}
              onNewExpenseClick={() => openExpenseModal('PERSONAL')}
              onNewGroupClick={() => setIsNewGroupModalOpen(true)}
              onSettleUpClick={(gid, debt) => openSettleModal(gid, debt)}
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
              onUpdateGroup={handleUpdateGroup}
              onAddMember={handleAddMember}
              onUpdateMember={handleUpdateMember}
              onDeleteMember={handleDeleteMember}
              onRefreshData={loadData}
              onAddExpense={(mode, grpId) => openExpenseModal(mode, grpId)}
              onSettleUp={(grpId, debt) => openSettleModal(grpId, debt)}
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
              personalExpenses={personalExpenses}
              personalTopics={personalTopics}
              groups={data.groups || []}
              members={data.members || []}
              settlements={data.settlements || []}
              currentUser={currentUser}
              currencyCode={currencyCode}
              formatCurrency={formatCurrency}
              onNewExpenseClick={() => openExpenseModal('PERSONAL')}
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
              onResetData={async () => {
                const ok = await confirm({
                  title: 'Reset All Test Data?',
                  message: 'Are you sure you want to reset all test data? All local records will be deleted. This cannot be undone.',
                  confirmText: 'Reset Data',
                  type: 'danger'
                });
                if (ok) {
                  LocalDatabase.clearData();
                  loadData();
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

      {/* Conditionally rendered modals for zero DOM bloat */}
      <Suspense fallback={null}>
        {/* New Expense Modal */}
        {isExpenseModalOpen && (
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
        )}

        {/* Settle Up Modal */}
        {isSettleModalOpen && (
          <SettleUpModal 
            isOpen={isSettleModalOpen}
            onClose={() => {
              setIsSettleModalOpen(false);
              setSettleModalGroupId(null);
              setSettleModalTarget(null);
            }}
            onSuccess={loadData}
            currentGroupId={settleModalGroupId || currentActiveGroupId}
            currentUser={currentUser}
            suggestedDebts={myDebts}
            groups={groups}
            currencyCode={currencyCode}
            members={data.members}
            initialTarget={settleModalTarget}
          />
        )}

        {/* New Group Modal */}
        {isNewGroupModalOpen && (
          <NewGroupModal
            isOpen={isNewGroupModalOpen}
            onClose={() => setIsNewGroupModalOpen(false)}
            onSuccess={loadData}
            currentUser={currentUser}
          />
        )}

        {/* Expense / Settlement Details Modal */}
        {selectedExpenseForDetails && (
          <ExpenseDetailsModal
            isOpen={!!selectedExpenseForDetails}
            onClose={() => setSelectedExpenseForDetails(null)}
            expense={selectedExpenseForDetails}
            currentUser={currentUser}
            currencyCode={currencyCode}
            personalTopics={data.personalTopics}
            members={data.members}
            onDeleteExpense={handleDeleteExpense}
            onDeleteSettlement={handleDeleteSettlement}
            onUpdateExpense={handleUpdateExpense}
            onUpdateSettlement={handleUpdateSettlement}
            onFilterTopic={(topicName) => {
              setSelectedExpenseForDetails(null);
              const found = (data.personalTopics || []).find(t => t.name.toLowerCase() === topicName.toLowerCase());
              if (found) {
                setSelectedTopicForDetails(found);
              }
            }}
          />
        )}

        {/* New Subject / Topic Modal */}
        {isNewTopicModalOpen && (
          <NewTopicModal
            isOpen={isNewTopicModalOpen}
            onClose={() => setIsNewTopicModalOpen(false)}
            onSuccess={loadData}
            currentUser={currentUser}
            currencyCode={currencyCode}
          />
        )}

        {/* Topic / Subject Details Modal */}
        {selectedTopicForDetails && (
          <TopicDetailsModal
            isOpen={!!selectedTopicForDetails}
            onClose={() => setSelectedTopicForDetails(null)}
            topic={selectedTopicForDetails}
            expenses={data.personalExpenses}
            currencyCode={currencyCode}
            onAddExpense={(topicName) => openExpenseModal('PERSONAL', null, topicName)}
            onDeleteTopic={handleDeleteTopic}
            onDeleteExpense={handleDeleteExpense}
            onUpdateTopic={handleUpdateTopic}
            onSelectExpense={(item) => setSelectedExpenseForDetails(item)}
          />
        )}

        {/* Group Details Modal */}
        {selectedGroupForDetails && (
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
            onUpdateGroup={handleUpdateGroup}
            onAddMember={handleAddMember}
            onUpdateMember={handleUpdateMember}
            onDeleteMember={handleDeleteMember}
            onDeleteExpense={handleDeleteExpense}
            onDeleteSettlement={handleDeleteSettlement}
            onSelectExpense={(item) => setSelectedExpenseForDetails(item)}
            onRefreshData={loadData}
          />
        )}

        {/* Full View Notifications Modal */}
        {isNotificationsModalOpen && (
          <NotificationsModal
            isOpen={isNotificationsModalOpen}
            onClose={() => setIsNotificationsModalOpen(false)}
            notifications={notifications}
            unreadCount={unreadNotifCount}
            currentUser={currentUser}
            onMarkAllRead={handleMarkAllRead}
            onNotificationClick={(notif) => {
              handleNotificationItemClick(notif);
              setIsNotificationsModalOpen(false);
            }}
            onApproveJoinRequest={handleApproveJoinRequest}
            onDeclineJoinRequest={handleDeclineJoinRequest}
            onAcceptInvitation={handleAcceptInvitation}
            onDeclineInvitation={handleDeclineInvitation}
            isActingOnNotif={isActingOnNotif}
          />
        )}
      </Suspense>
    </div>
  )
}

export default App

