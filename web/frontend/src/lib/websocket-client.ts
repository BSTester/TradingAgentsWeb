// WebSocket client library - placeholder for WebSocket integration
import { WebSocketMessage, LogEntry } from '@/types';
import { buildWebSocketUrl, getAuthToken } from '@/utils/api';
import { WS_MESSAGE_TYPES } from '@/utils/constants';

export interface WebSocketClientOptions {
  reconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private options: Required<WebSocketClientOptions>;
  private reconnectCount = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  
  // Event handlers
  public onOpen?: () => void;
  public onClose?: () => void;
  public onError?: (error: Event) => void;
  public onMessage?: (message: WebSocketMessage) => void;
  public onLog?: (log: LogEntry) => void;

  constructor(endpoint: string, options: WebSocketClientOptions = {}) {
    this.url = buildWebSocketUrl(endpoint);
    this.options = {
      reconnectAttempts: options.reconnectAttempts ?? 5,
      reconnectDelay: options.reconnectDelay ?? 1000,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
    };
  }

  connect(): void {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectCount = 0;
        this.authenticate();
        this.startHeartbeat();
        this.onOpen?.();
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.stopHeartbeat();
        this.onClose?.();
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        this.isConnecting = false;
        this.onError?.(error);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch {
          // Failed to parse WebSocket message
        }
      };
    } catch {
      this.isConnecting = false;
      // Failed to create WebSocket connection
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private authenticate(): void {
    const token = getAuthToken();
    if (token) {
      this.send({
        type: WS_MESSAGE_TYPES.AUTH,
        timestamp: new Date().toISOString(),
        data: { token },
      });
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({
          type: WS_MESSAGE_TYPES.PING,
          timestamp: new Date().toISOString(),
        });
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case WS_MESSAGE_TYPES.LOG:
        if (message.data && this.onLog) {
          this.onLog(message.data as unknown as LogEntry);
        }
        break;
      case WS_MESSAGE_TYPES.PONG:
        // Handle pong response
        break;
      default:
        this.onMessage?.(message);
        break;
    }
  }

  private handleReconnect(): void {
    if (this.reconnectCount < this.options.reconnectAttempts) {
      this.reconnectCount++;
      setTimeout(() => {
        this.connect();
      }, this.options.reconnectDelay * this.reconnectCount);
    }
  }
}