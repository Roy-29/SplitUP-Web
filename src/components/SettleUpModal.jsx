import React, { useState } from 'react';
import { LocalDatabase } from '../store/db';
import { isTursoConfigured, tursoAddSettlement } from '../lib/turso';

export default function SettleUpModal({ isOpen, onClose, onSuccess, currentGroupId, currentUser, suggestedDebts = [] }) {
    const myDebts = (suggestedDebts || []).filter(d => d.fromMemberId === currentUser?.id);

    const [form, setForm] = useState({
        debtIndex: 0,
        amount: myDebts.length > 0 ? myDebts[0].amount : ''
    });
    
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (myDebts.length === 0) {
            onClose();
            return;
        }

        const selectedDebt = myDebts[form.debtIndex] || myDebts[0];
        const amountValue = parseFloat(form.amount);

        if (isNaN(amountValue) || amountValue <= 0) {
            setError('Please enter a valid amount.');
            return;
        }

        if (amountValue > selectedDebt.amount) {
            setError(`You cannot pay more than you owe ($${selectedDebt.amount.toFixed(2)}).`);
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
            paymentMethod: 'CASH'
        };

        LocalDatabase.addSettlement(newSettlement);

        if (isTursoConfigured) {
            try {
                await tursoAddSettlement(newSettlement);
                console.log("Settlement synced to Turso database!");
            } catch (err) {
                console.warn("Turso settlement sync error:", err.message);
            }
        }

        onSuccess();
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: '400px' }}>
                <div className="modal-header">
                    <h2>Settle Up</h2>
                    <button type="button" className="btn-icon" onClick={onClose} style={{width: '32px', height: '32px'}}>
                        <i className="ph ph-x"></i>
                    </button>
                </div>
                
                {myDebts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
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

                        <div className="form-group">
                            <label>Who are you paying?</label>
                            <select 
                                value={form.debtIndex}
                                onChange={e => {
                                    const idx = Number(e.target.value);
                                    setForm({
                                        debtIndex: idx, 
                                        amount: myDebts[idx].amount
                                    });
                                }}
                            >
                                {myDebts.map((d, index) => (
                                    <option key={index} value={index}>
                                        {d.toMemberName} (You owe ${d.amount.toFixed(2)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Amount ($)</label>
                            <input 
                                type="number" 
                                step="0.01"
                                value={form.amount} 
                                onChange={e => setForm({...form, amount: e.target.value})} 
                            />
                        </div>

                        <div className="form-group">
                            <label>Payment Method</label>
                            <select defaultValue="CASH">
                                <option value="CASH">Cash</option>
                                <option value="VENMO">Venmo</option>
                                <option value="PAYPAL">PayPal</option>
                                <option value="BANK_TRANSFER">Bank Transfer</option>
                            </select>
                        </div>

                        <div className="modal-footer" style={{ marginTop: '24px' }}>
                            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn-primary" style={{ background: 'var(--success)', boxShadow: '0 4px 15px rgba(0, 184, 148, 0.3)' }}>
                                Settle ${Number(form.amount || 0).toFixed(2)}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
