'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useUserLLMSettings } from '@/hooks/useUserLLMSettings';
import { useLocalLLMKeys } from '@/hooks/useLocalLLMKeys';

/**
 * Profile 页「AI 设置」入口卡片。
 * 摘要：已保存 provider 数量、默认 provider、本浏览器已存 KEY 数量。
 * 不读取任何明文 KEY（useLocalLLMKeys 仅返回布尔）。
 */
export function AISettingsCard() {
  const router = useRouter();
  const { data, isLoading } = useUserLLMSettings();
  const { hasLocalKey } = useLocalLLMKeys();

  const providers = data?.providers || [];
  const defaultProvider = providers.find((p) => p.is_default);
  const localKeyCount = providers.filter((p) => hasLocalKey(p.provider_name || String(p.id))).length;

  return (
    <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-responsive-h3 text-text-primary mb-2">
            <i className="fas fa-brain mr-2 text-accent-primary" />
            AI 设置
          </h2>
          <p className="text-text-secondary">
            管理您的 AI provider、模型与 API 密钥（密钥仅存于当前浏览器）。
          </p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-secondary">
            <span>
              已保存 provider：
              <span className="text-text-primary font-medium ml-1">
                {isLoading ? '…' : providers.length}
              </span>
            </span>
            <span>
              默认：
              <span className="text-text-primary font-medium ml-1">
                {isLoading ? '…' : defaultProvider ? defaultProvider.display_name : '未设置'}
              </span>
            </span>
            <span>
              本浏览器已存 KEY：
              <span className="text-text-primary font-medium ml-1">
                {isLoading ? '…' : localKeyCount}
              </span>
            </span>
          </div>
        </div>
        <button
          onClick={() => router.push('/profile/ai-settings')}
          className="px-6 py-3 bg-accent-primary text-dark-primary rounded-lg hover:bg-accent-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary transition-colors whitespace-nowrap ml-6"
        >
          <i className="fas fa-cog mr-2" />
          管理
        </button>
      </div>
    </div>
  );
}

export default AISettingsCard;
