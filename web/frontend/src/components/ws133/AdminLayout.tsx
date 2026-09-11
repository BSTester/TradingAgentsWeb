'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const NAV = [
  { href: '/admin/users', label: '用户管理', icon: 'fa-users' },
  { href: '/admin/public-reports', label: '公开报告管理', icon: 'fa-tower-broadcast' },
];

// 单一导航的管理后台：左侧为唯一的菜单（品牌 + 模块 + 用户/退出），右侧为内容区。
export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-dark-primary">
      <div className="mx-auto flex max-w-6xl flex-col px-4 pb-16 pt-6 md:flex-row md:gap-8">
        {/* 唯一的菜单 = 左侧栏 */}
        <aside className="mb-6 w-full shrink-0 md:mb-0 md:w-60">
          <div className="flex flex-col rounded-xl border border-dark-border bg-dark-secondary p-2">
            {/* 品牌 */}
            <Link href="/admin/users" className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-primary text-white">
                <i className="fas fa-chart-line" aria-hidden="true" />
              </span>
              <span className="text-sm font-bold text-text-primary">TradingAgents</span>
            </Link>
            <p className="mb-1 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              管理控制台
            </p>

            {/* 管理模块菜单 */}
            <div className="flex gap-1 overflow-x-auto md:flex-col">
              {NAV.map((n) => {
                const active = pathname === n.href;
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
            </div>

            {/* 底部：返回前台 + 用户/退出 */}
            <div className="mt-4 border-t border-dark-border pt-3">
              <Link
                href="/"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
              >
                <i className="fas fa-house w-4" aria-hidden="true" />
                返回前台
              </Link>
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-text-primary">{user?.username ?? '未登录'}</p>
                  <p className="text-[11px] text-text-tertiary">管理员</p>
                </div>
                <button
                  onClick={() => {
                    logout();
                    router.push('/auth');
                  }}
                  className="rounded-lg border border-dark-border px-2.5 py-1 text-xs text-text-tertiary hover:text-text-primary"
                >
                  退出
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* 内容区 */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
