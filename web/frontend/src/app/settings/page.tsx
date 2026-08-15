'use client';

import { useState } from 'react';
import { SiteLayout } from '@/components/site/SiteLayout';
import { useAuth } from '@/lib/auth';
import { useLocalLLMKeys } from '@/hooks/useLocalLLMKeys';

const PROVIDERS = [
  { key: 'openai', label: 'OpenAI', url: 'https://api.openai.com/v1', models: 'gpt-4o / gpt-4o-mini' },
  { key: 'deepseek', label: 'DeepSeek', url: 'https://api.deepseek.com/v1', models: 'deepseek-chat / deepseek-reasoner' },
  { key: 'openrouter', label: 'OpenRouter', url: 'https://openrouter.ai/api/v1', models: '多模型聚合' },
  { key: 'custom', label: '自定义兼容端点', url: '', models: '兼容 OpenAI 协议' },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { hasLocalKey, saveLocalKey, clearLocalKey } = useLocalLLMKeys();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);

  const setDraft = (k: string, v: string) => setDrafts((p) => ({ ...p, [k]: v }));

  const save = (k: string) => {
    const val = drafts[k]?.trim();
    if (!val) return;
    saveLocalKey(k, val);
    setDrafts((p) => ({ ...p, [k]: '' }));
    setSaved(k);
    setTimeout(() => setSaved(null), 1800);
  };

  return (
    <SiteLayout maxWidth="max-w-3xl">
      <h1 className="h-serif text-2xl">自定义模型设置</h1>
      <p className="mt-1 text-sm text-text-secondary">
        配置自定义 LLM 接口与密钥。这些信息仅保存在你的浏览器本地，服务端不存储、不传输持久化。
      </p>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-verdict-hold/30 bg-verdict-hold/5 p-3 text-xs text-text-secondary">
        <i className="fa-solid fa-lock mt-0.5 text-verdict-hold" />
        <span>
          本地 Key 仅写入浏览器 localStorage（按账户隔离），不会随分析请求持久化到服务端，也不会出现在公开报告中。
          清除浏览器数据将一并清除。配置后，分析将优先使用你的自定义模型。
        </span>
      </div>

      {!user && (
        <p className="mt-4 text-xs text-verdict-hold">
          <i className="fa-solid fa-circle-info mr-1" />本地 Key 按账户隔离保存，登录后才会启用。
        </p>
      )}

      <div className="mt-6 space-y-3">
        {PROVIDERS.map((p) => {
          const has = user ? hasLocalKey(p.key) : false;
          return (
            <div key={p.key} className="surface-panel p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{p.label}</h3>
                  <p className="num text-[11px] text-text-tertiary">{p.url || '需填写 Base URL'} · {p.models}</p>
                </div>
                {has && <span className="verdict-pill verdict-bull"><i className="fa-solid fa-check text-[10px]" />已配置</span>}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="password"
                  value={drafts[p.key] ?? ''}
                  onChange={(e) => setDraft(p.key, e.target.value)}
                  placeholder={has ? '••••••••（输入新值可替换）' : '粘贴 API Key'}
                  className="h-10 flex-1 rounded-lg border border-dark-border bg-dark-input px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
                />
                <button onClick={() => save(p.key)} disabled={!drafts[p.key]?.trim()} className="btn-primary px-4 py-2 text-xs">
                  {saved === p.key ? '已保存' : '保存'}
                </button>
                {has && (
                  <button onClick={() => clearLocalKey(p.key)} className="btn-ghost px-3 py-2 text-xs">
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

