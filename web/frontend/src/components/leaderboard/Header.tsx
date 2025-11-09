'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  username: string;
  email: string;
  role?: string;
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
    <nav className="fixed top-0 w-full z-50 bg-[#0a0e1a]/80 backdrop-blur-lg border-b border-[#2d3748] shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 cursor-pointer group" onClick={() => router.push('/')}>
              <h1 className="text-white text-xl font-bold flex items-center space-x-2">
                <i className="fas fa-chart-line text-[#00d4ff] group-hover:text-[#0066ff] transition-colors duration-200" />
                <span className="group-hover:text-[#00d4ff] transition-colors duration-200">TradingAgentsWeb</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <button
                  onClick={handleDashboard}
                  className="text-[#a0aec0] hover:text-[#00d4ff] px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                >
                  <i className="fas fa-plus-circle mr-1" />
                  新建分析
                </button>
                <button
                  onClick={() => router.push('/history')}
                  className="text-[#a0aec0] hover:text-[#00d4ff] px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                >
                  <i className="fas fa-history mr-1" />
                  分析历史
                </button>
                <div className="text-[#a0aec0] flex items-center">
                  <i className={`fas ${user.role === 'admin' ? 'fa-crown' : 'fa-user-circle'} mr-2 text-[#00d4ff]`} />
                  <span className="text-white">{user.username}</span>
                  {user.role === 'admin' && (
                    <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-[#00d4ff] to-[#0066ff] text-white text-xs font-bold rounded">
                      管理员
                    </span>
                  )}
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="text-[#a0aec0] hover:text-[#ff3366] px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                  >
                    <i className="fas fa-power-off mr-1" />
                    退出
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={handleLogin}
                  className="text-[#a0aec0] hover:text-[#00d4ff] px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                >
                  <i className="fas fa-user-check mr-1" />
                  登录
                </button>
                <button
                  onClick={handleRegister}
                  className="bg-gradient-to-r from-[#00d4ff] to-[#0066ff] text-white px-4 py-2 rounded-lg text-sm font-medium hover:shadow-glow-cyan hover:scale-105 active:scale-95 transition-all duration-200"
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
