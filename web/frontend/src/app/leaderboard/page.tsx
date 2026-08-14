'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { SiteLayout } from '@/components/site/SiteLayout';
import { reportAPI } from '@/lib/api/reports';
import { ResearchCard } from '@/components/site/ResearchCard';
import { SearchBar } from '@/components/site/SearchBar';

export default function LeaderboardPage() {
  const [market, setMarket] = useState<string>('');
  const { data, isLoading } = useQuery({
    queryKey: ['public-reports', market],
    queryFn: () => reportAPI.list({ limit: 30, ...(market ? { market } : {}) }),
  });

  const reports = data?.data ?? [];

  return (
    <SiteLayout maxWidth="max-w-5xl">
      <div className="mb-6">
        <h1 className="h-serif text-2xl">公开研究榜单</h1>
        <p className="mt-1 text-sm text-text-secondary">社区公开的多智能体研究报告，点击卡片查看完整角色链。</p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[{ k: '', l: '全部' }, { k: 'US', l: '美股' }, { k: 'HK', l: '港股' }, { k: 'CN', l: 'A股' }].map((m) => (
          <button
            key={m.k}
            onClick={() => setMarket(m.k)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              market === m.k ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-dark-border text-text-secondary hover:text-text-primary'
            }`}
          >
            {m.l}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-text-tertiary">
          <i className="fa-solid fa-circle-notch animate-spin mr-2" /> 加载中…
        </div>
      ) : reports.length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-3 px-4 py-16 text-center">
          <i className="fa-regular fa-chart-bar text-3xl text-text-tertiary" />
          <p className="text-sm text-text-secondary">暂无公开研究报告</p>
          <div className="mt-2 w-full max-w-md"><SearchBar size="md" /></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => <ResearchCard key={r.id} report={r} />)}
        </div>
      )}
    </SiteLayout>
  );
}
