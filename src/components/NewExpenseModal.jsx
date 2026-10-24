import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LocalDatabase } from '../store/db';
import { isTursoConfigured, tursoAddExpense, tursoAddPersonalExpense, tursoAddPersonalTopic } from '../lib/turso';
import { formatSimple, getSymbol } from '../lib/CurrencyManager';
import CustomSelect from './CustomSelect';
import UserAvatar from './UserAvatar';
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

// Helper: Compute distribution for EXACT amounts with smart auto-balance
function computeExactAmounts(totalAmount, selectedMemberIds, lockedExactSet, customAmountsMap) {
  const total = Math.max(0, parseFloat(totalAmount) || 0);
  const selected = Array.from(selectedMemberIds);
  if (selected.length === 0) {
    return { amounts: {}, allocated: 0, remaining: total, isBalanced: true };
  }

  const locked = selected.filter(id => lockedExactSet.has(id));
  const unlocked = selected.filter(id => !lockedExactSet.has(id));

  let lockedSum = 0;
  const resultAmounts = {};

  for (const id of locked) {
    const raw = customAmountsMap[id];
    const val = Math.max(0, parseFloat(raw) || 0);
    resultAmounts[id] = val;
    lockedSum += val;
  }

  const remaining = Math.max(0, Number((total - lockedSum).toFixed(2)));

  if (unlocked.length > 0) {
    const rawPerUnlocked = remaining / unlocked.length;
    const rounded = Math.floor(rawPerUnlocked * 100) / 100;
    let distributed = 0;

    unlocked.forEach((id, idx) => {
      if (idx === unlocked.length - 1) {
        resultAmounts[id] = Math.max(0, Number((remaining - distributed).toFixed(2)));
      } else {
        resultAmounts[id] = rounded;
        distributed += rounded;
      }
    });
  }

  let allocated = 0;
  for (const id of selected) {
    allocated += (resultAmounts[id] || 0);
  }
  allocated = Number(allocated.toFixed(2));
  const rem = Number((total - allocated).toFixed(2));

  return {
    amounts: resultAmounts,
    allocated,
    remaining: rem,
    isBalanced: Math.abs(rem) < 0.05
  };
}

// Helper: Compute distribution for PERCENTAGES with smart auto-balance
function computePercentAmounts(totalAmount, selectedMemberIds, lockedPercentSet, customPercentagesMap) {
  const total = Math.max(0, parseFloat(totalAmount) || 0);
  const selected = Array.from(selectedMemberIds);
  if (selected.length === 0) {
    return { percentages: {}, amounts: {}, allocatedPercent: 0, remainingPercent: 100, isBalanced: true };
  }

  const locked = selected.filter(id => lockedPercentSet.has(id));
  const unlocked = selected.filter(id => !lockedPercentSet.has(id));

  let lockedPercentSum = 0;
  const resultPercentages = {};

  for (const id of locked) {
    const val = Math.max(0, parseFloat(customPercentagesMap[id]) || 0);
    resultPercentages[id] = val;
    lockedPercentSum += val;
  }

  const remainingPercent = Math.max(0, Number((100 - lockedPercentSum).toFixed(2)));

  if (unlocked.length > 0) {
    const rawPerUnlocked = remainingPercent / unlocked.length;
    const rounded = Math.floor(rawPerUnlocked * 10) / 10;
    let distributed = 0;

    unlocked.forEach((id, idx) => {
      if (idx === unlocked.length - 1) {
        resultPercentages[id] = Math.max(0, Number((remainingPercent - distributed).toFixed(2)));
      } else {
        resultPercentages[id] = rounded;
        distributed += rounded;
      }
    });
  }

  let allocatedPercent = 0;
  const resultAmounts = {};
  let distributedAmount = 0;

  selected.forEach((id, idx) => {
    const pct = resultPercentages[id] || 0;
    allocatedPercent += pct;
    if (idx === selected.length - 1) {
      resultAmounts[id] = Math.max(0, Number((total - distributedAmount).toFixed(2)));
    } else {
      const amt = Number(((pct / 100) * total).toFixed(2));
      resultAmounts[id] = amt;
      distributedAmount += amt;
    }
  });

  allocatedPercent = Number(allocatedPercent.toFixed(2));
  const remainingPercentDiff = Number((100 - allocatedPercent).toFixed(2));

  return {
    percentages: resultPercentages,
    amounts: resultAmounts,
    allocatedPercent,
    remainingPercent: remainingPercentDiff,
    isBalanced: Math.abs(remainingPercentDiff) < 0.2
  };
}

// Helper: Compute distribution for SHARES / RATIO
function computeSharesAmounts(totalAmount, selectedMemberIds, customSharesMap) {
  const total = Math.max(0, parseFloat(totalAmount) || 0);
  const selected = Array.from(selectedMemberIds);
  if (selected.length === 0) {
    return { shares: {}, percentages: {}, amounts: {}, totalShares: 0 };
  }

  let totalShares = 0;
  const resultShares = {};
  for (const id of selected) {
    const s = Math.max(1, parseInt(customSharesMap[id], 10) || 1);
    resultShares[id] = s;
    totalShares += s;
  }

  const resultPercentages = {};
  const resultAmounts = {};
  let distributedAmount = 0;

  selected.forEach((id, idx) => {
    const s = resultShares[id];
    const pct = Number(((s / totalShares) * 100).toFixed(1));
    resultPercentages[id] = pct;

    if (idx === selected.length - 1) {
      resultAmounts[id] = Math.max(0, Number((total - distributedAmount).toFixed(2)));
    } else {
      const amt = Number(((s / totalShares) * total).toFixed(2));
      resultAmounts[id] = amt;
      distributedAmount += amt;
    }
  });

  return {
    shares: resultShares,
    percentages: resultPercentages,
    amounts: resultAmounts,
    totalShares
  };
}

// Helper: Compute EQUAL split
function computeEqualAmounts(totalAmount, selectedMemberIds) {
  const total = Math.max(0, parseFloat(totalAmount) || 0);
  const selected = Array.from(selectedMemberIds);
  if (selected.length === 0) {
    return { perPerson: 0, amounts: {} };
  }

  const rawPerPerson = total / selected.length;
  const rounded = Math.floor(rawPerPerson * 100) / 100;
  let distributed = 0;
  const amounts = {};

  selected.forEach((id, idx) => {
    if (idx === selected.length - 1) {
      amounts[id] = Math.max(0, Number((total - distributed).toFixed(2)));
    } else {
      amounts[id] = rounded;
      distributed += rounded;
    }
  });

  return {
    perPerson: Number(rawPerPerson.toFixed(2)),
    amounts
  };
}

export default function NewExpenseModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  currentGroupId, 
  currentUser, 
  members = [],
  groups = [],
  personalTopics = [],
  initialMode = 'PERSONAL',
  initialTopic = ''
}) {
  const [expenseType, setExpenseType] = useState(initialMode || 'PERSONAL');
  const [selectedGroupId, setSelectedGroupId] = useState(currentGroupId || (groups.length > 0 ? groups[0].id : '1'));
  
  // Find current user's member ID in current group
  const getPayerMemberId = (gid) => {
    const groupMems = members.filter(m => String(m.groupId) === String(gid));
    const myMem = groupMems.find(m => 
      String(m.userId) === String(currentUser?.id) ||
      String(m.id) === String(currentUser?.id) ||
      (m.email && currentUser?.email && m.email.toLowerCase() === currentUser.email.toLowerCase())
    );
    return myMem ? myMem.id : (currentUser?.id || '');
  };

  const initialPayer = getPayerMemberId(selectedGroupId);

  const [form, setForm] = useState({
    title: '',
    amount: '',
    notes: '',
    selectedPayerId: initialPayer,
    selectedCategory: '',
    personalCategory: '',
    customCategoryName: '',
    topic: initialTopic || '',
    isNewTopic: false,
    newTopicName: '',
    splitMode: 'EQUAL', // 'EQUAL' | 'EXACT' | 'PERCENT' | 'SHARES'
    // Default requirement: NO box ticked EXCEPT the user adding the expense
    selectedMembers: new Set(initialPayer ? [initialPayer] : []),
    customAmounts: {},
    customPercentages: {},
    customShares: {}
  });

  const [lockedExact, setLockedExact] = useState(new Set());
  const [lockedPercentages, setLockedPercentages] = useState(new Set());
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeCurrency = localStorage.getItem('splitup_currency') || 'BDT';
  const currencySymbol = getSymbol(activeCurrency);

  const resetForm = () => {
    const payerId = getPayerMemberId(selectedGroupId);
    setForm({
      title: '',
      amount: '',
      notes: '',
      selectedPayerId: payerId,
      selectedCategory: '',
      personalCategory: '',
      customCategoryName: '',
      topic: initialTopic || '',
      isNewTopic: false,
      newTopicName: '',
      splitMode: 'EQUAL',
      // Reset requirement: Only payer is checked by default
      selectedMembers: new Set(payerId ? [payerId] : []),
      customAmounts: {},
      customPercentages: {},
      customShares: {}
    });
    setLockedExact(new Set());
    setLockedPercentages(new Set());
    setError('');
  };

  useEffect(() => {
    if (isOpen) {
      setExpenseType(initialMode || 'PERSONAL');
      const targetGid = currentGroupId || (groups.length > 0 ? groups[0].id : '1');
      setSelectedGroupId(targetGid);
      const payerId = getPayerMemberId(targetGid);
      setForm({
        title: '',
        amount: '',
        notes: '',
        selectedPayerId: payerId,
        selectedCategory: '',
        personalCategory: '',
        customCategoryName: '',
        topic: initialTopic || '',
        isNewTopic: false,
        newTopicName: '',
        splitMode: 'EQUAL',
        selectedMembers: new Set(payerId ? [payerId] : []),
        customAmounts: {},
        customPercentages: {},
        customShares: {}
      });
      setLockedExact(new Set());
      setLockedPercentages(new Set());
      setError('');
    }
  }, [isOpen, initialMode, currentGroupId, initialTopic]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSwitchMode = (newMode) => {
    if (newMode === expenseType) return;
    setExpenseType(newMode);
    // Reset all inputs cleanly so data doesn't bleed between Personal and Group modes
    const payerId = getPayerMemberId(selectedGroupId);
    setForm({
      title: '',
      amount: '',
      notes: '',
      selectedPayerId: payerId,
      selectedCategory: '',
      personalCategory: '',
      customCategoryName: '',
      topic: initialTopic || '',
      isNewTopic: false,
      newTopicName: '',
      splitMode: 'EQUAL',
      selectedMembers: new Set(payerId ? [payerId] : []),
      customAmounts: {},
      customPercentages: {},
      customShares: {}
    });
    setLockedExact(new Set());
    setLockedPercentages(new Set());
    setError('');
  };

  // Real-time split calculations
  const amountNum = Math.max(0, parseFloat(form.amount) || 0);
  const equalData = computeEqualAmounts(amountNum, form.selectedMembers);
  const exactData = computeExactAmounts(amountNum, form.selectedMembers, lockedExact, form.customAmounts);
  const percentData = computePercentAmounts(amountNum, form.selectedMembers, lockedPercentages, form.customPercentages);
  const sharesData = computeSharesAmounts(amountNum, form.selectedMembers, form.customShares);

  // Exact amount change with smart auto-balance and 600 cap protection
  const handleExactChange = (memberId, rawValue) => {
    const total = amountNum;
    
    // If cleared, unlock this member so they auto-split with remaining
    if (rawValue.trim() === '') {
      setLockedExact(prev => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
      setForm(prev => {
        const nextAmounts = { ...prev.customAmounts };
        delete nextAmounts[memberId];
        return { ...prev, customAmounts: nextAmounts };
      });
      return;
    }

    // Sum of other locked members
    let otherLockedSum = 0;
    for (const id of form.selectedMembers) {
      if (id !== memberId && lockedExact.has(id)) {
        otherLockedSum += Math.max(0, parseFloat(form.customAmounts[id]) || 0);
      }
    }

    const maxAllowed = Math.max(0, Number((total - otherLockedSum).toFixed(2)));
    let valNum = parseFloat(rawValue);
    if (isNaN(valNum)) valNum = 0;
    if (valNum < 0) valNum = 0;
    // Cap at maxAllowed so total never crosses the overall amount
    if (valNum > maxAllowed) {
      valNum = maxAllowed;
    }

    const valStr = rawValue.endsWith('.') ? rawValue : String(valNum);

    setLockedExact(prev => new Set(prev).add(memberId));
    setForm(prev => ({
      ...prev,
      customAmounts: {
        ...prev.customAmounts,
        [memberId]: valStr
      }
    }));
  };

  const handleToggleLockExact = (memberId) => {
    if (lockedExact.has(memberId)) {
      setLockedExact(prev => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
      setForm(prev => {
        const nextAmounts = { ...prev.customAmounts };
        delete nextAmounts[memberId];
        return { ...prev, customAmounts: nextAmounts };
      });
    } else {
      const computedVal = exactData.amounts[memberId] || 0;
      setLockedExact(prev => new Set(prev).add(memberId));
      setForm(prev => ({
        ...prev,
        customAmounts: {
          ...prev.customAmounts,
          [memberId]: String(computedVal)
        }
      }));
    }
  };

  const handleResetExactToEqual = () => {
    setLockedExact(new Set());
    setForm(prev => ({ ...prev, customAmounts: {} }));
  };

  // Percentage change with smart auto-balance and 100% cap
  const handlePercentChange = (memberId, rawValue) => {
    if (rawValue.trim() === '') {
      setLockedPercentages(prev => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
      setForm(prev => {
        const nextPct = { ...prev.customPercentages };
        delete nextPct[memberId];
        return { ...prev, customPercentages: nextPct };
      });
      return;
    }

    let otherLockedSum = 0;
    for (const id of form.selectedMembers) {
      if (id !== memberId && lockedPercentages.has(id)) {
        otherLockedSum += Math.max(0, parseFloat(form.customPercentages[id]) || 0);
      }
    }

    const maxAllowed = Math.max(0, Number((100 - otherLockedSum).toFixed(2)));
    let valNum = parseFloat(rawValue);
    if (isNaN(valNum)) valNum = 0;
    if (valNum < 0) valNum = 0;
    if (valNum > maxAllowed) {
      valNum = maxAllowed;
    }

    const valStr = rawValue.endsWith('.') ? rawValue : String(valNum);

    setLockedPercentages(prev => new Set(prev).add(memberId));
    setForm(prev => ({
      ...prev,
      customPercentages: {
        ...prev.customPercentages,
        [memberId]: valStr
      }
    }));
  };

  const handleToggleLockPercent = (memberId) => {
    if (lockedPercentages.has(memberId)) {
      setLockedPercentages(prev => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
      setForm(prev => {
        const nextPct = { ...prev.customPercentages };
        delete nextPct[memberId];
        return { ...prev, customPercentages: nextPct };
      });
    } else {
      const computedPct = percentData.percentages[memberId] || 0;
      setLockedPercentages(prev => new Set(prev).add(memberId));
      setForm(prev => ({
        ...prev,
        customPercentages: {
          ...prev.customPercentages,
          [memberId]: String(computedPct)
        }
      }));
    }
  };

  const handleResetPercentToEqual = () => {
    setLockedPercentages(new Set());
    setForm(prev => ({ ...prev, customPercentages: {} }));
  };

  // Shares change
  const handleShareStep = (memberId, delta) => {
    setForm(prev => {
      const currentShare = Math.max(1, parseInt(prev.customShares[memberId], 10) || 1);
      const nextShare = Math.max(1, Math.min(100, currentShare + delta));
      return {
        ...prev,
        customShares: {
          ...prev.customShares,
          [memberId]: nextShare
        }
      };
    });
  };

  const handleResetSharesToEqual = () => {
    setForm(prev => ({ ...prev, customShares: {} }));
  };

  const handleMemberToggle = (memberId) => {
    const next = new Set(form.selectedMembers);
    if (next.has(memberId)) {
      next.delete(memberId);
    } else {
      next.add(memberId);
    }
    // Clean up locked state if deselected
    setLockedExact(prev => {
      const updated = new Set(prev);
      updated.delete(memberId);
      return updated;
    });
    setLockedPercentages(prev => {
      const updated = new Set(prev);
      updated.delete(memberId);
      return updated;
    });
    setForm(prev => ({ ...prev, selectedMembers: next }));
  };

  const handleSelectAllMembers = () => {
    setForm(prev => ({
      ...prev,
      selectedMembers: new Set(displayMembers.map(m => m.id))
    }));
  };

  const handleSelectOnlyMe = () => {
    const payerId = getPayerMemberId(selectedGroupId);
    setForm(prev => ({
      ...prev,
      selectedMembers: new Set(payerId ? [payerId] : [])
    }));
    setLockedExact(new Set());
    setLockedPercentages(new Set());
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
        let categoryName = form.personalCategory || form.customCategoryName.trim() || 'General';

        if (categoryName === 'Other' && form.customCategoryName.trim()) {
          categoryName = form.customCategoryName.trim();
        }

        let topicName = '';
        if (form.isNewTopic && form.newTopicName.trim()) {
          topicName = form.newTopicName.trim();
          const topicObj = {
            userId: currentUser?.id,
            name: topicName,
            budget: 0,
            icon: 'ph-folder-simple',
            color: '#6c5ce7',
            createdAt: Date.now()
          };
          if (isTursoConfigured) {
            tursoAddPersonalTopic(topicObj).catch(() => {});
          } else {
            LocalDatabase.addPersonalTopic(topicObj);
          }
        } else if (form.topic && form.topic !== '__CREATE_NEW__') {
          topicName = form.topic.trim();
        }

        const personalExpense = {
          userId: currentUser?.id,
          userName: currentUser?.name || 'User',
          title: form.title.trim(),
          amount: amountValue,
          category: categoryName,
          notes: form.notes.trim(),
          currencyCode: activeCurrency,
          topic: topicName,
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

      if (!currentUser) {
        setError('You must be logged in to add an expense.');
        setIsSubmitting(false);
        return;
      }

      if (form.selectedMembers.size === 0) {
        setError('Please select at least one member to split with.');
        setIsSubmitting(false);
        return;
      }

      const activeMembers = members.filter(m => String(m.groupId) === String(selectedGroupId));
      const effectiveMembers = activeMembers.length > 0 ? activeMembers : members;

      const myMemberRecord = effectiveMembers.find(m => 
        String(m.userId) === String(currentUser?.id) ||
        String(m.id) === String(currentUser?.id) ||
        (m.email && currentUser?.email && m.email.toLowerCase() === currentUser.email.toLowerCase())
      );

      if (!myMemberRecord && activeMembers.length > 0) {
        setError('Only members of this group can add expenses. You are not a member of this group.');
        setIsSubmitting(false);
        return;
      }

      const payer = myMemberRecord || { id: currentUser?.id, name: currentUser?.name };
      
      let participants = [];

      if (form.splitMode === 'EQUAL') {
        participants = Array.from(form.selectedMembers).map(memberId => ({
          memberId: memberId,
          memberName: effectiveMembers.find(m => m.id === memberId)?.name || '',
          shareAmount: equalData.amounts[memberId] || 0
        }));
      } else if (form.splitMode === 'EXACT') {
        if (!exactData.isBalanced && exactData.remaining > 0.05) {
          setError(`Unallocated amount: ${currencySymbol}${exactData.remaining.toFixed(2)}. Please allocate all funds or click "Reset to Equal".`);
          setIsSubmitting(false);
          return;
        }
        participants = Array.from(form.selectedMembers).map(memberId => ({
          memberId: memberId,
          memberName: effectiveMembers.find(m => m.id === memberId)?.name || '',
          shareAmount: exactData.amounts[memberId] || 0
        }));
      } else if (form.splitMode === 'PERCENT') {
        if (!percentData.isBalanced) {
          setError(`Total percentage must equal 100% (currently ${percentData.allocatedPercent}%). Please allocate 100% or click "Reset to Equal".`);
          setIsSubmitting(false);
          return;
        }
        participants = Array.from(form.selectedMembers).map(memberId => ({
          memberId: memberId,
          memberName: effectiveMembers.find(m => m.id === memberId)?.name || '',
          shareAmount: percentData.amounts[memberId] || 0
        }));
      } else if (form.splitMode === 'SHARES') {
        participants = Array.from(form.selectedMembers).map(memberId => ({
          memberId: memberId,
          memberName: effectiveMembers.find(m => m.id === memberId)?.name || '',
          shareAmount: sharesData.amounts[memberId] || 0
        }));
      }

      // Safety: absorb fractional cent rounding if any
      let totalSharesSum = 0;
      participants.forEach(p => totalSharesSum += p.shareAmount);
      const pennyDiff = Number((amountValue - totalSharesSum).toFixed(2));
      if (participants.length > 0 && Math.abs(pennyDiff) > 0 && Math.abs(pennyDiff) <= 0.05) {
        participants[0].shareAmount = Number((participants[0].shareAmount + pennyDiff).toFixed(2));
      }

      const newExpense = {
        id: Date.now(),
        groupId: selectedGroupId,
        userId: currentUser?.id,
        title: form.title.trim(),
        amount: amountValue,
        paidBy: payer.id,
        paidByMemberId: payer.id,
        payerName: currentUser?.name || payer.name,
        date: Date.now(),
        notes: form.notes.trim(),
        category: form.selectedCategory,
        currencyCode: activeCurrency,
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

  const activeGroupMembers = members.filter(m => String(m.groupId) === String(selectedGroupId));
  const displayMembers = activeGroupMembers.length > 0 ? activeGroupMembers : (groups.length > 0 ? [] : (currentUser ? [currentUser] : []));

  return createPortal(
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
            onClick={() => handleSwitchMode('PERSONAL')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <i className="ph ph-user"></i>
            <span>Personal Tracker</span>
          </button>
          <button 
            type="button" 
            className={`toggle-btn ${expenseType === 'GROUP' ? 'active' : ''}`}
            onClick={() => handleSwitchMode('GROUP')}
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
                <CustomSelect 
                  value={selectedGroupId}
                  onChange={newGid => {
                    setSelectedGroupId(newGid);
                    const payerId = getPayerMemberId(newGid);
                    setForm(prev => ({
                      ...prev,
                      // Requirement: Only the user adding expense is checked
                      selectedMembers: new Set(payerId ? [payerId] : []),
                      selectedPayerId: payerId,
                      customAmounts: {},
                      customPercentages: {},
                      customShares: {}
                    }));
                    setLockedExact(new Set());
                    setLockedPercentages(new Set());
                  }}
                  options={groups.map(g => ({
                    value: g.id,
                    label: g.name,
                    icon: 'ph-users-three'
                  }))}
                  placeholder="Select a group"
                />
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
              <label>Total Amount ({currencySymbol})</label>
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
                onWheel={e => e.target.blur()}
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
                <CustomSelect 
                  value={form.selectedCategory}
                  onChange={val => setForm(prev => ({ ...prev, selectedCategory: val }))}
                  options={[
                    { value: '', label: 'General / Other', icon: 'ph-tag' },
                    { value: 'FOOD', label: 'Food & Dining', icon: '🍽️' },
                    { value: 'TRAVEL', label: 'Travel & Transport', icon: '✈️' },
                    { value: 'GROCERIES', label: 'Groceries / Bazar', icon: '🛒' },
                    { value: 'ENTERTAINMENT', label: 'Entertainment', icon: '🎮' },
                    { value: 'UTILITIES', label: 'Utilities & Rent', icon: '⚡' },
                    { value: 'OTHER', label: 'Other', icon: '🏷️' }
                  ]}
                  placeholder="General / Other"
                />
              </div>
            ) : null}
          </div>

          {/* Personal Expense Specific: Category Badges */}
          {expenseType === 'PERSONAL' && (
            <div className="form-group">
              <label>Category (Optional)</label>
              <div className="personal-category-grid">
                {PERSONAL_CATEGORIES.map(cat => {
                  const isSelected = form.personalCategory === cat.id;
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      className={`personal-category-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => setForm({ ...form, personalCategory: isSelected ? '' : cat.id })}
                      style={{
                        borderColor: isSelected ? cat.color : undefined,
                        background: isSelected ? `${cat.color}20` : undefined,
                        color: isSelected ? cat.color : undefined
                      }}
                    >
                      <i className={`ph ${cat.icon}`}></i>
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

          {/* Personal Expense Specific: Subject / Topic Picker */}
          {expenseType === 'PERSONAL' && (
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                  Subject / Topic (Optional Project / Event)
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Optional</span>
              </div>
              <CustomSelect 
                value={form.topic}
                onChange={val => {
                  if (val === '__CREATE_NEW__') {
                    setForm(prev => ({ ...prev, topic: '__CREATE_NEW__', isNewTopic: true }));
                  } else {
                    setForm(prev => ({ ...prev, topic: val, isNewTopic: false }));
                  }
                }}
                options={[
                  { value: '', label: 'General / No Subject', icon: 'ph-folder' },
                  ...personalTopics.map(t => ({
                    value: t.name,
                    label: `${t.name}${t.budget ? ` (Budget: ${t.budget})` : ''}`,
                    icon: t.icon || 'ph-folder-simple'
                  })),
                  { value: '__CREATE_NEW__', label: '+ Create New Subject...', icon: 'ph-plus' }
                ]}
                placeholder="Select a subject (e.g. Tour, Grocery)"
              />

              {form.isNewTopic && (
                <input 
                  type="text" 
                  placeholder='Type new subject name (e.g., "Tour to Cox&apos;s Bazar")'
                  value={form.newTopicName}
                  onChange={e => setForm(prev => ({ ...prev, newTopicName: e.target.value }))}
                  style={{ marginTop: '8px' }}
                  autoFocus
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
              {/* Group Expense Specific: Payer is strictly the logged-in user */}
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ margin: 0 }}>Paid by</label>
                  <span style={{ 
                    fontSize: '0.74rem', 
                    color: 'var(--accent-primary)', 
                    fontWeight: 600, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px' 
                  }}>
                    <i className="ph ph-shield-check"></i> Authenticated Account
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '12px',
                  border: '1px solid var(--glass-border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <UserAvatar user={currentUser} size={34} fontSize="0.85rem" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {currentUser?.name} <span style={{ color: 'var(--accent-primary)', fontSize: '0.8rem' }}>(You)</span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        @{currentUser?.username || currentUser?.email?.split('@')[0]}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.72rem',
                    background: 'rgba(0, 191, 165, 0.12)',
                    color: '#00bfa5',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontWeight: 600
                  }}>
                    Payer: You
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Only your logged-in account can record expenses you paid.
                </div>
              </div>

              {/* GPay Style Split Options Segmented Nav */}
              <div className="split-options">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ margin: 0 }}>Split between members</label>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <i className="ph ph-google-card-logo"></i> GPay Style Split
                  </span>
                </div>
                
                <div className="split-mode-tabs">
                  <button 
                    type="button" 
                    className={`split-mode-tab ${form.splitMode === 'EQUAL' ? 'active' : ''}`}
                    onClick={() => setForm(prev => ({ ...prev, splitMode: 'EQUAL' }))}
                  >
                    <i className="ph ph-equals"></i>
                    <span>Equally</span>
                  </button>
                  <button 
                    type="button" 
                    className={`split-mode-tab ${form.splitMode === 'EXACT' ? 'active' : ''}`}
                    onClick={() => setForm(prev => ({ ...prev, splitMode: 'EXACT' }))}
                  >
                    <i className="ph ph-coins"></i>
                    <span>Exact ({currencySymbol})</span>
                  </button>
                  <button 
                    type="button" 
                    className={`split-mode-tab ${form.splitMode === 'PERCENT' ? 'active' : ''}`}
                    onClick={() => setForm(prev => ({ ...prev, splitMode: 'PERCENT' }))}
                  >
                    <i className="ph ph-percent"></i>
                    <span>Percent (%)</span>
                  </button>
                  <button 
                    type="button" 
                    className={`split-mode-tab ${form.splitMode === 'SHARES' ? 'active' : ''}`}
                    onClick={() => setForm(prev => ({ ...prev, splitMode: 'SHARES' }))}
                  >
                    <i className="ph ph-chart-pie-slice"></i>
                    <span>Shares (x)</span>
                  </button>
                </div>

                {/* Status Bar */}
                {form.selectedMembers.size > 0 && amountNum > 0 && (
                  <div className={`split-status-bar ${
                    (form.splitMode === 'EQUAL' || form.splitMode === 'SHARES' || 
                     (form.splitMode === 'EXACT' && exactData.isBalanced) ||
                     (form.splitMode === 'PERCENT' && percentData.isBalanced)) ? 'balanced' : 'unbalanced'
                  }`}>
                    {form.splitMode === 'EQUAL' && (
                      <div className="status-content">
                        <i className="ph-fill ph-check-circle"></i>
                        <span>
                          Split equally: <strong>{currencySymbol}{equalData.perPerson.toFixed(2)}</strong> / person ({form.selectedMembers.size} {form.selectedMembers.size === 1 ? 'member' : 'members'})
                        </span>
                      </div>
                    )}

                    {form.splitMode === 'EXACT' && (
                      <div className="status-content-exact">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className={exactData.isBalanced ? "ph-fill ph-check-circle" : "ph-fill ph-warning-circle"}></i>
                          <span>
                            Allocated: <strong>{currencySymbol}{exactData.allocated.toFixed(2)}</strong> / {currencySymbol}{amountNum.toFixed(2)}
                            {exactData.remaining > 0 && (
                              <span className="remaining-tag">
                                ({currencySymbol}{exactData.remaining.toFixed(2)} left)
                              </span>
                            )}
                          </span>
                        </div>
                        {lockedExact.size > 0 && (
                          <button 
                            type="button" 
                            className="split-action-chip"
                            onClick={handleResetExactToEqual}
                            title="Reset everyone to equal split"
                          >
                            <i className="ph ph-arrows-clockwise"></i> Reset
                          </button>
                        )}
                      </div>
                    )}

                    {form.splitMode === 'PERCENT' && (
                      <div className="status-content-exact">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className={percentData.isBalanced ? "ph-fill ph-check-circle" : "ph-fill ph-warning-circle"}></i>
                          <span>
                            Allocated: <strong>{percentData.allocatedPercent}%</strong> / 100%
                            {percentData.remainingPercent > 0 && (
                              <span className="remaining-tag">
                                ({percentData.remainingPercent}% left)
                              </span>
                            )}
                          </span>
                        </div>
                        {lockedPercentages.size > 0 && (
                          <button 
                            type="button" 
                            className="split-action-chip"
                            onClick={handleResetPercentToEqual}
                            title="Reset everyone to equal percentage"
                          >
                            <i className="ph ph-arrows-clockwise"></i> Reset
                          </button>
                        )}
                      </div>
                    )}

                    {form.splitMode === 'SHARES' && (
                      <div className="status-content-exact">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="ph-fill ph-check-circle"></i>
                          <span>
                            Total Shares: <strong>{sharesData.totalShares}</strong> ({currencySymbol}{(amountNum / sharesData.totalShares).toFixed(2)} / share)
                          </span>
                        </div>
                        <button 
                          type="button" 
                          className="split-action-chip"
                          onClick={handleResetSharesToEqual}
                          title="Reset everyone to 1 share"
                        >
                          <i className="ph ph-arrows-clockwise"></i> Reset (1:1)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Member Selection List */}
              <div className="members-list">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem' }}>
                    Included in split ({form.selectedMembers.size})
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      type="button" 
                      className="split-action-chip"
                      onClick={handleSelectAllMembers}
                    >
                      Select All
                    </button>
                    <button 
                      type="button" 
                      className="split-action-chip"
                      onClick={handleSelectOnlyMe}
                    >
                      Only Me
                    </button>
                  </div>
                </div>

                {displayMembers.map(m => {
                  const isSelected = form.selectedMembers.has(m.id);
                  const isMe = m.id === currentUser?.id || String(m.userId) === String(currentUser?.id);

                  return (
                    <div key={m.id} className={`member-split-row ${isSelected ? 'selected' : 'unselected'}`}>
                      <label className="checkbox-label" style={{ flex: 1, minWidth: 0, margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => handleMemberToggle(m.id)}
                        />
                        <UserAvatar user={m} size={28} fontSize="0.75rem" />
                        <span className="member-name-text">
                          {m.name} {isMe ? '(You)' : ''}
                        </span>
                      </label>

                      {/* EQUAL MODE */}
                      {form.splitMode === 'EQUAL' && isSelected && (
                        <div className="member-split-pill">
                          {currencySymbol}{(equalData.amounts[m.id] || 0).toFixed(2)}
                        </div>
                      )}

                      {/* EXACT AMOUNT MODE (Smart Auto-Balance & 600 Cap) */}
                      {form.splitMode === 'EXACT' && isSelected && (
                        <div className="split-input-wrapper">
                          <span className="split-input-prefix">{currencySymbol}</span>
                          <input 
                            type="number" 
                            step="0.01" 
                            min="0"
                            placeholder="0.00"
                            className="split-custom-input"
                            value={lockedExact.has(m.id) ? (form.customAmounts[m.id] ?? '') : (exactData.amounts[m.id] !== undefined ? exactData.amounts[m.id].toFixed(2) : '')}
                            onKeyDown={e => {
                              if (['+', '-', 'e', 'E'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            onWheel={e => e.target.blur()}
                            onChange={(e) => handleExactChange(m.id, e.target.value)}
                          />
                          <button
                            type="button"
                            className={`split-lock-toggle ${lockedExact.has(m.id) ? 'locked' : 'auto'}`}
                            onClick={() => handleToggleLockExact(m.id)}
                            title={lockedExact.has(m.id) ? "Manually set. Click to auto-balance." : "Auto calculated. Click to fix amount."}
                          >
                            {lockedExact.has(m.id) ? (
                              <>
                                <i className="ph ph-lock-simple"></i>
                                <span>Fixed</span>
                              </>
                            ) : (
                              <>
                                <i className="ph ph-lightning"></i>
                                <span>Auto</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* PERCENTAGE MODE */}
                      {form.splitMode === 'PERCENT' && isSelected && (
                        <div className="split-input-wrapper">
                          <input 
                            type="number" 
                            step="0.1" 
                            min="0"
                            max="100"
                            placeholder="0"
                            className="split-custom-input percent-input"
                            value={lockedPercentages.has(m.id) ? (form.customPercentages[m.id] ?? '') : (percentData.percentages[m.id] !== undefined ? percentData.percentages[m.id] : '')}
                            onKeyDown={e => {
                              if (['+', '-', 'e', 'E'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            onWheel={e => e.target.blur()}
                            onChange={(e) => handlePercentChange(m.id, e.target.value)}
                          />
                          <span className="split-input-suffix">%</span>
                          <div className="split-percent-converted">
                            {currencySymbol}{(percentData.amounts[m.id] || 0).toFixed(2)}
                          </div>
                          <button
                            type="button"
                            className={`split-lock-toggle ${lockedPercentages.has(m.id) ? 'locked' : 'auto'}`}
                            onClick={() => handleToggleLockPercent(m.id)}
                            title={lockedPercentages.has(m.id) ? "Manually set. Click to auto-balance." : "Auto calculated. Click to fix."}
                          >
                            {lockedPercentages.has(m.id) ? (
                              <>
                                <i className="ph ph-lock-simple"></i>
                                <span>Fixed</span>
                              </>
                            ) : (
                              <>
                                <i className="ph ph-lightning"></i>
                                <span>Auto</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* SHARES MODE */}
                      {form.splitMode === 'SHARES' && isSelected && (
                        <div className="split-shares-wrapper">
                          <div className="shares-stepper">
                            <button 
                              type="button" 
                              className="share-step-btn"
                              onClick={() => handleShareStep(m.id, -1)}
                              disabled={(sharesData.shares[m.id] || 1) <= 1}
                            >
                              <i className="ph ph-minus"></i>
                            </button>
                            <span className="share-step-value">
                              {sharesData.shares[m.id] || 1}
                            </span>
                            <button 
                              type="button" 
                              className="share-step-btn"
                              onClick={() => handleShareStep(m.id, 1)}
                            >
                              <i className="ph ph-plus"></i>
                            </button>
                          </div>
                          <div className="split-shares-converted">
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              {sharesData.percentages[m.id]}%
                            </span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.86rem' }}>
                              {currencySymbol}{(sharesData.amounts[m.id] || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
    </div>,
    document.body
  );
}
