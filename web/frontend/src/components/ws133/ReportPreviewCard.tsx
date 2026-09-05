'use client';

import React from 'react';
import Link from 'next/link';
import type { ReportPreview } from '@/lib/types';
import { MarketTag, RiskBadge, RecommendationBadge, PriceChange } from './market';
import { formatAmount } from '@/utils/marketCurrency';

export function ReportPreviewCard({
  report,
  rank,
}: {
  report: ReportPreview;
  rank?: number;
}) {
  const marketLabel = report.market;
  const price = report.realtime_price ?? report.close_price;
  const conf = report.confidence ?? null;

  return (
    <Link
      href={`/reports/${report.analysis_id ?? report.id}`}
      className="group flex h-full flex-col rounded-xl border border-dark-border bg-dark-secondary p-4 shadow-card-dark transition-all hover:border-accent-primary/50 hover:shadow-glow-blue"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {rank != null && (
            <span className="num flex h-6 w-6 items-center justify-center rounded bg-dark-tertiary text-xs font-bold text-text-secondary">
              {rank}
            </span>
          )}
          <span className="num text-lg font-bold text-text-primary">{report.ticker}</span>
          <MarketTag market={marketLabel} />
        </div>
        <RiskBadge level={report.risk_level} />
      </div>

      {/* 公司名（缺值占位） */}
      <p className="mt-1 truncate text-sm text-text-secondary">
        {report.company_name || '—'}
      </p>

      {/* 价格（统一标签「参考价」，缺值占位） */}
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-xs text-text-tertiary">参考价</p>
          <p className="num text-xl font-bold text-text-primary">
            {price != null ? formatAmount(price, report.market ?? 'US') : '—'}
          </p>
        </div>
        <p className="num text-xs text-text-tertiary">{report.analysis_date || '—'}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-dark-tertiary/60 p-2">
          <p className="text-xs text-text-tertiary">分析模型</p>
          <p className="num truncate text-text-primary">{report.model || '—'}</p>
        </div>
        <div className="rounded-lg bg-dark-tertiary/60 p-2">
          <p className="text-xs text-text-tertiary">建议</p>
          <RecommendationBadge value={report.recommendation ?? null} />
        </div>
        <div className="col-span-2 rounded-lg bg-dark-tertiary/60 p-2">
          <p className="text-xs text-text-tertiary">参考交易价格区间</p>
          {report.price_range ? (
            <p className="num text-text-primary">
              {formatAmount(report.price_range[0], report.market ?? 'US')}
              {' – '}
              {formatAmount(report.price_range[1], report.market ?? 'US')}
            </p>
          ) : (
            <p className="text-text-secondary">—</p>
          )}
        </div>
      </div>

      {/* 置信度（缺值占位） */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-text-tertiary">
          <span>置信度</span>
          <span className="num">{conf != null ? `${Math.round(conf * 100)}%` : '—'}</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-dark-tertiary">
          <div
            className="h-full rounded-full bg-accent-primary"
            style={{ width: conf != null ? `${conf * 100}%` : '0%' }}
          />
        </div>
      </div>
    </Link>
  );
}

export function MarketFilterTabs({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const tabs = [
    { key: 'all', label: '全部' },
    { key: 'US', label: '美股' },
    { key: 'HK', label: '港股' },
    { key: 'CN', label: 'A股' },
  ];
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-dark-border bg-dark-secondary p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === t.key
              ? 'bg-accent-primary text-white'
              : 'text-text-secondary hover:bg-dark-tertiary'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
