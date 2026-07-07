import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLocalLLMKeys } from '@/hooks/useLocalLLMKeys';

// 可变 mock，便于切换登录/未登录
let mockUser: any = { id: 1, username: 'tester', role: 'user' };
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

beforeEach(() => {
  window.localStorage.clear();
  mockUser = { id: 1, username: 'tester', role: 'user' };
});

describe('useLocalLLMKeys', () => {
  it('保存后 hasLocalKey / getLocalKey 反映最新值', () => {
    const { result } = renderHook(() => useLocalLLMKeys());

    expect(result.current.hasLocalKey('openai')).toBe(false);

    act(() => {
      result.current.saveLocalKey('openai', 'sk-test');
    });

    expect(result.current.hasLocalKey('openai')).toBe(true);
    expect(result.current.getLocalKey('openai')).toBe('sk-test');
  });

  it('replaceLocalKey 覆盖、clearLocalKey 清除', () => {
    const { result } = renderHook(() => useLocalLLMKeys());

    act(() => result.current.saveLocalKey('openai', 'old'));
    act(() => result.current.replaceLocalKey('openai', 'new'));
    expect(result.current.getLocalKey('openai')).toBe('new');

    act(() => result.current.clearLocalKey('openai'));
    expect(result.current.hasLocalKey('openai')).toBe(false);
  });

  it('按 userId 隔离 localStorage', () => {
    const { result } = renderHook(() => useLocalLLMKeys());
    act(() => result.current.saveLocalKey('openai', 'key-1'));
    expect(window.localStorage.getItem('taw:llmkey:v1:1:openai')).toContain('key-1');
    expect(window.localStorage.getItem('taw:llmkey:v1:2:openai')).toBeNull();
  });

  it('未登录（userId 为 null）时写操作不生效', () => {
    mockUser = null;
    const { result } = renderHook(() => useLocalLLMKeys());
    act(() => result.current.saveLocalKey('openai', 'sk-test'));
    expect(result.current.getLocalKey('openai')).toBeNull();
  });
});
