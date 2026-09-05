'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reportsAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { RiskBadge, RecommendationBadge, MarketTag } from '@/components/ws133/market';
import type { ReportPreview } from '@/lib/types';

export default function MePage() {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['my-reports', statusFilter],
    queryFn: () => reportsAPI.listMine({ limit: 50, ...(statusFilter !== 'all' ? { status: statusFilter } : {}) }),
    enabled: !!user,
  });

  const togglePublic = useMutation({
    mutationFn: (r: ReportPreview) => reportsAPI.setPublic(r.analysis_id ?? r.id, !r.is_public),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-reports'] }),
  });

  const reports = (data?.data ?? []) as ReportPreview[];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-responsive-h2 text-text-primary">我的分析</h1>
          <p className="mt-1 text-sm text-text-tertiary">查看您的分析记录，并可一键切换是否公开。</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-dark-border bg-dark-secondary p-1">
          {['all', 'completed', 'failed'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                statusFilter === s ? 'bg-accent-primary text-white' : 'text-text-secondary'
              }`}
            >
              {s === 'all' ? '全部' : s === 'completed' ? '已完成' : '失败'}
            </button>
          ))}
        </div>
      </div>

      {authLoading || isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-dark-secondary" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-dark-border bg-dark-secondary/50 p-12 text-center text-sm text-text-tertiary">
          <i className="fas fa-file-lines mb-2 block text-2xl" aria-hidden="true" />
          暂无分析记录。
          <div className="mt-3">
            <Link href="/" className="text-accent-primary hover:underline">去发起一次分析 →</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div
              key={r.analysis_id ?? r.id}
              className="flex flex-col gap-3 rounded-xl border border-dark-border bg-dark-secondary p-4 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="num text-lg font-bold text-text-primary">{r.ticker}</span>
                  <MarketTag market={r.market} />
                </div>
                <div className="hidden items-center gap-2 md:flex">
                  <RecommendationBadge value={r.recommendation ?? null} />
                  <RiskBadge level={r.risk_level} />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-text-tertiary">
                <span className="num">{r.model ?? '—'}</span>
                <span className="num">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</span>
                <span
                  className={`rounded px-1.5 py-0.5 ${
                    r.status === 'completed' ? 'bg-down/10 text-down' : 'bg-warning-500/10 text-warning-500'
                  }`}
                >
                  {r.status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => togglePublic.mutate(r)}
                  disabled={togglePublic.isPending}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    r.is_public
                      ? 'border-accent-primary/40 text-accent-primary'
                      : 'border-dark-border text-text-tertiary'
                  }`}
                >
                  {r.is_public ? '公开中' : '设为公开'}
                </button>
                <Link
                  href={`/reports/${r.analysis_id ?? r.id}`}
                  className="rounded-lg bg-dark-tertiary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-dark-elevated"
                >
                  查看
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
