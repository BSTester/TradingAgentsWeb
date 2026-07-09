import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProviderFormDrawer } from '@/components/profile/ProviderFormDrawer';

const mockUser = { id: 1, username: 'tester', role: 'user' };
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

let capturedCreate: any = null;
let capturedUpdate: any = null;
const createProvider = {
  mutateAsync: vi.fn(async (body: any) => {
    capturedCreate = body;
    return { ...body, id: 'new-id' };
  }),
};
const updateProvider = {
  mutateAsync: vi.fn(async (args: any) => {
    capturedUpdate = args;
    return { ...(args?.body ?? {}), id: args?.id };
  }),
};

vi.mock('@/hooks/useUserLLMSettings', () => ({
  useUserLLMSettings: () => ({ createProvider, updateProvider }),
}));

vi.mock('@/lib/apiClient', () => ({
  configAPI: { validateAPIKey: vi.fn() },
  llmSettingsAPI: { testProvider: vi.fn() },
}));

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    toast: { message: '', type: 'info', isVisible: false },
    showToast: vi.fn(),
    hideToast: vi.fn(),
  }),
  Toast: () => null,
}));

beforeEach(() => {
  capturedCreate = null;
  capturedUpdate = null;
  createProvider.mutateAsync.mockClear();
  updateProvider.mutateAsync.mockClear();
});

describe('ProviderFormDrawer 新建 payload 契约对齐（BUG-001）', () => {
  it('新建 provider 时 payload 必须包含 provider_type=“custom” 等 openapi 必填字段', async () => {
    render(<ProviderFormDrawer provider={null} onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('如 openai / my-custom'), {
      target: { value: 'my-openai' },
    });
    fireEvent.change(screen.getByPlaceholderText('如 我的 OpenAI'), {
      target: { value: '我的 OpenAI' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://api.openai.com/v1'), {
      target: { value: 'https://api.openai.com/v1' },
    });
    fireEvent.change(screen.getByPlaceholderText('gpt-4o-mini'), {
      target: { value: 'gpt-4o-mini' },
    });
    fireEvent.change(screen.getByPlaceholderText('gpt-4o'), {
      target: { value: 'gpt-4o' },
    });

    fireEvent.click(screen.getByText('创建'));

    await waitFor(() => expect(createProvider.mutateAsync).toHaveBeenCalledTimes(1));

    expect(capturedCreate).not.toBeNull();
    // 关键修复点：缺失 provider_type 会导致后端 422
    expect(capturedCreate.provider_type).toBe('custom');
    expect(capturedCreate.provider_name).toBe('my-openai');
    expect(capturedCreate.display_name).toBe('我的 OpenAI');
    expect(capturedCreate.base_url).toBe('https://api.openai.com/v1');
    expect(capturedCreate.shallow_model).toBe('gpt-4o-mini');
    expect(capturedCreate.deep_model).toBe('gpt-4o');
    // 编辑 schema 无 provider_type，故不应出现在 update 调用中
    expect(capturedUpdate).toBeNull();
  });

  it('编辑 provider 时 update payload 不包含 provider_type', async () => {
    const existing = {
      id: 'p-1',
      provider_name: 'my-openai',
      display_name: '我的 OpenAI',
      base_url: 'https://api.openai.com/v1',
      shallow_model: 'gpt-4o-mini',
      deep_model: 'gpt-4o',
      is_enabled: true,
      is_default: false,
      validation_status: 'untested' as const,
    };
    render(<ProviderFormDrawer provider={existing as any} onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.click(screen.getByText('保存修改'));

    await waitFor(() => expect(updateProvider.mutateAsync).toHaveBeenCalledTimes(1));

    expect(capturedUpdate.body.provider_type).toBeUndefined();
    expect(capturedCreate).toBeNull();
  });
});
