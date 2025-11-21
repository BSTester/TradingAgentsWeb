'use client';

import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type, isVisible, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'fas fa-check-circle';
      case 'error':
        return 'fas fa-times-circle';
      case 'warning':
        return 'fas fa-exclamation-triangle';
      case 'info':
      default:
        return 'fas fa-info-circle';
    }
  };

  const getTypeClass = () => {
    switch (type) {
      case 'success':
        return 'text-success-500 bg-success-500/10 border-success-500/30';
      case 'error':
        return 'text-danger-500 bg-danger-500/10 border-danger-500/30';
      case 'warning':
        return 'text-warning-500 bg-warning-500/10 border-warning-500/30';
      case 'info':
      default:
        return 'text-accent-primary bg-accent-primary/10 border-accent-primary/30';
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div
        className={`max-w-md w-full min-w-80 border rounded-xl p-5 shadow-glow-cyan backdrop-blur-lg bg-dark-secondary/90 transform transition-all duration-300 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        } ${getTypeClass()}`}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <i className={`${getIcon()} text-xl`} />
          </div>
          <div className="ml-4 w-0 flex-1">
            <p className="text-base font-medium leading-6">{message}</p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              className="inline-flex text-text-tertiary hover:text-text-primary focus:outline-none p-1 transition-colors"
              onClick={onClose}
            >
              <i className="fas fa-times text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Toast Hook
interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  isVisible: boolean;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    message: '',
    type: 'info',
    isVisible: false,
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({
      message,
      type,
      isVisible: true,
    });
  };

  const hideToast = () => {
    setToast(prev => ({
      ...prev,
      isVisible: false,
    }));
  };

  return {
    toast,
    showToast,
    hideToast,
  };
}
