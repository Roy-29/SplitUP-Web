import React, { useState } from 'react';
import { LocalDatabase } from '../store/db';
import { isTursoConfigured, tursoAddSettlement } from '../lib/turso';
import { formatSimple } from '../lib/CurrencyManager';
import { QRCodeCanvas } from 'qrcode.react';
import MfsCheckoutModal from '../lib/mfs/MfsCheckoutModal';
import CustomSelect from './CustomSelect';

export default function SettleUpModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  currentGroupId, 
  currentUser, 
  suggestedDebts = [], 
  currencyCode = 'BDT',
  members = []
}) {
    const myDebts = (suggestedDebts || []).filter(d => d.fromMemberId === currentUser?.id);

    const [form, setForm] = useState({
        debtIndex: 0,
        amount: myDebts.length > 0 ? myDebts[0].amount : '',
        paymentMethod: 'bKash',
        trxId: ''
    });
    
    const [error, setError] = useState('');
    const [copiedField, setCopiedField] = useState(null);
    const [showQr, setShowQr] = useState(false);
    const [isMfsGatewayOpen, setIsMfsGatewayOpen] = useState(false);
    const [mfsGatewayProvider, setMfsGatewayProvider] = useState('BKASH');

    if (!isOpen) return null;

    const selectedDebt = myDebts[form.debtIndex] || myDebts[0];

    // Find the payee member from members list to check for saved bKash/Nagad/Rocket
    const payeeMember = selectedDebt ? members.find(m => 
      String(m.id) === String(selectedDebt.toMemberId) || 
      String(m.userId) === String(selectedDebt.toMemberId) ||
      (m.name && selectedDebt.toMemberName && m.name.toLowerCase() === selectedDebt.toMemberName.toLowerCase())
    ) : null;

    const payeeBkash = payeeMember?.bkashNumber || '';
    const payeeNagad = payeeMember?.nagadNumber || '';
    const payeeRocket = payeeMember?.rocketNumber || '';

    const handleCopy = (text, fieldName) => {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2500);
    };

    const handleMfsGatewaySuccess = async ({ provider, trxID, amount: paidAmount }) => {
      setIsMfsGatewayOpen(false);

      const newSettlement = {
        groupId: currentGroupId,
        paidBy: currentUser.id,
        payerName: currentUser.name,
        paidTo: selectedDebt.toMemberId,
        payeeName: selectedDebt.toMemberName,
        amount: paidAmount,
        date: Date.now(),
        paymentMethod: `${provider} (API)`,
        trxId: trxID
      };

      LocalDatabase.addSettlement(newSettlement);

      if (isTursoConfigured) {
        try {
          await tursoAddSettlement(newSettlement);
        } catch (err) {
          console.warn("Turso settlement sync error:", err.message);
        }
      }

      onSuccess();
      onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (myDebts.length === 0) {
            onClose();
            return;
        }

        const amountValue = parseFloat(form.amount);

        if (isNaN(amountValue) || amountValue <= 0) {
            setError('Please enter a valid amount.');
            return;
        }

        if (amountValue > selectedDebt.amount) {
            setError(`You cannot pay more than you owe (${formatSimple(selectedDebt.amount, currencyCode)}).`);
            return;
        }

        const newSettlement = {
            groupId: currentGroupId,
            paidBy: currentUser.id,
            payerName: currentUser.name,
            paidTo: selectedDebt.toMemberId,
            payeeName: selectedDebt.toMemberName,
            amount: amountValue,
            date: Date.now(),
            paymentMethod: form.paymentMethod || 'Cash',
            trxId: form.trxId ? form.trxId.trim() : null
        };

        LocalDatabase.addSettlement(newSettlement);

        if (isTursoConfigured) {
            try {
                await tursoAddSettlement(newSettlement);
            } catch (err) {
                console.warn("Turso settlement sync error:", err.message);
            }
        }

        onSuccess();
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '440px' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.25rem' }}>🇧🇩</span>
                      <h2>Settle Up</h2>
                    </div>
                    <button type="button" className="btn-icon" onClick={onClose} style={{width: '32px', height: '32px'}}>
                        <i className="ph ph-x"></i>
                    </button>
                </div>
                
                {myDebts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 20px' }}>
                        <div className="stat-icon green" style={{ margin: '0 auto 16px', width: '64px', height: '64px', fontSize: '32px' }}>
                            <i className="ph ph-check-circle"></i>
                        </div>
                        <h3>You're all settled up!</h3>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>You don't owe anyone right now.</p>
                        <button type="button" className="btn-primary" onClick={onClose} style={{ width: '100%', marginTop: '24px', justifyContent: 'center' }}>
                            Awesome
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="modal-form">
                        {error && <div className="error-message">{error}</div>}

                        {/* Who to pay */}
                        <div className="form-group">
                            <label>Who are you paying?</label>
                            <CustomSelect 
                              value={form.debtIndex}
                              onChange={idx => {
                                const numIdx = Number(idx);
                                setForm(prev => ({
                                  ...prev,
                                  debtIndex: numIdx,
                                  amount: myDebts[numIdx].amount
                                }));
                              }}
                              options={myDebts.map((d, index) => ({
                                value: index,
                                label: d.toMemberName,
                                sublabel: `(You owe ${formatSimple(d.amount, currencyCode)})`,
                                icon: 'ph-user'
                              }))}
                              placeholder="Select who to pay"
                            />
                        </div>

                        {/* Payee MFS Info Box (Bangladesh Magic) */}
                        <div style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          marginBottom: '16px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              Recipient's Payment Handles
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowQr(!showQr)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--accent-primary)',
                                fontSize: '0.78rem',
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
                                value={`bKash/Nagad Pay: ${payeeBkash || payeeNagad || selectedDebt?.toMemberName} - Amount: ${form.amount}`}
                                size={140}
                                level="M"
                              />
                              <p style={{ margin: '6px 0 0', color: '#333333', fontSize: '0.72rem' }}>
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
                                  style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                >
                                  {copiedField === 'bkash' ? '✓ Copied' : 'Copy'}
                                </button>
                              ) : (
                                <a 
                                  href="tel:*247%23" 
                                  style={{ fontSize: '0.75rem', color: '#E2136E', textDecoration: 'none', fontWeight: 600 }}
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
                                  style={{ padding: '3px 8px', fontSize: '0.75rem' }}
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
                                  style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                >
                                  {copiedField === 'rocket' ? '✓ Copied' : 'Copy'}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Quick API Checkout Trigger */}
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)', display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setMfsGatewayProvider('BKASH');
                                setIsMfsGatewayOpen(true);
                              }}
                              style={{
                                flex: 1,
                                padding: '8px 10px',
                                background: '#E2136E',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <i className="ph ph-lightning"></i>
                              <span>bKash Checkout API</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMfsGatewayProvider('NAGAD');
                                setIsMfsGatewayOpen(true);
                              }}
                              style={{
                                flex: 1,
                                padding: '8px 10px',
                                background: '#F7941D',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <i className="ph ph-wallet"></i>
                              <span>Nagad Gateway</span>
                            </button>
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label>Amount</label>
                              <button
                                type="button"
                                onClick={() => handleCopy(String(form.amount), 'amount')}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--accent-primary)',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer'
                                }}
                              >
                                {copiedField === 'amount' ? '✓ Copied Amount' : 'Copy Amount'}
                              </button>
                            </div>
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
                                onChange={e => {
                                    const val = e.target.value.replace(/[+\-eE]/g, '');
                                    setForm(prev => ({ ...prev, amount: val }));
                                }} 
                                required
                            />
                        </div>

                        {/* Payment Method */}
                        <div className="form-group">
                            <label>Payment Method</label>
                            <CustomSelect 
                              value={form.paymentMethod}
                              onChange={val => setForm(prev => ({ ...prev, paymentMethod: val }))}
                              options={[
                                { value: 'bKash', label: 'bKash (বিকাশ)', icon: '🌸' },
                                { value: 'Nagad', label: 'Nagad (নগদ)', icon: '🟠' },
                                { value: 'Rocket', label: 'Rocket (রকেট)', icon: '🟣' },
                                { value: 'Upay', label: 'Upay (উপায়)', icon: '🟢' },
                                { value: 'Cash', label: 'Cash', icon: '💵' },
                                { value: 'Bank Transfer', label: 'Bank / CellFin Transfer', icon: '🏦' },
                                { value: 'Google Pay / UPI', label: 'Google Pay / UPI', icon: '⚡' },
                                { value: 'Card', label: 'Debit / Credit Card', icon: '💳' }
                              ]}
                              placeholder="Select payment method"
                            />
                        </div>

                        {/* TrxID (Transaction ID) */}
                        <div className="form-group">
                          <label>Transaction ID (TrxID) <span style={{ color: 'var(--text-tertiary)', fontWeight: 'normal' }}>(Optional)</span></label>
                          <input 
                            type="text"
                            placeholder="e.g. BL9A82XJ1 or Trx receipt"
                            value={form.trxId}
                            onChange={e => setForm(prev => ({ ...prev, trxId: e.target.value }))}
                          />
                        </div>

                        <div className="modal-footer" style={{ marginTop: '20px' }}>
                            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn-primary" style={{ background: 'var(--success)', boxShadow: '0 4px 15px rgba(0, 184, 148, 0.3)' }}>
                                Settle {formatSimple(Number(form.amount || 0), currencyCode)}
                            </button>
                        </div>
                    </form>
                )}

                {/* Interactive bKash / Nagad Gateway Modal */}
                <MfsCheckoutModal 
                  isOpen={isMfsGatewayOpen}
                  onClose={() => setIsMfsGatewayOpen(false)}
                  onPaymentSuccess={handleMfsGatewaySuccess}
                  amount={form.amount}
                  currencyCode={currencyCode}
                  initialProvider={mfsGatewayProvider}
                  payeeName={selectedDebt?.toMemberName}
                  payerUser={currentUser}
                />
            </div>
        </div>
    );
}
