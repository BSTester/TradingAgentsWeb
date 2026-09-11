'use client';

import { AccountLayout } from '@/components/site/AccountLayout';
import Link from 'next/link';

// 示例数据：订阅计费表尚未在后端落地，先用示例展示形态。
const SAMPLE_LEDGER = [
  { id: 1, type: 'purchase', label: '购买 50 次套餐', delta: 50, balance: 50, at: '2026-08-10 14:20' },
  { id: 2, type: 'consume', label: '腾讯控股 0700.HK 研究', delta: -1, balance: 49, at: '2026-08-11 09:05' },
  { id: 3, type: 'consume', label: '宁德时代 300750 研究', delta: -1, balance: 48, at: '2026-08-11 16:40' },
];

export default function BillingPage() {
  return (
    <AccountLayout
      active="billing"
      eyebrow="个人工作区"
      title="订阅明细"
      subtitle="订阅次数的购买与消耗记录。"
      actions={
        <Link href="/subscription" className="btn-secondary text-xs">购买次数</Link>
      }
    >
      <div className="surface-panel mt-6 flex items-center gap-4 p-5">
        <i className="fa-solid fa-bolt text-2xl text-verdict-hold" />
        <div>
          <div className="text-xs text-text-tertiary">当前可用次数（示例）</div>
          <div className="num text-3xl font-semibold text-text-primary">48</div>
        </div>
        <span className="data-sample-badge ml-auto">示例数据</span>
      </div>

      <div className="surface-panel mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-dark-border text-left text-xs text-text-tertiary">
            <tr>
              <th className="px-4 py-2.5 font-medium">时间</th>
              <th className="px-4 py-2.5 font-medium">明细</th>
              <th className="px-4 py-2.5 text-right font-medium">变动</th>
              <th className="px-4 py-2.5 text-right font-medium">余额</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_LEDGER.map((row) => (
              <tr key={row.id} className="border-b border-dark-border/60 last:border-0">
                <td className="num px-4 py-3 text-xs text-text-tertiary">{row.at}</td>
                <td className="px-4 py-3 text-text-secondary">{row.label}</td>
                <td className={`num px-4 py-3 text-right font-medium ${row.delta > 0 ? 'text-verdict-bull' : 'text-verdict-bear'}`}>
                  {row.delta > 0 ? '+' : ''}{row.delta}
                </td>
                <td className="num px-4 py-3 text-right text-text-primary">{row.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="disclaimer-strip mt-3">计费明细为示例数据；后端订阅配额表（SubscriptionProduct / UserQuota / QuotaLedger）落地后将对接真实记录。</p>
    </AccountLayout>
  );
}
