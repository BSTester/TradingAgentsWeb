'use client';

import React from 'react';
import { UserLLMProviderSetting } from '@/lib/types';
import ProviderItem from './ProviderItem';

interface ProviderListProps {
  providers: UserLLMProviderSetting[];
  loading?: boolean;
  onEdit: (provider: UserLLMProviderSetting) => void;
  onSetDefault: (provider: UserLLMProviderSetting) => void;
  onDelete: (provider: UserLLMProviderSetting) => void;
}

export function ProviderList({ providers, loading, onEdit, onSetDefault, onDelete }: ProviderListProps) {
  if (loading) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-spinner fa-spin text-4xl text-accent-primary mb-4" />
        <p className="text-text-secondary">加载中...</p>
      </div>
    );
  }

  if (!providers.length) {
    return (
      <div className="text-center py-12 border border-dashed border-dark-border rounded-lg">
        <i className="fas fa-server text-4xl text-text-muted mb-4" />
        <p className="text-text-secondary">暂无 provider，点击下方新增您的第一个 AI provider。</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {providers.map((p) => (
        <ProviderItem
          key={p.id}
          provider={p}
          onEdit={onEdit}
          onSetDefault={onSetDefault}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export default ProviderList;
