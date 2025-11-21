'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';

interface HeaderProps {
  onNavigate: (path: string) => void;
}

export function Header({ onNavigate }: HeaderProps) {
  const { user, logout, isLoading } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 bg-dark-primary/80 backdrop-blur-lg border-b border-dark-border shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 md:h-16">
          <div className="flex items-center">
            <div
              className="flex-shrink-0 cursor-pointer group"
              onClick={() => onNavigate('/')}
            >
              <h1 className="text-text-primary text-base md:text-xl font-bold flex items-center space-x-2">
                <i className="fas fa-chart-line text-accent-primary group-hover:text-accent-secondary transition-colors" />
                <span className="group-hover:text-accent-primary transition-colors">
                  TradingAgentsWeb
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {!isLoading && !user && (
              <>
                <button
                  onClick={() => onNavigate('/login')}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary transition-all"
                >
                  登录
                </button>
                <button
                  onClick={() => onNavigate('/register')}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-accent-primary to-accent-secondary text-white hover:shadow-glow-cyan transition-all"
                >
                  注册
                </button>
              </>
            )}

            {user && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowUserMenu(!showUserMenu);
                  }}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary"
                >
                  <i className="fas fa-user-circle mr-2" />
                  {user.username}
                  <i className={`fas fa-chevron-down ml-2 text-xs transition-transform ${
                    showUserMenu ? 'rotate-180' : ''
                  }`} />
                </button>

                {showUserMenu && (
                  <div className="absolute top-full right-0 mt-1 w-48 bg-dark-secondary border border-dark-border rounded-lg shadow-lg py-2 z-50">
                    <button
                      onClick={() => {
                        onNavigate('/profile');
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary transition-all flex items-center"
                    >
                      <i className="fas fa-user-circle w-4 mr-3" />
                      个人中心
                    </button>

                    <button
                      onClick={() => {
                        onNavigate('/intraday-trading');
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-success-500 hover:bg-dark-tertiary transition-all flex items-center"
                    >
                      <i className="fas fa-chart-line w-4 mr-3" />
                      智能盯盘
                    </button>

                    <div className="border-t border-dark-border my-1"></div>

                    <button
                      onClick={() => {
                        logout();
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
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
