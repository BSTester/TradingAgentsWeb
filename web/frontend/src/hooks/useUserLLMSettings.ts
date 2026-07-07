'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { llmSettingsAPI } from '@/lib/apiClient';
import {
  CreateUserLLMProviderRequest,
  TestUserLLMProviderRequest,
  UpdateUserLLMProviderRequest,
  UserLLMSettingsResponse,
} from '@/lib/types';

/** react-query 缓存 key（与 api-contract.md §8 性能基线一致） */
export const USER_LLM_SETTINGS_KEY = ['user', 'llm-settings'] as const;

/**
 * 用户 provider 元数据 hook（react-query → llmSettingsAPI，E1–E5，仅元数据，无 KEY）
 * 用户 KEY 由 useLocalLLMKeys 独立管理，不进此缓存。
 */
export function useUserLLMSettings() {
  const queryClient = useQueryClient();

  const query = useQuery<UserLLMSettingsResponse>({
    queryKey: USER_LLM_SETTINGS_KEY,
    queryFn: () => llmSettingsAPI.getSettings(),
  });

  const createProvider = useMutation({
    mutationFn: (body: CreateUserLLMProviderRequest) => llmSettingsAPI.createProvider(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_LLM_SETTINGS_KEY });
    },
  });

  const updateProvider = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUserLLMProviderRequest }) =>
      llmSettingsAPI.updateProvider(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_LLM_SETTINGS_KEY });
    },
  });

  const deleteProvider = useMutation({
    mutationFn: (id: string) => llmSettingsAPI.deleteProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_LLM_SETTINGS_KEY });
    },
  });

  const testProvider = useMutation({
    mutationFn: ({ id, body }: { id: string; body: TestUserLLMProviderRequest }) =>
      llmSettingsAPI.testProvider(id, body),
  });

  const setDefault = useMutation({
    mutationFn: ({ id, isDefault }: { id: string; isDefault: boolean }) =>
      llmSettingsAPI.updateProvider(id, { is_default: isDefault }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_LLM_SETTINGS_KEY });
    },
  });

  return {
    ...query,
    createProvider,
    updateProvider,
    deleteProvider,
    testProvider,
    setDefault,
  };
}

export default useUserLLMSettings;
