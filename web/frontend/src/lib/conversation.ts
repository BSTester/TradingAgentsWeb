// Conversation / Report / Skills API client.
// Mirrors the existing auth/api pattern (Bearer token from localStorage 'access_token').
// Aligned with frontend-agent/api-contract.md.

import { buildApiUrl, buildWebSocketUrl } from '@/utils/api';
import type {
  Session,
  SessionListResponse,
  Message,
  MessageListResponse,
  Report,
  ReportPreview,
  ReportListResponse,
  SkillHealth,
  SkillsHealthResponse,
  ConversationWsEvent,
} from '@/types/conversation';

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
};

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(buildApiUrl(endpoint), { ...options, headers });

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        const publicPages = ['/', '/login', '/register', '/auth'];
        if (!publicPages.includes(window.location.pathname)) {
          window.location.href = '/login';
        }
      }
      throw new Error('无法验证凭据');
    }
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error((error as any).detail || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const conversationAPI = {
  list: (params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.append('page', String(params.page));
    if (params?.limit) q.append('limit', String(params.limit ?? 50));
    return apiRequest<SessionListResponse>(`/api/conversations?${q.toString()}`);
  },
  create: (data: { title?: string }) =>
    apiRequest<{ data: Session }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  get: (id: string) => apiRequest<{ data: Session }>(`/api/conversations/${id}`),
  update: (id: string, data: { title: string }) =>
    apiRequest<{ data: Session }>(`/api/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    apiRequest<{ data: { deleted: boolean; id: string } }>(`/api/conversations/${id}`, {
      method: 'DELETE',
    }),
};

export const messageAPI = {
  list: (sessionId: string, params?: { before_id?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.before_id) q.append('before_id', params.before_id);
    if (params?.limit) q.append('limit', String(params.limit));
    return apiRequest<MessageListResponse>(
      `/api/conversations/${sessionId}/messages?${q.toString()}`
    );
  },
  send: (sessionId: string, data: { content: string; client_message_id: string }) =>
    apiRequest<{ data: Message }>(`/api/conversations/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  followUp: (
    sessionId: string,
    messageId: string,
    data: { action: 'retry_stage' | 'expand_section' | 'ask_followup'; stage?: string; section?: string; content?: string }
  ) =>
    apiRequest<{ data: Message }>(
      `/api/conversations/${sessionId}/messages/${messageId}/follow-up`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
};

export const reportAPI = {
  list: (params?: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v !== undefined && v !== '') q.append(k, String(v));
    });
    return apiRequest<ReportListResponse>(`/api/reports?${q.toString()}`);
  },
  get: (id: string) => apiRequest<{ data: Report }>(`/api/reports/${id}`),
  // Returns a direct download URL (backend may respond with the file stream or a signed url).
  exportUrl: (id: string, format: 'md' | 'json' | 'pdf') =>
    buildApiUrl(`/api/reports/${id}/export?format=${format}`),
};

export const skillsAPI = {
  health: () => apiRequest<SkillsHealthResponse>('/api/skills/health'),
};

// ---- WebSocket client for conversation streaming (api-contract §5.1) ----

export type ConversationWsHandlers = {
  onEvent: (event: ConversationWsEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Event) => void;
};

export class ConversationWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private handlers: ConversationWsHandlers;
  private reconnectAttempts = 0;
  private maxReconnect = 5;
  private reconnectDelay = 1000;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private closedByUser = false;
  private messageQueue: string[] = [];

  constructor(sessionId: string, handlers: ConversationWsHandlers) {
    this.sessionId = sessionId;
    this.handlers = handlers;
  }

  connect() {
    if (typeof window === 'undefined') return;
    const token = getAuthToken();
    const base = buildWebSocketUrl(`/ws/conversation/${this.sessionId}`);
    const url = token ? `${base}?token=${token}` : base;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      if (token) this.sendRaw({ type: 'auth', token });
      this.startHeartbeat();
      // flush queued client messages
      this.messageQueue.forEach((m) => this.sendRaw(JSON.parse(m)));
      this.messageQueue = [];
      this.handlers.onOpen?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ConversationWsEvent;
        if (data.type === 'ping') {
          this.sendRaw({ type: 'pong' });
          return;
        }
        this.handlers.onEvent(data);
      } catch {
        // ignore malformed
      }
    };

    this.ws.onerror = (err) => this.handlers.onError?.(err);
    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.handlers.onClose?.();
      if (!this.closedByUser && this.reconnectAttempts < this.maxReconnect) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
      }
    };
  }

  private sendRaw(obj: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  send(obj: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendRaw(obj);
    } else {
      // queue until open
      this.messageQueue.push(JSON.stringify(obj));
    }
  }

  stop() {
    this.send({ type: 'stop' });
  }

  retryStage(stage: string) {
    this.send({ type: 'retry_stage', stage });
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.sendRaw({ type: 'ping' });
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  disconnect() {
    this.closedByUser = true;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
  }
}

export type { SkillHealth };
