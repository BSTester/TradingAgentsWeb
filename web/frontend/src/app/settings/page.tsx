'use client';

import { useEffect, useState } from 'react';
import { SiteLayout } from '@/components/site/SiteLayout';
import { useAuth } from '@/lib/auth';
import { useLocalLLMKeys } from '@/hooks/useLocalLLMKeys';
import { CUSTOM_MODEL_TYPES, customModelConfig, CustomModelType } from '@/lib/customModelConfig';

export default function SettingsPage() {
  const { user } = useAuth();
  const { hasLocalKey, saveLocalKey, clearLocalKey } = useLocalLLMKeys();
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({});
  const [savedType, setSavedType] = useState<string | null>(null);

  // 登录用户变化 / 首挂载时，用已保存的 Base URL（或默认值）填充表单
  useEffect(() => {
    if (!user) return;
    setUrlDrafts((prev) => {
      const next = { ...prev };
      for (const t of CUSTOM_MODEL_TYPES) {
        if (next[t.key] == null) {
          next[t.key] = customModelConfig.getBaseUrl(user.id, t.key) || t.defaultBaseUrl;
        }
      }
      return next;
    });
  }, [user]);

  const setKeyDraft = (k: string, v: string) => setKeyDrafts((p) => ({ ...p, [k]: v }));
  const setUrlDraft = (k: string, v: string) => setUrlDrafts((p) => ({ ...p, [k]: v }));

  const save = (type: CustomModelType) => {
    if (!user) return;
    const keyVal = keyDrafts[type]?.trim();
    if (keyVal) saveLocalKey(type, keyVal);
    customModelConfig.saveBaseUrl(user.id, type, urlDrafts[type] ?? '');
    setKeyDrafts((p) => ({ ...p, [type]: '' }));
    setSavedType(type);
    setTimeout(() => setSavedType(null), 1800);
  };

  const clear = (type: CustomModelType) => {
    if (!user) return;
    clearLocalKey(type);
    customModelConfig.clearBaseUrl(user.id, type);
    setUrlDrafts((p) => ({ ...p, [type]: CUSTOM_MODEL_TYPES.find((t) => t.key === type)!.defaultBaseUrl }));
  };

  return (
    <SiteLayout maxWidth="max-w-3xl">
      <h1 className="h-serif text-2xl">自定义模型设置</h1>
      <p className="mt-1 text-sm text-text-secondary">
        配置自定义 LLM 接口与密钥，只按接口类型选择，不绑定具体提供商。这些信息仅保存在你的浏览器本地，服务端不存储、不传输持久化。
      </p>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-verdict-hold/30 bg-verdict-hold/5 p-3 text-xs text-text-secondary">
        <i className="fa-solid fa-lock mt-0.5 text-verdict-hold" />
        <span>
          配置仅写入浏览器 localStorage（按账户隔离），不会随分析请求持久化到服务端，也不会出现在公开报告中。
          清除浏览器数据将一并清除。配置后，分析将优先使用你的自定义模型。
        </span>
      </div>

      {!user && (
        <p className="mt-4 text-xs text-verdict-hold">
          <i className="fa-solid fa-circle-info mr-1" />配置按账户隔离保存，登录后才会启用。
        </p>
      )}

      <div className="mt-6 space-y-3">
        {CUSTOM_MODEL_TYPES.map((t) => {
          const has = user ? hasLocalKey(t.key) : false;
          const keyDraft = keyDrafts[t.key] ?? '';
          const urlDraft = urlDrafts[t.key] ?? '';
          const urlDirty = user ? urlDraft.trim() !== (customModelConfig.getBaseUrl(user.id, t.key) || t.defaultBaseUrl) : false;
          return (
            <div key={t.key} className="surface-panel p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary">{t.label}</h3>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-text-tertiary">{t.desc}</p>
                </div>
                {has && <span className="verdict-pill verdict-bull shrink-0"><i className="fa-solid fa-check text-[10px]" />已配置</span>}
              </div>
              <div className="mt-3 space-y-2">
                <label className="block text-xs text-text-tertiary">API Key</label>
                <input
                  type="password"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(t.key, e.target.value)}
                  placeholder={has ? '••••••••（输入新值可替换）' : '粘贴该服务的 API Key'}
                  className="h-10 w-full rounded-lg border border-dark-border bg-dark-input px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
                />
                <label className="block pt-1 text-xs text-text-tertiary">Base URL</label>
                <input
                  type="text"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(t.key, e.target.value)}
                  placeholder={t.placeholder}
                  className="num h-10 w-full rounded-lg border border-dark-border bg-dark-input px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => save(t.key)}
                  disabled={!user || (!keyDraft.trim() && !urlDirty)}
                  className="btn-primary px-4 py-2 text-xs"
                >
                  {savedType === t.key ? '已保存' : '保存'}
                </button>
                {has && (
                  <button onClick={() => clear(t.key)} className="btn-ghost px-3 py-2 text-xs">
                    清除
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </SiteLayout>
  );
}
