import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { LocalDatabase } from '../store/db';
import { isTursoConfigured, tursoAddSettlement } from '../lib/turso';
import { formatSimple } from '../lib/CurrencyManager';
import { isDebtor, isCreditor, matchesMember, findMemberKey, isMemberMatch } from '../lib/BalanceCalculator';
import { QRCodeCanvas } from 'qrcode.react';
import MfsCheckoutModal from '../lib/mfs/MfsCheckoutModal';
import CustomSelect from './CustomSelect';

export default function SettleUpModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  currentGroupId = null, 
  currentUser, 
  suggestedDebts = [], 
  groups = [],
  currencyCode = 'BDT',
  members = [],
  initialTarget = null
}) {
  // Mode: 'PAY' (I am paying someone) | 'RECEIVE' (Someone paid me) | 'GROUP' (Between other members)
  const [activeTab, setActiveTab] = useState('PAY');
  const [selectedGroupId, setSelectedGroupId] = useState(currentGroupId || (groups[0]?.id || ''));

  // Form states
  const [payerId, setPayerId] = useState('');
  const [payeeId, setPayeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bKash');
  const [trxId, setTrxId] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [isMfsGatewayOpen, setIsMfsGatewayOpen] = useState(false);
  const [mfsGatewayProvider, setMfsGatewayProvider] = useState('BKASH');

  // Filter members for the selected group
  const groupMembers = useMemo(() => {
    if (!selectedGroupId) return members;
    const filtered = members.filter(m => String(m.groupId) === String(selectedGroupId));
    return filtered.length > 0 ? filtered : members;
  }, [members, selectedGroupId]);

  // Find the member record representing the current user in this group
  const currentUserMember = useMemo(() => {
    if (!currentUser) return null;
    return groupMembers.find(m => matchesMember(m, currentUser.id)) || 
           groupMembers.find(m => matchesMember(m, currentUser.email)) ||
           groupMembers.find(m => matchesMember(m, currentUser.name)) ||
           null;
  }, [groupMembers, currentUser]);

  // Canonical current user identifier in this group (member ID if exists, otherwise user ID)
  const myCanonicalId = currentUserMember?.id || currentUser?.id;

  // Filter debts for the selected group (or all if not group-specific)
  const relevantDebts = useMemo(() => {
    return (suggestedDebts || []).filter(d => {
      if (selectedGroupId && d.groupId && String(d.groupId) !== String(selectedGroupId)) {
        return false;
      }
      return true;
    });
  }, [suggestedDebts, selectedGroupId]);

  // Debts where current user is the debtor (I owe them)
  const debtsIOwe = useMemo(() => {
    return relevantDebts.filter(d => isDebtor(d, currentUser, groupMembers));
  }, [relevantDebts, currentUser, groupMembers]);

  // Debts where current user is the creditor (They owe me)
  const debtsOwedToMe = useMemo(() => {
    return relevantDebts.filter(d => isCreditor(d, currentUser, groupMembers));
  }, [relevantDebts, currentUser, groupMembers]);

  // Initialize or reset form when modal opens or group/target changes
  useEffect(() => {
    if (!isOpen) return;

    setError('');
    setIsSubmitting(false);
    setDate(new Date().toISOString().split('T')[0]);
    setTrxId('');
    setNotes('');

    const targetGid = initialTarget?.groupId || currentGroupId || (groups[0]?.id || '');
    setSelectedGroupId(targetGid);

    const targetGroupMembers = members.filter(m => String(m.groupId) === String(targetGid));
    const userMemberInTargetGroup = targetGroupMembers.find(m => matchesMember(m, currentUser?.id)) ||
                                   targetGroupMembers.find(m => matchesMember(m, currentUser?.email)) ||
                                   targetGroupMembers.find(m => matchesMember(m, currentUser?.name));
    const targetMyId = userMemberInTargetGroup?.id || currentUser?.id;

    // Filter relevant debts for this target group
    const targetDebts = (suggestedDebts || []).filter(d => !targetGid || !d.groupId || String(d.groupId) === String(targetGid));
    const targetDebtsIOwe = targetDebts.filter(d => isDebtor(d, currentUser, targetGroupMembers));
    const targetDebtsOwedToMe = targetDebts.filter(d => isCreditor(d, currentUser, targetGroupMembers));

    // If an initial target debt was passed
    if (initialTarget?.debt) {
      const d = initialTarget.debt;
      const amDebtor = isDebtor(d, currentUser, targetGroupMembers);
      const amCreditor = isCreditor(d, currentUser, targetGroupMembers);

      if (amCreditor) {
        setActiveTab('RECEIVE');
        setPayerId(d.fromMemberId);
        setPayeeId(targetMyId);
        setAmount(String(d.amount));
      } else {
        setActiveTab('PAY');
        setPayerId(targetMyId);
        setPayeeId(d.toMemberId);
        setAmount(String(d.amount));
      }
      return;
    }

    // Default mode setup based on debt balances
    if (targetDebtsIOwe.length > 0) {
      setActiveTab('PAY');
      setPayerId(targetMyId);
      setPayeeId(targetDebtsIOwe[0].toMemberId);
      setAmount(String(targetDebtsIOwe[0].amount));
    } else if (targetDebtsOwedToMe.length > 0) {
      setActiveTab('RECEIVE');
      setPayerId(targetDebtsOwedToMe[0].fromMemberId);
      setPayeeId(targetMyId);
      setAmount(String(targetDebtsOwedToMe[0].amount));
    } else {
      // No active debts for user in this group
      setActiveTab('PAY');
      setPayerId(targetMyId);
      const otherMember = targetGroupMembers.find(m => !matchesMember(m, currentUser?.id));
      setPayeeId(otherMember?.id || '');
      setAmount('');
    }
  }, [isOpen, currentGroupId, initialTarget, groups, members]);

  // When switching tabs, update payer & payee accordingly
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError('');

    if (tab === 'PAY') {
      setPayerId(myCanonicalId);
      if (debtsIOwe.length > 0) {
        setPayeeId(debtsIOwe[0].toMemberId);
        setAmount(String(debtsIOwe[0].amount));
      } else {
        const other = groupMembers.find(m => !matchesMember(m, currentUser?.id));
        setPayeeId(other?.id || '');
        setAmount('');
      }
    } else if (tab === 'RECEIVE') {
      setPayeeId(myCanonicalId);
      if (debtsOwedToMe.length > 0) {
        setPayerId(debtsOwedToMe[0].fromMemberId);
        setAmount(String(debtsOwedToMe[0].amount));
      } else {
        const other = groupMembers.find(m => !matchesMember(m, currentUser?.id));
        setPayerId(other?.id || '');
        setAmount('');
      }
    } else if (tab === 'GROUP') {
      const first = groupMembers[0]?.id || '';
      const second = groupMembers.find(m => String(m.id) !== String(first))?.id || '';
      setPayerId(first);
      setPayeeId(second);
      setAmount('');
    }
  };

  // Find recipient / payee member details for handles
  const payeeMember = useMemo(() => {
    return groupMembers.find(m => 
      String(m.id) === String(payeeId) || 
      String(m.userId) === String(payeeId) ||
      matchesMember(m, payeeId)
    );
  }, [groupMembers, payeeId]);

  // Find payer member details
  const payerMember = useMemo(() => {
    return groupMembers.find(m => 
      String(m.id) === String(payerId) || 
      String(m.userId) === String(payerId) ||
      matchesMember(m, payerId)
    );
  }, [groupMembers, payerId]);

  // Check matching outstanding debt between currently selected payer and payee
  const activeDebtBetween = useMemo(() => {
    if (!payerId || !payeeId) return null;
    return relevantDebts.find(d => 
      (String(d.fromMemberId) === String(payerId) || isMemberMatch(d.fromMemberId, payerId, groupMembers)) &&
      (String(d.toMemberId) === String(payeeId) || isMemberMatch(d.toMemberId, payeeId, groupMembers))
    );
  }, [relevantDebts, payerId, payeeId, groupMembers]);

  const payeeBkash = payeeMember?.bkashNumber || payeeMember?.phone || '';
  const payeeNagad = payeeMember?.nagadNumber || '';
  const payeeRocket = payeeMember?.rocketNumber || '';

  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleMfsGatewaySuccess = async ({ provider, trxID, amount: paidAmount }) => {
    setIsMfsGatewayOpen(false);
    await submitSettlementRecord({
      customAmount: paidAmount,
      customMethod: `${provider} (API)`,
      customTrxId: trxID
    });
  };

  const submitSettlementRecord = async ({ customAmount = null, customMethod = null, customTrxId = null } = {}) => {
    const finalAmount = parseFloat(customAmount !== null ? customAmount : amount);

    if (isNaN(finalAmount) || finalAmount <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return false;
    }

    if (!payerId || !payeeId) {
      setError('Please select both the payer and receiver.');
      return false;
    }

    if (String(payerId) === String(payeeId)) {
      setError('Payer and receiver cannot be the same member.');
      return false;
    }

    const activeGid = selectedGroupId || currentGroupId || (groups[0]?.id || '1');
    const curGroupMembers = members.filter(m => String(m.groupId) === String(activeGid));
    const userMemberInCurGroup = curGroupMembers.find(m => matchesMember(m, currentUser?.id)) ||
                                 curGroupMembers.find(m => matchesMember(m, currentUser?.email)) ||
                                 curGroupMembers.find(m => matchesMember(m, currentUser?.name));

    // Resolve canonical member IDs within the group
    let resolvedPayerId = payerId;
    let resolvedPayerName = '';
    if (isMemberMatch(payerId, currentUser, members) || matchesMember(userMemberInCurGroup, payerId)) {
      resolvedPayerId = userMemberInCurGroup?.id || currentUser.id;
      resolvedPayerName = currentUser.name || userMemberInCurGroup?.name || 'Member';
    } else {
      const pMem = curGroupMembers.find(m => matchesMember(m, payerId));
      resolvedPayerId = pMem?.id || payerId;
      resolvedPayerName = pMem?.name || 'Member';
    }

    let resolvedPayeeId = payeeId;
    let resolvedPayeeName = '';
    if (isMemberMatch(payeeId, currentUser, members) || matchesMember(userMemberInCurGroup, payeeId)) {
      resolvedPayeeId = userMemberInCurGroup?.id || currentUser.id;
      resolvedPayeeName = currentUser.name || userMemberInCurGroup?.name || 'Member';
    } else {
      const recMem = curGroupMembers.find(m => matchesMember(m, payeeId));
      resolvedPayeeId = recMem?.id || payeeId;
      resolvedPayeeName = recMem?.name || 'Member';
    }

    const settlementTimestamp = date ? new Date(date).getTime() : Date.now();

    const newSettlement = {
      id: `stl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      groupId: activeGid,
      paidBy: resolvedPayerId,
      paidTo: resolvedPayeeId,
      payerName: resolvedPayerName,
      payeeName: resolvedPayeeName,
      amount: finalAmount,
      date: settlementTimestamp,
      paymentMethod: customMethod || paymentMethod || 'Cash',
      trxId: (customTrxId !== null ? customTrxId : (trxId ? trxId.trim() : null)),
      notes: notes ? notes.trim() : null
    };

    setIsSubmitting(true);
    try {
      LocalDatabase.addSettlement(newSettlement);

      if (isTursoConfigured) {
        await tursoAddSettlement(newSettlement);
      }

      onSuccess();
      onClose();
      return true;
    } catch (err) {
      console.error("Settlement save error:", err);
      setError(err.message || 'Failed to record settlement. Please try again.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    await submitSettlementRecord();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 1050 }} onClick={onClose}>
      <div 
        className="modal-content glass-panel animate-fade-in" 
        style={{ maxWidth: '460px', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.3rem' }}>🤝</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Settle Up</h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Record debt clearance & payment
              </div>
            </div>
          </div>
          <button 
            type="button" 
            className="btn-icon" 
            onClick={onClose} 
            style={{ width: '32px', height: '32px' }}
          >
            <i className="ph ph-x"></i>
          </button>
        </div>

        {/* Direction Navigation Tabs */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-tertiary)',
          padding: '3px',
          borderRadius: '10px',
          marginBottom: '16px',
          border: '1px solid var(--glass-border)'
        }}>
          <button
            type="button"
            className={`toggle-btn ${activeTab === 'PAY' ? 'active' : ''}`}
            onClick={() => handleTabChange('PAY')}
            style={{ flex: 1, padding: '7px 4px', fontSize: '0.82rem', borderRadius: '8px' }}
          >
            I am paying
          </button>
          <button
            type="button"
            className={`toggle-btn ${activeTab === 'RECEIVE' ? 'active' : ''}`}
            onClick={() => handleTabChange('RECEIVE')}
            style={{ flex: 1, padding: '7px 4px', fontSize: '0.82rem', borderRadius: '8px' }}
          >
            I received
          </button>
          <button
            type="button"
            className={`toggle-btn ${activeTab === 'GROUP' ? 'active' : ''}`}
            onClick={() => handleTabChange('GROUP')}
            style={{ flex: 1, padding: '7px 4px', fontSize: '0.82rem', borderRadius: '8px' }}
          >
            Group members
          </button>
        </div>

        {error && (
          <div className="error-message" style={{ marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Group Selector if multiple groups exist */}
          {groups.length > 1 && (
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.82rem' }}>Group</label>
              <CustomSelect 
                value={selectedGroupId}
                onChange={gid => setSelectedGroupId(gid)}
                options={groups.map(g => ({
                  value: g.id,
                  label: g.name,
                  icon: 'ph-users-three'
                }))}
                placeholder="Select Group"
              />
            </div>
          )}

          {/* TAB 1: PAY DEBT (Current user is paying) */}
          {activeTab === 'PAY' && (
            <>
              <div className="form-group">
                <label style={{ fontSize: '0.82rem' }}>Who are you paying?</label>
                <CustomSelect 
                  value={payeeId}
                  onChange={pid => {
                    setPayeeId(pid);
                    const matchingDebt = debtsIOwe.find(d => 
                      String(d.toMemberId) === String(pid) || isMemberMatch(d.toMemberId, pid, groupMembers)
                    );
                    if (matchingDebt) {
                      setAmount(String(matchingDebt.amount));
                    }
                  }}
                  options={groupMembers
                    .filter(m => !matchesMember(m, currentUser?.id))
                    .map(m => {
                      const debt = debtsIOwe.find(d => 
                        String(d.toMemberId) === String(m.id) || isMemberMatch(d.toMemberId, m.id, groupMembers)
                      );
                      return {
                        value: m.id,
                        label: m.name,
                        sublabel: debt ? `You owe ${formatSimple(debt.amount, currencyCode)}` : null,
                        icon: 'ph-user'
                      };
                    })}
                  placeholder="Select member"
                />
              </div>

              {/* Outstanding Debt Info Pill */}
              {activeDebtBetween && (
                <div style={{
                  background: 'rgba(235, 77, 75, 0.08)',
                  border: '1px solid rgba(235, 77, 75, 0.25)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Total outstanding debt to <strong>{payeeMember?.name}</strong>:
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--danger)', fontSize: '0.95rem' }}>
                    {formatSimple(activeDebtBetween.amount, currencyCode)}
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: RECEIVE PAYMENT (Current user received money) */}
          {activeTab === 'RECEIVE' && (
            <>
              <div className="form-group">
                <label style={{ fontSize: '0.82rem' }}>Who paid you?</label>
                <CustomSelect 
                  value={payerId}
                  onChange={pid => {
                    setPayerId(pid);
                    const matchingDebt = debtsOwedToMe.find(d => 
                      String(d.fromMemberId) === String(pid) || isMemberMatch(d.fromMemberId, pid, groupMembers)
                    );
                    if (matchingDebt) {
                      setAmount(String(matchingDebt.amount));
                    }
                  }}
                  options={groupMembers
                    .filter(m => !matchesMember(m, currentUser?.id))
                    .map(m => {
                      const debt = debtsOwedToMe.find(d => 
                        String(d.fromMemberId) === String(m.id) || isMemberMatch(d.fromMemberId, m.id, groupMembers)
                      );
                      return {
                        value: m.id,
                        label: m.name,
                        sublabel: debt ? `Owes you ${formatSimple(debt.amount, currencyCode)}` : null,
                        icon: 'ph-user'
                      };
                    })}
                  placeholder="Select who paid you"
                />
              </div>

              {/* Outstanding Debt Info Pill */}
              {activeDebtBetween && (
                <div style={{
                  background: 'rgba(0, 184, 148, 0.08)',
                  border: '1px solid rgba(0, 184, 148, 0.25)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <strong>{payerMember?.name}</strong> owes you:
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--success)', fontSize: '0.95rem' }}>
                    {formatSimple(activeDebtBetween.amount, currencyCode)}
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 3: GROUP MEMBERS (Alice paid Bob) */}
          {activeTab === 'GROUP' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.82rem' }}>Who Paid?</label>
                <CustomSelect 
                  value={payerId}
                  onChange={val => setPayerId(val)}
                  options={groupMembers.map(m => ({
                    value: m.id,
                    label: matchesMember(m, currentUser?.id) ? `${m.name} (You)` : m.name,
                    icon: 'ph-user'
                  }))}
                  placeholder="Payer"
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.82rem' }}>Who Received?</label>
                <CustomSelect 
                  value={payeeId}
                  onChange={val => setPayeeId(val)}
                  options={groupMembers
                    .filter(m => String(m.id) !== String(payerId))
                    .map(m => ({
                      value: m.id,
                      label: matchesMember(m, currentUser?.id) ? `${m.name} (You)` : m.name,
                      icon: 'ph-user'
                    }))}
                  placeholder="Receiver"
                />
              </div>
            </div>
          )}

          {/* Payee MFS Info Box (Shown when user is paying someone) */}
          {activeTab === 'PAY' && payeeMember && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {payeeMember.name}'s Payment Handles
                </span>
                <button
                  type="button"
                  onClick={() => setShowQr(!showQr)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <i className="ph ph-qr-code"></i>
                  {showQr ? 'Hide QR' : 'Show QR'}
                </button>
              </div>

              {showQr && (
                <div style={{ textAlign: 'center', padding: '10px 0', background: '#ffffff', borderRadius: '8px', margin: '8px 0' }}>
                  <QRCodeCanvas 
                    value={`SplitUP Pay: ${payeeBkash || payeeNagad || payeeMember.name} - Amount: ${amount || 0}`}
                    size={130}
                    level="M"
                  />
                  <p style={{ margin: '6px 0 0', color: '#333333', fontSize: '0.7rem' }}>
                    Scan via bKash / Nagad App
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* bKash row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E2136E' }}></span>
                    <strong>bKash:</strong> {payeeBkash || 'Contact friend'}
                  </span>
                  {payeeBkash ? (
                    <button
                      type="button"
                      onClick={() => handleCopy(payeeBkash, 'bkash')}
                      className="btn-secondary"
                      style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    >
                      {copiedField === 'bkash' ? '✓ Copied' : 'Copy'}
                    </button>
                  ) : (
                    <a 
                      href="tel:*247%23" 
                      style={{ fontSize: '0.72rem', color: '#E2136E', textDecoration: 'none', fontWeight: 600 }}
                      title="Dial bKash USSD"
                    >
                      Dial *247#
                    </a>
                  )}
                </div>

                {/* Nagad row */}
                {payeeNagad && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F7941D' }}></span>
                      <strong>Nagad:</strong> {payeeNagad}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(payeeNagad, 'nagad')}
                      className="btn-secondary"
                      style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    >
                      {copiedField === 'nagad' ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                )}

                {/* Rocket row */}
                {payeeRocket && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8C3494' }}></span>
                      <strong>Rocket:</strong> {payeeRocket}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(payeeRocket, 'rocket')}
                      className="btn-secondary"
                      style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    >
                      {copiedField === 'rocket' ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>

              {/* Quick API Gateway Buttons */}
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)', display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMfsGatewayProvider('BKASH');
                    setIsMfsGatewayOpen(true);
                  }}
                  style={{
                    flex: 1,
                    padding: '7px 8px',
                    background: '#E2136E',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}
                >
                  <i className="ph ph-lightning"></i>
                  <span>bKash API</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMfsGatewayProvider('NAGAD');
                    setIsMfsGatewayOpen(true);
                  }}
                  style={{
                    flex: 1,
                    padding: '7px 8px',
                    background: '#F7941D',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}
                >
                  <i className="ph ph-wallet"></i>
                  <span>Nagad API</span>
                </button>
              </div>
            </div>
          )}

          {/* Amount input with quick fill buttons */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.82rem' }}>Payment Amount</label>
              {activeDebtBetween && activeDebtBetween.amount > 0 && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setAmount(String(activeDebtBetween.amount))}
                    style={{
                      background: 'rgba(108, 92, 231, 0.15)',
                      border: '1px solid rgba(108, 92, 231, 0.3)',
                      color: 'var(--accent-primary)',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Full ({formatSimple(activeDebtBetween.amount, currencyCode)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount(String(Number((activeDebtBetween.amount / 2).toFixed(2))))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      cursor: 'pointer'
                    }}
                  >
                    50%
                  </button>
                </div>
              )}
            </div>

            <input 
              type="number" 
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount} 
              onKeyDown={e => {
                if (['+', '-', 'e', 'E'].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              onChange={e => {
                const val = e.target.value.replace(/[+\-eE]/g, '');
                setAmount(val);
              }} 
              required
              style={{ fontSize: '1.15rem', fontWeight: 700 }}
            />
          </div>

          {/* Payment Method & Date row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label style={{ fontSize: '0.82rem' }}>Payment Method</label>
              <CustomSelect 
                value={paymentMethod}
                onChange={val => setPaymentMethod(val)}
                options={[
                  { value: 'bKash', label: 'bKash', icon: '🌸' },
                  { value: 'Nagad', label: 'Nagad', icon: '🟠' },
                  { value: 'Rocket', label: 'Rocket', icon: '🟣' },
                  { value: 'Upay', label: 'Upay', icon: '🟢' },
                  { value: 'Cash', label: 'Cash', icon: '💵' },
                  { value: 'Bank Transfer', label: 'Bank / CellFin', icon: '🏦' },
                  { value: 'Other', label: 'Other', icon: '💳' }
                ]}
                placeholder="Payment Method"
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.82rem' }}>Date</label>
              <input 
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Transaction ID & Note */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label style={{ fontSize: '0.82rem' }}>TrxID <span style={{ color: 'var(--text-muted)' }}>(Optional)</span></label>
              <input 
                type="text"
                placeholder="e.g. BL9A82XJ1"
                value={trxId}
                onChange={e => setTrxId(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.82rem' }}>Note <span style={{ color: 'var(--text-muted)' }}>(Optional)</span></label>
              <input 
                type="text"
                placeholder="e.g. Lunch split"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Footer buttons */}
          <div className="modal-footer" style={{ marginTop: '16px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={isSubmitting}
              style={{ 
                background: 'var(--success)', 
                boxShadow: '0 4px 15px rgba(0, 184, 148, 0.3)',
                minWidth: '160px'
              }}
            >
              {isSubmitting ? (
                'Recording...'
              ) : (
                `Settle ${amount ? formatSimple(Number(amount), currencyCode) : ''}`
              )}
            </button>
          </div>
        </form>

        {/* Interactive Simulated Gateway Checkout */}
        <MfsCheckoutModal 
          isOpen={isMfsGatewayOpen}
          onClose={() => setIsMfsGatewayOpen(false)}
          onPaymentSuccess={handleMfsGatewaySuccess}
          amount={amount}
          currencyCode={currencyCode}
          initialProvider={mfsGatewayProvider}
          payeeName={payeeMember?.name || 'Friend'}
          payerUser={currentUser}
        />
      </div>
    </div>,
    document.body
  );
}
