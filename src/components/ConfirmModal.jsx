import React, { useState, createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './ConfirmModal.css';

const ConfirmContext = createContext(null);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}

export function ConfirmProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState({
    title: 'Are you sure?',
    message: 'This action cannot be undone.',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    type: 'danger',
    icon: 'ph-trash'
  });

  const resolverRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      const type = opts.type || (opts.danger === false ? 'warning' : 'danger');
      const icon = opts.icon || (type === 'danger' ? 'ph-trash' : (type === 'warning' ? 'ph-warning' : 'ph-info'));

      setOptions({
        title: opts.title || (type === 'danger' ? 'Confirm Deletion' : 'Please Confirm'),
        message: opts.message || 'Are you sure you want to proceed? This action cannot be undone.',
        confirmText: opts.confirmText || (type === 'danger' ? 'Delete' : 'Confirm'),
        cancelText: opts.cancelText || 'Cancel',
        type,
        icon
      });
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter') {
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {isOpen && createPortal(
        <div className="confirm-modal-overlay" onClick={handleCancel}>
          <div 
            className="confirm-modal-card" 
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={`confirm-icon-box ${options.type}`}>
              <i className={`ph ${options.icon}`}></i>
            </div>

            <h3 className="confirm-title">{options.title}</h3>
            <p className="confirm-message">{options.message}</p>

            <div className="confirm-actions">
              <button 
                type="button" 
                className="confirm-btn-cancel" 
                onClick={handleCancel}
                autoFocus
              >
                {options.cancelText}
              </button>

              <button 
                type="button" 
                className={`confirm-btn-action ${options.type}`} 
                onClick={handleConfirm}
              >
                <i className={`ph ${options.icon}`}></i>
                <span>{options.confirmText}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </ConfirmContext.Provider>
  );
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  type = 'danger',
  icon
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const defaultIcon = icon || (type === 'danger' ? 'ph-trash' : (type === 'warning' ? 'ph-warning' : 'ph-info'));

  return createPortal(
    <div className="confirm-modal-overlay" onClick={onClose}>
      <div 
        className="confirm-modal-card" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={`confirm-icon-box ${type}`}>
          <i className={`ph ${defaultIcon}`}></i>
        </div>

        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>

        <div className="confirm-actions">
          <button 
            type="button" 
            className="confirm-btn-cancel" 
            onClick={onClose}
          >
            {cancelText}
          </button>

          <button 
            type="button" 
            className={`confirm-btn-action ${type}`} 
            onClick={onConfirm}
          >
            <i className={`ph ${defaultIcon}`}></i>
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
