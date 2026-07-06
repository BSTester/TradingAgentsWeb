// Conversation / Analysis domain types for the chat-driven workbench.
// Aligned with frontend-agent/api-contract.md (Stage 3 deliverable).

export type Market = 'US' | 'HK' | 'CN';

export type StageStatus =
  | 'pending'
  | 'active'
  | 'complete'
  | 'warning'
  | 'error'
  | 'stopped';

// Ordered canonical stage ids used by the backend streaming protocol.
export const STAGE_ORDER: string[] = [
  'intent_recognition',
  'market_identification',
  'market_analysis',
  'fundamentals_analysis',
  'sentiment_analysis',
  'news_analysis',
  'bull_bear_research',
  'risk_assessment',
  'report_assembly',
];

export interface Session {
  id: string;
  title: string;
  last_message_preview: string | null;
  message_count: number;
  has_active_analysis: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionListResponse {
  data: Session[];
  meta: { page: number; limit: number; total: number; has_next: boolean };
}

// ---- Message & content blocks ----

export type MessageRole = 'user' | 'assistant' | 'system';

export interface TextBlock {
  type: 'text';
  content: string;
}

export interface StageProgressBlock {
  type: 'stage_progress';
  stage_id: string;
  stage_name: string;
  status: StageStatus;
  summary?: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface ReportPreviewBlock {
  type: 'report';
  report_id: string;
  report_preview: {
    ticker: string;
    rating: number;
    summary: string;
  };
}

export type ContentBlock = TextBlock | StageProgressBlock | ReportPreviewBlock;

export interface Message {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  content_blocks?: ContentBlock[];
  created_at: string;
}

export interface MessageListResponse {
  data: Message[];
  meta: { has_more: boolean; oldest_message_id?: string };
}

// ---- Report ----

export interface ReportConclusion {
  rating: number; // 1-5
  rating_label: string;
  summary: string;
  key_points: string[];
}

export interface ReportIndicator {
  name: string;
  value: string;
  trend: 'up' | 'down' | 'flat';
}

export interface DataSource {
  name: string;
  snapshot_time: string;
}

export interface NewsSource {
  title: string;
  url: string;
  published_at: string;
}

export interface ReportFinancials {
  market_cap?: string;
  pe_ratio?: number | null;
  pb_ratio?: number | null;
  revenue_growth?: string | null;
}

export type SectionKey =
  | 'market_technical'
  | 'fundamentals'
  | 'sentiment'
  | 'news_macro'
  | 'risk';

export interface ReportSection {
  key: SectionKey;
  title: string;
  summary: string;
  content: string; // Markdown
  indicators?: ReportIndicator[];
  financials?: ReportFinancials;
  news_sources?: NewsSource[];
  risk_factors?: string[];
  grounded_evidence?: string;
  data_sources?: DataSource[];
}

export interface ReportSource {
  type: 'conversation' | 'scheduled_task';
  session_id?: string | null;
  task_id?: number | null;
}

export interface StageLogEntry {
  stage_id: string;
  stage_name: string;
  status: 'complete' | 'warning' | 'error';
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  error?: string | null;
}

export interface ReportReflection {
  previous_decisions?: string | null;
  alpha_vs_benchmark?: string | null;
}

export interface Report {
  id: string;
  ticker: string;
  company_name?: string;
  market: Market;
  source: ReportSource;
  conclusion: ReportConclusion;
  sections: ReportSection[];
  stage_log?: StageLogEntry[];
  reflection?: ReportReflection;
  status: 'completed' | 'failed' | 'partial';
  created_at: string;
  updated_at: string;
}

export interface ReportPreview {
  id: string;
  ticker: string;
  company_name?: string;
  market: Market;
  rating: number;
  rating_label: string;
  summary: string;
  section_summaries: Record<SectionKey, string>;
  source: ReportSource;
  status: 'completed' | 'failed' | 'partial';
  created_at: string;
}

export interface ReportListResponse {
  data: ReportPreview[];
  meta: { page: number; limit: number; total: number; has_next: boolean };
}

export interface SkillHealth {
  name: string;
  display_name: string;
  description?: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  primary_source?: string | null;
  fallback_source?: string | null;
  markets?: Market[];
  last_error?: string | null;
  last_checked_at?: string;
}

export interface SkillsHealthResponse {
  data: { skills: SkillHealth[]; updated_at: string };
}

// ---- WebSocket streaming events (api-contract §5) ----

export interface TokenEvent {
  type: 'token';
  data: { content: string; message_id: string };
}
export interface StageStartEvent {
  type: 'stage_start';
  data: { stage_id: string; stage_name: string; display_name?: string };
}
export interface StageUpdateEvent {
  type: 'stage_update';
  data: { stage_id: string; summary: string };
}
export interface StageCompleteEvent {
  type: 'stage_complete';
  data: { stage_id: string; completed_at: string; duration_ms: number };
}
export interface StageWarningEvent {
  type: 'stage_warning';
  data: { stage_id: string; message: string; can_continue: boolean };
}
export interface StageErrorEvent {
  type: 'stage_error';
  data: { stage_id: string; message: string; retryable: boolean };
}
export interface AnalysisCompleteEvent {
  type: 'analysis_complete';
  data: { message_id: string; duration_ms: number; stages_completed: number; stages_total: number };
}
export interface ReportReadyEvent {
  type: 'report_ready';
  data: { report_id: string; message_id: string; report: Report };
}
export interface StopAckEvent {
  type: 'stop_ack';
  data: { message_id: string; stopped_at: string; completed_stages: string[]; partial_content: string };
}
export interface GlobalErrorEvent {
  type: 'error';
  data: { code: string; message: string; stage_id?: string | null };
}
export interface PongEvent {
  type: 'pong';
}
export interface PingEvent {
  type: 'ping';
}

export type ConversationWsEvent =
  | TokenEvent
  | StageStartEvent
  | StageUpdateEvent
  | StageCompleteEvent
  | StageWarningEvent
  | StageErrorEvent
  | AnalysisCompleteEvent
  | ReportReadyEvent
  | StopAckEvent
  | GlobalErrorEvent
  | PongEvent
  | PingEvent;

export interface SkillsHealthEvent {
  type: 'health_update';
  data: { skills: SkillHealth[]; updated_at: string };
}
