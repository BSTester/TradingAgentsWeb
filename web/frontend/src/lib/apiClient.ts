import axios from 'axios';

import { API_BASE_URL } from '@/utils/api';
import type {
  AdminLLMProvider,
  AdminOrder,
  AdminPublicReportItem,
  AdminSubscriptionPlan,
  AdminUser,
  AppConfigWithSystemDefault,
  CreateUserLLMProviderRequest,
  ReportDetail,
  ReportPreview,
  SubscriptionInfo,
  SubscriptionPlan,
  SystemDefaultProviderSummary,
  TestUserLLMProviderRequest,
  TestUserLLMProviderResponse,
  UpdateUserLLMProviderRequest,
  UserLLMProviderSetting,
  UserLLMSettingsResponse,
} from '@/lib/types';



// Create axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a separate client for public endpoints (no auth required)
export const publicApiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for public client to handle errors
publicApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 处理网络错误和其他错误
    if (!error.response) {
      // 网络错误（无响应）
      error.message = '网络连接失败，请检查网络连接后重试';
    } else if (error.response.status >= 500) {
      // 服务器错误
      error.message = '服务器错误，请稍后重试';
    }
    return Promise.reject(error);
  }
);

// Add request interceptor to include auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      
      // Don't redirect to login for /api/auth/me endpoint
      // This allows the app to show logged-out state without redirecting
      const requestUrl = error.config?.url || '';
      if (!requestUrl.includes('/api/auth/me')) {
        window.location.href = '/login';
      }
    } else if (!error.response) {
      // 网络错误（无响应）
      error.message = '网络连接失败，请检查网络连接后重试';
    } else if (error.response.status >= 500) {
      // 服务器错误
      error.message = '服务器错误，请稍后重试';
    }
    return Promise.reject(error);
  }
);



/**
 * Auth API（公共客户端，不需要认证）
 * 后端已强制校验验证码：/api/auth/login 和 /api/auth/register
 */
export const authAPI = {
  getCaptcha: async () => {
    const res = await publicApiClient.post('/api/auth/captcha/new', {});
    // seed 方案：后端只返回 seed，前端据此派生并绘制验证码
    return res.data as { captcha_id: string; seed: string };
  },

  login: async (username: string, password: string, captcha?: { id: string; answer: string }, turnstileToken?: string) => {
    try {
      const payload: any = { username, password };
      if (captcha?.id && captcha?.answer) {
        payload.captcha_id = captcha.id;
        payload.captcha_answer = captcha.answer;
      }
      if (turnstileToken) {
        payload.turnstile_token = turnstileToken;
      }
      const response = await publicApiClient.post('/api/auth/login', payload);
      return response.data;
    } catch (error: any) {
      let errorMessage = error.response?.data?.detail || 
                         error.response?.data?.message || 
                         error.message || 
                         '登录失败，请稍后重试';
      if (typeof errorMessage === 'string' && /Invalid or expired captcha/i.test(errorMessage)) {
        errorMessage = '验证码无效或已过期';
      }
      throw new Error(errorMessage);
    }
  },

  register: async (username: string, email: string, password?: string, captcha?: { id: string; answer: string }, emailCode?: string, turnstileToken?: string) => {
    try {
      const payload: any = { username, email };
      if (password) {
        payload.password = password;
      }
      if (captcha?.id && captcha?.answer) {
        payload.captcha_id = captcha.id;
        payload.captcha_answer = captcha.answer;
      }
      if (emailCode) {
        payload.email_code = emailCode;
      }
      if (turnstileToken) {
        payload.turnstile_token = turnstileToken;
      }
      const response = await publicApiClient.post('/api/auth/register', payload);
      return response.data;
    } catch (error: any) {
      let errorMessage = error.response?.data?.detail || 
                         error.response?.data?.message || 
                         error.message || 
                         '注册失败，请稍后重试';
      if (typeof errorMessage === 'string' && /Invalid or expired captcha/i.test(errorMessage)) {
        errorMessage = '验证码无效或已过期';
      }
      throw new Error(errorMessage);
    }
  },

  setPassword: async (password: string, oldPassword?: string) => {
    try {
      const payload: any = { password };
      if (oldPassword) {
        payload.old_password = oldPassword;
      }
      const response = await apiClient.post('/api/auth/set-password', payload);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                         error.response?.data?.message || 
                         error.message || 
                         '设置密码失败，请稍后重试';
      throw new Error(errorMessage);
    }
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/api/auth/me');
    return response.data;
  },

  sendEmailCode: async (email: string, captcha: { id: string; answer: string }) => {
    try {
      const response = await publicApiClient.post('/api/auth/email-code/send', {
        email,
        captcha_id: captcha.id,
        captcha_answer: captcha.answer,
      });
      return response.data;
    } catch (error: any) {
      let errorMessage = error.response?.data?.detail || 
                         error.response?.data?.message || 
                         error.message || 
                         '发送验证码失败，请稍后重试';
      if (typeof errorMessage === 'string' && /Invalid or expired captcha/i.test(errorMessage)) {
        errorMessage = '验证码无效或已过期';
      }
      throw new Error(errorMessage);
    }
  },

  sendEmailCodeForRegister: async (email: string, captcha: { id: string; answer: string }) => {
    try {
      const response = await publicApiClient.post('/api/auth/email-code/send-for-register', {
        email,
        captcha_id: captcha.id,
        captcha_answer: captcha.answer,
      });
      return response.data;
    } catch (error: any) {
      let errorMessage = error.response?.data?.detail || 
                         error.response?.data?.message || 
                         error.message || 
                         '发送验证码失败，请稍后重试';
      if (typeof errorMessage === 'string' && /Invalid or expired captcha/i.test(errorMessage)) {
        errorMessage = '验证码无效或已过期';
      }
      throw new Error(errorMessage);
    }
  },

  loginWithEmailCode: async (email: string, code: string, captcha?: { id: string; answer: string }) => {
    try {
      const payload: any = { email, code };
      if (captcha?.id && captcha?.answer) {
        payload.captcha_id = captcha.id;
        payload.captcha_answer = captcha.answer;
      }
      const response = await publicApiClient.post('/api/auth/email-code/login', payload);
      return response.data;
    } catch (error: any) {
      let errorMessage = error.response?.data?.detail || 
                         error.response?.data?.message || 
                         error.message || 
                         '登录失败，请稍后重试';
      if (typeof errorMessage === 'string' && /Invalid or expired captcha/i.test(errorMessage)) {
        errorMessage = '验证码无效或已过期';
      }
      throw new Error(errorMessage);
    }
  },
};

// Config API (现在需要认证)
export const configAPI = {
  getConfig: async () => {
    try {
      const response = await apiClient.get('/api/config');
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '获取配置失败';
      throw new Error(errorMessage);
    }
  },

  validateAPIKey: async (provider: string, apiKey: string) => {
    try {
      const response = await apiClient.post('/api/validate-key', {
        provider,
        api_key: apiKey,
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          'API密钥验证失败';
      throw new Error(errorMessage);
    }
  },

  // 仅取 system_default 脱敏摘要（E6 扩展字段），普通用户也可读
  getSystemDefault: async (): Promise<SystemDefaultProviderSummary | null> => {
    try {
      const response = await apiClient.get('/api/config');
      const data = response.data as AppConfigWithSystemDefault;
      return data?.system_default ?? null;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail ||
                          error.response?.data?.message ||
                          error.message ||
                          '获取系统默认 provider 失败';
      throw new Error(errorMessage);
    }
  },
};

// 管理员 LLM 供应商目录（Provider/Model CRUD 源），供系统默认页选择
export const adminLLMAPI = {
  listProviders: async (includeInactive = true): Promise<AdminLLMProvider[]> => {
    try {
      const response = await apiClient.get(
        `/api/admin/llm/providers?include_inactive=${includeInactive}`,
      );
      return response.data as AdminLLMProvider[];
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail ||
                          error.response?.data?.message ||
                          error.message ||
                          '获取供应商列表失败';
      throw new Error(errorMessage);
    }
  },
};

// 管理员设置系统默认 provider（E7，后端 KEY，脱敏摘要返回）
export const adminDefaultProviderAPI = {
  setSystemDefault: async (vars: { providerId: number; shallow_model?: string; deep_model?: string }): Promise<SystemDefaultProviderSummary> => {
    try {
      const response = await apiClient.put('/api/admin/llm/system-default', {
        provider_id: vars.providerId,
        shallow_model: vars.shallow_model ?? undefined,
        deep_model: vars.deep_model ?? undefined,
      });
      return response.data as SystemDefaultProviderSummary;
    } catch (error: any) {
      // 优先取后端 detail（如 "cannot set inactive provider as system default"）
      const errorMessage = error.response?.data?.detail ||
                          error.response?.data?.message ||
                          error.message ||
                          '设置系统默认 provider 失败';
      throw new Error(errorMessage);
    }
  },
};

// Analysis API (需要认证)
export const analysisAPI = {
  startAnalysis: async (data: any) => {
    try {
      const response = await apiClient.post('/api/analyze', data);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '启动分析失败';
      throw new Error(errorMessage);
    }
  },

  getAnalysisStatus: async (analysisId: string) => {
    try {
      const response = await apiClient.get(`/api/analysis/${analysisId}/status`);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '获取分析状态失败';
      throw new Error(errorMessage);
    }
  },

  getAnalysisResults: async (analysisId: string) => {
    try {
      const response = await apiClient.get(`/api/analysis/${analysisId}/results`);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '获取分析结果失败';
      throw new Error(errorMessage);
    }
  },

  getAnalysesList: async (page = 1, limit = 10) => {
    try {
      const response = await apiClient.get(`/api/analyses?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '获取分析列表失败';
      throw new Error(errorMessage);
    }
  },

  getMarkdownReport: async (analysisId: string) => {
    try {
      const response = await apiClient.get(`/api/analysis/${analysisId}/markdown`);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '获取Markdown报告失败';
      throw new Error(errorMessage);
    }
  },

  exportToPDF: async (analysisId: string, options = {}) => {
    try {
      const response = await apiClient.post(`/api/analysis/${analysisId}/export/pdf`, options);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '导出PDF失败';
      throw new Error(errorMessage);
    }
  },

  // Reuse configAPI's validateAPIKey
  validateKey: async (data: { provider: string; api_key: string }) => {
    return configAPI.validateAPIKey(data.provider, data.api_key);
  },
};

// User Config API (需要认证)
export const userConfigAPI = {
  getConfig: async () => {
    try {
      const response = await apiClient.get('/api/user/config');
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '获取用户配置失败';
      throw new Error(errorMessage);
    }
  },

  updateConfig: async (data: any) => {
    try {
      const response = await apiClient.put('/api/user/config', data);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '更新用户配置失败';
      throw new Error(errorMessage);
    }
  },
};

// Scheduled Tasks API (需要认证)
export const scheduledTasksAPI = {
  create: async (data: any) => {
    try {
      const response = await apiClient.post('/api/scheduled-tasks', data);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '创建定时任务失败';
      throw new Error(errorMessage);
    }
  },

  list: async (params: { page?: number; limit?: number } = {}) => {
    try {
      const { page = 1, limit = 10 } = params;
      const response = await apiClient.get(`/api/scheduled-tasks?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '获取定时任务列表失败';
      throw new Error(errorMessage);
    }
  },

  get: async (taskId: number) => {
    try {
      const response = await apiClient.get(`/api/scheduled-tasks/${taskId}`);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '获取定时任务详情失败';
      throw new Error(errorMessage);
    }
  },

  update: async (taskId: number, data: any) => {
    try {
      const response = await apiClient.patch(`/api/scheduled-tasks/${taskId}`, data);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '更新定时任务失败';
      throw new Error(errorMessage);
    }
  },

  delete: async (taskId: number) => {
    try {
      const response = await apiClient.delete(`/api/scheduled-tasks/${taskId}`);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '删除定时任务失败';
      throw new Error(errorMessage);
    }
  },

  // 全量统计（覆盖全部任务，不依赖当页数据）
  stats: async () => {
    try {
      const response = await apiClient.get('/api/scheduled-tasks/stats');
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail ||
                           error.response?.data?.message ||
                           error.message ||
                           '获取定时任务统计失败';
      throw new Error(errorMessage);
    }
  },

  // Legacy aliases for backward compatibility
  createTask: async (data: any) => scheduledTasksAPI.create(data),
  getTasks: async (page = 1, limit = 10) => scheduledTasksAPI.list({ page, limit }),
  updateTask: async (taskId: number, data: any) => scheduledTasksAPI.update(taskId, data),
  deleteTask: async (taskId: number) => scheduledTasksAPI.delete(taskId),
};

// Intraday Trading API (需要认证)
export const intradayTradingAPI = {
  // DEPRECATED: Scheduler status is now pushed via WebSocket 'scheduler_status_sync' message
  // This method is kept for backward compatibility but should not be used
  // getSchedulerStatus: async () => {
  //   throw new Error('DEPRECATED: Use WebSocket scheduler_status_sync message instead');
  // },

  getConfig: async () => {
    try {
      const response = await apiClient.get('/api/intraday/scheduler/config');
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '获取配置失败';
      throw new Error(errorMessage);
    }
  },

  startScheduler: async () => {
    try {
      const response = await apiClient.post('/api/intraday/scheduler/control', {
        action: 'start'
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '启动调度器失败';
      throw new Error(errorMessage);
    }
  },

  stopScheduler: async () => {
    try {
      const response = await apiClient.post('/api/intraday/scheduler/control', {
        action: 'stop'
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '停止调度器失败';
      throw new Error(errorMessage);
    }
  },

  updateConfig: async (config: {
    futu_api_url?: string;
    futu_api_key?: string;
    interval_minutes?: number;
    market_type?: string;
    llm_provider?: string;
    llm_api_key?: string;
  }) => {
    try {
      const response = await apiClient.post('/api/intraday/scheduler/config', config);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '更新配置失败';
      throw new Error(errorMessage);
    }
  },

  validateConfig: async (config: {
    futu_api_url: string;
    futu_api_key?: string;
  }) => {
    try {
      const response = await apiClient.post('/api/intraday/scheduler/validate-config', config);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '验证配置失败';
      throw new Error(errorMessage);
    }
  },

  // Account and positions
  getAccountInfo: async (market: string = 'US') => {
    try {
      const response = await apiClient.get(`/api/intraday/account?market=${market}`);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '获取账户信息失败';
      throw new Error(errorMessage);
    }
  },

  getPositions: async (market: string = 'US') => {
    try {
      const response = await apiClient.get(`/api/intraday/positions?market=${market}`);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '获取持仓信息失败';
      throw new Error(errorMessage);
    }
  },

  // DEPRECATED: Decisions list is now pushed via WebSocket 'decisions_initial' message
  // This method is kept for backward compatibility but should not be used
  // getDecisions: async (params?: { page?: number; limit?: number }) => {
  //   throw new Error('DEPRECATED: Use WebSocket decisions_initial message instead');
  // },

  getDecision: async (id: number) => {
    try {
      const response = await apiClient.get(`/api/intraday/decisions/${id}`);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '获取决策详情失败';
      throw new Error(errorMessage);
    }
  },

  // Orders
  getOrders: async (market: string = 'US', filterStatus: number = 0) => {
    try {
      const response = await apiClient.get(`/api/intraday/orders?market=${market}&filter_status=${filterStatus}`);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '获取订单列表失败';
      throw new Error(errorMessage);
    }
  },

  cancelOrder: async (orderId: string, stockCode: string) => {
    try {
      const response = await apiClient.post('/api/intraday/cancel-order', {
        order_id: orderId,
        stock_code: stockCode,
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '撤销订单失败';
      throw new Error(errorMessage);
    }
  },
};

// User LLM Settings API (需要认证) — 仅管理 provider 元数据（无用户 KEY）
export const llmSettingsAPI = {
  getSettings: async (): Promise<UserLLMSettingsResponse> => {
    try {
      const response = await apiClient.get<UserLLMSettingsResponse>('/api/user/llm-settings');
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        '获取 AI 设置失败';
      throw new Error(errorMessage);
    }
  },

  createProvider: async (body: CreateUserLLMProviderRequest): Promise<UserLLMProviderSetting> => {
    try {
      const response = await apiClient.post<UserLLMProviderSetting>('/api/user/llm-settings/providers', body);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        '创建 provider 失败';
      throw new Error(errorMessage);
    }
  },

  updateProvider: async (id: string, body: UpdateUserLLMProviderRequest): Promise<UserLLMProviderSetting> => {
    try {
      const response = await apiClient.patch<UserLLMProviderSetting>(`/api/user/llm-settings/providers/${id}`, body);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        '更新 provider 失败';
      throw new Error(errorMessage);
    }
  },

  deleteProvider: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/api/user/llm-settings/providers/${id}`);
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        '删除 provider 失败';
      throw new Error(errorMessage);
    }
  },

  testProvider: async (id: string, body: TestUserLLMProviderRequest): Promise<TestUserLLMProviderResponse> => {
    try {
      const response = await apiClient.post<TestUserLLMProviderResponse>(`/api/user/llm-settings/providers/${id}/test`, body);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        '测试连接失败';
      throw new Error(errorMessage);
    }
  },
};

// ===== 报告 / 订阅 / 管理 / LLM 模型 API（WS-133，统一自原 api.ts）=====

function errMessage(error: any, fallback: string): string {
  return (
    error.response?.data?.detail ||
    error.response?.data?.message ||
    error.message ||
    fallback
  );
}

// 报告（公开榜单 / 我的分析 / 详情 / 公开状态 / PDF 导出）
export const reportsAPI = {
  // 公开榜单（免登录，走公共客户端）
  publicList: async (params?: { limit?: number; market?: string; page?: number }) => {
    try {
      const q: Record<string, any> = {};
      if (params?.limit) q.limit = params.limit;
      if (params?.market) q.market = params.market;
      if (params?.page) q.page = params.page;
      const res = await publicApiClient.get<{ data: ReportPreview[]; meta: any }>(
        '/api/reports/public',
        { params: q },
      );
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '获取公开报告列表失败'));
    }
  },

  // 我的分析列表（登录后）
  listMine: async (params?: { page?: number; limit?: number; market?: string; status?: string }) => {
    try {
      const q: Record<string, any> = {};
      if (params?.page) q.page = params.page;
      if (params?.limit) q.limit = params.limit;
      if (params?.market) q.market = params.market;
      if (params?.status) q.status = params.status;
      const res = await apiClient.get<{ data: ReportPreview[]; meta: any }>('/api/reports', {
        params: q,
      });
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '获取我的分析列表失败'));
    }
  },

  // 报告详情（含完整角色链）
  get: async (reportId: string) => {
    try {
      const res = await apiClient.get<{ data: ReportDetail }>(`/api/reports/${reportId}`);
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '获取报告详情失败'));
    }
  },

  // 一键切换公开状态
  setPublic: async (reportId: string, is_public: boolean) => {
    try {
      const res = await apiClient.post<{ data: ReportPreview }>(`/api/reports/${reportId}/public`, {
        is_public,
      });
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '更新公开状态失败'));
    }
  },

  // 导出 PDF（带封面研报，返回 Blob）
  exportPdf: async (reportId: string): Promise<Blob> => {
    try {
      const res = await apiClient.get(`/api/reports/${reportId}/export?format=pdf`, {
        responseType: 'blob',
      });
      return res.data as Blob;
    } catch (error: any) {
      throw new Error(errMessage(error, '导出失败，请稍后重试'));
    }
  },
};

// 用临时 API Key 获取某提供商的可用模型列表（自定义模型设置页用，Key 不持久化）
export const llmAPI = {
  fetchModelsTransient: async (data: { base_url: string; api_key: string; provider_type?: string }) => {
    try {
      const res = await apiClient.post<{ models: string[]; count: number }>('/api/llm/fetch-models', data);
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '获取模型列表失败'));
    }
  },
};

// 订阅 / 按次
export const subscriptionAPI = {
  plans: async () => {
    try {
      const res = await apiClient.get<{ data: SubscriptionPlan[] }>('/api/subscription/plans');
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '获取订阅套餐失败'));
    }
  },

  me: async () => {
    try {
      const res = await apiClient.get<{ data: SubscriptionInfo }>('/api/subscription/me');
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '获取订阅信息失败'));
    }
  },

  purchase: async (planId: number) => {
    try {
      const res = await apiClient.post<{ data: SubscriptionInfo }>('/api/subscription/purchase', {
        plan_id: planId,
      });
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '购买失败'));
    }
  },
};

// 管理控制台（用户 / 订阅商品 / 公开报告 / 供应商模型 / 订单）
export const adminAPI = {
  users: async (params?: { page?: number; limit?: number; search?: string }) => {
    try {
      const q: Record<string, any> = {};
      if (params?.page) q.page = params.page;
      if (params?.limit) q.limit = params.limit;
      if (params?.search) q.search = params.search;
      const res = await apiClient.get<{ data: AdminUser[]; meta: any }>('/api/admin/users', {
        params: q,
      });
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '获取用户列表失败'));
    }
  },

  setUserActive: async (userId: number, is_active: boolean) => {
    try {
      const res = await apiClient.post<{ data: AdminUser }>(`/api/admin/users/${userId}/active`, {
        is_active,
      });
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '更新用户状态失败'));
    }
  },

  setUserRole: async (userId: number, role: 'user' | 'admin') => {
    try {
      const res = await apiClient.post<{ data: AdminUser }>(`/api/admin/users/${userId}/role`, {
        role,
      });
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '更新用户角色失败'));
    }
  },

  subscriptionProducts: async () => {
    try {
      const res = await apiClient.get<{ data: AdminSubscriptionPlan[] }>(
        '/api/admin/subscription-products',
      );
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '获取订阅商品失败'));
    }
  },

  createSubscriptionProduct: async (data: {
    name: string;
    credits: number;
    price: number;
    description?: string;
    is_active?: boolean;
  }) => {
    try {
      const res = await apiClient.post<{ data: AdminSubscriptionPlan }>(
        '/api/admin/subscription-products',
        data,
      );
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '创建订阅商品失败'));
    }
  },

  updateSubscriptionProduct: async (
    planId: number,
    data: { name?: string; credits?: number; price?: number; description?: string; is_active?: boolean },
  ) => {
    try {
      const res = await apiClient.patch<{ data: AdminSubscriptionPlan }>(
        `/api/admin/subscription-products/${planId}`,
        data,
      );
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '更新订阅商品失败'));
    }
  },

  deleteSubscriptionProduct: async (planId: number) => {
    try {
      const res = await apiClient.delete<{ data: { id: number; deleted: boolean } }>(
        `/api/admin/subscription-products/${planId}`,
      );
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '删除订阅商品失败'));
    }
  },

  // 公开报告管理（治理 / 可见性）
  publicReports: async (params?: { page?: number; limit?: number; market?: string }) => {
    try {
      const q: Record<string, any> = {};
      if (params?.page) q.page = params.page;
      if (params?.limit) q.limit = params.limit;
      if (params?.market) q.market = params.market;
      const res = await apiClient.get<{ data: AdminPublicReportItem[]; meta: any }>(
        '/api/admin/public-reports',
        { params: q },
      );
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '获取公开报告管理列表失败'));
    }
  },

  setReportPublic: async (reportId: string, is_public: boolean) => {
    try {
      const res = await apiClient.post<{ data: any }>(`/api/admin/reports/${reportId}/public`, {
        is_public,
      });
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '更新报告公开状态失败'));
    }
  },

  // 获取某个供应商的可用模型列表（调用其 /v1/models）
  fetchProviderModels: async (providerId: number) => {
    try {
      const res = await apiClient.post<{
        provider_id: number;
        provider_name: string;
        base_url: string;
        count: number;
        models: string[];
      }>(`/api/admin/llm/providers/${providerId}/fetch-models`);
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '获取供应商模型失败'));
    }
  },

  // 订单列表（所有用户的次数流水）
  orders: async (params?: { page?: number; limit?: number; type?: string }) => {
    try {
      const q: Record<string, any> = {};
      if (params?.page) q.page = params.page;
      if (params?.limit) q.limit = params.limit;
      if (params?.type) q.type = params.type;
      const res = await apiClient.get<{ data: AdminOrder[]; meta: any }>('/api/admin/orders', {
        params: q,
      });
      return res.data;
    } catch (error: any) {
      throw new Error(errMessage(error, '获取订单列表失败'));
    }
  },
};

export default apiClient;
