'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '@/lib/api';
import { MarketTag, RiskBadge, RecommendationBadge } from '@/components/ws133/market';
import type { AdminPublicReportItem } from '@/lib/types';

export default function AdminPublicReportsPage() {
  const queryClient = useQueryClient();
  const [market, setMarket] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-public-reports', market],
    queryFn: () => adminAPI.publicReports({ limit: 50, ...(market !== 'all' ? { market } : {}) }),
  });

  const toggle = useMutation({
    mutationFn: (r: { analysis_id: string; is_public: boolean }) => adminAPI.setReportPublic(r.analysis_id, !r.is_public),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-public-reports'] }),
  });

  const reports = (data?.data ?? []) as AdminPublicReportItem[];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-responsive-h2 text-text-primary">公开报告管理</h1>
          <p className="mt-1 text-sm text-text-tertiary">报告目录与可见性治理。管理员不替作者擅自公开。</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-dark-border bg-dark-secondary p-1">
          {['all', 'US', 'HK', 'CN'].map((m) => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${market === m ? 'bg-accent-primary text-white' : 'text-text-secondary'}`}
            >
              {m === 'all' ? '全部' : m}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-dark-secondary" />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-dark-border bg-dark-secondary/50 p-10 text-center text-sm text-text-tertiary">暂无报告。</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-dark-border">
          <table className="table">
            <thead>
              <tr>
                <th>标的</th>
                <th>作者</th>
                <th>市场</th>
                <th>建议</th>
                <th>风险</th>
                <th>时间</th>
                <th>可见性</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.analysis_id ?? r.id}>
                  <td>
                    <Link href={`/reports/${r.analysis_id ?? r.id}`} className="num font-semibold text-text-primary hover:text-accent-primary">
                      {r.ticker}
                    </Link>
                  </td>
                  <td>{r.owner ?? '—'}</td>
                  <td><MarketTag market={r.market} /></td>
                  <td><RecommendationBadge value={r.recommendation ?? null} /></td>
                  <td><RiskBadge level={r.risk_level} /></td>
                  <td className="num text-text-tertiary">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <button
                      onClick={() => toggle.mutate({ analysis_id: r.analysis_id ?? r.id, is_public: r.is_public })}
                      disabled={toggle.isPending}
                      className={`rounded-lg border px-3 py-1 text-xs font-medium ${
                        r.is_public ? 'border-accent-primary/40 text-accent-primary' : 'border-dark-border text-text-tertiary'
                      }`}
                    >
                      {r.is_public ? '公开' : '私密'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
