// User and Authentication Types
export interface User {
  id: number
  username: string
  email: string
  role: string
  is_active: boolean
  can_access_intraday_trading: boolean
  created_at: string
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

// Scheduled Task Types
export interface ScheduledTaskCreate {
  task_name: string
  ticker: string
  analysts: string[]
  research_depth: number
  llm_provider: string
  backend_url: string
  shallow_thinker: string
  deep_thinker: string
  is_public: boolean
  execution_cycle: 'daily' | 'weekly' | 'every_n_days' | 'workdays'
  execution_time: string
  interval_days?: number
  day_of_week?: string
  end_date?: string
}

export interface ScheduledTask {
  id: number
  user_id: number
  task_name: string
  ticker: string
  market?: string
  analysts: string[]
  research_depth: number
  llm_provider: string
  shallow_thinker: string
  deep_thinker: string
  backend_url: string
  is_public: boolean
  execution_cycle: string
  execution_time: string
  interval_days?: number
  day_of_week?: string
  end_date?: string
  is_enabled: boolean
  status: 'pending' | 'completed'
  next_run_time?: string
  last_run_time?: string
  total_executions: number
  created_at: string
  updated_at?: string
}

export interface ScheduledTaskUpdate {
  is_enabled?: boolean
  task_name?: string
}

export interface ScheduledTaskListResponse {
  items: ScheduledTask[]
  total: number
  page: number
  limit: number
  has_next: boolean
  has_prev: boolean
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