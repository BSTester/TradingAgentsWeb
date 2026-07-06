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
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + '/');
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Close dropdown menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showUserMenu) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showUserMenu]);

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
    setShowUserMenu(false);
    router.push('/');
  };

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-dark-primary/80 backdrop-blur-lg border-b border-dark-border shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 md:h-16">
            {/* Left side - Logo */}
            <div className="flex items-center">
              {/* Logo */}
              <div className="flex-shrink-0 cursor-pointer group" onClick={() => handleNavigation('/')}>
                <h1 className="text-text-primary text-base md:text-xl font-bold flex items-center space-x-2">
                  <i className="fas fa-chart-line text-accent-primary group-hover:text-accent-secondary transition-colors" />
                  <span className="group-hover:text-accent-primary transition-colors">TradingAgentsWeb</span>
                </h1>
              </div>
            </div>

            {/* Right side - Hamburger menu (mobile) and Desktop navigation */}
            <div className="flex items-center">
              {/* Hamburger menu button - visible on mobile only */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary transition-colors min-w-touch min-h-touch flex items-center justify-center"
                aria-label="打开导航菜单"
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-menu"
              >
                <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`} aria-hidden="true" />
              </button>

              {/* Desktop navigation - hidden on mobile */}
              <div className="hidden md:flex items-center space-x-2">
              {/* Show user-specific navigation only when logged in */}
              {user && (
                <>
                  {showNewAnalysis && (
                    <button
                      onClick={() => handleNavigation('/')}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive('/')
                          ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow-cyan'
                          : 'text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary'
                      }`}
                    >
                      <i className="fas fa-plus-circle mr-1" />
                      新建对话
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

                  {/* User dropdown menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowUserMenu(!showUserMenu);
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center ${
                        isActive('/profile') || isActive('/admin')
                          ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow-cyan'
                          : 'text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary'
                      }`}
                    >
                      <i className={`fas ${user?.role === 'admin' ? 'fa-crown' : 'fa-user-circle'} mr-2`} />
                      {user?.username}
                      {user?.role === 'admin' && (
                        <span className="mx-2 px-2 py-0.5 bg-gradient-to-r from-accent-primary to-accent-secondary text-white text-xs font-bold rounded">
                          管理员
                        </span>
                      )}
                      <i className={`fas fa-chevron-down ml-2 text-xs transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showUserMenu && (
                      <div className="absolute top-full right-0 mt-1 w-48 bg-dark-secondary border border-dark-border rounded-lg shadow-lg py-2 z-50">
                        <button
                          onClick={() => {
                            handleNavigation('/profile');
                            setShowUserMenu(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary transition-all flex items-center"
                        >
                          <i className="fas fa-user-circle w-4 mr-3" />
                          个人中心
                        </button>

                        {/* Admin menu items */}
                        {showUserManagement && user?.role === 'admin' && (
                          <>
                            <div className="border-t border-dark-border my-1"></div>
                            <button
                              onClick={() => {
                                handleNavigation('/admin/users');
                                setShowUserMenu(false);
                              }}
                              className={`w-full text-left px-4 py-2 text-sm transition-all flex items-center ${
                                isActive('/admin/users')
                                  ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white'
                                  : 'text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary'
                              }`}
                            >
                              <i className="fas fa-users w-4 mr-3" />
                              用户列表
                            </button>
                            <button
                              onClick={() => {
                                handleNavigation('/admin/llm-config');
                                setShowUserMenu(false);
                              }}
                              className={`w-full text-left px-4 py-2 text-sm transition-all flex items-center ${
                                isActive('/admin/llm-config')
                                  ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white'
                                  : 'text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary'
                              }`}
                            >
                              <i className="fas fa-brain w-4 mr-3" />
                              LLM管理
                            </button>
                          </>
                        )}

                        <div className="border-t border-dark-border my-1"></div>
                        <button
                          onClick={() => {
                            handleLogout();
                            setShowUserMenu(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-danger-500 hover:bg-danger-500/10 transition-all flex items-center"
                        >
                          <i className="fas fa-power-off w-4 mr-3" />
                          退出登录
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Show login/register for non-logged in users */}
              {!user && (
                <>
                  <button
                    onClick={() => handleNavigation('/login')}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary transition-all"
                  >
                    登录
                  </button>
                  <button
                    onClick={() => handleNavigation('/register')}
                    className="px-3 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-accent-primary to-accent-secondary text-white hover:shadow-glow-cyan transition-all"
                  >
                    注册
                  </button>
                </>
              )}
              </div>
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
            className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-dark-secondary shadow-xl transform transition-transform duration-300 ease-in-out"
            style={{ transform: isMobileMenuOpen ? 'translateX(0)' : 'translateX(100%)' }}
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
                {/* Show user-specific navigation only when logged in */}
                {user && (
                  <>
                    {showNewAnalysis && (
                      <button
                        onClick={() => handleNavigation('/')}
                        className={`w-full flex items-center px-4 py-3 rounded-lg text-base font-medium transition-all min-h-touch ${
                          isActive('/')
                            ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow-cyan'
                            : 'text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary'
                        }`}
                      >
                        <i className="fas fa-plus-circle w-6 text-lg" />
                        <span className="ml-3">新建对话</span>
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

                {/* Mobile User Menu */}
                {user && (
                  <div className="border border-dark-border rounded-lg overflow-hidden bg-dark-tertiary">
                    {/* User section header */}
                    <div className="flex items-center justify-between p-4 border-b border-dark-border">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white font-bold mr-3">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{user.username}</p>
                          {user.role === 'admin' && (
                            <span className="px-2 py-1 bg-gradient-to-r from-accent-primary to-accent-secondary text-white text-xs font-bold rounded">
                              管理员
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* User menu items */}
                    <div className="py-2">
                      <button
                        onClick={() => handleNavigation('/profile')}
                        className={`w-full flex items-center px-4 py-3 text-base font-medium transition-all ${
                          isActive('/profile')
                            ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white'
                            : 'text-text-secondary hover:text-accent-primary hover:bg-dark-secondary'
                        }`}
                      >
                        <i className="fas fa-user-circle w-6 text-lg mr-3" />
                        个人中心
                      </button>
                      
                      {/* Admin menu items */}
                      {showUserManagement && user.role === 'admin' && (
                        <>
                          <div className="border-t border-dark-border my-2"></div>
                          <button
                            onClick={() => handleNavigation('/admin/users')}
                            className={`w-full flex items-center px-4 py-3 text-base font-medium transition-all ${
                              isActive('/admin/users')
                                ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white'
                                : 'text-text-secondary hover:text-accent-primary hover:bg-dark-secondary'
                            }`}
                          >
                            <i className="fas fa-users w-6 text-lg mr-3" />
                            用户列表
                          </button>
                          <button
                            onClick={() => handleNavigation('/admin/llm-config')}
                            className={`w-full flex items-center px-4 py-3 text-base font-medium transition-all ${
                              isActive('/admin/llm-config')
                                ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white'
                                : 'text-text-secondary hover:text-accent-primary hover:bg-dark-secondary'
                            }`}
                          >
                            <i className="fas fa-brain w-6 text-lg mr-3" />
                            LLM管理
                          </button>
                        </>
                      )}
                      
                      <div className="border-t border-dark-border my-2"></div>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center px-4 py-3 text-base font-medium text-danger-500 hover:bg-danger-500/10 transition-all"
                      >
                        <i className="fas fa-power-off w-6 text-lg mr-3" />
                        退出登录
                      </button>
                    </div>
                  </div>
                )}
                  </>
                )}

                {/* Show login/register for non-logged in users */}
                {!user && (
                  <>
                    <div className="border-t border-dark-border my-2"></div>
                    <button
                      onClick={() => handleNavigation('/login')}
                      className="w-full flex items-center px-4 py-3 rounded-lg text-base font-medium transition-all min-h-touch text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary"
                    >
                      <i className="fas fa-sign-in-alt w-6 text-lg" />
                      <span className="ml-3">登录</span>
                    </button>
                    <button
                      onClick={() => handleNavigation('/register')}
                      className="w-full flex items-center px-4 py-3 rounded-lg text-base font-medium transition-all min-h-touch bg-gradient-to-r from-accent-primary to-accent-secondary text-white hover:shadow-glow-cyan"
                    >
                      <i className="fas fa-user-plus w-6 text-lg" />
                      <span className="ml-3">注册</span>
                    </button>
                  </>
                )}
              </div>
            </nav>

            {/* User Section at Bottom - removed to avoid duplication with mobile menu */}
          </div>
        </div>
      )}
    </>
  );
}
