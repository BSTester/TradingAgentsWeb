'use client';

import { SiteLayout } from '@/components/site/SiteLayout';
import { MeNav } from '@/app/me/page';
import { useAuth } from '@/lib/auth';
import { useState } from 'react';

export default function PreferencesPage() {
  const { user } = useAuth();
  const [publicDefault, setPublicDefault] = useState(false);
  const [emailNotify, setEmailNotify] = useState(true);

  return (
    <SiteLayout maxWidth="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="h-serif text-2xl">账户偏好</h1>
          <p className="mt-1 text-sm text-text-secondary">分析结果的默认公开与通知设置。</p>
        </div>
        <MeNav active="preferences" />
      </div>

      <div className="mt-6 surface-panel divide-y divide-dark-border">
        <PrefRow title="账户" desc={user ? user.username : '未登录'}>
          <span className="num text-xs text-text-tertiary">{user?.email ?? '—'}</span>
        </PrefRow>
        <PrefRow title="角色" desc="普通用户可管理自己的分析；管理员可进入管理控制台。">
          <span className={`verdict-pill ${user?.role === 'admin' ? 'verdict-hold' : 'verdict-neutral'}`}>{user?.role === 'admin' ? '管理员' : '普通用户'}</span>
        </PrefRow>
        <PrefRow title="新分析默认公开" desc="开启后，新完成的研究报告默认对社区公开。可逐份在报告页关闭。">
          <Toggle on={publicDefault} onChange={setPublicDefault} />
        </PrefRow>
        <PrefRow title="分析完成邮件通知" desc="研究完成后向你的注册邮箱发送提醒（示例开关）。">
          <Toggle on={emailNotify} onChange={setEmailNotify} />
        </PrefRow>
        <PrefRow title="本地模型 Key" desc="在「本地模型」页管理，仅存浏览器，服务端不保存。">
          <a href="/settings" className="text-xs text-accent-secondary hover:underline">前往设置 →</a>
        </PrefRow>
      </div>
    </SiteLayout>
  );
}

function PrefRow({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-text-primary">{title}</div>
        <div className="mt-0.5 text-xs text-text-tertiary">{desc}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        on ? 'bg-accent-primary/80' : 'bg-dark-elevated'
      }`}
      role="switch"
      aria-checked={on}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
        on ? 'translate-x-5' : 'translate-x-0.5'
      }`} />
    </button>
  );
}

