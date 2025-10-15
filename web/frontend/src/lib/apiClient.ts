import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
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

// Auth API (使用公共客户端，不需要认证)
export const authAPI = {
  login: async (username: string, password: string) => {
    try {
      const response = await publicApiClient.post('/api/auth/login', {
        username,
        password,
      });
      return response.data;
    } catch (error: any) {
      // 提取详细错误信息
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '登录失败，请稍后重试';
      throw new Error(errorMessage);
    }
  },

  register: async (username: string, email: string, password: string) => {
    try {
      const response = await publicApiClient.post('/api/auth/register', {
        username,
        email,
        password,
      });
      return response.data;
    } catch (error: any) {
      // 提取详细错误信息
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message || 
                          '注册失败，请稍后重试';
      throw new Error(errorMessage);
    }
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/api/auth/me');
    return response.data;
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
};

export default apiClient;