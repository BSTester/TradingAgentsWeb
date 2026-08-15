'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/auth';
import { SiteLayout } from '@/components/site/SiteLayout';
import { SystemDefaultForm } from '@/components/admin/system-default-provider/SystemDefaultForm';
import { PageLoading } from '@/components/ui/PageLoading';

export default function SystemDefaultProviderPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // 权限检查：仅管理员可访问，普通用户无写权限，重定向回首页
  React.useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user || user.role !== 'admin') {
    return <PageLoading message="正在验证管理员权限..." />;
  }

  return (
    <SiteLayout maxWidth="max-w-5xl">
      {/* 页面标题 */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="num text-[11px] uppercase tracking-[0.16em] text-accent-primary">管理控制台</div>
          <h1 className="h-serif mt-1 text-2xl">
            <i className="fas fa-star mr-2 text-accent-primary" aria-hidden="true" />
            系统默认 Provider
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            指定一个系统默认 AI provider，供未配置个人 provider 的用户使用。其 API Key 由后端保存并脱敏，不会以明文暴露。
          </p>
        </div>
        <span className="verdict-pill verdict-hold">管理员</span>
      </div>

      <SystemDefaultForm />
    </SiteLayout>
  );
}
