'use client';

import React from 'react';
import { useLocalLLMKeys } from '@/hooks/useLocalLLMKeys';
import { UserLLMProviderSetting } from '@/lib/types';

interface ProviderItemProps {
  provider: UserLLMProviderSetting;
  onEdit: (provider: UserLLMProviderSetting) => void;
  onSetDefault: (provider: UserLLMProviderSetting) => void;
  onDelete: (provider: UserLLMProviderSetting) => void;
}

function ValidationBadge({ status, at }: { status: string | null; at: string | null }) {
  if (!status || status === 'untested') return null;
  const ok = status === 'ok';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        ok ? 'bg-success-500/20 text-success-500' : 'bg-danger-500/20 text-danger-500'
      }`}
      title={at ? `验证时间：${new Date(at).toLocaleString('zh-CN')}` : undefined}
    >
      <i className={`fas ${ok ? 'fa-check-circle' : 'fa-times-circle'} mr-1`} />
      {ok ? '已验证' : '验证失败'}
    </span>
  );
}

export function ProviderItem({ provider, onEdit, onSetDefault, onDelete }: ProviderItemProps) {
  const { hasLocalKey } = useLocalLLMKeys();
  const providerKey = provider.provider_name || String(provider.id);
  const localSaved = hasLocalKey(providerKey);

  return (
    <div className="bg-dark-secondary rounded-lg border border-dark-border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-text-primary font-medium truncate">{provider.display_name}</span>
          {provider.is_default && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent-primary/20 text-accent-primary">
              <i className="fas fa-star mr-1" />
              默认
            </span>
          )}
          {provider.is_enabled ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-500/20 text-success-500">
              已启用
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-dark-tertiary text-text-muted">
              已停用
            </span>
          )}
          <ValidationBadge status={provider.last_validation_status} at={provider.last_validated_at} />
        </div>
        <p className="text-sm text-text-secondary truncate">
          <span className="text-text-muted">{provider.provider_name}</span>
          {provider.base_url ? ` · ${provider.base_url}` : ''}
        </p>
        <div className="mt-2">
          {localSaved ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-500/20 text-success-500">
              <i className="fas fa-key mr-1" />
              本浏览器已存 KEY
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-500/20 text-warning-500">
              <i className="fas fa-exclamation-triangle mr-1" />
              当前浏览器未保存 KEY
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 shrink-0">
        {!provider.is_default && (
          <button
            onClick={() => onSetDefault(provider)}
            className="px-3 py-2 bg-dark-tertiary border border-dark-border text-text-primary rounded-lg hover:bg-dark-primary transition-colors"
          >
            <i className="fas fa-star mr-1" />
            设为默认
          </button>
        )}
        <button
          onClick={() => onEdit(provider)}
          className="px-3 py-2 bg-dark-tertiary border border-dark-border text-text-primary rounded-lg hover:bg-dark-primary transition-colors"
        >
          <i className="fas fa-edit mr-1" />
          编辑 / KEY
        </button>
        <button
          onClick={() => onEdit(provider)}
          className="px-3 py-2 bg-dark-tertiary border border-dark-border text-text-primary rounded-lg hover:bg-dark-primary transition-colors"
        >
          <i className="fas fa-plug mr-1" />
          测试连接
        </button>
        <button
          onClick={() => onDelete(provider)}
          className="px-3 py-2 bg-dark-tertiary border border-danger-500/40 text-danger-500 rounded-lg hover:bg-danger-500/10 transition-colors"
        >
          <i className="fas fa-trash mr-1" />
          删除
        </button>
      </div>
    </div>
  );
}

export default ProviderItem;
