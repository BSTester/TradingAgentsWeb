'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageShell } from '@/components/ws133/Shell';
import { COMMON_PROVIDERS } from '@/lib/providers';
import { llmAPI } from '@/lib/api';

interface LocalModelConfig {
  provider: string;
  base_url: string;
  api_key: string;
  shallow_model: string;
  deep_model: string;
}

const STORAGE_KEY = 'ws133_local_model_config';

const EMPTY: LocalModelConfig = { provider: '', base_url: '', api_key: '', shallow_model: '', deep_model: '' };

export default function SettingsPage() {
  const [cfg, setCfg] = useState<LocalModelConfig>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCfg((c) => ({ ...c, ...JSON.parse(raw) }));
    } catch {}
  }, []);

  const selected = useMemo(
    () => COMMON_PROVIDERS.find((p) => p.value === cfg.provider) ?? null,
    [cfg.provider]
  );

  // 用用户自己的本地 Key + 接口地址，从该提供商的 API 拉取可用模型
  const handleFetchModels = async () => {
    if (!cfg.base_url) { setFetchError('请先填写 API 接口地址'); return; }
    if (!cfg.api_key) { setFetchError('请先填写 API Key'); return; }
    setFetchingModels(true);
    setFetchError(null);
    try {
      const res = await llmAPI.fetchModelsTransient({
        base_url: cfg.base_url,
        api_key: cfg.api_key,
        provider_type: cfg.provider,
      });
      setFetchedModels(res.models ?? []);
    } catch (err: any) {
      setFetchError(err?.message ?? '获取模型列表失败');
    } finally {
      setFetchingModels(false);
    }
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = <K extends keyof LocalModelConfig>(k: K, v: LocalModelConfig[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));

  const onProvider = (value: string) => {
    const p = COMMON_PROVIDERS.find((x) => x.value === value);
    setCfg((c) => ({
      ...c,
      provider: value,
      base_url: p?.base_url ?? '',
      shallow_model: p?.models?.[0] ?? '',
      deep_model: p?.models?.[1] ?? p?.models?.[0] ?? '',
    }));
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl">
        <h1 className="text-responsive-h2 text-text-primary">自定义模型设置</h1>
        <p className="mt-1 text-sm text-text-tertiary">
          选择常用 LLM 服务商并填写您的 Key，即可跳过订阅、直接使用自有模型进行分析。
        </p>

        <div className="mt-4 rounded-lg border border-warning-500/40 bg-warning-500/10 p-3 text-sm text-warning-500">
          <i className="fas fa-triangle-exclamation mr-2" aria-hidden="true" />
          配置仅保存在当前浏览器前端，服务器不保存，请勿泄露您的 Key。
        </div>

        <div className="mt-6 space-y-5 rounded-2xl border border-dark-border bg-dark-secondary p-6">
          <div>
            <label className="form-label">LLM 服务商</label>
            <select
              value={cfg.provider}
              onChange={(e) => onProvider(e.target.value)}
              className="form-select mt-1"
            >
              <option value="">请选择服务商</option>
              {COMMON_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">API 接口地址</label>
            <input
              value={cfg.base_url}
              onChange={(e) => set('base_url', e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="form-control mt-1"
            />
          </div>

          <div>
            <label className="form-label">API Key</label>
            <input
              type="password"
              value={cfg.api_key}
              onChange={(e) => set('api_key', e.target.value)}
              placeholder="sk-..."
              className="form-control mt-1"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">浅层模型（快速）</label>
              <input
                list="shallow-models"
                value={cfg.shallow_model}
                onChange={(e) => set('shallow_model', e.target.value)}
                placeholder={selected?.models?.[0] ?? 'gpt-5.5'}
                className="form-control mt-1"
              />
              <datalist id="shallow-models">
                {(fetchedModels.length ? fetchedModels : (selected?.models ?? [])).map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="form-label">深度模型（推理）</label>
              <input
                list="deep-models"
                value={cfg.deep_model}
                onChange={(e) => set('deep_model', e.target.value)}
                placeholder={selected?.models?.[1] ?? selected?.models?.[0] ?? ''}
                className="form-control mt-1"
              />
              <datalist id="deep-models">
                {(fetchedModels.length ? fetchedModels : (selected?.models ?? [])).map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          </div>

          {/* 获取该供应商的可用模型（用本地 Key），选中后可直接填入浅层/深度 */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleFetchModels}
              disabled={fetchingModels}
              className="rounded-lg border border-accent-primary/50 px-4 py-2 text-sm text-accent-primary hover:bg-accent-primary/10 disabled:opacity-50"
            >
              <i className="fas fa-sync mr-1" aria-hidden="true" />
              {fetchingModels ? '获取中…' : '获取模型列表'}
            </button>
            {fetchedModels.length > 0 && (
              <span className="text-xs text-text-tertiary">已获取 {fetchedModels.length} 个可用模型，可直接在输入框选择。</span>
            )}
            {fetchError && (
              <span className="text-xs text-danger-500">
                <i className="fas fa-exclamation-circle mr-1" aria-hidden="true" />
                {fetchError}
              </span>
            )}
          </div>

          {/* 获取到的模型：可见可点选列表，点击即为该模型设为浅层/深层 */}
          {fetchedModels.length > 0 && (
            <div className="rounded-lg border border-dark-border bg-dark-tertiary/40 p-3">
              <p className="mb-2 text-xs text-text-tertiary">
                可用模型（点击设为浅层 / 深层）：
              </p>
              <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                {fetchedModels.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1.5 rounded-md bg-dark-elevated px-2 py-1 text-xs"
                  >
                    <span className="font-mono text-text-primary">{m}</span>
                    <button
                      type="button"
                      onClick={() => set('shallow_model', m)}
                      className="rounded bg-dark-secondary px-1.5 py-0.5 text-[11px] text-accent-primary hover:bg-accent-primary/15"
                      title="设为浅层模型"
                    >
                      浅层
                    </button>
                    <button
                      type="button"
                      onClick={() => set('deep_model', m)}
                      className="rounded bg-dark-secondary px-1.5 py-0.5 text-[11px] text-accent-primary hover:bg-accent-primary/15"
                      title="设为深层模型"
                    >
                      深层
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-dark-border pt-4">
            <span className="text-xs text-text-tertiary">
              {saved ? (
                <span className="text-down">
                  <i className="fas fa-check mr-1" aria-hidden="true" /> 已保存到本机
                </span>
              ) : (
                '配置将用于发起分析时的默认 Key。'
              )}
            </span>
            <button
              onClick={save}
              className="rounded-lg bg-accent-primary px-5 py-2 text-sm font-semibold text-white hover:bg-accent-secondary"
            >
              保存配置
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-dark-border bg-dark-secondary p-4 text-xs text-text-tertiary">
          <i className="fas fa-circle-info mr-1" aria-hidden="true" />
          提示：保存后，在首页发起分析时将自动使用此配置，无需消耗订阅次数。
        </div>
      </div>
    </PageShell>
  );
}
