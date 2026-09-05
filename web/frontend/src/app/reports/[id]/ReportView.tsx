'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI } from '@/lib/api';
import { PageShell } from '@/components/ws133/Shell';
import { RiskBadge, RecommendationBadge, MarketTag } from '@/components/ws133/market';
import { formatAmount } from '@/utils/marketCurrency';
import LazyMarkdown from '@/components/common/LazyMarkdown';
import type { ReportDetail, RoleChainNode } from '@/lib/types';

export default function ReportView() {
  const { id } = useParams<{ id: string }>();
  const reportId = Array.isArray(id) ? id[0] : id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => reportsAPI.get(reportId),
    staleTime: 30_000,
    retry: false,
  });

  const report = data?.data as ReportDetail | undefined;

  // 合并「返回顶部/底部」为单按钮：在顶部显示↓（去底部），在底部显示↑（回顶部）。
  const [atBottom, setAtBottom] = useState(false);
  useEffect(() => {
    const recompute = () =>
      setAtBottom(Math.ceil(window.innerHeight + window.scrollY) >= document.body.scrollHeight - 40);
    window.addEventListener('scroll', recompute, { passive: true });
    window.addEventListener('resize', recompute);
    recompute();
    return () => {
      window.removeEventListener('scroll', recompute);
      window.removeEventListener('resize', recompute);
    };
  }, [data, isLoading]);

  // 导出 PDF（带封面研报）
  const [downloading, setDownloading] = useState(false);
  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const blob = await reportsAPI.exportPdf(reportId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report?.ticker ?? 'report'}_多智能体研报.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      alert(e?.message ?? '导出失败，请稍后重试');
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <PageShell>
        <div className="mx-auto max-w-6xl space-y-3">
          <div className="h-32 animate-pulse rounded-xl bg-dark-secondary" />
          <div className="h-64 animate-pulse rounded-xl bg-dark-secondary" />
        </div>
      </PageShell>
    );
  }

  if (!report) {
    return (
      <PageShell>
        <div className="rounded-xl border border-dashed border-dark-border bg-dark-secondary/50 p-12 text-center text-sm text-text-tertiary">
          {(error as any)?.message || '报告不存在或未公开。'}
        </div>
      </PageShell>
    );
  }

  const verdictNodes = (report.role_chain ?? []).filter((n) => n.type === 'risk-judge');

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="num text-responsive-h2 text-text-primary">{report.ticker}</h1>
              <MarketTag market={report.market} />
              <RiskBadge level={report.risk_level} />
            </div>
            {report.company_name && (
              <p className="mt-1 text-sm text-text-secondary">{report.company_name}</p>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-text-tertiary">
              {report.model && (
                <span><i className="fas fa-microchip mr-1" aria-hidden="true" />{report.model}</span>
              )}
              {report.analysis_date && <span className="num">分析日 {report.analysis_date}</span>}
              {report.status === 'completed' ? (
                <span className="text-down">已完成</span>
              ) : (
                <span className="text-warning-500">{report.status}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadPdf}
              disabled={!!downloading}
              className="flex items-center gap-2 rounded-lg border border-dark-border bg-dark-secondary px-3 py-2 text-sm font-medium text-text-primary hover:border-accent-primary/50 hover:text-accent-primary disabled:opacity-60"
            >
              <i className={`fas ${downloading ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`} aria-hidden="true" />
              {downloading ? '生成中…' : '导出 PDF'}
            </button>
          </div>
        </div>

        {/* Risk Judge verdict (置顶) */}
        <section className="mb-6 rounded-2xl border border-accent-primary/30 bg-gradient-to-br from-dark-secondary to-dark-tertiary p-6 shadow-card-dark">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-primary text-white">
              <i className="fas fa-gavel" aria-hidden="true" />
            </span>
            <h2 className="text-responsive-h4 text-text-primary">风险评审裁决</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <VerdictStat label="建议" value={<RecommendationBadge value={report.recommendation ?? null} />} />
            <VerdictStat
              label="价格区间"
              value={
                report.price_range ? (
                  <span className="num">
                    {formatAmount(report.price_range[0], report.market ?? 'US')}
                    {' – '}
                    {formatAmount(report.price_range[1], report.market ?? 'US')}
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <VerdictStat
              label="置信度"
              value={report.confidence != null ? <span className="num">{Math.round(report.confidence * 100)}%</span> : '—'}
            />
            <VerdictStat label="持有期限" value={report.holding_period ?? '—'} />
          </div>

          {report.realtime_price != null || report.close_price != null ? (
            <div className="mt-4 flex gap-6 text-sm">
              {report.realtime_price != null && (
                <div>
                  <p className="text-xs text-text-tertiary">实时价</p>
                  <p className="num text-lg font-bold text-text-primary">
                    {formatAmount(report.realtime_price, report.market ?? 'US')}
                  </p>
                </div>
              )}
              {report.close_price != null && (
                <div>
                  <p className="text-xs text-text-tertiary">收盘价</p>
                  <p className="num text-lg font-bold text-text-primary">
                    {formatAmount(report.close_price, report.market ?? 'US')}
                  </p>
                </div>
              )}
              {report.data_source_count != null && (
                <div>
                  <p className="text-xs text-text-tertiary">数据来源</p>
                  <p className="num text-lg font-bold text-text-primary">{report.data_source_count}</p>
                </div>
              )}
            </div>
          ) : null}

          {/* 裁决结论 + 风险提示文本：左右显示 */}
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_15rem]">
            {/* 裁决结论：醒目大字号 */}
            <div className="rounded-xl border-l-4 border-accent-primary bg-accent-primary/5 p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent-primary">
                <i className="fas fa-gavel mr-1" aria-hidden="true" />
                裁决结论
              </p>
              <div className="report-markdown text-base md:text-lg">
                <LazyMarkdown preset="gfm">
                  {verdictNodes[0]?.summary || report.trading_decision || report.final_summary || '暂无裁决摘要'}
                </LazyMarkdown>
              </div>
            </div>
            {/* 风险提示文本 */}
            <div className="flex flex-col justify-between rounded-xl border border-warning-500/30 bg-warning-500/5 p-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-warning-500">
                  <i className="fas fa-shield-halved" aria-hidden="true" />
                  风险提示
                </p>
                <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
                  本报告由 TradingAgents 多智能体系统基于公开数据自动生成，仅供研究参考，不构成任何投资建议。据此操作，风险自负。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Role chain */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-responsive-h3 text-text-primary">
            <i className="fas fa-sitemap text-accent-primary" aria-hidden="true" />
            多智能体角色链
          </h2>

          {(() => {
            // 角色链：去掉与顶部「风险评审裁决」概览重复的 risk-judge 节点
            const chain = (report.role_chain ?? []).filter((n) => n.type !== 'risk-judge');
            if (chain.length === 0) {
              return (
                <div className="rounded-xl border border-dashed border-dark-border bg-dark-secondary/50 p-8 text-center text-sm text-text-tertiary">
                  该报告暂无可展开的角色链详情。
                </div>
              );
            }
            return (
              <div className="space-y-2">
                {chain.map((node, i) => (
                  <RoleChainNodeCard key={node.id ?? i} node={node} index={i} />
                ))}
              </div>
            );
          })()}
        </section>
      </div>

      {/* 快速返回顶部 / 底部（单按钮，方向随当前滚动位置变化） */}
      <button
        type="button"
        onClick={() =>
          window.scrollTo({ top: atBottom ? 0 : document.body.scrollHeight, behavior: 'smooth' })
        }
        title={atBottom ? '返回顶部' : '返回底部'}
        aria-label={atBottom ? '返回顶部' : '返回底部'}
        className="fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-dark-border bg-dark-secondary/90 text-text-secondary shadow-card-dark backdrop-blur hover:border-accent-primary/50 hover:text-accent-primary"
      >
        <i className={`fas ${atBottom ? 'fa-arrow-up' : 'fa-arrow-down'}`} aria-hidden="true" />
      </button>
    </PageShell>
  );
}

function VerdictStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-dark-tertiary/50 p-3">
      <p className="text-xs text-text-tertiary">{label}</p>
      <div className="mt-1 text-sm font-semibold text-text-primary">{value}</div>
    </div>
  );
}

function RoleChainNodeCard({ node, index }: { node: RoleChainNode; index: number }) {
  const [open, setOpen] = useState(index < 1); // first node open by default
  const icon = {
    analysts: 'fa-users',
    bull: 'fa-arrow-trend-up',
    bear: 'fa-arrow-trend-down',
    trader: 'fa-chart-line',
    'risk-review': 'fa-shield',
    summary: 'fa-list-check',
    'risk-judge': 'fa-gavel',
  }[node.type] ?? 'fa-circle';
  const agents = node.agents && node.agents.length > 0 ? node.agents : null;

  return (
    <div className="rounded-xl border border-dark-border bg-dark-secondary">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="num flex h-6 w-6 items-center justify-center rounded bg-dark-tertiary text-xs text-text-secondary">
            {index + 1}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-primary/15 text-accent-primary">
            <i className={`fas ${icon}`} aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <div className="report-md-inline text-sm font-semibold text-text-primary">
              <LazyMarkdown preset="gfm">{node.title}</LazyMarkdown>
            </div>
            <div className="report-md-inline max-w-xl truncate text-xs text-text-tertiary">
              <LazyMarkdown preset="gfm">{node.summary}</LazyMarkdown>
            </div>
          </div>
        </div>
        <i
          className={`fas ${open ? 'fa-chevron-up' : 'fa-chevron-down'} text-text-tertiary`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="border-t border-dark-border px-5 pt-4 pb-5">
          {agents ? (
            // 分析师团队：分角色折叠子卡片
            <div className="space-y-2">
              {agents.map((a, i) => (
                <AgentSubCard key={a.name + i} name={a.name} result={a.result} defaultOpen={i === 0} />
              ))}
            </div>
          ) : (
            <div className="report-markdown">
              <LazyMarkdown preset="gfm">{node.content || node.summary || '暂无内容'}</LazyMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AgentSubCard({ name, result, defaultOpen }: { name: string; result: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="overflow-hidden rounded-lg border border-dark-border bg-dark-tertiary/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <i className="fas fa-user-tie text-accent-primary" aria-hidden="true" />
          <span className="report-md-inline">{name}</span>
        </span>
        <i className={`fas ${open ? 'fa-chevron-up' : 'fa-chevron-down'} text-text-tertiary`} aria-hidden="true" />
      </button>
      {open && (
        <div className="report-markdown border-t border-dark-border px-4 pt-3 pb-4">
          <LazyMarkdown preset="gfm">{result || '暂无内容'}</LazyMarkdown>
        </div>
      )}
    </div>
  );
}
