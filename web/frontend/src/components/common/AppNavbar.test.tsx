import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppNavbar } from '@/components/common/AppNavbar';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}));
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const adminUser = {
  id: 1,
  username: 'admin',
  email: 'admin@example.com',
  role: 'admin',
  is_active: true,
  can_access_intraday_trading: false,
  has_set_password: true,
  created_at: '',
};

const normalUser = { ...adminUser, id: 2, username: 'bob', role: 'user' };

describe('AppNavbar 管理员菜单', () => {
  it('管理员下拉菜单包含“系统默认 Provider”入口', async () => {
    const user = userEvent.setup();
    render(<AppNavbar user={adminUser} onLogout={vi.fn()} />);

    // 打开用户下拉菜单
    await user.click(screen.getByRole('button', { name: /admin/i }));
    expect(await screen.findByText('系统默认 Provider')).toBeInTheDocument();
  });

  it('普通用户下拉菜单不包含“系统默认 Provider”入口', async () => {
    const user = userEvent.setup();
    render(<AppNavbar user={normalUser} onLogout={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /bob/i }));
    // 普通用户仅见个人中心 / 退出登录，不应见任何管理员入口
    expect(await screen.findByText('个人中心')).toBeInTheDocument();
    expect(screen.queryByText('LLM管理')).not.toBeInTheDocument();
    expect(screen.queryByText('系统默认 Provider')).not.toBeInTheDocument();
  });
});
