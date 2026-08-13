'use client';

import Link from 'next/link';
import { SiteLayout } from '@/components/site/SiteLayout';
import { useAuth } from '@/lib/auth';

const PLANS = [
  { credits: 10, price: '¥39', per: '¥3.9 / 次', tag: '' },
  { credits: 50, price: '¥169', per: '¥3.38 / 次', tag: '推荐' },
  { credits: 200, price: '¥599', per: '¥2.995 / 次', tag: '超值' },
];

export default function SubscriptionPage() {
  const { user } = useAuth();
  return (
    <SiteLayout maxWidth="max-w-4xl">
      <h1 className="h-serif text-2xl">订阅中心</h1>
      <p className="mt-1 text-sm text-text-secondary">
        按次订阅。没有配置本地模型 Key 时，可消耗订阅次数使用系统大模型完成研究分析。
      </p>

      <div className="mt-5 surface-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-bolt text-verdict-hold" />
          <div>
            <div className="text-xs text-text-tertiary">当前可用次数（示例）</div>
            <div className="num text-xl font-semibold text-text-primary">{user ? '—' : '登录后查看'}</div>
          </div>
        </div>
        <p className="text-xs text-text-tertiary">每完成一次研究分析扣除 1 次，使用本地 Key 不扣次数。</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <div key={plan.credits} className={`surface-panel relative p-5 ${plan.tag ? 'border-verdict-hold/40' : ''}`}>
            {plan.tag && (
              <span className="absolute -top-2 right-4 rounded-full bg-verdict-hold px-2 py-0.5 text-[10px] font-medium text-dark-primary">{plan.tag}</span>
            )}
            <div className="num text-sm text-text-secondary">{plan.credits} 次</div>
            <div className="h-serif mt-2 text-3xl">{plan.price}</div>
            <div className="num mt-1 text-xs text-text-tertiary">{plan.per}</div>
            <button className="btn-primary mt-4 w-full text-xs" disabled>购买（即将上线）</button>
          </div>
        ))}
      </div>

      <div className="mt-6 surface-card p-4">
        <h3 className="text-sm font-medium text-text-primary">计费说明</h3>
        <ul className="mt-2 space-y-1.5 text-xs text-text-secondary">
          <li>· 系统模型分析按完成报告扣除订阅次数，启动前预扣，失败自动回补。</li>
          <li>· 配置并使用本地模型 Key 时，不消耗订阅次数。</li>
          <li>· 所有行情与价格为示例 / 延迟数据，研究结论非投资建议。</li>
        </ul>
        {!user && (
          <Link href="/auth" className="btn-ghost mt-4 inline-flex text-xs">登录后管理订阅</Link>
        )}
      </div>
    </SiteLayout>
  );
}

