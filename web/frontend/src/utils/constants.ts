// Application constants

export const APP_NAME = 'TradingAgents';
export const APP_VERSION = '1.0.0';

// Analysis configuration constants
export const ANALYSIS_CONFIG = {
  MAX_TICKER_LENGTH: 10,
  MIN_TICKER_LENGTH: 1,
  MAX_ANALYSIS_HISTORY_DAYS: 1825, // 5 years
  DEFAULT_RESEARCH_DEPTH: 2,
  MAX_RESEARCH_DEPTH: 3,
  MIN_RESEARCH_DEPTH: 1,
} as const;

// LLM Provider constants
export const LLM_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  OPENROUTER: 'openrouter',
  OLLAMA: 'ollama',
} as const;

// Analysis status constants
export const ANALYSIS_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ERROR: 'error',
} as const;

// WebSocket message types
export const WS_MESSAGE_TYPES = {
  LOG: 'log',
  PROGRESS: 'progress',
  STATUS: 'status',
  ERROR: 'error',
  COMPLETE: 'complete',
  AUTH: 'auth',
  PING: 'ping',
  PONG: 'pong',
} as const;

// Log levels
export const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
} as const;

// Trading actions
export const TRADING_ACTIONS = {
  BUY: 'BUY',
  SELL: 'SELL',
  HOLD: 'HOLD',
} as const;

// Form validation constants
export const VALIDATION = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9_]{3,50}$/,
  },
  PASSWORD: {
    MIN_LENGTH: 6,
    MAX_LENGTH: 128,
  },
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  TICKER: {
    PATTERN: /^[A-Za-z0-9.]{1,10}$/,
  },
} as const;

// API configuration
export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// Pagination constants
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 5,
} as const;

// File export constants
export const EXPORT = {
  PDF_FORMATS: ['A4', 'Letter'] as const,
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_FORMATS: ['pdf', 'markdown'] as const,
} as const;

// UI constants
export const UI = {
  DEBOUNCE_DELAY: 300, // milliseconds
  TOAST_DURATION: 5000, // 5 seconds
  LOADING_DELAY: 200, // milliseconds before showing loading spinner
} as const;

// Default values
export const DEFAULTS = {
  ANALYSIS_DATE: () => new Date().toISOString().split('T')[0],
  RESEARCH_DEPTH: 2,
  LLM_PROVIDER: LLM_PROVIDERS.OPENAI,
  BACKEND_URL: 'http://localhost:8000',
} as const;