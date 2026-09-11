'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

// Top navigation for the redesign (public + authenticated surfaces).
export function SiteHeader() {
  const { user, logout, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const navLink = [
    { href: '/public', label: '热门研究', icon: 'fa-ranking-star' },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const goMe = () => router.push(user?.role === 'admin' ? '/admin' : '/me');

  return (
    <header className="sticky top-0 z-40 border-b border-dark-border bg-dark-primary/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-primary text-white shadow-glow-blue">
            <i className="fas fa-chart-line" aria-hidden="true" />
          </span>
          <span className="hidden sm:block">
            <span className="block text-base font-bold leading-tight text-text-primary">
              TradingAgents
            </span>
            <span className="block text-xs text-text-tertiary">多智能体股票研究</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {navLink.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(l.href)
                  ? 'bg-dark-tertiary text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <i className={`fas ${l.icon} w-4`} aria-hidden="true" />
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/settings"
            title="自定义模型"
            aria-label="自定义模型"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-dark-border text-text-secondary hover:border-accent-primary/50 hover:text-text-primary"
          >
            <i className="fas fa-sliders" aria-hidden="true" />
          </Link>
          {isLoading ? null : user ? (
            <div className="flex items-center gap-2">
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  className="hidden rounded-lg border border-dark-border px-3 py-2 text-sm text-text-secondary hover:text-text-primary sm:block"
                >
                  管理控制台
                </Link>
              )}
              <button
                type="button"
                onClick={goMe}
                className="flex items-center gap-2 rounded-lg bg-dark-tertiary px-3 py-2 text-sm font-medium text-text-primary hover:bg-dark-elevated"
              >
                <i className="fas fa-user-circle" aria-hidden="true" />
                <span className="max-w-[8rem] truncate">{user.username}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.push('/');
                }}
                className="rounded-lg border border-dark-border px-3 py-2 text-sm text-text-tertiary hover:text-text-primary"
              >
                退出
              </button>
            </div>
          ) : (
            <Link
              href="/auth"
              className="rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold text-white shadow-glow-blue hover:bg-accent-secondary"
            >
              登录 / 注册
            </Link>
          )}
        </div>
      </div>

      {/* Mobile secondary nav */}
      <nav className="border-t border-dark-border md:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-2 py-1">
          {[{ href: '/', label: '首页', icon: 'fa-house' }, ...navLink].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-medium ${
                isActive(l.href) ? 'text-accent-primary' : 'text-text-secondary'
              }`}
            >
              <i className={`fas ${l.icon ?? 'fa-house'}`} aria-hidden="true" />
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

// Page shell: header + centered content.
export function PageShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="min-h-screen bg-dark-primary">
      <SiteHeader />
      <main className={`mx-auto max-w-6xl px-4 pb-16 pt-8 ${className}`}>{children}</main>
    </div>
  );
}
