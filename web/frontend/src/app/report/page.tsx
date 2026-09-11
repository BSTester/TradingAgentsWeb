'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { RoleChainReportView } from '@/components/report/RoleChainReport';
import { DisclaimerBanner } from '@/components/site/DisclaimerBanner';
import { SiteLayout } from '@/components/site/SiteLayout';
import { reportAPI } from '@/lib/api/reports';

function ReportInner() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['report', id],
    queryFn: () => reportAPI.get(id),
    enabled: !!id,
  });

  if (!id) {
    return (
      <SiteLayout maxWidth="max-w-3xl">
        <div className="surface-card flex flex-col items-center gap-3 px-4 py-16 text-center">
          <i className="fa-regular fa-folder-open text-3xl text-text-tertiary" />
          <p className="text-sm text-text-secondary">未指定报告</p>
          <Link href="/leaderboard" className="btn-ghost mt-2 text-xs">浏览公开榜单</Link>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout maxWidth="max-w-4xl">
      {isLoading && (
        <div className="flex items-center justify-center py-24 text-text-tertiary">
          <i className="fa-solid fa-circle-notch animate-spin mr-2" /> 正在加载报告…
        </div>
      )}
      {error && !isLoading && (
        <div className="surface-card flex flex-col items-center gap-3 px-4 py-16 text-center">
          <i className="fa-regular fa-folder-open text-3xl text-text-tertiary" />
          <p className="text-sm text-text-secondary">报告不存在或暂不可见</p>
          <p className="text-xs text-text-tertiary">该报告可能为私有，需登录其作者账号查看。</p>
          <Link href="/leaderboard" className="btn-ghost mt-2 text-xs">返回公开榜单</Link>
        </div>
      )}
      {data && !isLoading && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <Link href="/leaderboard" className="text-xs text-text-tertiary hover:text-text-secondary">← 返回</Link>
            <div className="flex gap-2">
              <a href={reportAPI.exportUrl(id, 'md')} className="btn-ghost px-3 py-1.5 text-xs"><i className="fa-solid fa-file-lines mr-1.5" />Markdown</a>
              <a href={reportAPI.exportUrl(id, 'pdf')} className="btn-ghost px-3 py-1.5 text-xs"><i className="fa-solid fa-file-pdf mr-1.5" />PDF</a>
            </div>
          </div>
          <DisclaimerBanner />
          {data.role_chain ? (
            <RoleChainReportView report={data.role_chain} />
          ) : (
            <LegacyReportView />
          )}
        </div>
      )}
    </SiteLayout>
  );
}

function LegacyReportView() {
  return (
    <div className="surface-card p-6 text-center">
      <i className="fa-regular fa-clock text-3xl text-text-tertiary" />
      <p className="mt-3 text-sm text-text-secondary">该报告尚无结构化角色链数据</p>
      <p className="mt-1 text-xs text-text-tertiary">可能是较早的分析或仍在进行中。新分析完成后将自动渲染完整多智能体角色链。</p>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportInner />
    </Suspense>
  );
}

