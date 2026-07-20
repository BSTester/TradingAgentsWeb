import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SystemDefaultForm } from '@/components/admin/system-default-provider/SystemDefaultForm';
import { renderWithQuery } from '@/test/renderWithQuery';
import {
  configAPI,
  adminLLMAPI,
  adminDefaultProviderAPI,
} from '@/lib/apiClient';
import type { AdminLLMProvider, SystemDefaultProviderSummary } from '@/lib/types';

// 模拟 next 的导航相关模块（组件用到了 next/link）
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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

// 模拟 API 客户端（hook 通过它取数 / 设置默认）
vi.mock('@/lib/apiClient', () => ({
  configAPI: { getSystemDefault: vi.fn() },
  adminLLMAPI: { listProviders: vi.fn() },
  adminDefaultProviderAPI: { setSystemDefault: vi.fn() },
}));

const baseProviders: AdminLLMProvider[] = [
  {
    id: 1,
    provider_name: 'openai',
    display_name: 'OpenAI',
    api_key: null,
    base_url: 'https://api.openai.com/v1',
    description: null,
    is_active: true,
    models_count: 3,
    created_at: '',
    updated_at: '',
  },
  {
    id: 2,
    provider_name: 'anthropic',
    display_name: 'Anthropic',
    api_key: null,
    base_url: 'https://api.anthropic.com',
    description: null,
    is_active: true,
    models_count: 2,
    created_at: '',
    updated_at: '',
  },
  {
    id: 3,
    provider_name: 'disabled',
    display_name: 'Disabled Prov',
    api_key: null,
    base_url: 'https://disabled.example.com',
    description: null,
    is_active: false,
    models_count: 0,
    created_at: '',
    updated_at: '',
  },
];

const openaiDefault: SystemDefaultProviderSummary = {
  provider_id: 1,
  provider_name: 'openai',
  display_name: 'OpenAI',
  base_url: 'https://api.openai.com/v1',
  has_api_key: true,
  api_key_masked: 'sk-***abcd',
  is_active: true,
};

beforeEach(() => {
  vi.mocked(configAPI.getSystemDefault).mockReset();
  vi.mocked(adminLLMAPI.listProviders).mockReset();
  vi.mocked(adminDefaultProviderAPI.setSystemDefault).mockReset();
  vi.mocked(adminLLMAPI.listProviders).mockResolvedValue(baseProviders);
});

describe('SystemDefaultForm', () => {
  it('展示当前系统默认 provider 的非敏感摘要', async () => {
    vi.mocked(configAPI.getSystemDefault).mockResolvedValue(openaiDefault);

    renderWithQuery(<SystemDefaultForm />);

    expect(await screen.findByText('当前系统默认')).toBeInTheDocument();
    expect(screen.getByText('https://api.openai.com/v1')).toBeInTheDocument();
    // 脱敏 KEY 可见，但永不明文
    expect(screen.getByText(/sk-\*\*\*abcd/)).toBeInTheDocument();
  });

  it('无默认时展示空态提示', async () => {
    vi.mocked(configAPI.getSystemDefault).mockResolvedValue(null);

    renderWithQuery(<SystemDefaultForm />);

    expect(await screen.findByText('尚未设置系统默认 Provider')).toBeInTheDocument();
  });

  it('inactive provider 在列表中显示为禁用且不可选', async () => {
    vi.mocked(configAPI.getSystemDefault).mockResolvedValue(openaiDefault);

    renderWithQuery(<SystemDefaultForm />);

    await screen.findByText('当前系统默认');

    const inactiveOption = screen.getByRole('option', { name: /Disabled Prov/ });
    expect(inactiveOption).toBeDisabled();
  });

  it('设置默认前需二次确认，确认后才调用后端', async () => {
    vi.mocked(configAPI.getSystemDefault).mockResolvedValue(openaiDefault);
    vi.mocked(adminDefaultProviderAPI.setSystemDefault).mockResolvedValue({
      ...openaiDefault,
      provider_id: 2,
      provider_name: 'anthropic',
      display_name: 'Anthropic',
      base_url: 'https://api.anthropic.com',
    });

    const user = userEvent.setup();
    renderWithQuery(<SystemDefaultForm />);

    await screen.findByText('当前系统默认');

    // 选择一个不同的 active provider
    await user.selectOptions(screen.getByRole('combobox'), '2');

    const saveBtn = screen.getByRole('button', { name: /保存为系统默认/i });
    expect(saveBtn).toBeEnabled();

    await user.click(saveBtn);

    // 二次确认对话框出现，此时尚未调用后端
    expect(adminDefaultProviderAPI.setSystemDefault).not.toHaveBeenCalled();
    expect(await screen.findByText('设为系统默认 Provider')).toBeInTheDocument();

    // 确认后调用后端
    await user.click(screen.getByRole('button', { name: '确认设置' }));
    expect(adminDefaultProviderAPI.setSystemDefault).toHaveBeenCalledWith(2);

    // 成功后提示
    expect(await screen.findByText('已更新系统默认 Provider')).toBeInTheDocument();
  });

  it('设置失败（如 inactive provider）时显示明确错误提示', async () => {
    vi.mocked(configAPI.getSystemDefault).mockResolvedValue(openaiDefault);
    vi.mocked(adminDefaultProviderAPI.setSystemDefault).mockRejectedValueOnce(
      new Error('cannot set inactive provider as system default'),
    );

    const user = userEvent.setup();
    renderWithQuery(<SystemDefaultForm />);

    await screen.findByText('当前系统默认');
    await user.selectOptions(screen.getByRole('combobox'), '2');
    await user.click(screen.getByRole('button', { name: /保存为系统默认/i }));
    await user.click(await screen.findByRole('button', { name: '确认设置' }));

    expect(
      await screen.findByText('cannot set inactive provider as system default'),
    ).toBeInTheDocument();
  });

  it('配置请求失败时显示可重试错误态，并可恢复到正常内容', async () => {
    vi.mocked(configAPI.getSystemDefault)
      .mockRejectedValueOnce(new Error('系统默认配置加载失败'))
      .mockResolvedValueOnce(openaiDefault);

    const user = userEvent.setup();
    renderWithQuery(<SystemDefaultForm />);

    expect(await screen.findByRole('alert')).toHaveTextContent('系统默认配置加载失败');
    await user.click(screen.getByRole('button', { name: /重试/i }));

    expect(await screen.findByText('当前系统默认')).toBeInTheDocument();
    expect(configAPI.getSystemDefault).toHaveBeenCalledTimes(2);
  });

  it('提供到 Provider/Model 目录管理页的入口', async () => {
    vi.mocked(configAPI.getSystemDefault).mockResolvedValue(openaiDefault);

    renderWithQuery(<SystemDefaultForm />);

    await screen.findByText('当前系统默认');

    const link = screen.getByRole('link', { name: /前往 LLM 管理/i });
    expect(link).toHaveAttribute('href', '/admin/llm-config');
  });
});
