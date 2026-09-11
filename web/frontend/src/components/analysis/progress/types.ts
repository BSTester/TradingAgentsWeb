export type StatusFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'statusText' | 'json'>>;

export interface PhaseAgent {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  logs: string[];
}

export interface AnalysisPhase {
  id: string;
  name: string;
  description: string;
  icon: string;
  agents: PhaseAgent[];
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface WebSocketMessage {
  type: 'log' | 'complete' | 'error' | 'interrupted' | 'config' | 'pong';
  timestamp: string;
  analysis_id?: string;
  data: {
    level?: string;
    message?: string;
    agent?: string;
    step?: string;
    progress?: number;
    phase?: string;
    status?: string;
    trading_decision?: string;
    error?: string;
    selected_analysts?: string[];
    research_depth?: number;
    enable_trading_executor?: boolean;
  };
}