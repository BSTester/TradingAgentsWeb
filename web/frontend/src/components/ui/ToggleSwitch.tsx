'use client';

import React from 'react';

interface ToggleSwitchProps {
  enabled: boolean;
  disabled?: boolean;
  loading?: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ToggleSwitch({
  enabled,
  disabled = false,
  loading = false,
  onChange,
  label,
  size = 'md',
}: ToggleSwitchProps) {
  const handleClick = () => {
    if (!disabled && !loading) {
      onChange(!enabled);
    }
  };

  // Size classes
  const sizeClasses = {
    sm: {
      container: 'w-9 h-5',
      slider: 'w-4 h-4',
      translate: 'translate-x-4',
    },
    md: {
      container: 'w-11 h-6',
      slider: 'w-5 h-5',
      translate: 'translate-x-5',
    },
    lg: {
      container: 'w-14 h-7',
      slider: 'w-6 h-6',
      translate: 'translate-x-7',
    },
  };

  const currentSize = sizeClasses[size];

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className={`
          relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-primary
          ${currentSize.container}
          ${
            disabled || loading
              ? 'opacity-50 cursor-not-allowed bg-gray-400'
              : enabled
              ? 'bg-[#00a870] hover:bg-[#008c5e]'
              : 'bg-gray-600 hover:bg-gray-500'
          }
        `}
        aria-pressed={enabled}
        aria-label={label || 'Toggle switch'}
      >
        <span
          className={`
            inline-block rounded-full bg-white shadow-lg transform transition-transform duration-200 ease-in-out
            ${currentSize.slider}
            ${enabled ? currentSize.translate : 'translate-x-0.5'}
          `}
        >
          {loading && (
            <span className="flex items-center justify-center w-full h-full">
              <i className="fas fa-spinner fa-spin text-xs text-gray-600" />
            </span>
          )}
        </span>
      </button>
      {label && (
        <span className="text-sm text-text-secondary select-none">{label}</span>
      )}
    </div>
  );
}
