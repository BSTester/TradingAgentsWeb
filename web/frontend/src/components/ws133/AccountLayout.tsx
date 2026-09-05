'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const NAV = [
  { href: '/me', label: '我的分析', icon: 'fa-file-lines', exact: true },
  { href: '/me/subscription', label: '订阅明细', icon: 'fa-credit-card' },
  { href: '/me/settings', label: '个人信息', icon: 'fa-user' },
];

// User console sidebar layout (narrow screens collapse to horizontal scroll).
export function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  const current = NAV.find((n) =>
    n.exact ? pathname === n.href : pathname.startsWith(n.href)
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-8 md:flex-row md:gap-8">
      {/* Sidebar */}
      <aside className="mb-6 w-full shrink-0 md:mb-0 md:w-64">
        <div className="rounded-xl border border-dark-border bg-dark-secondary p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-primary/15 text-accent-primary">
              <i className="fas fa-user" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{user?.username ?? '未登录'}</p>
              <p className="text-xs text-text-tertiary">{user?.role === 'admin' ? '管理员' : '普通用户'}</p>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto md:flex-col">
            {NAV.map((n) => {
              const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-accent-primary text-white'
                      : 'text-text-secondary hover:bg-dark-tertiary hover:text-text-primary'
                  }`}
                >
                  <i className={`fas ${n.icon} w-4`} aria-hidden="true" />
                  {n.label}
                </Link>
              );
            })}
            <div className="mt-4 hidden border-t border-dark-border pt-4 md:block">
              <Link href="/" className="text-xs text-text-tertiary hover:text-text-secondary">
                ← 返回首页
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-dark-border bg-dark-secondary p-3 text-xs text-text-tertiary">
          <i className="fas fa-shield-halved mr-1" aria-hidden="true" />
          本页为「{current?.label ?? '账户'}」。
        </div>
      </aside>

      {/* Content */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
