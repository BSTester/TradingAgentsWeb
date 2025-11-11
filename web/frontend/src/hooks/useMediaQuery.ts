'use client';

import { useState, useEffect } from 'react';

export interface MediaQueryOptions {
  query: string;
  defaultValue?: boolean;
}

/**
 * Custom hook for detecting media query matches
 * @param query - CSS media query string (e.g., '(min-width: 768px)')
 * @param defaultValue - Default value for SSR (default: false)
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: string, defaultValue: boolean = false): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    // Server-side rendering fallback
    if (typeof window === 'undefined') {
      return defaultValue;
    }
    
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    
    // Set initial value
    setMatches(mediaQuery.matches);

    // Create event listener
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener (use addEventListener for better browser support)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        // Fallback for older browsers
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [query]);

  return matches;
}

// Convenience hooks for common breakpoints
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)', false);
}

export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)', false);
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)', true);
}

export function useIsLandscape(): boolean {
  return useMediaQuery('(orientation: landscape)', true);
}

export function useIsPortrait(): boolean {
  return useMediaQuery('(orientation: portrait)', false);
}
