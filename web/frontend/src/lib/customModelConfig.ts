/**
 * 自定义模型配置（类型 + Base URL）— 纯前端，localStorage
 *
 * 自定义模型只按「接口类型」区分（openai / anthropic 兼容），不指定具体
 * 提供商。API Key 走 keyVault（taw:llmkey 命名空间）；Base URL 属于非敏感
 * 配置，存于同一命名空间的 `<type>::baseurl` 键下，按 userId 隔离。
 */

import { LOCAL_KEY_NS } from './keyVault';

export type CustomModelType = 'openai-compatible' | 'anthropic-compatible';

export const CUSTOM_MODEL_TYPES: {
  key: CustomModelType;
  label: string;
  desc: string;
  defaultBaseUrl: string;
  placeholder: string;
}[] = [
  {
    key: 'openai-compatible',
    label: 'OpenAI 接口兼容',
    desc: '适用于 OpenAI 及各类兼容 Chat Completions 协议的服务（DeepSeek、OpenRouter、vLLM 等）',
    defaultBaseUrl: 'https://api.openai.com/v1',
    placeholder: 'https://api.openai.com/v1',
  },
  {
    key: 'anthropic-compatible',
    label: 'Anthropic 接口兼容',
    desc: '适用于 Anthropic 及各类兼容 Messages 协议的服务（Claude 系列等）',
    defaultBaseUrl: 'https://api.anthropic.com',
    placeholder: 'https://api.anthropic.com',
  },
];

function baseUrlId(userId: string | number, type: CustomModelType): string {
  return `${LOCAL_KEY_NS}:${userId}:${type}::baseurl`;
}

function safeLocalStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

export const customModelConfig = {
  /** 读取某类型的 Base URL；未配置时返回空串（由调用方决定是否用默认值填充表单） */
  getBaseUrl(userId: string | number, type: CustomModelType): string {
    const ls = safeLocalStorage();
    if (!ls) return '';
    try {
      return ls.getItem(baseUrlId(userId, type)) || '';
    } catch {
      return '';
    }
  },

  saveBaseUrl(userId: string | number, type: CustomModelType, url: string): void {
    const ls = safeLocalStorage();
    if (!ls) return;
    try {
      ls.setItem(baseUrlId(userId, type), url.trim());
    } catch {
      /* storage 不可用时静默失败 */
    }
  },

  clearBaseUrl(userId: string | number, type: CustomModelType): void {
    const ls = safeLocalStorage();
    if (!ls) return;
    try {
      ls.removeItem(baseUrlId(userId, type));
    } catch {
      /* noop */
    }
  },
};

export default customModelConfig;
