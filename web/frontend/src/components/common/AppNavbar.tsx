'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  can_access_intraday_trading?: boolean;
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + '/');
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Close menu on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen]);

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    onLogout();
    setIsMobileMenuOpen(false);
    router.push('/');
  };

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-dark-primary/80 backdrop-blur-lg border-b border-dark-border shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 md:h-16">
            {/* Left side - Hamburger menu (mobile) and Logo */}
            <div className="flex items-center">
              {/* Hamburger menu button - visible on mobile only */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden mr-3 p-2 rounded-lg text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary transition-colors min-w-touch min-h-touch flex items-center justify-center"
                aria-label="打开导航菜单"
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-menu"
              >
                <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`} aria-hidden="true" />
              </button>

              {/* Logo */}
              <div className="flex-shrink-0 cursor-pointer group" onClick={() => handleNavigation('/')}>
                <h1 className="text-text-primary text-base md:text-xl font-bold flex items-center space-x-2">
                  <i className="fas fa-chart-line text-accent-primary group-hover:text-accent-secondary transition-colors" />
                  <span className="group-hover:text-accent-primary transition-colors">TradingAgentsWeb</span>
                </h1>
              </div>
            </div>

            {/* Desktop navigation - hidden on mobile */}
            <div className="hidden md:flex items-center space-x-2">
              {showNewAnalysis && (
                <button
                  onClick={() => handleNavigation('/dashboard')}
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
                onClick={() => handleNavigation('/history')}
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
                onClick={() => handleNavigation('/scheduled-tasks')}
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
                  onClick={() => handleNavigation('/intraday-trading')}
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
                  onClick={() => handleNavigation('/admin/users')}
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
                    onClick={() => handleNavigation('/profile')}
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
                    onClick={handleLogout}
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

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          
          {/* Menu Panel */}
          <div 
            id="mobile-menu"
            className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-dark-secondary shadow-xl transform transition-transform duration-300 ease-in-out"
            style={{ transform: isMobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)' }}
          >
            {/* Menu Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-dark-border">
              <h2 className="text-lg font-bold text-text-primary">菜单</h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-lg text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary transition-colors"
                aria-label="关闭菜单"
              >
                <i className="fas fa-times text-xl" aria-hidden="true" />
              </button>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 overflow-y-auto py-4" aria-label="主导航">
              <div className="space-y-1 px-3">
                {showNewAnalysis && (
                  <button
                    onClick={() => handleNavigation('/dashboard')}
                    className={`w-full flex items-center px-4 py-3 rounded-lg text-base font-medium transition-all min-h-touch ${
                      isActive('/dashboard')
                        ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow-cyan'
                        : 'text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary'
                    }`}
                  >
                    <i className="fas fa-plus-circle w-6 text-lg" />
                    <span className="ml-3">新建分析</span>
                  </button>
                )}
                
                <button
                  onClick={() => handleNavigation('/history')}
                  className={`w-full flex items-center px-4 py-3 rounded-lg text-base font-medium transition-all min-h-touch ${
                    isActive('/history')
                      ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow-cyan'
                      : 'text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary'
                  }`}
                >
                  <i className="fas fa-history w-6 text-lg" />
                  <span className="ml-3">分析历史</span>
                </button>

                <button
                  onClick={() => handleNavigation('/scheduled-tasks')}
                  className={`w-full flex items-center px-4 py-3 rounded-lg text-base font-medium transition-all min-h-touch ${
                    isActive('/scheduled-tasks')
                      ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow-cyan'
                      : 'text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary'
                  }`}
                >
                  <i className="fas fa-clock w-6 text-lg" />
                  <span className="ml-3">定期报告</span>
                </button>

                {(user?.role === 'admin' || user?.can_access_intraday_trading) && (
                  <button
                    onClick={() => handleNavigation('/intraday-trading')}
                    className={`w-full flex items-center px-4 py-3 rounded-lg text-base font-medium transition-all min-h-touch ${
                      isActive('/intraday-trading')
                        ? 'bg-gradient-to-r from-success-500 to-success-600 text-white'
                        : 'text-text-secondary hover:text-success-500 hover:bg-dark-tertiary'
                    }`}
                  >
                    <i className="fas fa-chart-line w-6 text-lg" />
                    <span className="ml-3">智能盯盘</span>
                  </button>
                )}

                {showUserManagement && user?.role === 'admin' && (
                  <button
                    onClick={() => handleNavigation('/admin/users')}
                    className={`w-full flex items-center px-4 py-3 rounded-lg text-base font-medium transition-all min-h-touch ${
                      isActive('/admin')
                        ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow-cyan'
                        : 'text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary'
                    }`}
                  >
                    <i className="fas fa-users-cog w-6 text-lg" />
                    <span className="ml-3">用户管理</span>
                  </button>
                )}

                <button
                  onClick={() => handleNavigation('/profile')}
                  className={`w-full flex items-center px-4 py-3 rounded-lg text-base font-medium transition-all min-h-touch ${
                    isActive('/profile')
                      ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow-cyan'
                      : 'text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary'
                  }`}
                >
                  <i className={`fas ${user?.role === 'admin' ? 'fa-crown' : 'fa-user-circle'} w-6 text-lg`} />
                  <span className="ml-3">个人中心</span>
                </button>
              </div>
            </nav>

            {/* User Section at Bottom */}
            {user && (
              <div className="border-t border-dark-border p-4 bg-dark-tertiary">
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white font-bold">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-semibold text-text-primary">{user.username}</p>
                    <p className="text-xs text-text-tertiary">{user.email}</p>
                  </div>
                  {user.role === 'admin' && (
                    <span className="px-2 py-1 bg-gradient-to-r from-accent-primary to-accent-secondary text-white text-xs font-bold rounded">
                      管理员
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-base font-medium text-danger-500 hover:bg-danger-500/10 transition-all min-h-touch"
                >
                  <i className="fas fa-power-off mr-2" />
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
