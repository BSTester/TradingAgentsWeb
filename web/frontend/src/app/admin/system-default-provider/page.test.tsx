import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import SystemDefaultProviderPage from '@/app/admin/system-default-provider/page';
import { renderWithQuery } from '@/test/renderWithQuery';
import { useAuth } from '@/lib/auth';
import { configAPI, adminLLMAPI, adminDefaultProviderAPI } from '@/lib/apiClient';

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/admin/system-default-provider',
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
vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: any) => children,
}));
vi.mock('@/lib/apiClient', () => ({
  configAPI: { getSystemDefault: vi.fn() },
  adminLLMAPI: { listProviders: vi.fn() },
  adminDefaultProviderAPI: { setSystemDefault: vi.fn() },
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

beforeEach(() => {
  vi.clearAllMocks();
  mockPush.mockReset();
  vi.mocked(configAPI.getSystemDefault).mockResolvedValue(null);
  vi.mocked(adminLLMAPI.listProviders).mockResolvedValue([]);
});

describe('SystemDefaultProviderPage', () => {
  it('管理员可访问页面并加载配置表单', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: adminUser,
      logout: vi.fn(),
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    renderWithQuery(<SystemDefaultProviderPage />);

    expect(
      await screen.findByRole('heading', { name: /系统默认 Provider/i }),
    ).toBeInTheDocument();
  });

  it('非管理员无写权限：重定向回首页且不渲染保存控件', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: normalUser,
      logout: vi.fn(),
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    renderWithQuery(<SystemDefaultProviderPage />);

    // 不应出现管理用的“保存为系统默认”按钮（写权限）
    expect(
      screen.queryByRole('button', { name: /保存为系统默认/i }),
    ).not.toBeInTheDocument();

    // 非管理员被重定向
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
  });
});
