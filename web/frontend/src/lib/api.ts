/**
 * API 客户端兼容层（TradingAgentsWeb）
 *
 * HTTP 传输已统一到 `@/lib/apiClient`（axios 单实例 + 鉴权/401 拦截器），
 * 本文件仅保留两类东西：
 *   1. 纯 WebSocket 能力 `AnalysisWebSocket`（与 HTTP 无关，保留原实现）
 *   2. 旧 fetch 版 API 面的兼容签名，全部委托给 canonical 实现
 *
 * 现有页面/组件 `import { xxxAPI } from '@/lib/api'` 无需改动；
 * 新代码请直接 `import { xxxAPI } from '@/lib/apiClient'`。
 */

import { buildWebSocketUrl } from '@/utils/api';
import {
  adminAPI,
  analysisAPI as canonicalAnalysisAPI,
  apiClient,
  authAPI as canonicalAuthAPI,
  configAPI,
  llmAPI,
  reportsAPI,
  scheduledTasksAPI as canonicalScheduledTasksAPI,
  subscriptionAPI,
} from '@/lib/apiClient';

// ===== WebSocket（实时日志/进度推送）=====
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

// ===== 定时任务类型（与后端 _task_payload / 列表响应结构对齐）=====

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

// ===== 兼容 API 面（签名与原 fetch 版一致，实现委托 canonical client）=====

// Auth（旧签名：对象入参；委托 canonical，兼容原 fetch 版调用方）
export const authAPI = {
  register: (data: {
    username: string;
    email: string;
    password?: string;
    turnstile_token?: string;
  }) =>
    canonicalAuthAPI.register(
      data.username,
      data.email,
      data.password,
      undefined,
      undefined,
      data.turnstile_token,
    ),

  login: (data: { username: string; password: string; turnstile_token?: string }) =>
    canonicalAuthAPI.login(data.username, data.password, undefined, data.turnstile_token),

  getCurrentUser: () => canonicalAuthAPI.getCurrentUser(),
};

// Analysis（旧方法名映射到 canonical 实现）
export const analysisAPI = {
  getConfig: () => configAPI.getConfig(),

  validateKey: (data: { provider: string; api_key: string }) => canonicalAnalysisAPI.validateKey(data),

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
  }) => canonicalAnalysisAPI.startAnalysis(data),

  getStatus: (analysisId: string) => canonicalAnalysisAPI.getAnalysisStatus(analysisId),

  getResults: (analysisId: string) => canonicalAnalysisAPI.getAnalysisResults(analysisId),

  getMarkdown: (analysisId: string) => canonicalAnalysisAPI.getMarkdownReport(analysisId),

  // 旧签名支持 status_filter / ticker_filter（canonical getAnalysesList 仅支持分页）
  listAnalyses: (params?: {
    page?: number;
    limit?: number;
    status_filter?: string;
    ticker_filter?: string;
  }) => {
    const q: Record<string, any> = {};
    if (params?.page) q.page = params.page;
    if (params?.limit) q.limit = params.limit;
    if (params?.status_filter) q.status_filter = params.status_filter;
    if (params?.ticker_filter) q.ticker_filter = params.ticker_filter;
    return apiClient
      .get<{ analyses: any[]; total: number; page: number; limit: number; has_next: boolean }>(
        '/api/analyses',
        { params: q },
      )
      .then((res) => res.data);
  },

  exportPDF: (analysisId: string, options?: any) => canonicalAnalysisAPI.exportToPDF(analysisId, options),
};

// Scheduled Tasks（全部委托 canonical 实现；显式返回类型保持类型链条完整）
export const scheduledTasksAPI = {
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
  }): Promise<{ data: ScheduledTaskItem }> =>
    canonicalScheduledTasksAPI.create(data) as Promise<{ data: ScheduledTaskItem }>,

  list: (params?: { page?: number; limit?: number }): Promise<ScheduledTaskListResponse> =>
    canonicalScheduledTasksAPI.list(params ?? {}) as Promise<ScheduledTaskListResponse>,

  stats: (): Promise<{ data: ScheduledTaskStats }> =>
    canonicalScheduledTasksAPI.stats() as Promise<{ data: ScheduledTaskStats }>,

  get: (taskId: number): Promise<{ data: ScheduledTaskItem }> =>
    canonicalScheduledTasksAPI.get(taskId) as Promise<{ data: ScheduledTaskItem }>,

  update: (
    taskId: number,
    data: { is_enabled?: boolean; task_name?: string },
  ): Promise<{ data: ScheduledTaskItem }> =>
    canonicalScheduledTasksAPI.update(taskId, data) as Promise<{ data: ScheduledTaskItem }>,

  delete: (
    taskId: number,
  ): Promise<{
    success: boolean;
    message: string;
    task_id: number;
    task_name: string;
    task_status: string;
    scheduler_removed: boolean;
  }> =>
    canonicalScheduledTasksAPI.delete(taskId) as Promise<{
      success: boolean;
      message: string;
      task_id: number;
      task_name: string;
      task_status: string;
      scheduler_removed: boolean;
    }>,
};

// ===== 以下 API 组签名与 canonical 完全一致，直接透传 =====
export { reportsAPI, llmAPI, subscriptionAPI, adminAPI };