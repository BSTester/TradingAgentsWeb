'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  conversationAPI,
  messageAPI,
  skillsAPI,
  type ConversationWebSocket,
} from '@/lib/conversation';
import { useConversationWebSocket } from '@/hooks/useConversationWebSocket';
import type {
  Message,
  Session,
  SkillHealth,
  StageStatus,
  ContentBlock,
  Report,
  ConversationWsEvent,
} from '@/types/conversation';
import { useAuth } from '@/lib/auth';

// ---- streaming message assembly ----

interface StreamState {
  messages: Message[];
  activeAssistantId: string | null;
  isStreaming: boolean;
  streamingError: string | null;
  reports: Record<string, Report>; // report_id -> report (for rendering cards)
}

type StreamAction =
  | { type: 'SET_MESSAGES'; messages: Message[] }
  | { type: 'INIT_ASSISTANT'; id: string }
  | { type: 'TOKEN'; id: string; content: string }
  | { type: 'STAGE_START'; stageId: string; stageName: string }
  | { type: 'STAGE_UPDATE'; stageId: string; summary: string }
  | { type: 'STAGE_COMPLETE'; stageId: string; completedAt: string }
  | { type: 'STAGE_WARNING'; stageId: string; message: string }
  | { type: 'STAGE_ERROR'; stageId: string; message: string }
  | { type: 'REPORT_READY'; report: Report; messageId: string }
  | { type: 'STREAM_END' }
  | { type: 'STREAM_ERROR'; message: string };

function upsertStageBlock(blocks: ContentBlock[], stageId: string, patch: Partial<Extract<ContentBlock, { type: 'stage_progress' }>>): ContentBlock[] {
  const idx = blocks.findIndex((b) => b.type === 'stage_progress' && b.stage_id === stageId);
  if (idx === -1) {
    return [
      ...blocks,
      {
        type: 'stage_progress',
        stage_id: stageId,
        stage_name: patch.stage_name ?? stageId,
        status: patch.status ?? 'active',
        summary: patch.summary,
        started_at: patch.started_at,
        completed_at: patch.completed_at,
      } as Extract<ContentBlock, { type: 'stage_progress' }>,
    ];
  }
  const next = blocks.slice();
  const cur = next[idx] as Extract<ContentBlock, { type: 'stage_progress' }>;
  next[idx] = { ...cur, ...patch };
  return next;
}

function streamReducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { ...state, messages: action.messages, activeAssistantId: null, isStreaming: false };
    case 'INIT_ASSISTANT': {
      if (state.messages.some((m) => m.id === action.id)) {
        return { ...state, activeAssistantId: action.id };
      }
      const msg: Message = {
        id: action.id,
        session_id: '',
        role: 'assistant',
        content: '',
        content_blocks: [],
        created_at: new Date().toISOString(),
      };
      return { ...state, messages: [...state.messages, msg], activeAssistantId: action.id };
    }
    case 'TOKEN': {
      const id = action.id;
      const messages = state.messages.map((m) => {
        if (m.id !== id) return m;
        const blocks = m.content_blocks ? m.content_blocks.slice() : [];
        const lastText = blocks[blocks.length - 1];
        if (lastText && lastText.type === 'text') {
          blocks[blocks.length - 1] = { type: 'text', content: lastText.content + action.content };
        } else {
          blocks.push({ type: 'text', content: action.content });
        }
        return { ...m, content: m.content + action.content, content_blocks: blocks };
      });
      return { ...state, messages, activeAssistantId: id };
    }
    case 'STAGE_START': {
      const id = state.activeAssistantId;
      if (!id) return state;
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === id
            ? { ...m, content_blocks: upsertStageBlock(m.content_blocks ?? [], action.stageId, { stage_name: action.stageName, status: 'active' as StageStatus, started_at: new Date().toISOString() }) }
            : m
        ),
      };
    }
    case 'STAGE_UPDATE': {
      const id = state.activeAssistantId;
      if (!id) return state;
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === id
            ? { ...m, content_blocks: upsertStageBlock(m.content_blocks ?? [], action.stageId, { summary: action.summary }) }
            : m
        ),
      };
    }
    case 'STAGE_COMPLETE': {
      const id = state.activeAssistantId;
      if (!id) return state;
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === id
            ? { ...m, content_blocks: upsertStageBlock(m.content_blocks ?? [], action.stageId, { status: 'complete' as StageStatus, completed_at: action.completedAt }) }
            : m
        ),
      };
    }
    case 'STAGE_WARNING': {
      const id = state.activeAssistantId;
      if (!id) return state;
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === id
            ? { ...m, content_blocks: upsertStageBlock(m.content_blocks ?? [], action.stageId, { status: 'warning' as StageStatus, summary: action.message }) }
            : m
        ),
      };
    }
    case 'STAGE_ERROR': {
      const id = state.activeAssistantId;
      if (!id) return state;
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === id
            ? { ...m, content_blocks: upsertStageBlock(m.content_blocks ?? [], action.stageId, { status: 'error' as StageStatus, summary: action.message }) }
            : m
        ),
      };
    }
    case 'REPORT_READY': {
      const report = action.report;
      const messages = state.messages.map((m) => {
        if (m.id !== action.messageId) return m;
        const blocks = m.content_blocks ? m.content_blocks.slice() : [];
        const exists = blocks.some((b) => b.type === 'report' && b.report_id === report.id);
        if (!exists) {
          blocks.push({
            type: 'report',
            report_id: report.id,
            report_preview: { ticker: report.ticker, rating: report.conclusion.rating, summary: report.conclusion.summary },
          });
        }
        return { ...m, content_blocks: blocks };
      });
      return { ...state, messages, reports: { ...state.reports, [report.id]: report }, isStreaming: false };
    }
    case 'STREAM_END':
      return { ...state, isStreaming: false };
    case 'STREAM_ERROR':
      return { ...state, isStreaming: false, streamingError: action.message };
    default:
      return state;
  }
}

// ---- context shape ----

interface ConversationContextValue {
  sessions: Session[];
  activeSessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingError: string | null;
  reports: Record<string, Report>;
  skillsHealth: SkillHealth[];
  isConnected: boolean;
  loadingSessions: boolean;
  loadSessions: () => Promise<void>;
  createSession: () => Promise<string>;
  selectSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  stopAnalysis: () => void;
  retryStage: (stage: string) => void;
  refreshSkills: () => Promise<void>;
}

const ConversationContext = createContext<ConversationContextValue | undefined>(undefined);

export function ConversationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [skillsHealth, setSkillsHealth] = useState<SkillHealth[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [stream, dispatch] = useReducer(streamReducer, {
    messages: [],
    activeAssistantId: null,
    isStreaming: false,
    streamingError: null,
    reports: {},
  });
  const wsRef = useRef<ConversationWebSocket | null>(null);

  const loadSessions = useCallback(async () => {
    if (!user) {
      setSessions([]);
      return;
    }
    setLoadingSessions(true);
    try {
      const res = await conversationAPI.list({ limit: 50 });
      setSessions(res.data);
    } catch {
      // ignore; surface via UI if needed
    } finally {
      setLoadingSessions(false);
    }
  }, [user]);

  const selectSession = useCallback(async (id: string) => {
    setActiveSessionId(id);
    try {
      const res = await messageAPI.list(id, { limit: 50 });
      dispatch({ type: 'SET_MESSAGES', messages: res.data });
    } catch {
      dispatch({ type: 'SET_MESSAGES', messages: [] });
    }
  }, []);

  const createSession = useCallback(async (): Promise<string> => {
    const res = await conversationAPI.create({ title: '新对话' });
    const session = res.data;
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    dispatch({ type: 'SET_MESSAGES', messages: [] });
    return session.id;
  }, []);

  const renameSession = useCallback(async (id: string, title: string) => {
    try {
      const res = await conversationAPI.update(id, { title });
      setSessions((prev) => prev.map((s) => (s.id === id ? res.data : s)));
    } catch {
      /* noop */
    }
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await conversationAPI.remove(id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (activeSessionId === id) {
          setActiveSessionId(null);
          dispatch({ type: 'SET_MESSAGES', messages: [] });
        }
      } catch {
        /* noop */
      }
    },
    [activeSessionId]
  );

  // ---- WS event handler ----
  const handleEvent = useCallback((event: ConversationWsEvent) => {
    switch (event.type) {
      case 'token':
        dispatch({ type: 'INIT_ASSISTANT', id: event.data.message_id });
        dispatch({ type: 'TOKEN', id: event.data.message_id, content: event.data.content });
        break;
      case 'stage_start':
        dispatch({ type: 'STAGE_START', stageId: event.data.stage_id, stageName: event.data.stage_name });
        break;
      case 'stage_update':
        dispatch({ type: 'STAGE_UPDATE', stageId: event.data.stage_id, summary: event.data.summary });
        break;
      case 'stage_complete':
        dispatch({ type: 'STAGE_COMPLETE', stageId: event.data.stage_id, completedAt: event.data.completed_at });
        break;
      case 'stage_warning':
        dispatch({ type: 'STAGE_WARNING', stageId: event.data.stage_id, message: event.data.message });
        break;
      case 'stage_error':
        dispatch({ type: 'STAGE_ERROR', stageId: event.data.stage_id, message: event.data.message });
        break;
      case 'analysis_complete':
        dispatch({ type: 'STREAM_END' });
        break;
      case 'report_ready':
        dispatch({ type: 'REPORT_READY', report: event.data.report, messageId: event.data.message_id });
        break;
      case 'stop_ack':
        dispatch({ type: 'STREAM_END' });
        break;
      case 'error':
        dispatch({ type: 'STREAM_ERROR', message: event.data.message });
        break;
      default:
        break;
    }
  }, []);

  const { isConnected, stop, retryStage } = useConversationWebSocket({
    sessionId: activeSessionId,
    onEvent: handleEvent,
    enabled: !!user && !!activeSessionId,
  });

  const sendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || !user) return;
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = await createSession();
      }
      const clientMessageId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      // optimistic user message
      const userMsg: Message = {
        id: clientMessageId,
        session_id: sessionId,
        role: 'user',
        content: text,
        content_blocks: [{ type: 'text', content: text }],
        created_at: new Date().toISOString(),
      };
      dispatch({ type: 'SET_MESSAGES', messages: [...stream.messages, userMsg] });
      dispatch({ type: 'INIT_ASSISTANT', id: `pending-${sessionId}-${Date.now()}` });
      try {
        const res = await messageAPI.send(sessionId, { content: text, client_message_id: clientMessageId });
        // replace optimistic user message with server-confirmed one
        dispatch({
          type: 'SET_MESSAGES',
          messages: [
            ...stream.messages.filter((m) => m.id !== clientMessageId),
            { ...res.data, content_blocks: res.data.content_blocks ?? [{ type: 'text', content: res.data.content }] },
          ],
        });
      } catch (err) {
        dispatch({ type: 'STREAM_ERROR', message: err instanceof Error ? err.message : '发送失败' });
      }
    },
    [activeSessionId, user, createSession, stream.messages]
  );

  const refreshSkills = useCallback(async () => {
    try {
      const res = await skillsAPI.health();
      setSkillsHealth(res.data.skills);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadSessions();
      refreshSkills();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const value = useMemo<ConversationContextValue>(
    () => ({
      sessions,
      activeSessionId,
      messages: stream.messages,
      isStreaming: stream.isStreaming,
      streamingError: stream.streamingError,
      reports: stream.reports,
      skillsHealth,
      isConnected,
      loadingSessions,
      loadSessions,
      createSession,
      selectSession,
      renameSession,
      deleteSession,
      sendMessage,
      stopAnalysis: stop,
      retryStage,
      refreshSkills,
    }),
    [sessions, activeSessionId, stream, skillsHealth, isConnected, loadingSessions, loadSessions, createSession, selectSession, renameSession, deleteSession, sendMessage, stop, retryStage, refreshSkills]
  );

  return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>;
}

export function useConversation() {
  const ctx = useContext(ConversationContext);
  if (!ctx) throw new Error('useConversation must be used within ConversationProvider');
  return ctx;
}
