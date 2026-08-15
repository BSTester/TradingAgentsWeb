'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { SiteLayout } from '@/components/site/SiteLayout';

interface AccountLayoutProps {
  active: 'me' | 'billing' | 'preferences';
  title: string;
  subtitle: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * 登录后个人工作区的侧栏布局。
 * 对齐设计稿 07 的 .account-layout + .side-nav：
 * 左侧固定侧栏（用户名片 + 导航），右侧主内容区；
 * 窄屏下侧栏改为横向滚动导航，与设计响应式一致。
 */
export function AccountLayout({ active, title, subtitle, eyebrow, actions, children }: AccountLayoutProps) {
  const { user } = useAuth();
  const initial = (user?.username?.[0] ?? 'U').toUpperCase();

  const navItems = [
    { k: 'me', href: '/me', label: '我的分析', icon: 'fa-folder-open' },
    { k: 'billing', href: '/me/billing', label: '订阅明细', icon: 'fa-receipt' },
    { k: 'preferences', href: '/me/preferences', label: '账户偏好', icon: 'fa-sliders' },
  ] as const;

  return (
    <SiteLayout maxWidth="max-w-6xl">
      <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-5">
        {/* 侧栏 */}
        <aside className="surface-panel h-fit p-3 lg:sticky lg:top-4">
          {/* 用户名片（窄屏隐藏） */}
          <div className="hidden border-b border-dark-border pb-3 lg:block">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#b5dfc8] to-[#427e70] text-sm font-extrabold text-[#082319]">
                {initial}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-text-primary">
                  {user?.username ?? '未登录'}
                </div>
                <div className="text-[10px] text-text-tertiary">
                  {user?.role === 'admin' ? '管理员' : '普通用户'}
                </div>
              </div>
            </div>
          </div>

          {/* 导航：窄屏横向滚动，宽屏纵向 */}
          <nav className="flex gap-1 overflow-x-auto pt-2 lg:flex-col lg:overflow-visible lg:pt-3">
            {navItems.map((it) => (
              <Link
                key={it.k}
                href={it.href}
                className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-xs transition-colors lg:w-full ${
                  active === it.k
                    ? 'bg-accent-primary/10 text-accent-primary'
                    : 'text-text-secondary hover:bg-accent-primary/5 hover:text-accent-primary'
                }`}
              >
                <i className={`fas ${it.icon} w-3.5 text-center`} />
                <span>{it.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* 主内容区 */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
            <div>
              {eyebrow && (
                <div className="num text-[11px] uppercase tracking-[0.16em] text-accent-primary">
                  {eyebrow}
                </div>
              )}
              <h1 className="h-serif mt-1 text-2xl">{title}</h1>
              <p className="mt-1.5 text-sm text-text-secondary">{subtitle}</p>
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
          {children}
        </div>
      </div>
    </SiteLayout>
  );
}

export default AccountLayout;
