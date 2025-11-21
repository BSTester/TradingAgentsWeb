// 用户相关类型定义
export interface User {
  id: number;
  username: string;
  email: string;
  role: string;  // 'admin' or 'user'
  is_active: boolean;  // Whether user account is active
  can_access_intraday_trading: boolean;  // Whether user can access intraday trading features
  has_set_password: boolean;  // Whether user has explicitly set a password
  created_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// 分析配置相关类型
export interface AnalysisConfig {
  ticker: string;
  analysis_date: string;
  analysts: string[];
  research_depth: number;
  llm_provider: string;
  api_key?: string;
  shallow_thinker?: string;
  deep_thinker?: string;
}

export interface AnalysisRequest extends AnalysisConfig {
  user_id: number;
}

// 分析状态相关类型
export interface AnalysisStatus {
  id: string;
  status: 'initializing' | 'running' | 'completed' | 'error';
  current_step?: string;
  progress?: number;
  message?: string;
}

export interface AnalysisResult {
  id: string;
  status: string;
  timestamp: string;
  request: AnalysisConfig;
  decision?: string;
  final_state?: Record<string, any>;
  error?: {
    message: string;
    details?: string;
  };
}

// 配置相关类型
export interface AppConfig {
  llm_providers: LLMProvider[];
  analysts: string[];
  research_depths: number[];
  backend_url: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  models: LLMModel[];
  requires_api_key: boolean;
  api_key_placeholder?: string;
  help_text?: string;
}

export interface LLMModel {
  id: string;
  name: string;
  description?: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 历史记录类型
export interface AnalysisHistory {
  id: string;
  ticker: string;
  analysis_date: string;
  status: string;
  timestamp: string;
  decision?: string;
}
// 定时任务
相关类型
export interface ScheduledTask {
  id: number;
  user_id: number;
  task_name: string;
  ticker: string;
  market: string;
  analysts: string[];
  research_depth: number;
  llm_provider: string;
  shallow_thinker: string;
  deep_thinker: string;
  backend_url: string;
  is_public: boolean;
  execution_cycle: 'daily' | 'weekly' | 'workdays' | 'every_n_days';
  execution_time: string;
  interval_days?: number;
  day_of_week?: string;
  end_date?: string;
  is_enabled: boolean;
  status: 'pending' | 'completed';
  scheduler_job_id: string;
  total_executions: number;
  last_run_time?: string;
  next_run_time?: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduledTaskCreate {
  task_name: string;
  ticker: string;
  analysts: string[];
  research_depth: number;
  llm_provider: string;
  backend_url: string;
  shallow_thinker: string;
  deep_thinker: string;
  is_public: boolean;
  execution_cycle: 'daily' | 'weekly' | 'workdays' | 'every_n_days';
  execution_time: string;
  interval_days?: number;
  day_of_week?: string;
  end_date?: string;
}

export interface ScheduledTaskUpdate {
  is_enabled?: boolean;
  task_name?: string;
}

export interface ScheduledTaskListResponse {
  items: ScheduledTask[];
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
  has_prev: boolean;
}
