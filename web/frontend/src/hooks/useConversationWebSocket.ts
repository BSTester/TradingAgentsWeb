'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConversationWebSocket } from '@/lib/conversation';
import type { ConversationWsEvent } from '@/types/conversation';

interface UseConversationWsOptions {
  sessionId: string | null;
  onEvent: (event: ConversationWsEvent) => void;
  enabled?: boolean;
}

interface UseConversationWsResult {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  stop: () => void;
  retryStage: (stage: string) => void;
}

/**
 * React wrapper around ConversationWebSocket for the chat-driven analysis stream.
 * Reconnects automatically (logic lives in ConversationWebSocket) and exposes
 * high-level controls to the workbench.
 */
export function useConversationWebSocket({
  sessionId,
  onEvent,
  enabled = true,
}: UseConversationWsOptions): UseConversationWsResult {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<ConversationWebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!sessionId || !enabled) return;
    if (wsRef.current) return;
    const ws = new ConversationWebSocket(sessionId, {
      onEvent: (e) => onEventRef.current(e),
      onOpen: () => setIsConnected(true),
      onClose: () => setIsConnected(false),
    });
    wsRef.current = ws;
    ws.connect();
  }, [sessionId, enabled]);

  const disconnect = useCallback(() => {
    wsRef.current?.disconnect();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  const stop = useCallback(() => wsRef.current?.stop(), []);
  const retryStage = useCallback((stage: string) => wsRef.current?.retryStage(stage), []);

  // Auto connect when session becomes active; disconnect on cleanup / session change.
  useEffect(() => {
    if (sessionId && enabled) connect();
    return () => disconnect();
  }, [sessionId, enabled, connect, disconnect]);

  return { isConnected, connect, disconnect, stop, retryStage };
}
