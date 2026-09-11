/**
 * 分析请求的 LLM 配置解析（纯前端，浏览器本地）。
 *
 * 项目已下线后端 LLM 配置（无 Provider 目录、无系统默认 Provider、无用户级
 * 持久化设置），分析改为「请求即配置」：前端在发起分析时把 provider /
 * backend_url / 模型 / api_key 一并提交，后端只做校验。
 *
 * 解析顺序：
 *   1. 用户在「设置」页配置的自定义接口类型（openai 兼容优先）→ 映射到后端
 *      provider 名（openai / anthropic），Base URL 与模型名来自 localStorage；
 *   2. 兜底：keyVault 中按具体 provider 名保存的密钥 + 本地目录默认值。
 *
 * 未配置任何本地密钥时返回 null，调用方应引导用户前往 `/settings`。
 */

import { CUSTOM_MODEL_TYPES, customModelConfig, type CustomModelType } from '@/lib/customModelConfig';
import { keyVault } from '@/lib/keyVault';
import { COMMON_PROVIDERS } from '@/lib/providers';

export interface LlmRequestConfig {
  llm_provider: string;
  backend_url: string;
  shallow_thinker: string;
  deep_thinker: string;
  api_key: string;
}

/** 接口类型 → 后端 provider 名（决定使用哪个 LangChain 客户端）。 */
const TYPE_TO_PROVIDER: Record<CustomModelType, string> = {
  'openai-compatible': 'openai',
  'anthropic-compatible': 'anthropic',
};

export function resolveLocalLlmConfig(
  userId: string | number | null | undefined,
): LlmRequestConfig | null {
  if (userId == null) return null;

  // 1) 自定义接口类型（/settings 保存的键名即类型名）
  for (const t of CUSTOM_MODEL_TYPES) {
    const apiKey = keyVault.get(userId, t.key);
    if (!apiKey) continue;
    const models = customModelConfig.getModels(userId, t.key);
    return {
      llm_provider: TYPE_TO_PROVIDER[t.key],
      backend_url: customModelConfig.getBaseUrl(userId, t.key) || t.defaultBaseUrl,
      shallow_thinker: models.shallow || t.defaultModels.shallow,
      deep_thinker: models.deep || t.defaultModels.deep,
      api_key: apiKey,
    };
  }

  // 2) 兜底：按具体 provider 名保存的密钥
  for (const provider of COMMON_PROVIDERS) {
    const apiKey = keyVault.get(userId, provider.value);
    if (!apiKey) continue;
    return {
      llm_provider: provider.value,
      backend_url: provider.base_url,
      shallow_thinker: provider.models[0] ?? '',
      deep_thinker: provider.models[1] ?? provider.models[0] ?? '',
      api_key: apiKey,
    };
  }

  return null;
}

/** 未配置本地模型时展示的引导文案。 */
export const LOCAL_LLM_NOT_CONFIGURED_MESSAGE =
  '尚未配置本地模型：请先在「设置」页填写接口类型、Base URL、模型名与 API Key（仅保存在本浏览器）。';

export const LOCAL_LLM_SETTINGS_PATH = '/settings';
