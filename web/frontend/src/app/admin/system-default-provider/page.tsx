'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/auth';
import { AppNavbar } from '@/components/common/AppNavbar';
import { Footer } from '@/components/common/Footer';
import { SystemDefaultForm } from '@/components/admin/system-default-provider/SystemDefaultForm';
import { PageLoading } from '@/components/ui/PageLoading';

export default function SystemDefaultProviderPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
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
    <div className="min-h-screen bg-dark-primary flex flex-col">
      <AppNavbar user={user} onLogout={logout} />

      <div className="flex-1 max-w-5xl mx-auto px-4 py-8 pt-20 sm:px-6 lg:px-8 w-full">
        {/* 页面标题 */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-text-primary">
            <i className="fas fa-star mr-3 text-accent-primary" aria-hidden="true" />
            系统默认 Provider
          </h2>
          <p className="mt-2 text-text-secondary">
            指定一个系统默认 AI provider，供未配置个人 provider 的用户使用。其 API Key 由后端保存并脱敏，不会以明文暴露。
          </p>
        </div>

        <SystemDefaultForm />
      </div>

      <Footer />
    </div>
  );
}
