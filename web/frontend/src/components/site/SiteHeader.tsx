'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';

const NAV = [
  { href: '/', label: '研究' },
  { href: '/leaderboard', label: '公开榜单' },
  { href: '/subscription', label: '订阅' },
  { href: '/settings', label: '自定义模型' },
];

export function SiteHeader() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = user?.role === 'admin';

  return (
    <header className="sticky top-0 z-40 border-b border-dark-border bg-dark-primary/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="inline-block h-6 w-6 rounded-md bg-gradient-to-br from-accent-primary to-accent-secondary" />
          <span className="font-heading text-[15px] font-semibold tracking-tight text-text-primary">
            TradingAgents
          </span>
          <span className="hidden text-[10px] text-text-tertiary sm:inline">多智能体研究</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active ? 'bg-dark-tertiary text-text-primary' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                pathname.startsWith('/admin') ? 'bg-dark-tertiary text-text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              管理控制台
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2">
              <Link href="/me" className="rounded-md px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary">
                {user.username}
              </Link>
              <button onClick={logout} className="btn-ghost px-3 py-1.5 text-xs">
                退出
              </button>
            </div>
          ) : (
            <Link href="/auth" className="btn-primary px-3 py-1.5 text-xs">
              登录
            </Link>
          )}
          <button
            className="rounded-md p-1.5 text-text-secondary md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="菜单"
          >
            <i className="fa-solid fa-bars" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-dark-border px-4 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-dark-tertiary hover:text-text-primary"
            >
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/admin" onClick={() => setMenuOpen(false)} className="block rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-dark-tertiary">
              管理控制台
            </Link>
          )}
          {user && (
            <Link href="/me" onClick={() => setMenuOpen(false)} className="block rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-dark-tertiary">
              我的分析
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
