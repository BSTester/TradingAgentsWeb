'use client';

/**
 * 本地模型 provider 列表（纯前端）。
 *
 * 项目已下线后台 LLM 配置（Provider/模型目录、系统默认 Provider、用户级持久化设置），
 * 分析所需的 provider / 模型 / Base URL / API Key 全部来自前端本地：
 * - provider 目录：`@/lib/providers` 的 COMMON_PROVIDERS 常量
 * - API Key：浏览器 keyVault（按 provider 名或接口类型存储）
 * - Base URL：`@/lib/customModelConfig`（自定义接口类型的 Base URL，localStorage）
 *
 * 本 hook 输出的结构与原「用户 LLM 设置」接口保持一致，
 * 便于分析表单与模型选择器直接复用（display_name / shallow_model / deep_model 等）。
 */

import { useAuth } from '@/lib/auth';
import { customModelConfig } from '@/lib/customModelConfig';
import { COMMON_PROVIDERS } from '@/lib/providers';
import { useLocalLLMKeys } from '@/hooks/useLocalLLMKeys';

/** 自定义模型接口类型（与 /settings 页保存密钥时使用的键一致）。 */
export type ProviderInterfaceType = 'openai-compatible' | 'anthropic-compatible';

export function interfaceTypeOf(provider: string): ProviderInterfaceType {
  return provider === 'anthropic' ? 'anthropic-compatible' : 'openai-compatible';
}

export interface LocalModelProvider {
  id: string;
  provider_name: string;
  display_name: string;
  base_url: string;
  shallow_model: string;
  deep_model: string;
  is_enabled: boolean;
  is_default: boolean;
}

export interface LocalModelProvidersState {
  providers: LocalModelProvider[];
  default_provider_id: string | null;
}

/**
 * 返回已配置本地密钥的 provider（含其目录默认模型）。
 * 未配置任何本地密钥时返回全部目录 provider（value 为空，由表单提示用户去 /settings 配置）。
 */
export function useLocalModelProviders(): { data: LocalModelProvidersState; isLoading: boolean } {
  const { user } = useAuth();
  const { hasLocalKey } = useLocalLLMKeys();
  const userId = user?.id ?? '';

  const keyed = COMMON_PROVIDERS.filter(
    (p) => hasLocalKey(p.value) || hasLocalKey(interfaceTypeOf(p.value))
  );
  const catalog = keyed.length > 0 ? keyed : COMMON_PROVIDERS;

  const providers: LocalModelProvider[] = catalog.map((p, index) => ({
    id: p.value,
    provider_name: p.value,
    display_name: p.label,
    base_url: customModelConfig.getBaseUrl(userId, interfaceTypeOf(p.value)) || p.base_url,
    shallow_model: p.models[0] ?? '',
    deep_model: p.models[1] ?? p.models[0] ?? '',
    is_enabled: true,
    is_default: index === 0,
  }));

  return {
    data: { providers, default_provider_id: providers[0]?.id ?? null },
    isLoading: false,
  };
}

export default useLocalModelProviders;
