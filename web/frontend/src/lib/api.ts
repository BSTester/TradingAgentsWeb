/**
 * API client for TradingAgents backend
 */

import { API_BASE_URL, buildApiUrl, buildWebSocketUrl } from '@/utils/api';

// Get auth token from localStorage
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
};

// API request wrapper with auth
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(buildApiUrl(endpoint), {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Handle unauthorized: clear auth and redirect to login
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('access_token');
          // Clear cookie used by middleware
          document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
          
          // Only redirect to login if not on a public page
          const publicPages = ['/', '/login', '/register', '/auth'];
          const currentPath = window.location.pathname;
          if (!publicPages.includes(currentPath) && !currentPath.startsWith('/analysis/')) {
            // Redirect to login page
            window.location.href = '/login';
          }
        } catch {}
      }
      throw new Error('无法验证凭据');
    }

    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// Auth APIs
export const authAPI = {
  register: (data: { username: string; email: string; password: string; turnstile_token?: string }) =>
    apiRequest<{ access_token: string; token_type: string; user: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { username: string; password: string; turnstile_token?: string }) =>
    apiRequest<{ access_token: string; token_type: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCurrentUser: () => apiRequest<any>('/api/auth/me'),
};

// Analysis APIs
export const analysisAPI = {
  // Get configuration options (requires authentication)
  getConfig: () => apiRequest<any>('/api/config'),

  // Validate API key (requires authentication)
  validateKey: (data: { provider: string; api_key: string }) =>
    apiRequest<{ valid: boolean; message: string }>('/api/validate-key', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Start new analysis
  startAnalysis: (data: {
    ticker: string;
    analysis_date: string;
    analysts: string[];
    research_depth: number;
    llm_provider: string;
    backend_url: string;
    shallow_thinker: string;
    deep_thinker: string;
    api_key?: string;
    openai_api_key?: string;
    anthropic_api_key?: string;
    google_api_key?: string;
    openrouter_api_key?: string;
  }) =>
    apiRequest<{ analysis_id: string; status: string }>('/api/analyze', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Get analysis status
  getStatus: (analysisId: string) =>
    apiRequest<{
      analysis_id: string;
      status: string;
      current_step: string | null;
      progress_percentage: number;
      started_at: string | null;
      updated_at: string | null;
    }>(`/api/analysis/${analysisId}/status`),

  // Get analysis results
  getResults: (analysisId: string) =>
    apiRequest<any>(`/api/analysis/${analysisId}/results`),

  // Get analysis markdown
  getMarkdown: (analysisId: string) =>
    apiRequest<{
      content: string;
      sections: any;
      metadata: any;
    }>(`/api/analysis/${analysisId}/markdown`),

  // List analyses
  listAnalyses: (params?: {
    page?: number;
    limit?: number;
    status_filter?: string;
    ticker_filter?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status_filter) queryParams.append('status_filter', params.status_filter);
    if (params?.ticker_filter) queryParams.append('ticker_filter', params.ticker_filter);

    return apiRequest<{
      analyses: any[];
      total: number;
      page: number;
      limit: number;
      has_next: boolean;
    }>(`/api/analyses?${queryParams.toString()}`);
  },

  // Export analysis
  exportPDF: (analysisId: string, options: any) =>
    apiRequest<{
      download_url: string;
      expires_at: string;
      file_size: number;
    }>(`/api/analysis/${analysisId}/export/pdf`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),
};

// WebSocket connection for real-time logs
export class AnalysisWebSocket {
  private ws: WebSocket | null = null;
  private analysisId: string;
  private onMessage: (data: any) => void;
  private onError: (error: Event) => void;
  private onClose: () => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(
    analysisId: string,
    onMessage: (data: any) => void,
    onError: (error: Event) => void = () => {},
    onClose: () => void = () => {}
  ) {
    this.analysisId = analysisId;
    this.onMessage = onMessage;
    this.onError = onError;
    this.onClose = onClose;
  }

  connect() {

    const baseUrl = buildWebSocketUrl(`/ws/analysis/${this.analysisId}`);
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const subprotocol = token ? `jwt.${token}` : undefined;
    this.ws = subprotocol ? new WebSocket(baseUrl, [subprotocol]) : new WebSocket(baseUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      // Send ping to keep connection alive
      this.startPingInterval();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // 过滤非当前分析的消息
        if (data && data.analysis_id && data.analysis_id !== this.analysisId) {
          console.log('Ignored WS message for different analysis_id:', data.analysis_id);
          return;
        }
        this.onMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.onError(error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      this.stopPingInterval();
      this.onClose();
      this.attemptReconnect();
    };
  }

  private pingInterval: NodeJS.Timeout | null = null;

  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  disconnect() {
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}


// Scheduled Tasks APIs

// 单个定期任务，与后端 _task_payload 对齐（/api/scheduled-tasks/ 列表/详情均返回此结构）。
export interface ScheduledTaskItem {
  id: number;
  task_name: string;
  ticker: string;
  market: string | null;
  is_enabled: boolean;
  status: string;
  execution_cycle: string;
  execution_time: string;
  interval_days: number | null;
  day_of_week: string | null;
  end_date: string | null;
  next_run: string | null;
  last_run: string | null;
  total_executions: number;
  last_report: { report_id: string | null; status: string | null; rating: number | null };
  analysts: string[];
  research_depth: number;
  created_at: string;
  updated_at: string;
}

// 列表响应：后端返回 { data: [...任务], meta: { page, limit, total, has_next } }。
export interface ScheduledTaskListResponse {
  data: ScheduledTaskItem[];
  meta: { page: number; limit: number; total: number; has_next: boolean };
}

// 全量统计响应（/api/scheduled-tasks/stats）：覆盖全部任务，不依赖当页数据。
export interface ScheduledTaskStats {
  running: number;
  paused: number;
  scheduled_today: number;
  failed: number;
  completed: number;
}

export const scheduledTasksAPI = {
  // Create a new scheduled task
  create: (data: {
    task_name: string;
    ticker: string;
    analysts: string[];
    research_depth: number;
    llm_provider: string;
    backend_url: string;
    shallow_thinker: string;
    deep_thinker: string;
    is_public: boolean;
    execution_cycle: string;
    execution_time: string;
    interval_days?: number;
    end_date?: string;
  }) =>
    apiRequest<{ data: ScheduledTaskItem }>('/api/scheduled-tasks/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // List scheduled tasks
  list: (params?: { page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    return apiRequest<ScheduledTaskListResponse>(`/api/scheduled-tasks/?${queryParams.toString()}`);
  },

  // Full-set statistics across all of the user's tasks
  stats: () =>
    apiRequest<{ data: ScheduledTaskStats }>('/api/scheduled-tasks/stats'),

  // Get a specific scheduled task
  get: (taskId: number) =>
    apiRequest<{ data: ScheduledTaskItem }>(`/api/scheduled-tasks/${taskId}`),

  // Update a scheduled task
  update: (taskId: number, data: { is_enabled?: boolean; task_name?: string }) =>
    apiRequest<{ data: ScheduledTaskItem }>(`/api/scheduled-tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Delete a scheduled task
  delete: (taskId: number) =>
    apiRequest<{
      success: boolean;
      message: string;
      task_id: number;
      task_name: string;
      task_status: string;
      scheduler_removed: boolean;
    }>(`/api/scheduled-tasks/${taskId}`, {
      method: 'DELETE',
    }),
};

// ===== TradingAgents Web 重设计 · 报告 / 订阅 / 管理 API（WS-133）=====

// 报告（公开榜单 / 我的分析 / 详情）
export const reportsAPI = {
  // 公开榜单（免登录）
  publicList: (params?: { limit?: number; market?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.append('limit', params.limit.toString());
    if (params?.market) q.append('market', params.market);
    if (params?.page) q.append('page', params.page.toString());
    return apiRequest<{ data: import('./types').ReportPreview[]; meta: any }>(
      `/api/reports/public?${q.toString()}`
    );
  },

  // 我的分析列表（登录后）
  listMine: (params?: { page?: number; limit?: number; market?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.append('page', params.page.toString());
    if (params?.limit) q.append('limit', params.limit.toString());
    if (params?.market) q.append('market', params.market);
    if (params?.status) q.append('status', params.status);
    return apiRequest<{ data: import('./types').ReportPreview[]; meta: any }>(
      `/api/reports?${q.toString()}`
    );
  },

  // 报告详情（含完整角色链）
  get: (reportId: string) =>
    apiRequest<{ data: import('./types').ReportDetail }>(`/api/reports/${reportId}`),

  // 一键切换公开状态
  setPublic: (reportId: string, is_public: boolean) =>
    apiRequest<{ data: import('./types').ReportPreview }>(`/api/reports/${reportId}/public`, {
      method: 'POST',
      body: JSON.stringify({ is_public }),
    }),

  // 导出 PDF（带封面研报）
  exportPdf: async (reportId: string) => {
    const token = getAuthToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(buildApiUrl(`/api/reports/${reportId}/export?format=pdf`), { headers });
    if (!response.ok) throw new Error('导出失败，请稍后重试');
    return response.blob();
  },
};

// 用临时 API Key 获取某提供商的可用模型列表（自定义模型设置页用，Key 不持久化）
export const llmAPI = {
  fetchModelsTransient: (data: { base_url: string; api_key: string; provider_type?: string }) =>
    apiRequest<{ models: string[]; count: number }>('/api/llm/fetch-models', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// 订阅 / 按次
export const subscriptionAPI = {
  plans: () =>
    apiRequest<{ data: import('./types').SubscriptionPlan[] }>('/api/subscription/plans'),

  me: () =>
    apiRequest<{ data: import('./types').SubscriptionInfo }>('/api/subscription/me'),

  purchase: (planId: number) =>
    apiRequest<{ data: import('./types').SubscriptionInfo }>('/api/subscription/purchase', {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId }),
    }),
};

// 管理控制台
export const adminAPI = {
  users: (params?: { page?: number; limit?: number; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.append('page', params.page.toString());
    if (params?.limit) q.append('limit', params.limit.toString());
    if (params?.search) q.append('search', params.search);
    return apiRequest<{ data: import('./types').AdminUser[]; meta: any }>(
      `/api/admin/users?${q.toString()}`
    );
  },

  setUserActive: (userId: number, is_active: boolean) =>
    apiRequest<{ data: import('./types').AdminUser }>(`/api/admin/users/${userId}/active`, {
      method: 'POST',
      body: JSON.stringify({ is_active }),
    }),

  setUserRole: (userId: number, role: 'user' | 'admin') =>
    apiRequest<{ data: import('./types').AdminUser }>(`/api/admin/users/${userId}/role`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),

  subscriptionProducts: () =>
    apiRequest<{ data: import('./types').AdminSubscriptionPlan[] }>('/api/admin/subscription-products'),

  createSubscriptionProduct: (data: {
    name: string;
    credits: number;
    price: number;
    description?: string;
    is_active?: boolean;
  }) =>
    apiRequest<{ data: import('./types').AdminSubscriptionPlan }>('/api/admin/subscription-products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSubscriptionProduct: (
    planId: number,
    data: { name?: string; credits?: number; price?: number; description?: string; is_active?: boolean }
  ) =>
    apiRequest<{ data: import('./types').AdminSubscriptionPlan }>(
      `/api/admin/subscription-products/${planId}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    ),

  deleteSubscriptionProduct: (planId: number) =>
    apiRequest<{ data: { id: number; deleted: boolean } }>(
      `/api/admin/subscription-products/${planId}`,
      { method: 'DELETE' }
    ),

  // 公开报告管理（治理 / 可见性）
  publicReports: (params?: { page?: number; limit?: number; market?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.append('page', params.page.toString());
    if (params?.limit) q.append('limit', params.limit.toString());
    if (params?.market) q.append('market', params.market);
    return apiRequest<{ data: import('./types').AdminPublicReportItem[]; meta: any }>(
      `/api/admin/public-reports?${q.toString()}`
    );
  },

  setReportPublic: (reportId: string, is_public: boolean) =>
    apiRequest<{ data: any }>(`/api/admin/reports/${reportId}/public`, {
      method: 'POST',
      body: JSON.stringify({ is_public }),
    }),

  // 获取某个供应商的可用模型列表（调用其 /v1/models）
  fetchProviderModels: (providerId: number) =>
    apiRequest<{ provider_id: number; provider_name: string; base_url: string; count: number; models: string[] }>(
      `/api/admin/llm/providers/${providerId}/fetch-models`,
      { method: 'POST' }
    ),

  // 订单列表（所有用户的次数流水）
  orders: (params?: { page?: number; limit?: number; type?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.append('page', params.page.toString());
    if (params?.limit) q.append('limit', params.limit.toString());
    if (params?.type) q.append('type', params.type);
    return apiRequest<{ data: import('./types').AdminOrder[]; meta: any }>(
      `/api/admin/orders?${q.toString()}`
    );
  },
};
