'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast, Toast } from '@/components/ui/Toast';
import { useUserLLMSettings } from '@/hooks/useUserLLMSettings';
import { configAPI, llmSettingsAPI } from '@/lib/apiClient';
import { UserLLMProviderSetting } from '@/lib/types';
import LocalKeyField, { LocalKeyTestResult } from './LocalKeyField';

interface ProviderFormDrawerProps {
  provider: UserLLMProviderSetting | null; // null = 新增
  onClose: () => void;
  onSuccess: (saved: UserLLMProviderSetting) => void;
}

interface FormState {
  provider_name: string;
  display_name: string;
  base_url: string;
  shallow_model: string;
  deep_model: string;
  is_enabled: boolean;
  is_default: boolean;
}

const emptyForm: FormState = {
  provider_name: '',
  display_name: '',
  base_url: '',
  shallow_model: '',
  deep_model: '',
  is_enabled: true,
  is_default: false,
};

export function ProviderFormDrawer({ provider, onClose, onSuccess }: ProviderFormDrawerProps) {
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const { createProvider, updateProvider } = useUserLLMSettings();
  const isEdit = !!provider;

  const [form, setForm] = useState<FormState>(
    provider
      ? {
          provider_name: provider.provider_name,
          display_name: provider.display_name,
          base_url: provider.base_url,
          shallow_model: provider.shallow_model || '',
          deep_model: provider.deep_model || '',
          is_enabled: provider.is_enabled,
          is_default: provider.is_default,
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // localStorage 隔离 key：系统 provider 用 provider_name；自定义用 id
  const providerKey = isEdit
    ? provider!.provider_name || String(provider!.id)
    : form.provider_name.trim();

  // 测试连接：已保存 provider 走 E5；新建时若 provider_name 是已知系统 provider，走通用验证
  const handleTest = async (apiKey: string): Promise<LocalKeyTestResult> => {
    const base_url = form.base_url.trim();
    let valid = false;
    let message: string | undefined;
    if (isEdit && provider) {
      const res = await llmSettingsAPI.testProvider(provider.id, { base_url, api_key: apiKey });
      valid = !!res.valid;
      message = res.message;
    } else {
      // 新建：用通用验证接口（对已知系统 provider 有效）
      const res = await configAPI.validateAPIKey(form.provider_name.trim(), apiKey);
      valid = !!res?.valid;
      message = res?.message;
    }
    const result: LocalKeyTestResult = { valid };
    if (message) result.message = message;
    return result;
  };

  const handleSubmit = async () => {
    if (!form.provider_name.trim() || !form.display_name.trim()) {
      showToast('请填写 provider 名称与显示名称', 'error');
      return;
    }
    setSaving(true);
    try {
      const basePayload = {
        provider_name: form.provider_name.trim(),
        display_name: form.display_name.trim(),
        base_url: form.base_url.trim(),
        shallow_model: form.shallow_model.trim() || null,
        deep_model: form.deep_model.trim() || null,
        is_enabled: form.is_enabled,
        is_default: form.is_default,
      };
      // 新建时补齐 openapi UserLLMProviderCreate 必填字段 provider_type（BUG-001 修复）
      // 编辑走 UserLLMProviderUpdate，无 provider_type 字段，故仅新建时附带。
      const saved = isEdit
        ? await updateProvider.mutateAsync({ id: provider!.id, body: basePayload })
        : await createProvider.mutateAsync({ ...basePayload, provider_type: 'custom' });
      showToast(isEdit ? 'provider 已更新' : 'provider 已创建', 'success');
      onSuccess(saved);
    } catch (err: any) {
      showToast(err?.message || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-start justify-center p-4">
        <div className="relative bg-dark-secondary rounded-xl shadow-2xl border border-dark-border w-full max-w-lg my-12 transform animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-5 border-b border-dark-border">
            <h3 className="text-lg font-semibold text-text-primary">
              <i className="fas fa-server mr-2 text-accent-primary" />
              {isEdit ? '编辑 Provider' : '新增 Provider'}
            </h3>
            <button onClick={onClose} className="text-text-muted hover:text-text-secondary text-xl">
              <i className="fas fa-times" />
            </button>
          </div>

          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Provider 名称 *</label>
              <input
                value={form.provider_name}
                onChange={(e) => setField('provider_name', e.target.value)}
                disabled={isEdit}
                placeholder="如 openai / my-custom"
                className="block w-full h-11 px-3 bg-dark-tertiary border border-dark-border text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary disabled:opacity-60"
              />
              {isEdit && (
                <p className="text-xs text-text-tertiary mt-1">Provider 名称创建后不可修改。</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">显示名称 *</label>
              <input
                value={form.display_name}
                onChange={(e) => setField('display_name', e.target.value)}
                placeholder="如 我的 OpenAI"
                className="block w-full h-11 px-3 bg-dark-tertiary border border-dark-border text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Base URL</label>
              <input
                value={form.base_url}
                onChange={(e) => setField('base_url', e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="block w-full h-11 px-3 bg-dark-tertiary border border-dark-border text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">浅层模型</label>
                <input
                  value={form.shallow_model}
                  onChange={(e) => setField('shallow_model', e.target.value)}
                  placeholder="gpt-4o-mini"
                  className="block w-full h-11 px-3 bg-dark-tertiary border border-dark-border text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">深层模型</label>
                <input
                  value={form.deep_model}
                  onChange={(e) => setField('deep_model', e.target.value)}
                  placeholder="gpt-4o"
                  className="block w-full h-11 px-3 bg-dark-tertiary border border-dark-border text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary"
                />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center space-x-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={form.is_enabled}
                  onChange={(e) => setField('is_enabled', e.target.checked)}
                  className="h-4 w-4 text-accent-primary border-dark-border rounded bg-dark-secondary"
                />
                <span>启用</span>
              </label>
              <label className="flex items-center space-x-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setField('is_default', e.target.checked)}
                  className="h-4 w-4 text-accent-primary border-dark-border rounded bg-dark-secondary"
                />
                <span>设为默认</span>
              </label>
            </div>

            {/* 本地 KEY 区（localStorage，非后端） */}
            {user && (
              <LocalKeyField
                providerKey={providerKey}
                providerLabel={form.display_name.trim() || form.provider_name.trim() || '该 Provider'}
                baseUrl={form.base_url.trim()}
                onTest={handleTest}
                {...(isEdit && provider ? { providerId: provider.id } : {})}
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-dark-border">
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-dark-border text-text-primary bg-dark-tertiary rounded-lg hover:bg-dark-primary transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-2.5 bg-accent-primary text-white rounded-lg hover:bg-accent-secondary disabled:opacity-50 transition-colors"
            >
              {saving ? <i className="fas fa-spinner fa-spin mr-1" /> : null}
              {isEdit ? '保存修改' : '创建'}
            </button>
          </div>
        </div>
      </div>

      <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} />
    </div>
  );
}

export default ProviderFormDrawer;
