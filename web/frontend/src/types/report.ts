// Role-chain report contract — mirrors docs/report-role-chain-contract.md
// and tradingagents/utils/role_chain.py 1:1.

export type Market = 'US' | 'HK' | 'CN';
export type Verdict = 'strong_buy' | 'buy' | 'overweight' | 'hold' | 'reduce' | 'watch';
export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high';
export type Stance = 'positive' | 'warm' | 'neutral' | 'cooling' | 'negative';
export type Currency = 'USD' | 'HKD' | 'CNY';

export interface PriceBand {
  low: number;
  high: number;
  currency: Currency;
  basis: '示例' | '延迟' | '收盘';
}

export interface RoleDecision {
  verdict: Verdict;
  verdictLabel: string;
  rationale: string;
  priceBand: PriceBand | null; // null -> show "示例 / 延迟", never invent
  riskLevel: RiskLevel;
  horizon: string | null;
  confidence: number | null; // 0-100, null -> hide
}

export interface AnalystNode {
  role: 'market' | 'social' | 'news' | 'fundamentals';
  code: 'MKT' | 'SOC' | 'NEWS' | 'FND';
  title: string;
  subtitle: string;
  stance: Stance;
  summary: string;
  evidence: string[];
  hasContent: boolean;
}

export interface DebateSide {
  headline: string;
  summary: string;
}

export interface TraderPlan {
  verdict: Verdict;
  verdictLabel: string;
  priceBand: PriceBand | null;
  positionCapPct: number | null;
  note: string; // fixed: "研究建议，非下单执行入口"
  hasContent: boolean;
  summary: string;
}

export interface RoleChainReport {
  id: string;
  ticker: string;
  company: string;
  market: Market | null;
  title: string;
  publishedAt: string;
  author: { name: string };
  modelId: string;
  depth: 'lite' | 'standard' | 'deep';
  decision: RoleDecision;
  analysts: AnalystNode[];
  debate: {
    bull: DebateSide;
    bear: DebateSide;
    manager: { summary: string };
  };
  traderPlan: TraderPlan;
  riskDebate: {
    risky: DebateSide;
    safe: DebateSide;
    neutral: DebateSide;
  };
  summary: string;
  meta: { sources: number; generatedAt: string; disclaimer: string };
}

// Trimmed shape returned by report list / leaderboard previews.
export interface ReportPreview {
  id: string;
  ticker: string;
  company_name: string;
  market: Market | null;
  rating: number;
  rating_label: string;
  summary: string;
  status: string;
  created_at: string | null;
  trading_decision?: string;
  role_chain?: { decision: RoleDecision; analysts: AnalystNode[] };
}

// verdict -> pill class + color helpers
export const VERDICT_PILL: Record<Verdict, string> = {
  strong_buy: 'verdict-bull',
  buy: 'verdict-bull',
  overweight: 'verdict-hold',
  hold: 'verdict-hold',
  reduce: 'verdict-bear',
  watch: 'verdict-neutral',
};

export const STANCE_PILL: Record<Stance, string> = {
  positive: 'verdict-bull',
  warm: 'verdict-hold',
  neutral: 'verdict-neutral',
  cooling: 'verdict-bear',
  negative: 'verdict-bear',
};

export const STANCE_LABEL: Record<Stance, string> = {
  positive: '积极',
  warm: '偏多',
  neutral: '中性',
  cooling: '偏空',
  negative: '看空',
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: '低',
  moderate: '中等',
  elevated: '偏高',
  high: '高',
};

export const MARKET_LABEL: Record<string, string> = {
  US: '美股',
  HK: '港股',
  CN: 'A股',
};

