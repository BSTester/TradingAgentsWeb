'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { SiteLayout } from '@/components/site/SiteLayout';
import { reportAPI } from '@/lib/api/reports';
import { ResearchCard } from '@/app/page';
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
      <SiteLayout maxWidth="max-w-3xl">
        <div className="surface-card flex flex-col items-center gap-3 px-4 py-16 text-center">
          <i className="fa-regular fa-user text-3xl text-text-tertiary" />
          <p className="text-sm text-text-secondary">登录后查看你的分析记录</p>
          <Link href="/auth" className="btn-primary mt-2 text-xs">去登录</Link>
        </div>
      </SiteLayout>
    );
  }

  const reports = data?.data ?? [];

  return (
    <SiteLayout maxWidth="max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="h-serif text-2xl">我的分析</h1>
          <p className="mt-1 text-sm text-text-secondary">你发起的多智能体研究报告，可在此管理与公开。</p>
        </div>
        <MeNav active="me" />
      </div>

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
    </SiteLayout>
  );
}

export function MeNav({ active }: { active: 'me' | 'billing' | 'preferences' }) {
  const items = [
    { k: 'me', href: '/me', label: '我的分析' },
    { k: 'billing', href: '/me/billing', label: '订阅明细' },
    { k: 'preferences', href: '/me/preferences', label: '账户偏好' },
  ];
  return (
    <nav className="flex gap-1">
      {items.map((i) => (
        <Link
          key={i.k}
          href={i.href}
          className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
            active === i.k ? 'bg-dark-tertiary text-text-primary' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

