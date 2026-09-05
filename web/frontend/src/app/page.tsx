'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI } from '@/lib/api';
import { SiteHeader } from '@/components/ws133/Shell';
import { ReportPreviewCard } from '@/components/ws133/ReportPreviewCard';
import { Reveal, TiltCard } from '@/components/ws133/Reveal';
import type { ReportPreview } from '@/lib/types';

const SUGGESTIONS = [
  { text: 'AAPL', label: '苹果' },
  { text: '0700.HK', label: '腾讯控股' },
  { text: '600519', label: '贵州茅台' },
  { text: 'MiniMax 纳入港股通对后市的影响', label: '自然语言研究' },
];

// 多智能体角色链（关于 TradingAgents）
const ROLES = [
  { icon: 'fa-users', title: '分析师团队', desc: '市场、基本面、新闻、舆情等多路分析师并行收集与研判数据。' },
  { icon: 'fa-scale-balanced', title: '多空辩论', desc: '看多（Bull）与看空（Bear）研究员对立论证，让观点充分交锋。' },
  { icon: 'fa-chart-line', title: 'Trader 策略', desc: '结合辩论结果给出交易计划与参考区间（仅为建议，非执行）。' },
  { icon: 'fa-gavel', title: '风险评审裁决', desc: '综合风险等级、价格区间、置信度与持有期限，给出最终裁决。' },
  { icon: 'fa-list-check', title: '风险辩论与总结', desc: '多轮风险评审后输出结构化、可展开的最终研究报告。' },
  { icon: 'fa-rotate', title: '记忆与反思', desc: '带入历史判断与反思，让每次研究持续进化。' },
];



export default function HomePage() {
  const router = useRouter();
  const [q, setQ] = useState('');

  const submit = (value: string) => {
    const query = value.trim() || q.trim();
    if (!query) return;
    router.push(`/research?q=${encodeURIComponent(query)}`);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['public-reports-home'],
    queryFn: () => reportsAPI.publicList({ limit: 6 }),
    staleTime: 30_000,
  });

  const reports = (data?.data ?? []) as ReportPreview[];

  return (
    <div className="min-h-screen bg-dark-primary">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-16 md:pt-24">
        {/* Hero */}
        <section className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-primary text-white shadow-glow-blue">
            <i className="fas fa-chart-line text-2xl" aria-hidden="true" />
          </div>
          <h1 className="text-responsive-h1 text-text-primary">
            用多智能体团队研究一只股票
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-text-secondary md:text-base">
            输入股票代码、公司名称或自然语言研究指令，TradingAgents
            将组织分析师、多空辩论、Trader 与风险评审团队产出可追溯的研究报告。
          </p>

          {/* Search box */}
          <form
            className="mx-auto mt-8 max-w-2xl"
            onSubmit={(e) => {
              e.preventDefault();
              submit(q);
            }}
          >
            <div className="flex items-center gap-2 rounded-2xl border border-dark-border bg-dark-secondary p-2 shadow-card-dark focus-within:border-accent-primary/60">
              <i className="fas fa-magnifying-glass pl-2 text-text-tertiary" aria-hidden="true" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="例如：AAPL、0700.HK、600519、MiniMax 纳入港股通对后市的影响"
                className="h-12 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary md:text-base"
              />
              <button
                type="submit"
                className="h-12 rounded-xl bg-accent-primary px-5 text-sm font-semibold text-white hover:bg-accent-secondary"
              >
                开始研究
              </button>
            </div>
          </form>

          {/* Suggestions */}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.text}
                type="button"
                onClick={() => submit(s.text)}
                className="rounded-lg border border-dark-border bg-dark-secondary px-3 py-1.5 text-xs text-text-secondary hover:border-accent-primary/50 hover:text-text-primary"
              >
                {s.text}
                <span className="ml-1 text-text-tertiary">· {s.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 关于 TradingAgents */}
        <section className="mt-16">
          <Reveal>
            <div className="mb-6 text-center">
              <h2 className="flex items-center justify-center gap-2 text-responsive-h2 text-text-primary">
                <i className="fas fa-robot text-accent-primary" aria-hidden="true" />
                关于 TradingAgents
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-text-secondary">
                一个由多智能体协作的 AI 股票研究平台。输入一家公司，TradingAgents
                会组织一整支「研究团队」——从数据收集、观点对立，到风险裁决与总结，产出可追溯、可展开的研究报告。
              </p>
            </div>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((r, i) => (
              <Reveal key={r.title} delay={i * 60} className="h-full">
                <TiltCard className="flex h-full flex-col">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-primary/15 text-accent-primary">
                    <i className={`fas ${r.icon} text-lg`} aria-hidden="true" />
                  </div>
                  <h3 className="text-responsive-h4 text-text-primary">{r.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{r.desc}</p>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Latest public research */}
        <section className="mt-16">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-responsive-h3 text-text-primary">
              <i className="fas fa-tower-broadcast text-accent-primary" aria-hidden="true" />
              最新公开研究
            </h2>
            <a href="/public" className="text-sm text-accent-primary hover:underline">
              查看热门研究 →
            </a>
          </div>

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-xl bg-dark-secondary" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-dark-border bg-dark-secondary/50 p-10 text-center text-sm text-text-tertiary">
              <i className="fas fa-inbox mb-2 block text-2xl" aria-hidden="true" />
              暂无公开研究报告。完成一次分析后，可将其设为公开。
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reports.map((r) => (
                <ReportPreviewCard key={r.analysis_id ?? r.id} report={r} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
