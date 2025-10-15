import axios from 'axios';
import { ApiResponse } from '@/types';

// API base URL - will be configured via environment variables
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');

// API endpoints
export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    REFRESH: '/api/auth/refresh',
    ME: '/api/auth/me',
  },
  // Analysis
  ANALYSIS: {
    START: '/api/analyze',
    LIST: '/api/analyses',
    STATUS: (id: string) => `/api/analysis/${id}/status`,
    RESULTS: (id: string) => `/api/analysis/${id}/results`,
    MARKDOWN: (id: string) => `/api/analysis/${id}/markdown`,
    EXPORT_PDF: (id: string) => `/api/analysis/${id}/export/pdf`,
  },
  // Configuration
  CONFIG: '/api/config',
  // WebSocket
  WS: {
    ANALYSIS: (id: string) => `/ws/analysis/${id}`,
  },
} as const;

// HTTP client configuration
export const HTTP_CONFIG = {
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
};

// Token management
export const TOKEN_KEY = 'trading_agents_token';

export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const setAuthToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeAuthToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
};

// Auth headers helper
export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// API response handler
export const handleApiResponse = <T>(response: Response): Promise<ApiResponse<T>> => {
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// Error handler
export const handleApiError = <T = unknown>(error: unknown): ApiResponse<T> => {
  if (axios.isAxiosError(error)) {
    return {
      error: {
        detail: error.response?.data?.detail || error.message,
        type: error.response?.data?.type
      },
      status: error.response?.status || 500
    };
  }
  if (error instanceof Error) {
    return {
      error: { detail: error.message },
      status: 500
    };
  }
  return {
    error: { detail: 'An unknown error occurred' },
    status: 500
  };
};

// Build full API URL
export const buildApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};

// WebSocket URL builder
export const buildWebSocketUrl = (endpoint: string): string => {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
  const wsProtocol = base.startsWith('https') ? 'wss' : 'ws';
  const wsBase = base.replace(/^https?/i, wsProtocol);
  return `${wsBase}${endpoint}`;
};