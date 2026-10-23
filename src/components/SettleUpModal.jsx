import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { LocalDatabase } from '../store/db';
import { isTursoConfigured, tursoAddSettlement } from '../lib/turso';
import { formatSimple } from '../lib/CurrencyManager';
import { isDebtor, matchesMember, isMemberMatch } from '../lib/BalanceCalculator';
import { QRCodeCanvas } from 'qrcode.react';
import MfsCheckoutModal from '../lib/mfs/MfsCheckoutModal';
import CustomSelect from './CustomSelect';
import UserAvatar from './UserAvatar';

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
  const [selectedGroupId, setSelectedGroupId] = useState(currentGroupId || (groups[0]?.id || ''));

  // Form states: Payer is strictly currentUser
  const [payeeId, setPayeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bKash');
  const [trxId, setTrxId] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [error, setError] = useState('');
  const [isForbiddenTarget, setIsForbiddenTarget] = useState(false);
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

  // Canonical current user identifier in this group
  const myCanonicalId = currentUserMember?.id || currentUser?.id;

  // Filter debts for the selected group
  const relevantDebts = useMemo(() => {
    return (suggestedDebts || []).filter(d => {
      if (selectedGroupId && d.groupId && String(d.groupId) !== String(selectedGroupId)) {
        return false;
      }
      return true;
    });
  }, [suggestedDebts, selectedGroupId]);

  // Debts where current user is strictly the debtor (I owe them)
  const debtsIOwe = useMemo(() => {
    return relevantDebts.filter(d => isDebtor(d, currentUser, groupMembers));
  }, [relevantDebts, currentUser, groupMembers]);

  // Initialize form when modal opens or target changes
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
    const targetDebts = (suggestedDebts || []).filter(d => !targetGid || !d.groupId || String(d.groupId) === String(targetGid));
    const targetDebtsIOwe = targetDebts.filter(d => isDebtor(d, currentUser, targetGroupMembers));

    // If an initial target debt was passed
    if (initialTarget?.debt) {
      const d = initialTarget.debt;
      if (typeof d === 'object' && d.fromMemberId && d.toMemberId) {
        const amDebtor = isDebtor(d, currentUser, targetGroupMembers);
        if (!amDebtor) {
          setError('Permission Denied: Only the debtor can settle and pay their own debt.');
          setIsForbiddenTarget(true);
          setPayeeId('');
          setAmount('');
          return;
        }
        setIsForbiddenTarget(false);
        setPayeeId(d.toMemberId);
        setAmount(String(d.amount));
        return;
      } else if (typeof d === 'string') {
        setIsForbiddenTarget(false);
        setPayeeId(d);
        const matchingDebt = targetDebtsIOwe.find(deb => 
          String(deb.toMemberId) === String(d) || isMemberMatch(deb.toMemberId, d, targetGroupMembers)
        );
        if (matchingDebt) {
          setAmount(String(matchingDebt.amount));
        } else {
          setAmount('');
        }
        return;
      }
    }

    setIsForbiddenTarget(false);

    // Default: choose first person currentUser owes
    if (targetDebtsIOwe.length > 0) {
      setPayeeId(targetDebtsIOwe[0].toMemberId);
      setAmount(String(targetDebtsIOwe[0].amount));
    } else {
      const otherMember = targetGroupMembers.find(m => !matchesMember(m, currentUser?.id));
      setPayeeId(otherMember?.id || '');
      setAmount('');
    }
  }, [isOpen, currentGroupId, initialTarget, groups, members, suggestedDebts, currentUser]);

  // Recipient / payee member details
  const payeeMember = useMemo(() => {
    return groupMembers.find(m => 
      String(m.id) === String(payeeId) || 
      String(m.userId) === String(payeeId) ||
      matchesMember(m, payeeId)
    );
  }, [groupMembers, payeeId]);

  // Check matching outstanding debt that currentUser owes to currently selected payee
  const activeDebtBetween = useMemo(() => {
    if (!payeeId) return null;
    return debtsIOwe.find(d => 
      String(d.toMemberId) === String(payeeId) || isMemberMatch(d.toMemberId, payeeId, groupMembers)
    );
  }, [debtsIOwe, payeeId, groupMembers]);

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
    if (isForbiddenTarget) {
      setError('Permission Denied: Only the debtor can settle and pay their own debt.');
      return false;
    }

    const finalAmount = parseFloat(customAmount !== null ? customAmount : amount);

    if (isNaN(finalAmount) || finalAmount <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return false;
    }

    if (!payeeId) {
      setError('Please select who you are paying.');
      return false;
    }

    const activeGid = selectedGroupId || currentGroupId || (groups[0]?.id || '1');
    const curGroupMembers = members.filter(m => String(m.groupId) === String(activeGid));
    const userMemberInCurGroup = curGroupMembers.find(m => matchesMember(m, currentUser?.id)) ||
                                 curGroupMembers.find(m => matchesMember(m, currentUser?.email)) ||
                                 curGroupMembers.find(m => matchesMember(m, currentUser?.name));

    // Payer is strictly the logged in currentUser
    const resolvedPayerId = userMemberInCurGroup?.id || currentUser.id;
    const resolvedPayerName = currentUser.name || userMemberInCurGroup?.name || 'You';

    const recMem = curGroupMembers.find(m => matchesMember(m, payeeId));
    const resolvedPayeeId = recMem?.id || payeeId;
    const resolvedPayeeName = recMem?.name || payeeMember?.name || 'Member';

    if (String(resolvedPayerId) === String(resolvedPayeeId)) {
      setError('You cannot record a payment to yourself.');
      return false;
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
                Pay and clear your outstanding debt
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

        {error && (
          <div className="error-message" style={{ marginBottom: '14px' }}>
            {error}
          </div>
        )}

        {isForbiddenTarget ? (
          <div style={{
            padding: '20px 16px',
            background: 'rgba(235, 77, 75, 0.12)',
            border: '1px solid rgba(235, 77, 75, 0.3)',
            borderRadius: '12px',
            color: 'var(--danger)',
            textAlign: 'center',
            marginBottom: '16px'
          }}>
            <i className="ph ph-warning-circle" style={{ fontSize: '2rem', marginBottom: '8px', display: 'inline-block' }}></i>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 700 }}>Debtor Authorization Required</h4>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Only the debtor whose debt it is can settle and pay this amount. You cannot record or settle debts on behalf of other members.
            </p>
            <div style={{ marginTop: '16px' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
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

            {/* Payer Card (Strictly Current User) */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Payer (Debtor)
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <UserAvatar user={currentUser} size={36} />
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {currentUser?.name || 'You'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      @{currentUser?.username || currentUser?.email?.split('@')[0]}
                    </div>
                  </div>
                </div>
                <span style={{
                  fontSize: '0.72rem',
                  background: 'rgba(0, 184, 148, 0.15)',
                  color: 'var(--success)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontWeight: 600
                }}>
                  Active Payer ✓
                </span>
              </div>
            </div>

            {/* Payee Selection (Who are you paying?) */}
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
                placeholder="Select recipient member"
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
                  Total debt you owe to <strong>{payeeMember?.name}</strong>:
                </div>
                <div style={{ fontWeight: 800, color: 'var(--danger)', fontSize: '0.95rem' }}>
                  {formatSimple(activeDebtBetween.amount, currencyCode)}
                </div>
              </div>
            )}

            {/* Payee MFS Info Box */}
            {payeeMember && (
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
                      <strong>bKash:</strong> {payeeBkash || 'Ask member for number'}
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

                {/* Quick Simulated Gateway Buttons */}
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
                  `Pay & Settle ${amount ? formatSimple(Number(amount), currencyCode) : ''}`
                )}
              </button>
            </div>
          </form>
        )}

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
