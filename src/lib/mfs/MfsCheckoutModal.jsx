import React, { useState } from 'react';
import { bkashCreatePayment, bkashExecutePayment } from './bkash';
import { nagadInitPayment, nagadVerifyPayment } from './nagad';
import { formatSimple } from '../CurrencyManager';
import './MfsCheckoutModal.css';

export default function MfsCheckoutModal({ 
  isOpen, 
  onClose, 
  onPaymentSuccess, 
  amount = 0, 
  currencyCode = 'BDT', 
  initialProvider = 'BKASH',
  payeeName = 'Member',
  payerUser = null
}) {
  const [provider, setProvider] = useState(initialProvider); // 'BKASH' | 'NAGAD'
  const [step, setStep] = useState(1); // 1: Wallet Number, 2: OTP, 3: PIN, 4: Success
  const [walletNumber, setWalletNumber] = useState(payerUser?.bkashNumber || '01700000000');
  const [otp, setOtp] = useState('123456');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);

  if (!isOpen) return null;

  const isBkash = provider === 'BKASH';
  const themeClass = isBkash ? 'bkash' : 'nagad';
  const brandName = isBkash ? 'bKash' : 'Nagad';

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanNum = walletNumber.trim();
    if (!/^01[3-9]\d{8}$/.test(cleanNum)) {
      setError('Please enter a valid 11-digit Bangladeshi mobile number (01XXXXXXXXX).');
      return;
    }

    setLoading(true);
    try {
      if (isBkash) {
        await bkashCreatePayment({ amount, invoiceNumber: `INV_${Date.now()}` });
      } else {
        await nagadInitPayment({ amount, orderId: `NG_${Date.now()}` });
      }
      setStep(2); // Go to OTP
    } catch (err) {
      setError(err.message || 'Payment initiation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = (e) => {
    e.preventDefault();
    setError('');
    if (!otp || otp.length < 4) {
      setError('Please enter the 4-6 digit verification code (OTP).');
      return;
    }
    setStep(3); // Go to PIN
  };

  const handleStep3Submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!pin || pin.length < 4) {
      setError('Please enter your 4-5 digit account PIN.');
      return;
    }

    setLoading(true);
    try {
      let res;
      if (isBkash) {
        res = await bkashExecutePayment(`PAY_${Date.now()}`);
      } else {
        res = await nagadVerifyPayment(`REF_${Date.now()}`);
      }

      setPaymentResult(res);
      setStep(4); // Success

      setTimeout(() => {
        onPaymentSuccess({
          provider: brandName,
          trxID: res.trxID,
          amount: Number(amount),
          date: Date.now()
        });
      }, 1500);

    } catch (err) {
      setError(err.message || 'Payment verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mfs-modal-overlay" onClick={onClose}>
      <div className={`mfs-modal-container ${themeClass}-mode`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`mfs-header ${themeClass}`}>
          <div className="mfs-brand-box">
            <div>
              <div className="mfs-brand-title">{brandName} Checkout</div>
              <div className="mfs-brand-subtitle">{brandName} Online Payment Gateway</div>
            </div>
          </div>
          <button className="mfs-close-btn" onClick={onClose} title="Cancel">
            <i className="ph ph-x"></i>
          </button>
        </div>

        {/* Invoice bar */}
        <div className="mfs-invoice-bar">
          <div>
            <span>Paying to: </span>
            <strong>{payeeName}</strong>
          </div>
          <div className="mfs-amount-tag">
            {formatSimple(amount, currencyCode)}
          </div>
        </div>

        {/* Modal Body */}
        <div className="mfs-body">
          {error && <div className="mfs-error">{error}</div>}

          {step === 1 && (
            <form onSubmit={handleStep1Submit}>
              <div className="mfs-step-indicator">
                <span className={`mfs-step-dot ${themeClass}-dot`}>1</span>
                <span>Enter Your {brandName} Account Number</span>
              </div>

              <div className="mfs-form-group">
                <label>Your {brandName} Number</label>
                <input 
                  type="tel"
                  className="mfs-input"
                  placeholder="01XXXXXXXXX"
                  value={walletNumber}
                  onChange={e => setWalletNumber(e.target.value)}
                  maxLength={11}
                  required
                  autoFocus
                />
                <div className="mfs-notice">
                  By clicking Confirm, you agree to the terms & conditions of {brandName}.
                </div>
              </div>

              <div className="mfs-footer" style={{ padding: '10px 0 0' }}>
                <button type="button" className="mfs-btn-cancel" onClick={onClose}>
                  Close
                </button>
                <button type="submit" className={`mfs-btn-submit ${themeClass}`} disabled={loading}>
                  {loading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleStep2Submit}>
              <div className="mfs-step-indicator">
                <span className={`mfs-step-dot ${themeClass}-dot`}>2</span>
                <span>Enter Verification Code</span>
              </div>

              <div className="mfs-form-group">
                <label>Verification Code (OTP)</label>
                <input 
                  type="text"
                  className="mfs-input"
                  placeholder="123456"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  maxLength={6}
                  required
                  autoFocus
                />
                <div className="mfs-notice">
                  A verification code was sent to {walletNumber} (Sandbox test code: 123456).
                </div>
              </div>

              <div className="mfs-footer" style={{ padding: '10px 0 0' }}>
                <button type="button" className="mfs-btn-cancel" onClick={() => setStep(1)}>
                  Back
                </button>
                <button type="submit" className={`mfs-btn-submit ${themeClass}`}>
                  Verify OTP
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleStep3Submit}>
              <div className="mfs-step-indicator">
                <span className={`mfs-step-dot ${themeClass}-dot`}>3</span>
                <span>Enter {brandName} PIN</span>
              </div>

              <div className="mfs-form-group">
                <label>Account PIN</label>
                <input 
                  type="password"
                  className="mfs-input"
                  placeholder="•••••"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  maxLength={5}
                  required
                  autoFocus
                />
                <div className="mfs-notice">
                  Enter your secret PIN (Sandbox test PIN: 12345).
                </div>
              </div>

              <div className="mfs-footer" style={{ padding: '10px 0 0' }}>
                <button type="button" className="mfs-btn-cancel" onClick={() => setStep(2)}>
                  Back
                </button>
                <button type="submit" className={`mfs-btn-submit ${themeClass}`} disabled={loading}>
                  {loading ? 'Executing...' : 'Pay Now'}
                </button>
              </div>
            </form>
          )}

          {step === 4 && paymentResult && (
            <div className="mfs-success-box">
              <div className="mfs-success-icon">
                <i className="ph ph-check"></i>
              </div>
              <h3 style={{ margin: '0 0 6px', color: '#0ca678' }}>Payment Successful!</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#495057' }}>
                {formatSimple(amount, currencyCode)} paid via {brandName}
              </p>
              <div className="mfs-trx-badge">
                TrxID: {paymentResult.trxID}
              </div>
              <p style={{ fontSize: '0.78rem', color: '#868e96', margin: '4px 0 0' }}>
                Auto-settling balance in SplitUP...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
