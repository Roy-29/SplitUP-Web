import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { isTursoConfigured, tursoAddPersonalTopic } from '../lib/turso';
import { LocalDatabase } from '../store/db';
import './Modal.css';

const TOPIC_ICONS = [
  { id: 'ph-island', name: 'Tour / Travel' },
  { id: 'ph-shopping-cart', name: 'Groceries' },
  { id: 'ph-house', name: 'Home / Living' },
  { id: 'ph-bag', name: 'Shopping / Clothes' },
  { id: 'ph-laptop', name: 'Tech / Work' },
  { id: 'ph-first-aid', name: 'Medical / Health' },
  { id: 'ph-fork-knife', name: 'Food / Dining' },
  { id: 'ph-graduation-cap', name: 'Education / Learning' },
  { id: 'ph-car', name: 'Transport / Commute' },
  { id: 'ph-gift', name: 'Gifts / Festival' },
  { id: 'ph-wrench', name: 'Repair / Maintenance' },
  { id: 'ph-folder-simple', name: 'General Subject' }
];

const TOPIC_COLORS = [
  '#6c5ce7', // Purple
  '#00b894', // Green
  '#0984e3', // Blue
  '#e84393', // Pink
  '#e17055', // Orange
  '#fdcb6e', // Amber
  '#d63031', // Crimson
  '#00cec9'  // Turquoise
];

export default function NewTopicModal({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  currencyCode = 'BDT'
}) {
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('ph-folder-simple');
  const [selectedColor, setSelectedColor] = useState('#6c5ce7');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please provide a subject/topic name (e.g. "Cox\'s Bazar Tour" or "Monthly Grocery").');
      return;
    }

    const budgetNum = budget ? parseFloat(budget) : 0;
    if (budget && (isNaN(budgetNum) || budgetNum < 0)) {
      setError('Please enter a valid target budget or leave it empty.');
      return;
    }

    setIsSubmitting(true);

    const newTopic = {
      userId: currentUser?.id,
      name: trimmedName,
      description: description.trim(),
      budget: budgetNum,
      icon: selectedIcon,
      color: selectedColor,
      createdAt: Date.now()
    };

    try {
      if (isTursoConfigured) {
        await tursoAddPersonalTopic(newTopic);
      } else {
        LocalDatabase.addPersonalTopic(newTopic);
      }
      setName('');
      setBudget('');
      setDescription('');
      setIsSubmitting(false);
      onSuccess?.(newTopic);
      onClose();
    } catch (err) {
      console.error("Failed to create topic:", err);
      setError(err.message || 'Failed to create topic.');
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content glass-panel animate-fade-in" 
        style={{ maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.3rem', margin: '0 0 4px 0' }}>New Subject / Topic</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              গ্রুপ বা ইভেন্টভিত্তিক ব্যক্তিগত খরচ ট্র্যাক করুন
            </p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} style={{ width: '32px', height: '32px' }}>
            <i className="ph ph-x"></i>
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(214, 48, 49, 0.15)',
            border: '1px solid rgba(214, 48, 49, 0.3)',
            color: '#ff7675',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Subject Name */}
          <div className="form-group">
            <label style={{ fontSize: '0.88rem', fontWeight: 600 }}>
              Subject / Topic Name <span style={{ color: 'var(--accent-primary)' }}>*</span>
            </label>
            <input 
              type="text" 
              placeholder='e.g., "Tour to Cox&apos;s Bazar", "Monthly Grocery", "Eid Shopping"'
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Budget Limit */}
          <div className="form-group">
            <label style={{ fontSize: '0.88rem', fontWeight: 600 }}>
              Target Budget ({currencyCode}) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
            </label>
            <input 
              type="number" 
              placeholder="e.g., 10000"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              min="0"
              step="any"
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label style={{ fontSize: '0.88rem', fontWeight: 600 }}>
              Description / Notes <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
            </label>
            <input 
              type="text" 
              placeholder="e.g., 3-day beach trip with family"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Icon Selector */}
          <div className="form-group">
            <label style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '6px' }}>Choose an Icon</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
              {TOPIC_ICONS.map(ic => {
                const isSelected = selectedIcon === ic.id;
                return (
                  <button
                    key={ic.id}
                    type="button"
                    onClick={() => setSelectedIcon(ic.id)}
                    style={{
                      height: '42px',
                      borderRadius: '10px',
                      background: isSelected ? 'rgba(108, 92, 231, 0.25)' : 'var(--bg-tertiary)',
                      border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title={ic.name}
                  >
                    <i className={`ph ${ic.id}`}></i>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Selector */}
          <div className="form-group">
            <label style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '6px' }}>Choose Theme Color</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {TOPIC_COLORS.map(c => {
                const isSelected = selectedColor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: c,
                      border: isSelected ? '3px solid #fff' : '2px solid transparent',
                      boxShadow: isSelected ? `0 0 0 2px ${c}` : 'none',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease',
                      transform: isSelected ? 'scale(1.15)' : 'scale(1)'
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '12px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <i className="ph ph-spinner ph-spin"></i> Creating...
                </>
              ) : (
                <>
                  <i className="ph ph-plus"></i> Create Subject
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
