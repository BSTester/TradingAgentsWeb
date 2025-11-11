'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface AppNavbarProps {
  user: User | null;
  onLogout: () => void;
  showNewAnalysis?: boolean;
  showUserManagement?: boolean;
}

export function AppNavbar({ user, onLogout, showNewAnalysis = true, showUserManagement = true }: AppNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + '/');
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-dark-primary/80 backdrop-blur-lg border-b border-dark-border shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 cursor-pointer group" onClick={() => router.push('/')}>
              <h1 className="text-text-primary text-xl font-bold flex items-center space-x-2">
                <i className="fas fa-chart-line text-accent-primary group-hover:text-accent-secondary transition-colors" />
                <span className="group-hover:text-accent-primary transition-colors">TradingAgentsWeb</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {showNewAnalysis && (
              <button
                onClick={() => router.push('/dashboard')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive('/dashboard')
                    ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow-cyan'
                    : 'text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary'
                }`}
              >
                <i className="fas fa-plus-circle mr-1" />
                新建分析
              </button>
            )}
            <button
              onClick={() => router.push('/history')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive('/history')
                  ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow-cyan'
                  : 'text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary'
              }`}
            >
              <i className="fas fa-history mr-1" />
              分析历史
            </button>
            <button
              onClick={() => router.push('/scheduled-tasks')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive('/scheduled-tasks')
                  ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow-cyan'
                  : 'text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary'
              }`}
            >
              <i className="fas fa-clock mr-1" />
              定期报告
            </button>
            {(user?.role === 'admin' || user?.can_access_intraday_trading) && (
              <button
                onClick={() => router.push('/intraday-trading')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive('/intraday-trading')
                    ? 'bg-gradient-to-r from-success-500 to-success-600 text-white'
                    : 'text-text-secondary hover:text-success-500 hover:bg-dark-tertiary'
                }`}
              >
                <i className="fas fa-chart-line mr-1" />
                智能盯盘
              </button>
            )}
            {showUserManagement && user?.role === 'admin' && (
              <button
                onClick={() => router.push('/admin/users')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive('/admin')
                    ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow-cyan'
                    : 'text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary'
                }`}
              >
                <i className="fas fa-users-cog mr-1" />
                用户管理
              </button>
            )}
            {user && (
              <>
                <button
                  onClick={() => router.push('/profile')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center ${
                    isActive('/profile')
                      ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow-cyan'
                      : 'text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary'
                  }`}
                >
                  <i className={`fas ${user?.role === 'admin' ? 'fa-crown' : 'fa-user-circle'} mr-2`} />
                  {user?.username}
                  {user?.role === 'admin' && (
                    <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-accent-primary to-accent-secondary text-white text-xs font-bold rounded">
                      管理员
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    onLogout();
                    router.push('/');
                  }}
                  className="text-text-secondary hover:text-danger-500 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <i className="fas fa-power-off mr-1" />
                  退出
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
