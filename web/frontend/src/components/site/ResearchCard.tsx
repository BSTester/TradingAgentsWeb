import Link from 'next/link';
import type { ReportPreview } from '@/types/report';
import { VERDICT_PILL } from '@/types/report';

/**
 * 公开研究 / 我的分析列表中复用的研究报告卡片。
 * 从 src/app/page.tsx 抽出，避免在 page 模块里导出非页面组件
 * （Next.js 页面模块只应导出 default / metadata 等保留导出）。
 */
export function ResearchCard({ report }: { report: ReportPreview }) {
  const decision = report.role_chain?.decision;
  const verdict = decision?.verdict;
  const pill = verdict ? VERDICT_PILL[verdict] : 'verdict-neutral';
  return (
    <Link href={`/report?id=${report.id}`} className="surface-card block p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="num text-sm font-semibold text-text-primary">{report.ticker}</span>
            <span className="rounded bg-dark-tertiary px-1.5 py-0.5 text-[10px] text-text-tertiary">
              {report.market ? ({ US: '美股', HK: '港股', CN: 'A股' } as Record<string, string>)[report.market] ?? report.market : '—'}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-text-secondary">{report.company_name}</p>
        </div>
        <span className={`verdict-pill ${pill}`}>
          {report.trading_decision || decision?.verdictLabel || '待裁决'}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-text-secondary">
        {report.summary || '暂无摘要'}
      </p>
      <div className="mt-3 flex items-center justify-between text-[11px] text-text-tertiary">
        <span>{report.created_at ? new Date(report.created_at).toLocaleDateString('zh-CN') : '—'}</span>
        <span className="data-sample-badge">示例 / 延迟</span>
      </div>
    </Link>
  );
}

export default ResearchCard;
