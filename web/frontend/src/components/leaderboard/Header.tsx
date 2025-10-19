'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  username: string;
  email: string;
}

interface HeaderProps {
  user: User | null;
  onLogout?: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
  const router = useRouter();

  const handleLogin = () => {
    router.push('/login');
  };

  const handleRegister = () => {
    router.push('/register');
  };

  const handleDashboard = () => {
    router.push('/dashboard');
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
            {user ? (
              <>
                <button
                  onClick={handleDashboard}
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  <i className="fas fa-plus-circle mr-1" />
                  新建分析
                </button>
                {user.role === 'admin' && (
                  <button
                    onClick={() => router.push('/admin/users')}
                    className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    <i className="fas fa-users-cog mr-1" />
                    用户管理
                  </button>
                )}
                <div className="text-gray-300 flex items-center">
                  <i className={`fas ${user.role === 'admin' ? 'fa-crown' : 'fa-user-circle'} mr-2`} />
                  {user.username}
                  {user.role === 'admin' && (
                    <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-gray-900 text-xs font-bold rounded">
                      管理员
                    </span>
                  )}
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    <i className="fas fa-sign-out-alt mr-1" />
                    退出
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={handleLogin}
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  <i className="fas fa-sign-in-alt mr-1" />
                  登录
                </button>
                <button
                  onClick={handleRegister}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  <i className="fas fa-user-plus mr-1" />
                  注册
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
