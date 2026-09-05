'use client';

// Dark-financial market display primitives (WS-133).
//   - Up/down colors resolve per market: A-share = red up / green down; US/HK = green up / red down.
//   - Every movement shows arrow + sign + percent + text label (never relies on color alone).
//   - Risk level uses fixed text + icon, kept separate from up/down semantics.

import React from 'react';
import type { Market, RiskLevel } from '@/lib/types';

// Color resolution per market + direction (+1 up, -1 down, 0 flat).
export function pnlColor(market: Market | null | undefined, direction: -1 | 0 | 1): string {
  if (direction === 0) return 'text-text-tertiary';
  const isCn = market?.toUpperCase() === 'CN';
  const isUp = direction > 0;
  // A-share: red up / green down. US/HK: green up / red down.
  const upColor = isCn ? 'text-up' : 'text-down';      // tailwind up/down DEFAULT tokens
  const downColor = isCn ? 'text-down' : 'text-up';
  return isUp ? upColor : downColor;
}

export const DEFAULT_MARKET_LABEL: Record<Market, string> = {
  US: '美股',
  HK: '港股',
  CN: 'A股',
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};

export const RISK_ICON: Record<RiskLevel, string> = {
  low: 'fa-shield-halved',
  medium: 'fa-triangle-exclamation',
  high: 'fa-circle-exclamation',
};

export const RISK_CLASS: Record<RiskLevel, string> = {
  low: 'text-down border-down/40 bg-down/10',
  medium: 'text-warning-500 border-warning-500/40 bg-warning-500/10',
  high: 'text-danger-500 border-danger-500/40 bg-danger-500/10',
};

export const RECOMMENDATION_LABEL: Record<string, string> = {
  buy: '买入',
  hold: '持仓',
  sell: '卖出',
};

export const RECOMMENDATION_CLASS: Record<string, string> = {
  buy: 'text-up border-up/40 bg-up/10',       // buy = positive (green/red depends on market, use accent) -> use accent-safety color
  hold: 'text-warning-500 border-warning-500/40 bg-warning-500/10',
  sell: 'text-down border-down/40 bg-down/10',
};

export function MarketTabs({
  value,
  onChange,
  counts,
}: {
  value: Market | 'all';
  onChange: (v: Market | 'all') => void;
  counts?: Partial<Record<Market | 'all', number>>;
}) {
  const tabs: { key: Market | 'all'; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'US', label: '美股' },
    { key: 'HK', label: '港股' },
    { key: 'CN', label: 'A股' },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-dark-border bg-dark-secondary p-1">
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-accent-primary text-white shadow-glow-blue'
                : 'text-text-secondary hover:bg-dark-tertiary hover:text-text-primary'
            }`}
          >
            {t.label}
            {counts?.[t.key] != null && (
              <span className={`num text-xs ${active ? 'text-white/80' : 'text-text-tertiary'}`}>
                {counts[t.key]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Risk level → fixed text + icon (never conflated with up/down).
export function RiskBadge({ level }: { level: RiskLevel | null | undefined }) {
  if (!level) return <span className="text-text-tertiary text-xs">—</span>;
  const cls = RISK_CLASS[level] ?? RISK_CLASS.medium;
  return (
    <span
      title="风险提示：本报告由 TradingAgents 多智能体系统基于公开数据自动生成，仅供研究参考，不构成任何投资建议。"
      className={`inline-flex cursor-help items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      <i className={`fas ${RISK_ICON[level] ?? 'fa-shield-halved'}`} aria-hidden="true" />
      {RISK_LABEL[level] ?? level}
    </span>
  );
}

export function RecommendationBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-text-tertiary text-xs">—</span>;
  const key = value.toLowerCase();
  const label = RECOMMENDATION_LABEL[key] ?? value;
  const cls = RECOMMENDATION_CLASS[key] ?? 'text-text-secondary border-dark-border bg-dark-tertiary';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>
      <i className={`fas ${key === 'buy' ? 'fa-arrow-trend-up' : key === 'sell' ? 'fa-arrow-trend-down' : 'fa-bars'}`} aria-hidden="true" />
      {label}
    </span>
  );
}

// Numeric price-change cell: arrow + sign + percent + verbal label, colored per market.
export function PriceChange({
  change,
  pct,
  market,
  label,
}: {
  change?: number | null;
  pct?: number | null;
  market?: Market | null;
  label?: string;
}) {
  const direction: -1 | 0 | 1 = (change ?? 0) > 0 ? 1 : (change ?? 0) < 0 ? -1 : 0;
  const color = pnlColor(market, direction);
  const arrow = direction > 0 ? '▲' : direction < 0 ? '▼' : '■';
  const sign = direction > 0 ? '+' : '';
  const verbal =
    label ??
    (direction > 0 ? '上涨' : direction < 0 ? '下跌' : '持平');
  return (
    <span className={`num inline-flex items-center gap-1.5 text-sm font-semibold ${color}`}>
      <span aria-hidden="true">{arrow}</span>
      {change != null && <span>{sign}{change.toFixed(2)}</span>}
      {pct != null && <span>({sign}{pct.toFixed(2)}%)</span>}
      <span className="text-xs font-normal opacity-80">{verbal}</span>
    </span>
  );
}

// Market chip (US/HK/A 股 label).
export function MarketTag({ market }: { market?: Market | null }) {
  if (!market) return <span className="text-text-tertiary text-xs">—</span>;
  return (
    <span className="inline-flex items-center rounded bg-dark-tertiary px-1.5 py-0.5 text-xs font-medium text-text-secondary">
      {DEFAULT_MARKET_LABEL[market] ?? market}
    </span>
  );
}
