import React, { useState, useRef, useEffect } from 'react';
import './CustomSelect.css';

export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  disabled = false,
  className = '',
  id = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && menuRef.current) {
      const items = menuRef.current.querySelectorAll('.custom-select-option');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      const idx = options.findIndex(opt => String(opt.value) === String(value));
      setHighlightedIndex(idx >= 0 ? idx : 0);
    }
  };

  const handleSelect = (option) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        setIsOpen(true);
        const idx = options.findIndex(opt => String(opt.value) === String(value));
        setHighlightedIndex(idx >= 0 ? idx : 0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightedIndex >= 0 && options[highlightedIndex]) {
          handleSelect(options[highlightedIndex]);
        }
        break;
      case 'Escape':
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div 
      className={`custom-select-container ${isOpen ? 'is-open' : ''} ${className}`}
      ref={containerRef}
      id={id}
    >
      <button
        type="button"
        className="custom-select-trigger"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="custom-select-value">
          {selectedOption ? (
            <>
              {selectedOption.icon && (
                <span className="custom-select-icon">
                  {typeof selectedOption.icon === 'string' && selectedOption.icon.startsWith('ph-') ? (
                    <i className={`ph ${selectedOption.icon}`}></i>
                  ) : (
                    selectedOption.icon
                  )}
                </span>
              )}
              <span className="custom-select-option-label">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="custom-select-option-sublabel">{selectedOption.sublabel}</span>
              )}
            </>
          ) : (
            <span className="custom-select-placeholder">{placeholder}</span>
          )}
        </div>
        <i className="ph ph-caret-down custom-select-arrow"></i>
      </button>

      {isOpen && (
        <div className="custom-select-menu" ref={menuRef} role="listbox">
          {options.map((option, idx) => {
            const isSelected = String(option.value) === String(value);
            const isHighlighted = idx === highlightedIndex;

            return (
              <div
                key={option.value || idx}
                className={`custom-select-option ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                role="option"
                aria-selected={isSelected}
              >
                <div className="custom-select-option-content">
                  {option.icon && (
                    <span className="custom-select-icon">
                      {typeof option.icon === 'string' && option.icon.startsWith('ph-') ? (
                        <i className={`ph ${option.icon}`}></i>
                      ) : (
                        option.icon
                      )}
                    </span>
                  )}
                  <span className="custom-select-option-label">{option.label}</span>
                  {option.sublabel && (
                    <span className="custom-select-option-sublabel">{option.sublabel}</span>
                  )}
                </div>
                {isSelected && (
                  <i className="ph ph-check custom-select-check"></i>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
