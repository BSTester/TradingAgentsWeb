'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI } from '@/lib/api';
import { PageShell } from '@/components/ws133/Shell';
import { ReportPreviewCard, MarketFilterTabs } from '@/components/ws133/ReportPreviewCard';
import type { ReportPreview } from '@/lib/types';

export default function PublicPage() {
  const [market, setMarket] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['public-reports', market],
    queryFn: () => reportsAPI.publicList({ limit: 12, ...(market !== 'all' ? { market } : {}) }),
    staleTime: 30_000,
  });

  const reports = (data?.data ?? []) as ReportPreview[];
  const filtered = reports;

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-responsive-h2 text-text-primary">热门研究</h1>
          <p className="mt-1 text-sm text-text-tertiary">
            社区公开的多智能体研究报告，按市场筛选。
          </p>
        </div>
        <MarketFilterTabs value={market} onChange={setMarket} />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-52 animate-pulse rounded-xl bg-dark-secondary" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-dark-border bg-dark-secondary/50 p-12 text-center text-sm text-text-tertiary">
          <i className="fas fa-tower-broadcast mb-2 block text-2xl" aria-hidden="true" />
          暂无该市场的公开研究报告。
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r, i) => (
            <ReportPreviewCard key={r.analysis_id ?? r.id} report={r} rank={i + 1} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
