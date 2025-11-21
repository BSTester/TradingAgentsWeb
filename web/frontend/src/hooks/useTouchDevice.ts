'use client';

import { useState, useEffect } from 'react';

export interface TouchDeviceState {
  isTouch: boolean;
  hasHover: boolean;
  pointerType: 'mouse' | 'touch' | 'pen' | 'unknown';
}

/**
 * Custom hook for detecting touch device capabilities
 * @returns TouchDeviceState with device capability information
 */
export function useTouchDevice(): TouchDeviceState {
  const [state, setState] = useState<TouchDeviceState>(() => {
    // Server-side rendering fallback
    if (typeof window === 'undefined') {
      return {
        isTouch: false,
        hasHover: true,
        pointerType: 'mouse',
      };
    }

    // Initial detection
    const isTouch = 
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0;

    const hasHover = window.matchMedia('(hover: hover)').matches;

    return {
      isTouch,
      hasHover,
      pointerType: isTouch ? 'touch' : 'mouse',
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect pointer type from pointer events
    const handlePointerMove = (event: PointerEvent) => {
      const pointerType = event.pointerType as 'mouse' | 'touch' | 'pen';
      
      setState(prev => {
        if (prev.pointerType !== pointerType) {
          return {
            ...prev,
            pointerType: pointerType || 'unknown',
            isTouch: pointerType === 'touch' || pointerType === 'pen',
          };
        }
        return prev;
      });
    };

    // Listen for hover capability changes
    const hoverQuery = window.matchMedia('(hover: hover)');
    const handleHoverChange = (event: MediaQueryListEvent) => {
      setState(prev => ({
        ...prev,
        hasHover: event.matches,
      }));
    };

    // Add event listeners
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    
    if (hoverQuery.addEventListener) {
      hoverQuery.addEventListener('change', handleHoverChange);
    } else {
      // Fallback for older browsers
      hoverQuery.addListener(handleHoverChange);
    }

    // Cleanup
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      
      if (hoverQuery.removeEventListener) {
        hoverQuery.removeEventListener('change', handleHoverChange);
      } else {
        // Fallback for older browsers
        hoverQuery.removeListener(handleHoverChange);
      }
    };
  }, []);

  return state;
}

/**
 * Simple hook to check if device supports touch
 */
export function useIsTouch(): boolean {
  const { isTouch } = useTouchDevice();
  return isTouch;
}

/**
 * Simple hook to check if device supports hover
 */
export function useHasHover(): boolean {
  const { hasHover } = useTouchDevice();
  return hasHover;
}
