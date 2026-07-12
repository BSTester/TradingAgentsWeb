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

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

// Workflow Desk information architecture — maps the rail onto the existing routes.
const RESEARCH_NAV: NavItem[] = [
  { label: '发起分析', path: '/', icon: 'fas fa-circle-plus' },
  { label: '分析历史', path: '/history', icon: 'fas fa-clock-rotate-left' },
  { label: '定期任务', path: '/scheduled-tasks', icon: 'fas fa-calendar-day' },
];

const ACCOUNT_NAV: NavItem[] = [
  { label: '个人中心', path: '/profile', icon: 'fas fa-user' },
  { label: '我的模型', path: '/profile/ai-settings', icon: 'fas fa-sliders' },
];

const ADMIN_NAV: NavItem[] = [
  { label: '用户', path: '/admin/users', icon: 'fas fa-users' },
  { label: '系统模型', path: '/admin/llm-config', icon: 'fas fa-brain' },
  { label: '系统默认 Provider', path: '/admin/system-default-provider', icon: 'fas fa-star' },
];

const ROUTE_LABEL: Record<string, string> = {
  '/': '发起分析',
  '/history': '分析历史',
  '/history/detail': '分析报告',
  '/history/progress': '实时工作流',
  '/analysis': '分析报告',
  '/scheduled-tasks': '定期任务',
  '/profile': '个人中心',
  '/profile/ai-settings': '我的模型',
  '/admin/users': '用户',
  '/admin/llm-config': '系统模型',
  '/admin/system-default-provider': '系统默认 Provider',
};

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block w-7 h-7 rounded-lg border border-accent-primary shrink-0"
    >
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-4 bg-accent-primary" />
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-px w-4 bg-accent-primary" />
    </span>
  );
}

function RailButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`min-h-[39px] rounded-lg px-3 flex items-center gap-2.5 text-sm transition-colors ${
        active
          ? 'bg-accent-primary text-dark-primary font-bold'
          : 'text-text-secondary hover:bg-dark-secondary hover:text-text-primary'
      }`}
    >
      <i className={`${item.icon} w-4 text-center`} aria-hidden="true" />
      <span>{item.label}</span>
    </button>
  );
}

export function AppNavbar({
  user,
  onLogout,
  showNewAnalysis = true,
  showUserManagement = true,
}: AppNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname?.startsWith(path + '/');
  };

  const currentLabel = (() => {
    if (!pathname) return '发起分析';
    if (ROUTE_LABEL[pathname]) return ROUTE_LABEL[pathname];
    const match = Object.keys(ROUTE_LABEL)
      .filter((p) => p !== '/' && pathname.startsWith(p))
      .sort((a, b) => b.length - a.length)[0];
    return match ? ROUTE_LABEL[match] : 'Workflow Desk';
  })();

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setShowUserMenu(false);
  }, [pathname]);

  // Close dropdown menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showUserMenu) setShowUserMenu(false);
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
      if (e.key === 'Escape') {
        if (showUserMenu) setShowUserMenu(false);
        if (isMobileMenuOpen) setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen, showUserMenu]);

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
    setShowUserMenu(false);
  };

  const handleLogout = () => {
    onLogout();
    setIsMobileMenuOpen(false);
    setShowUserMenu(false);
    router.push('/');
  };

  const researchNav = showNewAnalysis ? RESEARCH_NAV : RESEARCH_NAV.filter((n) => n.path !== '/');
  const adminNav = ADMIN_NAV;

  return (
    <>
      {/* ============ Desktop research rail (lg+) ============ */}
      <aside
        aria-label="主导航"
        className="hidden lg:flex fixed inset-y-0 left-0 w-rail flex-col bg-[#111720] border-r border-dark-border px-3 py-4 z-40"
      >
        <button
          type="button"
          onClick={() => handleNavigation('/')}
          className="flex items-center gap-2.5 px-2 pb-5 border-b border-dark-border"
        >
          <BrandMark />
          <span className="text-left leading-tight">
            <span className="block font-mono text-sm font-medium tracking-tight text-text-primary">
              TRADINGAGENTS
            </span>
            <span className="block font-mono text-[10px] text-text-tertiary">WORKFLOW DESK</span>
          </span>
        </button>

        <nav className="pt-4 flex-1 overflow-y-auto scrollbar-hide">
          <div className="px-2 pb-1 text-[10px] font-mono tracking-wider uppercase text-text-tertiary">
            研究工作台
          </div>
          <div className="grid gap-1">
            {researchNav.map((item) => (
              <RailButton
                key={item.path}
                item={item}
                active={isActive(item.path)}
                onClick={() => handleNavigation(item.path)}
              />
            ))}
          </div>

          {user && (
            <>
              <div className="px-2 pt-5 pb-1 text-[10px] font-mono tracking-wider uppercase text-text-tertiary">
                账户与管理
              </div>
              <div className="grid gap-1">
                {ACCOUNT_NAV.map((item) => (
                  <RailButton
                    key={item.path}
                    item={item}
                    active={isActive(item.path)}
                    onClick={() => handleNavigation(item.path)}
                  />
                ))}
                {showUserManagement && user.role === 'admin' && (
                  <>
                    <div className="px-2 pt-4 pb-1 text-[10px] font-mono tracking-wider uppercase text-text-tertiary">
                      管理员
                    </div>
                    {adminNav.map((item) => (
                      <RailButton
                        key={item.path}
                        item={item}
                        active={isActive(item.path)}
                        onClick={() => handleNavigation(item.path)}
                      />
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </nav>

        <div className="mt-auto border-t border-dark-border pt-3 px-2 font-mono text-[10px] leading-relaxed text-text-tertiary">
          US · HK · CN
          <br />
          市场与数据源自动识别
        </div>
      </aside>

      {/* ============ Top status bar (always visible) ============ */}
      <header className="fixed top-0 left-0 lg:left-rail right-0 h-16 z-30 bg-dark-primary/90 backdrop-blur-lg border-b border-dark-border">
        <div className="h-full flex items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile brand */}
            <button
              type="button"
              onClick={() => handleNavigation('/')}
              className="lg:hidden flex items-center gap-2"
            >
              <BrandMark />
              <span className="font-mono text-xs font-medium tracking-tight text-text-primary">
                TRADINGAGENTS
              </span>
            </button>
            <span className="hidden lg:block font-mono text-[11px] text-text-tertiary">
              WORKFLOW DESK / <span className="text-text-primary">{currentLabel}</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-2 font-mono text-[10px] text-text-secondary">
              <span className="relative inline-block w-[7px] h-[7px] rounded-full bg-accent-primary shadow-[0_0_0_4px_rgba(155,255,190,0.12)]" />
              服务已连接
            </span>

            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowUserMenu(!showUserMenu);
                  }}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-dark-secondary transition-colors"
                  aria-haspopup="menu"
                  aria-expanded={showUserMenu}
                >
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary text-dark-primary flex items-center justify-center font-bold text-xs">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden sm:block max-w-[8rem] truncate">{user.username}</span>
                  {user.role === 'admin' && (
                    <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-accent-primary/15 text-accent-primary text-[10px] font-bold">
                      管理员
                    </span>
                  )}
                  <i
                    className={`fas fa-chevron-down text-[10px] transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>

                {showUserMenu && (
                  <div
                    role="menu"
                    className="absolute top-full right-0 mt-1 w-44 bg-dark-secondary border border-dark-border rounded-lg shadow-elevated-dark py-2 z-50"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-danger-500 hover:bg-danger-500/10 transition-colors flex items-center"
                    >
                      <i className="fas fa-power-off w-4 mr-3" aria-hidden="true" />
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleNavigation('/login')}
                  className="px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-accent-primary transition-colors"
                >
                  登录
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigation('/register')}
                  className="px-3 py-1.5 rounded-lg text-sm bg-accent-primary text-dark-primary font-bold hover:brightness-95 transition-all"
                >
                  注册
                </button>
              </div>
            )}

            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-text-secondary hover:text-accent-primary hover:bg-dark-secondary transition-colors min-w-touch min-h-touch flex items-center justify-center"
              aria-label="打开导航菜单"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
            >
              <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* ============ Mobile drawer (full nav) ============ */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            id="mobile-menu"
            className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-dark-secondary shadow-elevated-dark overflow-y-auto"
          >
            <div className="h-16 flex items-center justify-between px-4 border-b border-dark-border">
              <div className="flex items-center gap-2">
                <BrandMark />
                <span className="font-mono text-sm font-medium text-text-primary">TRADINGAGENTS</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-lg text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary transition-colors"
                aria-label="关闭菜单"
              >
                <i className="fas fa-times text-xl" aria-hidden="true" />
              </button>
            </div>

            <nav className="p-3" aria-label="主导航">
              <div className="px-2 py-2 text-[10px] font-mono tracking-wider uppercase text-text-tertiary">
                研究工作台
              </div>
              <div className="grid gap-1">
                {researchNav.map((item) => (
                  <RailButton
                    key={item.path}
                    item={item}
                    active={isActive(item.path)}
                    onClick={() => handleNavigation(item.path)}
                  />
                ))}
              </div>

              {user && (
                <>
                  <div className="px-2 pt-4 py-2 text-[10px] font-mono tracking-wider uppercase text-text-tertiary">
                    账户与管理
                  </div>
                  <div className="grid gap-1">
                    {ACCOUNT_NAV.map((item) => (
                      <RailButton
                        key={item.path}
                        item={item}
                        active={isActive(item.path)}
                        onClick={() => handleNavigation(item.path)}
                      />
                    ))}
                    {showUserManagement && user.role === 'admin' && (
                      <>
                        <div className="px-2 pt-3 py-2 text-[10px] font-mono tracking-wider uppercase text-text-tertiary">
                          管理员
                        </div>
                        {adminNav.map((item) => (
                          <RailButton
                            key={item.path}
                            item={item}
                            active={isActive(item.path)}
                            onClick={() => handleNavigation(item.path)}
                          />
                        ))}
                      </>
                    )}
                  </div>

                  <div className="mt-4 border-t border-dark-border pt-3">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center px-3 py-3 rounded-lg text-sm text-danger-500 hover:bg-danger-500/10 transition-colors min-h-touch"
                    >
                      <i className="fas fa-power-off w-4 mr-2.5" aria-hidden="true" />
                      退出登录
                    </button>
                  </div>
                </>
              )}

              {!user && (
                <div className="grid gap-1 mt-2">
                  <button
                    type="button"
                    onClick={() => handleNavigation('/login')}
                    className="w-full flex items-center px-3 py-3 rounded-lg text-sm text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary transition-colors min-h-touch"
                  >
                    <i className="fas fa-right-to-bracket w-4 mr-2.5" aria-hidden="true" />
                    登录
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigation('/register')}
                    className="w-full flex items-center px-3 py-3 rounded-lg text-sm bg-accent-primary text-dark-primary font-bold hover:brightness-95 transition-colors min-h-touch"
                  >
                    <i className="fas fa-user-plus w-4 mr-2.5" aria-hidden="true" />
                    注册
                  </button>
                </div>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
