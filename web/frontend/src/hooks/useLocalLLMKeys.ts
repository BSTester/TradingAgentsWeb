'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { keyVault } from '@/lib/keyVault';

/**
 * 用户本地 KEY 管理 hook（纯前端，localStorage）
 *
 * - 按当前登录用户隔离（userId），多账户共用浏览器不会串用
 * - 明文 KEY 不进入任何跨页面 state；仅在调用 save/replace 的入参中短暂存在
 * - 写操作后通过内部 version 自增触发依赖组件重渲染（同步读取 localStorage）
 * - 监听同源其他标签页的 storage 事件，保证多标签同步
 *
 * 返回方法命名对齐 api-contract.md §2.2 UserKeyVaultState。
 */
export function useLocalLLMKeys() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // 仅当本命名空间发生变化时刷新
      if (e.key && e.key.startsWith('taw:llmkey:')) {
        refresh();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const getLocalKey = useCallback(
    (providerKey: string): string | null => {
      if (userId == null) return null;
      return keyVault.get(userId, providerKey);
    },
    // version 用于让 getter 在写操作后重新读取最新值
    [userId, version]
  );

  const hasLocalKey = useCallback(
    (providerKey: string): boolean => {
      if (userId == null) return false;
      return keyVault.has(userId, providerKey);
    },
    [userId, version]
  );

  const saveLocalKey = useCallback(
    (providerKey: string, key: string) => {
      if (userId == null) return;
      keyVault.save(userId, providerKey, key);
      refresh();
    },
    [userId, refresh]
  );

  const replaceLocalKey = useCallback(
    (providerKey: string, key: string) => {
      if (userId == null) return;
      keyVault.replace(userId, providerKey, key);
      refresh();
    },
    [userId, refresh]
  );

  const clearLocalKey = useCallback(
    (providerKey: string) => {
      if (userId == null) return;
      keyVault.clear(userId, providerKey);
      refresh();
    },
    [userId, refresh]
  );

  return {
    userId,
    hasLocalKey,
    getLocalKey,
    saveLocalKey,
    replaceLocalKey,
    clearLocalKey,
    refresh,
  };
}

export default useLocalLLMKeys;
