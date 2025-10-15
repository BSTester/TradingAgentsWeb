'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { getAuthToken } from '@/utils/api';

// Token refresh interval (25 minutes - 5 minutes before expiry)
const REFRESH_INTERVAL = 25 * 60 * 1000;

export function useTokenRefresh() {
  const { refreshToken, logout, isAuthenticated } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Function to handle token refresh
    const handleRefresh = async () => {
      const token = getAuthToken();
      if (!token) {
        await logout();
        return;
      }

      try {
        // Check if token is close to expiry
        const parts = token.split('.');
        if (parts.length !== 3 || !parts[1]) {
          await logout();
          return;
        }
        
        const payload = JSON.parse(atob(parts[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = payload.exp - currentTime;

        // If token expires in less than 5 minutes, refresh it
        if (timeUntilExpiry < 5 * 60) {
          const success = await refreshToken();
          if (!success) {
            await logout();
          }
        }
      } catch {
        // Invalid token format, logout
        await logout();
      }
    };

    // Initial check
    handleRefresh();

    // Set up periodic refresh
    intervalRef.current = setInterval(handleRefresh, REFRESH_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, refreshToken, logout]);

  // Also refresh on window focus (user returns to tab)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleFocus = async () => {
      const token = getAuthToken();
      if (!token) {
        await logout();
        return;
      }

      try {
        const parts = token.split('.');
        if (parts.length !== 3 || !parts[1]) {
          await logout();
          return;
        }
        
        const payload = JSON.parse(atob(parts[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        
        // If token is expired, logout
        if (payload.exp <= currentTime) {
          await logout();
          return;
        }

        // If token expires soon, refresh it
        const timeUntilExpiry = payload.exp - currentTime;
        if (timeUntilExpiry < 10 * 60) { // 10 minutes
          await refreshToken();
        }
      } catch {
        await logout();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isAuthenticated, refreshToken, logout]);
}