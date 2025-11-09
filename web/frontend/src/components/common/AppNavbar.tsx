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
  showNewAnalysis?: boolean; // 是否显示"新建分析"按钮
  showUserManagement?: boolean; // 是否显示"用户管理"按钮
}

export function AppNavbar({ user, onLogout, showNewAnalysis = true, showUserManagement = true }: AppNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + '/');
  };

  return (
    <nav className="bg-gray-900 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 cursor-pointer" onClick={() => router.push('/')}>
              <h1 className="text-white text-xl font-bold">
                <i className="fas fa-chart-line mr-2" />
                TradingAgents
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {showNewAnalysis && (
              <button
                onClick={() => router.push('/dashboard')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/dashboard')
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                <i className="fas fa-plus-circle mr-1" />
                新建分析
              </button>
            )}
            <button
              onClick={() => router.push('/history')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/history')
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              <i className="fas fa-history mr-1" />
              分析历史
            </button>
            <button
              onClick={() => router.push('/scheduled-tasks')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/scheduled-tasks')
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              <i className="fas fa-clock mr-1" />
              定期报告
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => router.push('/intraday-trading')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/intraday-trading')
                    ? 'bg-green-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                <i className="fas fa-chart-line mr-1" />
                短线交易
              </button>
            )}
            {showUserManagement && user?.role === 'admin' && (
              <button
                onClick={() => router.push('/admin/users')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/admin')
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
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
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                    isActive('/profile')
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <i className={`fas ${user?.role === 'admin' ? 'fa-crown' : 'fa-user-circle'} mr-2`} />
                  {user?.username}
                  {user?.role === 'admin' && (
                    <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-gray-900 text-xs font-bold rounded">
                      管理员
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    onLogout();
                    router.push('/');
                  }}
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
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
