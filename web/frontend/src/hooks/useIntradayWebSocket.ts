/**
 * WebSocket hook for intraday trading real-time updates
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { buildWebSocketUrl } from '@/utils/api';

interface WebSocketMessage {
  type: string;
  timestamp: string;
  message?: string;
  [key: string]: any;
}

interface UseIntradayWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  autoConnect?: boolean;
}

export function useIntradayWebSocket(
  sessionId: string | null,
  options: UseIntradayWebSocketOptions = {}
) {
  const { onMessage, onStatusChange, autoConnect = true } = options;
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isManualDisconnectRef = useRef(false); // Track manual disconnect
  const maxReconnectAttempts = 5;
  const reconnectDelay = 2000;
  
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const updateStatus = useCallback((newStatus: typeof status) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds
  }, []);

  const stopPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!sessionId) {
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      isManualDisconnectRef.current = false; // Reset manual disconnect flag
      updateStatus('connecting');
      
      const baseUrl = buildWebSocketUrl(`/ws/intraday/${sessionId}`); // sessionId is actually user_id
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const subprotocol = token ? `jwt.${token}` : undefined;
      
      const ws = subprotocol ? new WebSocket(baseUrl, [subprotocol]) : new WebSocket(baseUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        updateStatus('connected');
        reconnectAttemptsRef.current = 0;
        startPingInterval();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          
          // Ignore ping responses
          if (data.type === 'pong') {
            return;
          }
          
          setLastMessage(data);
          onMessage?.(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = () => {
        updateStatus('error');
      };

      ws.onclose = () => {
        stopPingInterval();
        updateStatus('disconnected');
        
        // Only attempt reconnect if not manually disconnected
        if (!isManualDisconnectRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay * reconnectAttemptsRef.current);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      updateStatus('error');
    }
  }, [sessionId, onMessage, updateStatus, startPingInterval, stopPingInterval]);

  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true; // Mark as manual disconnect
    stopPingInterval();
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    updateStatus('disconnected');
  }, [stopPingInterval, updateStatus]);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && sessionId) {
      connect();
    }

    // Cleanup: disconnect when component unmounts or sessionId changes
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, autoConnect]); // Only reconnect when sessionId or autoConnect changes

  return {
    status,
    lastMessage,
    connect,
    disconnect,
    send,
    isConnected: status === 'connected',
  };
}
