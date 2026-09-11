'use client';

import React, { useMemo } from 'react';
import { useLocalModelProviders } from '@/hooks/useLocalModelProviders';

/**
 * Workflow Desk — model-only selector for the analysis launch surface.
 *
 * Privacy contract (WS-13 / story-001, ui-spec.md "Analysis-start experience"):
 *   Visible:   model display names only.
 *   Forbidden: provider name, base URL, API key state, local-storage status,
 *              system-default status, backend credential source.
 *
 * Data sources (all local to the browser):
 *   - `@/lib/providers` COMMON_PROVIDERS catalogue (model values + labels), and
 *   - keyVault presence via useLocalModelProviders (no key material rendered).
 *
 * Provider / backend_url / api_key are resolved silently by the parent when it
 * builds the launch payload; they are not surfaced in this UI.
 */

export interface ModelOption {
  /** Internal provider key — never displayed. */
  provider: string;
  /** Shallow-thinker model value — never displayed. */
  shallow: string;
  /** Deep-thinker model value — never displayed. */
  deep: string;
  /** The only thing the user sees. */
  label: string;
}

export interface ModelSelectorProps {
  /** Optional non-sensitive config (model display labels only). */
  config?: any;
  /** Currently selected model label. */
  value?: string;
  /** Called with the resolved model descriptor (display name + internal values). */
  onChange: (selection: ModelOption | null) => void;
  disabled?: boolean;
  id?: string;
}

export const NO_MODEL_MESSAGE =
  '当前没有可用模型。请先在「设置」页保存本地 API Key（密钥只保存在本浏览器，不上传服务器）。';

/** Look up a friendly display label for a model value, falling back to the raw value. */
function labelFor(config: any, provider: string, type: 'shallow' | 'deep', value: string): string {
  if (!value) return '';
  const arr = config?.models?.[String(provider || '').toLowerCase()]?.[type];
  const found = Array.isArray(arr) ? arr.find((m: any) => m?.value === value) : undefined;
  return found?.label || value;
}

export function ModelSelector({ config, value, onChange, disabled, id = 'analysis_model' }: ModelSelectorProps) {
  // 本地模型：provider 目录来自 @/lib/providers，密钥来自浏览器 keyVault
  // （hook 只输出模型名与展示名，不含 api_key / base_url 等敏感信息）。
  const { data: llmSettings } = useLocalModelProviders();

  const options = useMemo<ModelOption[]>(() => {
    const list: ModelOption[] = [];
    const seen = new Set<string>();
    const push = (opt: ModelOption) => {
      if (!opt.label) return;
      const key = `${opt.provider}|${opt.shallow}|${opt.deep}`;
      if (seen.has(key)) return;
      seen.add(key);
      list.push(opt);
    };

    const personal = (llmSettings?.providers || []).filter((p: any) => p?.is_enabled);
    for (const p of personal) {
      const provider = p.provider_name;
      const shallow = p.shallow_model || '';
      const deep = p.deep_model || shallow;
      const shallowLabel = labelFor(config, provider, 'shallow', shallow);
      const deepLabel = labelFor(config, provider, 'deep', deep);
      const label =
        shallowLabel && deepLabel && shallowLabel !== deepLabel
          ? `${shallowLabel} / ${deepLabel}`
          : deepLabel || shallowLabel;
      push({ provider, shallow, deep, label });
    }

    return list;
  }, [llmSettings]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const label = e.target.value;
    const next = options.find((o) => o.label === label) || null;
    onChange(next);
  };

  if (options.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-warning-500/40 bg-warning-500/10 px-4 py-3 text-sm text-warning-500"
      >
        <i className="fas fa-circle-info mr-2" aria-hidden="true" />
        {NO_MODEL_MESSAGE}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-text-secondary">
        模型
      </label>
      <select
        id={id}
        name="analysis_model"
        value={value || ''}
        onChange={handleChange}
        disabled={disabled}
        className="w-full min-h-[43px] px-3 py-2 bg-[#0d131b] border border-dark-border text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary transition-all disabled:opacity-50"
      >
        <option value="">选择模型...</option>
        {options.map((opt) => (
          <option key={`${opt.provider}:${opt.shallow}:${opt.deep}`} value={opt.label}>
            {opt.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-text-tertiary">
        只显示可用模型。个人模型在“我的模型”中管理；此处不展示 Provider、Endpoint 或密钥配置。
      </p>
    </div>
  );
}
