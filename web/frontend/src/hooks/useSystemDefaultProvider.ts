'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  adminDefaultProviderAPI,
  adminLLMAPI,
  configAPI,
} from '@/lib/apiClient';
import type { AdminLLMProvider, SystemDefaultProviderSummary } from '@/lib/types';

/**
 * 管理员「系统默认 Provider」页的数据层。
 * - 当前默认摘要来自 /api/config 的 system_default（脱敏）。
 * - 可选 provider 列表来自管理员 LLM 供应商目录（含 inactive）。
 * - 设置默认走 PUT /api/admin/llm/system-default（后端 KEY，脱敏返回）。
 */
export function useSystemDefaultProvider() {
  const queryClient = useQueryClient();

  const systemDefaultQuery = useQuery<SystemDefaultProviderSummary | null>({
    queryKey: ['admin', 'system-default'],
    queryFn: () => configAPI.getSystemDefault(),
  });

  const providersQuery = useQuery<AdminLLMProvider[]>({
    queryKey: ['admin', 'llm-providers-all'],
    queryFn: () => adminLLMAPI.listProviders(true),
  });

  const setDefaultMutation = useMutation<SystemDefaultProviderSummary, Error, number>({
    mutationFn: (providerId: number) => adminDefaultProviderAPI.setSystemDefault(providerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'system-default'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'llm-providers-all'] });
    },
  });

  return { systemDefaultQuery, providersQuery, setDefaultMutation };
}
