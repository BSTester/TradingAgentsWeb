'use client';

import React, { useMemo } from 'react';
import { useUserLLMSettings } from '@/hooks/useUserLLMSettings';

/**
 * Workflow Desk — model-only selector for the analysis launch surface.
 *
 * Privacy contract (WS-13 / story-001, ui-spec.md "Analysis-start experience"):
 *   Visible:   model display names only.
 *   Forbidden: provider name, base URL, API key state, local-storage status,
 *              system-default status, backend credential source.
 *
 * This component deliberately reads ONLY:
 *   - the user's personal LLM settings (display_name + shallow/deep model values), and
 *   - the non-sensitive `config.models[*][shallow|deep]` labels (display labels only).
 * It never reads `config.system_default`, `config.llm_providers[].url`,
 * `AdminLLMProvider.api_key`, `hasLocalKey(...)` or any masked/raw key.
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
  '当前没有可用模型。请在“我的模型”添加个人模型，或联系管理员。';

/** Look up a friendly display label for a model value, falling back to the raw value. */
function labelFor(config: any, provider: string, type: 'shallow' | 'deep', value: string): string {
  if (!value) return '';
  const arr = config?.models?.[String(provider || '').toLowerCase()]?.[type];
  const found = Array.isArray(arr) ? arr.find((m: any) => m?.value === value) : undefined;
  return found?.label || value;
}

export function ModelSelector({ config, value, onChange, disabled, id = 'analysis_model' }: ModelSelectorProps) {
  // Personal models only — the privacy-clean source. The hook response contains
  // no api_key (keys live browser-local and are managed in 我的模型).
  const { data: llmSettings } = useUserLLMSettings();

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
  }, [llmSettings, config]);

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
