'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { Toast, useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/admin/llm-config/ConfirmDialog';
import { useSystemDefaultProvider } from '@/hooks/useSystemDefaultProvider';
import type { AdminLLMProvider, SystemDefaultProviderSummary } from '@/lib/types';

function ProviderSummaryCard({ provider }: { provider: SystemDefaultProviderSummary }) {
  return (
    <div
      className="bg-dark-secondary rounded-lg border border-accent-primary/40 shadow-card-dark p-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary text-dark-primary text-xl">
            <i className="fas fa-star" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">{provider.display_name}</h3>
            <p className="text-xs text-text-muted font-mono">{provider.provider_name}</p>
          </div>
        </div>
        <span className="px-2 py-1 rounded text-xs font-medium bg-accent-primary/10 text-accent-primary border border-accent-primary/30">
          当前系统默认
        </span>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-text-muted mb-1">Base URL</dt>
          <dd className="text-text-secondary font-mono break-all">{provider.base_url || '—'}</dd>
        </div>
        <div>
          <dt className="text-text-muted mb-1">API Key</dt>
          <dd className="text-text-secondary">
            {provider.has_api_key ? (
              <span>
                <i className="fas fa-lock text-success-500 mr-1" aria-hidden="true" />
                已配置（脱敏
                {provider.api_key_masked ? ` · ${provider.api_key_masked}` : ''}）
              </span>
            ) : (
              <span className="text-warning">
                <i className="fas fa-exclamation-triangle mr-1" aria-hidden="true" />
                未配置
              </span>
            )}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-text-muted">
        系统默认 provider 的 KEY 由后端保存并向前端脱敏，不会以明文暴露给管理员或普通用户。
      </p>
    </div>
  );
}

function EmptyDefaultState() {
  return (
    <div
      className="bg-dark-secondary rounded-lg border border-dark-border p-8 text-center"
      role="status"
    >
      <div className="text-warning text-5xl mb-4">
        <i className="fas fa-exclamation-triangle" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-medium text-text-primary mb-2">尚未设置系统默认 Provider</h3>
      <p className="text-text-secondary max-w-md mx-auto">
        当前没有任何 provider 被设为系统默认。未配置个人 AI provider 的用户将无法使用系统提供的默认模型能力，请尽快在下方选择一个 active provider 作为系统默认。
      </p>
    </div>
  );
}

function ProviderSelect({
  providers,
  value,
  onChange,
}: {
  providers: AdminLLMProvider[];
  value: number | null;
  onChange: (id: number) => void;
}) {
  const activeProviders = providers.filter((p) => p.is_active);
  const inactiveProviders = providers.filter((p) => !p.is_active);

  return (
    <div>
      <label htmlFor="system-default-provider-select" className="block text-sm font-medium text-text-secondary mb-2">
        选择系统默认 Provider（仅 active 可选）
      </label>
      <select
        id="system-default-provider-select"
        className="w-full bg-dark-tertiary border border-dark-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        <option value="" disabled>
          {providers.length === 0 ? '暂无可用 provider' : '请选择一个 provider…'}
        </option>
        <optgroup label="Active">
          {activeProviders.length === 0 && (
            <option value="" disabled>
              无 active provider
            </option>
          )}
          {activeProviders.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}（{p.provider_name}）
            </option>
          ))}
        </optgroup>
        {inactiveProviders.length > 0 && (
          <optgroup label="Inactive（不可选）">
            {inactiveProviders.map((p) => (
              <option key={p.id} value={p.id} disabled className="text-text-muted">
                {p.display_name}（{p.provider_name}）— 已禁用
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {inactiveProviders.length > 0 && (
        <p className="mt-2 text-xs text-text-muted">
          已禁用的 provider 显示为置灰且不可选择；若需将其设为默认，请先到 LLM 管理启用。
        </p>
      )}
    </div>
  );
}

export function SystemDefaultForm() {
  const { systemDefaultQuery, providersQuery, setDefaultMutation } = useSystemDefaultProvider();
  const { toast, showToast, hideToast } = useToast();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const systemDefault = systemDefaultQuery.data ?? null;
  const providers = useMemo(() => providersQuery.data ?? [], [providersQuery.data]);

  // 初始化选中项为当前默认 provider（若存在且仍在列表中）
  useEffect(() => {
    if (selectedId !== null) return;
    if (systemDefault && providers.some((p) => p.id === systemDefault.provider_id)) {
      setSelectedId(systemDefault.provider_id);
    }
  }, [systemDefault, providers, selectedId]);

  const isLoading = systemDefaultQuery.isLoading || providersQuery.isLoading;

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedId) ?? null,
    [providers, selectedId],
  );
  const isSelectedActive = selectedProvider?.is_active ?? false;
  const isSameAsCurrent =
    !!systemDefault && selectedId !== null && selectedId === systemDefault.provider_id;

  const canSave = isSelectedActive && !isSameAsCurrent && !setDefaultMutation.isPending;

  const handleConfirmSave = () => {
    if (selectedId === null) return;
    setConfirmOpen(false);
    setDefaultMutation.mutate(selectedId, {
      onSuccess: () => {
        showToast('已更新系统默认 Provider', 'success');
      },
      onError: (err: Error) => {
        showToast(err.message || '设置系统默认 provider 失败', 'error');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="text-center py-12" aria-busy="true">
        <i className="fas fa-spinner fa-spin text-4xl text-accent-primary mb-4" aria-hidden="true" />
        <p className="text-text-secondary">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 当前默认摘要 / 空态 */}
      {systemDefault ? <ProviderSummaryCard provider={systemDefault} /> : <EmptyDefaultState />}

      {/* 选择表单 */}
      <div className="bg-dark-secondary rounded-lg border border-dark-border shadow-card-dark p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          <i className="fas fa-sliders-h mr-2 text-accent-primary" aria-hidden="true" />
          设置系统默认 Provider
        </h3>

        <ProviderSelect
          providers={providers}
          value={selectedId}
          onChange={(id) => setSelectedId(id)}
        />

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => setConfirmOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-accent-primary to-accent-secondary text-dark-primary rounded-lg hover:shadow-glow-cyan transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="fas fa-save mr-2" aria-hidden="true" />
            保存为系统默认
          </button>
          {isSameAsCurrent && (
            <span className="text-xs text-text-muted">当前选择已是系统默认，无需更改。</span>
          )}
          {selectedProvider && !isSelectedActive && (
            <span className="text-xs text-warning">
              <i className="fas fa-exclamation-triangle mr-1" aria-hidden="true" />
              该 provider 已禁用，不可设为系统默认。
            </span>
          )}
        </div>
      </div>

      {/* 目录管理入口 */}
      <div className="bg-dark-tertiary rounded-lg border border-dark-border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-text-secondary">
          需要先创建或启用 provider？前往 LLM 管理维护 Provider / Model 目录。
        </p>
        <Link
          href="/admin/llm-config"
          className="inline-flex items-center justify-center px-4 py-2 bg-dark-secondary border border-dark-border rounded-lg text-text-primary hover:border-accent-primary/50 hover:text-accent-primary transition-colors"
        >
          <i className="fas fa-brain mr-2" aria-hidden="true" />
          前往 LLM 管理（Provider/Model 目录）
        </Link>
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      {/* 二次确认对话框 */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="设为系统默认 Provider"
        message={
          selectedProvider
            ? `即将把「${selectedProvider.display_name}（${selectedProvider.provider_name}）」设为系统默认 Provider。\n\n` +
              `设为默认后：\n` +
              `• 未配置个人 AI provider 的用户将使用此系统默认 provider 完成分析；\n` +
              `• 原系统默认 provider 会自动取消默认状态；\n` +
              `• 系统默认 provider 的 KEY 由后端保存，不会以明文暴露。`
            : '确认设置？'
        }
        confirmText="确认设置"
        cancelText="取消"
        confirmButtonClass="bg-gradient-to-r from-accent-primary to-accent-secondary hover:opacity-90"
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmOpen(false)}
        icon="fa-star"
        iconColor="text-accent-primary"
      />
    </div>
  );
}

export default SystemDefaultForm;
