import React from 'react';

interface Provider {
  id: number;
  provider_name: string;
  display_name: string;
  api_key: string | null;
  base_url: string | null;
  description: string | null;
  is_active: boolean;
  models_count: number;
  created_at: string;
  updated_at: string;
}

interface ProviderListProps {
  providers: Provider[];
  onEdit: (provider: Provider) => void;
  onDelete: (provider: Provider) => void;
}

export function ProviderList({ providers, onEdit, onDelete }: ProviderListProps) {
  if (providers.length === 0) {
    return (
      <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-12 text-center">
        <div className="text-text-muted text-6xl mb-4">🔌</div>
        <h3 className="text-lg font-medium text-text-primary mb-2">暂无供应商</h3>
        <p className="text-text-secondary">点击上方按钮添加第一个 LLM 供应商</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {providers.map((provider) => (
        <div
          key={provider.id}
          className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-6 hover:border-accent-primary/50 transition-colors"
        >
          {/* 状态指示器 */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${provider.is_active ? 'bg-success-500' : 'bg-text-muted'}`} />
              <span className="text-xs text-text-muted">
                {provider.is_active ? '已启用' : '已禁用'}
              </span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => onEdit(provider)}
                className="p-2 text-accent-primary hover:bg-dark-tertiary rounded transition-colors"
                title="编辑"
              >
                <i className="fas fa-edit" />
              </button>
              <button
                onClick={() => onDelete(provider)}
                className="p-2 text-danger-500 hover:bg-dark-tertiary rounded transition-colors"
                title="删除"
              >
                <i className="fas fa-trash" />
              </button>
            </div>
          </div>

          {/* 供应商信息 */}
          <h4 className="text-lg font-semibold text-text-primary mb-2">
            {provider.display_name}
          </h4>
          <p className="text-xs text-text-muted mb-3 font-mono">
            {provider.provider_name}
          </p>

          {provider.description && (
            <p className="text-sm text-text-secondary mb-4 line-clamp-2">
              {provider.description}
            </p>
          )}

          {/* Base URL */}
          {provider.base_url && (
            <div className="mb-3">
              <p className="text-xs text-text-muted mb-1">Base URL:</p>
              <p className="text-sm text-text-secondary font-mono truncate" title={provider.base_url}>
                {provider.base_url}
              </p>
            </div>
          )}

          {/* API Key (masked) */}
          {provider.api_key && (
            <div className="mb-3">
              <p className="text-xs text-text-muted mb-1">API Key:</p>
              <p className="text-sm text-text-secondary font-mono">
                {provider.api_key}
              </p>
            </div>
          )}

          {/* 统计信息 */}
          <div className="pt-4 border-t border-dark-border flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <i className="fas fa-cube text-text-muted text-sm" />
              <span className="text-sm text-text-secondary">
                {provider.models_count} 个模型
              </span>
            </div>
            <span className="text-xs text-text-muted">
              ID: {provider.id}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
