import axios from 'axios';

import { API_BASE_URL } from '@/utils/api';
import type {
  AdminLLMProvider,
  AppConfigWithSystemDefault,
  CreateUserLLMProviderRequest,
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

  login: async (username: string, password: string, captcha?: { id: string; answer: string }) => {
    try {
      const payload: any = { username, password };
      if (captcha?.id && captcha?.answer) {
        payload.captcha_id = captcha.id;
        payload.captcha_answer = captcha.answer;
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

  register: async (username: string, email: string, password?: string, captcha?: { id: string; answer: string }, emailCode?: string) => {
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
      let errorMessage = error.response?.data?.detail || 
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
  setSystemDefault: async (providerId: number): Promise<SystemDefaultProviderSummary> => {
    try {
      const response = await apiClient.put('/api/admin/llm/system-default', {
        provider_id: providerId,
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

export default apiClient;
