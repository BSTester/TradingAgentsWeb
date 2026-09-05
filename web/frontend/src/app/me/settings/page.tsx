'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { subscriptionAPI } from '@/lib/api';
import type { SubscriptionInfo } from '@/lib/types';

export default function MeSettingsPage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['subscription-me'],
    queryFn: () => subscriptionAPI.me(),
    enabled: !!user,
  });
  const me = data?.data as SubscriptionInfo | undefined;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-responsive-h2 text-text-primary">个人信息</h1>
        <p className="mt-1 text-sm text-text-tertiary">您的账户资料。</p>
      </div>

      <div className="space-y-4">
        <Section title="个人信息">
          <Row label="用户名" value={user?.username ?? '—'} />
          <Row label="邮箱" value={user?.email ?? '—'} />
          <Row label="角色" value={user?.role === 'admin' ? '管理员' : '普通用户'} />
          <Row label="注册时间" value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'} />
          <Row label="剩余分析次数" value={`${me?.balance ?? 0} 次`} />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dark-border bg-dark-secondary p-5">
      <h2 className="mb-4 text-responsive-h4 text-text-primary">{title}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-dark-border py-3 last:border-0">
      <span className="text-sm text-text-tertiary">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value}</span>
    </div>
  );
}
