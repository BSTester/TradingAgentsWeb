'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AccountLayout } from '@/components/site/AccountLayout';
import { reportAPI } from '@/lib/api/reports';
import { ResearchCard } from '@/components/site/ResearchCard';
import { useAuth } from '@/lib/auth';

export default function MyAnalysesPage() {
  const { user, isLoading } = useAuth();
  const { data } = useQuery({
    queryKey: ['my-reports'],
    queryFn: () => reportAPI.list({ limit: 30 }),
    enabled: !!user,
  });

  if (!isLoading && !user) {
    return (
      <AccountLayout
        active="me"
        eyebrow="个人工作区"
        title="我的分析"
        subtitle="登录后查看你的分析记录"
      >
        <div className="surface-card mt-6 flex flex-col items-center gap-3 px-4 py-16 text-center">
          <i className="fa-regular fa-user text-3xl text-text-tertiary" />
          <p className="text-sm text-text-secondary">登录后查看你的分析记录</p>
          <Link href="/auth" className="btn-primary mt-2 text-xs">去登录</Link>
        </div>
      </AccountLayout>
    );
  }

  const reports = data?.data ?? [];

  return (
    <AccountLayout
      active="me"
      eyebrow="个人工作区"
      title="我的分析"
      subtitle="保存的报告可随时设置为公开，让其他人从研究榜单中查看。"
      actions={
        <Link href="/" className="btn-primary text-xs">发起研究</Link>
      }
    >
      {reports.length === 0 ? (
        <div className="surface-card mt-6 flex flex-col items-center gap-3 px-4 py-16 text-center">
          <i className="fa-regular fa-folder-open text-3xl text-text-tertiary" />
          <p className="text-sm text-text-secondary">还没有分析记录</p>
          <Link href="/" className="btn-primary mt-2 text-xs">发起第一次研究</Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => <ResearchCard key={r.id} report={r} />)}
        </div>
      )}
    </AccountLayout>
  );
}
