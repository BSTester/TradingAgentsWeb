'use client';

import React, { useState } from 'react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogin = () => {
    router.push('/login');
    setMobileMenuOpen(false);
  };

  const handleRegister = () => {
    router.push('/register');
    setMobileMenuOpen(false);
  };

  const handleDashboard = () => {
    router.push('/dashboard');
    setMobileMenuOpen(false);
  };

  const handleHistory = () => {
    router.push('/history');
    setMobileMenuOpen(false);
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
    setMobileMenuOpen(false);
  };

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-[#0a0e1a]/80 backdrop-blur-lg border-b border-[#2d3748] shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 md:h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0 cursor-pointer group" onClick={() => router.push('/')}>
                <h1 className="text-white text-base md:text-xl font-bold flex items-center space-x-2">
                  <i className="fas fa-chart-line text-[#00d4ff] group-hover:text-[#0066ff] transition-colors duration-200" />
                  <span className="group-hover:text-[#00d4ff] transition-colors duration-200">TradingAgentsWeb</span>
                </h1>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-4">
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
                    onClick={handleHistory}
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
                      onClick={handleLogout}
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

            {/* Mobile Menu Button */}
            <div className="flex md:hidden items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-[#a0aec0] hover:text-[#00d4ff] p-2 rounded-md transition-colors min-w-touch min-h-touch flex items-center justify-center"
                aria-label="菜单"
              >
                <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Menu Panel */}
          <div className="fixed top-14 right-0 w-64 bg-dark-secondary border-l border-dark-border shadow-xl z-50 md:hidden animate-fade-in">
            <div className="py-2">
              {user ? (
                <>
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-dark-border">
                    <div className="flex items-center space-x-2">
                      <i className={`fas ${user.role === 'admin' ? 'fa-crown' : 'fa-user-circle'} text-[#00d4ff]`} />
                      <span className="text-white font-medium">{user.username}</span>
                    </div>
                    {user.role === 'admin' && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-gradient-to-r from-[#00d4ff] to-[#0066ff] text-white text-xs font-bold rounded">
                        管理员
                      </span>
                    )}
                  </div>

                  {/* Menu Items */}
                  <button
                    onClick={handleDashboard}
                    className="w-full text-left px-4 py-3 text-[#a0aec0] hover:bg-dark-tertiary hover:text-[#00d4ff] transition-colors min-h-touch flex items-center"
                  >
                    <i className="fas fa-plus-circle mr-3 w-5" />
                    新建分析
                  </button>
                  <button
                    onClick={handleHistory}
                    className="w-full text-left px-4 py-3 text-[#a0aec0] hover:bg-dark-tertiary hover:text-[#00d4ff] transition-colors min-h-touch flex items-center"
                  >
                    <i className="fas fa-history mr-3 w-5" />
                    分析历史
                  </button>
                  {onLogout && (
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 text-[#a0aec0] hover:bg-dark-tertiary hover:text-[#ff3366] transition-colors min-h-touch flex items-center border-t border-dark-border"
                    >
                      <i className="fas fa-power-off mr-3 w-5" />
                      退出登录
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={handleLogin}
                    className="w-full text-left px-4 py-3 text-[#a0aec0] hover:bg-dark-tertiary hover:text-[#00d4ff] transition-colors min-h-touch flex items-center"
                  >
                    <i className="fas fa-user-check mr-3 w-5" />
                    登录
                  </button>
                  <button
                    onClick={handleRegister}
                    className="w-full text-left px-4 py-3 text-[#a0aec0] hover:bg-dark-tertiary hover:text-[#00d4ff] transition-colors min-h-touch flex items-center"
                  >
                    <i className="fas fa-user-plus mr-3 w-5" />
                    注册
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
