// User and Authentication Types
export interface User {
  id: number
  username: string
  email: string
  created_at: string
  is_active: boolean
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

// Analysis Types
export interface AnalysisRequest {
  ticker: string
  analysis_date: string
  analysts: string[]
  research_depth: number
  llm_provider: string
  shallow_thinker: string
  deep_thinker: string
  backend_url: string
  openai_api_key?: string
  anthropic_api_key?: string
  google_api_key?: string
  openrouter_api_key?: string
}

export interface AnalysisResponse {
  analysis_id: string
  status: string
}

export interface AnalysisStatus {
  analysis_id: string
  status: 'queued' | 'initializing' | 'running' | 'completed' | 'error'
  current_step?: string
  progress_percentage: number
  started_at?: string
  updated_at: string
}

export interface AnalysisResults {
  analysis_id: string
  ticker: string
  analysis_date: string
  status: string
  trading_decision?: string
  market_analysis?: string
  sentiment_analysis?: string
  news_analysis?: string
  fundamentals_analysis?: string
  risk_assessment?: string
  final_state?: any
  created_at: string
  completed_at?: string
}

export interface AnalysisRecord {
  id: string
  ticker: string
  analysis_date: string
  status: string
  progress_percentage: number
  created_at: string
  updated_at: string
  completed_at?: string
}

export interface AnalysisListResponse {
  analyses: AnalysisRecord[]
  total: number
  page: number
  limit: number
  has_next: boolean
  has_prev: boolean
}

// Configuration Types
export interface AnalystOption {
  value: string
  label: string
  description: string
}

export interface ResearchDepthOption {
  value: number
  label: string
  description: string
}

export interface LLMProviderOption {
  value: string
  label: string
  url: string
}

export interface ModelOption {
  value: string
  label: string
}

export interface ConfigResponse {
  analysts: AnalystOption[]
  research_depths: ResearchDepthOption[]
  llm_providers: LLMProviderOption[]
  models: {
    [provider: string]: {
      shallow: ModelOption[]
      deep: ModelOption[]
    }
  }
}

// WebSocket Types
export interface LogEntry {
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'debug'
  message: string
  agent?: string
  step?: string
  progress?: number
}

export interface WebSocketMessage {
  type: 'log' | 'progress' | 'status' | 'error' | 'complete' | 'auth' | 'ping' | 'pong'
  timestamp: string
  data?: any
}

// Export Types
export interface ExportRequest {
  format: 'A4' | 'Letter'
  include_charts: boolean
  include_raw_data: boolean
}

export interface ExportResponse {
  download_url: string
  expires_at: string
  file_size?: number
}

export interface MarkdownReport {
  content: string
  sections: {
    [key: string]: string
  }
  metadata: {
    [key: string]: any
  }
}

// UI Types
export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  duration?: number
}

// API Types
export interface ApiError {
  detail: string
  type?: string
}

export interface ApiResponse<T = any> {
  data?: T
  error?: ApiError
  status: number
}