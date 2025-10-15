// 用户相关类型定义
export interface User {
  id: number;
  username: string;
  email: string;
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