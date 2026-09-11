'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SearchBar } from '@/components/site/SearchBar';
import { SiteLayout } from '@/components/site/SiteLayout';
import { ResearchCard } from '@/components/site/ResearchCard';
import { reportAPI } from '@/lib/api/reports';
import type { ReportPreview } from '@/types/report';

const FEATURES = [
  { icon: 'fa-users-gear', title: '多智能体协作', desc: '市场 / 舆情 / 新闻 / 基本面分析师 + 多空辩论 + 风险裁决，结构化产出。' },
  { icon: 'fa-magnifying-glass-chart', title: '搜索即研究', desc: '股票代码、公司名称或自然语言指令，一句话触发全维分析。' },
  { icon: 'fa-shield-halved', title: '研究非交易', desc: '给出建议区间与仓位参考，全站无任何下单执行入口。' },
  { icon: 'fa-globe', title: '美股 / 港股 / A 股', desc: '三大市场统一研究流程，多模型路由与按次订阅配额。' },
];

export default function HomePage() {
  const [recent, setRecent] = useState<ReportPreview[]>([]);

  useEffect(() => {
    reportAPI.publicFeed(6).then((res) => setRecent(res.data));
  }, []);

  return (
    <SiteLayout maxWidth="max-w-5xl">
      {/* Hero search */}
      <section className="hero-search -mx-4 px-4 pt-10 pb-12 sm:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-dark-border bg-dark-secondary px-3 py-1 text-xs text-text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-primary" />
            AI 多智能体驱动的股票研究工作台
          </div>
          <h1 className="h-serif text-3xl leading-tight sm:text-5xl sm:leading-tight">
            用一句话，发起一次专业级股票研究
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-text-secondary sm:text-base">
            输入股票代码、公司名称或研究指令，多智能体团队将从市场、舆情、新闻、基本面到风险裁决，
            给出结构化的研究结论与建议区间。
          </p>
          <div className="mx-auto mt-8 max-w-2xl">
            <SearchBar size="lg" />
          </div>
          <p className="disclaimer-strip mt-4">
            示例 / 延迟数据 · 仅供研究参考 · 非投资建议 · 无下单执行入口
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="surface-card p-4">
            <i className={`fa-solid ${f.icon} text-accent-primary`} />
            <h3 className="mt-3 text-sm font-semibold text-text-primary">{f.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Recent public research */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="h-serif text-lg">最新公开研究</h2>
          <Link href="/leaderboard" className="text-xs text-accent-secondary hover:underline">
            查看全部榜单 →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="surface-card flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <i className="fa-regular fa-chart-bar text-2xl text-text-tertiary" />
            <p className="text-sm text-text-secondary">暂无公开研究报告</p>
            <p className="text-xs text-text-tertiary">完成分析后在「我的分析」中开启公开，即可上榜。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((r) => (
              <ResearchCard key={r.id} report={r} />
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}

