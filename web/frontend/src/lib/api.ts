/**
 * API client for TradingAgents backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// Auth APIs
export const authAPI = {
  register: (data: { username: string; email: string; password: string }) =>
    apiRequest<{ access_token: string; token_type: string; user: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { username: string; password: string }) =>
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
    const wsUrl = API_BASE_URL.replace('http', 'ws');
    this.ws = new WebSocket(`${wsUrl}/ws/analysis/${this.analysisId}`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      // Send ping to keep connection alive
      this.startPingInterval();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
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
