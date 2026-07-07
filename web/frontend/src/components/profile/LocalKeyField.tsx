'use client';

import React, { useState } from 'react';
import { useLocalLLMKeys } from '@/hooks/useLocalLLMKeys';
import { ConfirmDialog } from '@/components/admin/llm-config/ConfirmDialog';

export interface LocalKeyTestResult {
  valid: boolean;
  message?: string;
}

interface LocalKeyFieldProps {
  /** localStorage 隔离用的 provider 标识（provider_name 或 自定义 id） */
  providerKey: string;
  /** 展示用名称 */
  providerLabel: string;
  /** 用于测试连接（E5）的 base_url */
  baseUrl?: string;
  /** 后端 provider 配置 id（仅已保存的 provider 可测试连接） */
  providerId?: string;
  /**
   * 实际测试逻辑：传入 apiKey（本地或临时输入），返回成败。
   * 由父组件注入（调用 llmSettingsAPI.testProvider 或 configAPI.validateAPIKey）。
   * 不传则测试按钮禁用并提示「保存后可测试」。
   */
  onTest?: (apiKey: string) => Promise<LocalKeyTestResult>;
}

type Mode = 'empty' | 'saved' | 'replace';

/**
 * 本地 KEY 保存 / 替换 / 清除（localStorage）
 * 依据 api-contract.md §2.3 与 frontend-tech-spec.md §4.3
 *
 * 安全约束（§2.4）：
 *  - 明文 KEY 仅在局部 useState，保存/用完即清空
 *  - 不回显已保存 KEY 明文
 *  - 不进任何后端持久化字段（仅 onTest 临时下发）
 */
export function LocalKeyField({ providerKey, providerLabel, baseUrl, providerId, onTest }: LocalKeyFieldProps) {
  const { hasLocalKey, getLocalKey, saveLocalKey, replaceLocalKey, clearLocalKey } = useLocalLLMKeys();

  const [mode, setMode] = useState<Mode>(hasLocalKey(providerKey) ? 'saved' : 'empty');
  const [apiKey, setApiKey] = useState('');
  const [saveToBrowser, setSaveToBrowser] = useState(true);
  const [showKey, setShowKey] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LocalKeyTestResult | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const isSaved = mode === 'saved';

  // 当前可用于测试 / 下发的 KEY：优先刚输入，其次本地已存
  const resolveKey = (): string => {
    if (apiKey.trim()) return apiKey.trim();
    return getLocalKey(providerKey) || '';
  };

  const handleSave = () => {
    const key = apiKey.trim();
    if (!key) return;
    if (saveToBrowser) {
      saveLocalKey(providerKey, key);
      setMode('saved');
    }
    // 不论是否保存，提交完即清空明文
    setApiKey('');
    setTestResult(null);
  };

  const handleReplace = () => {
    const key = apiKey.trim();
    if (!key) return;
    replaceLocalKey(providerKey, key);
    setApiKey('');
    setMode('saved');
    setTestResult(null);
  };

  const handleConfirmClear = () => {
    clearLocalKey(providerKey);
    setMode('empty');
    setApiKey('');
    setTestResult(null);
    setClearConfirmOpen(false);
  };

  const handleTest = async () => {
    if (!onTest) return;
    const key = resolveKey();
    if (!key) {
      setTestResult({ valid: false, message: '请先输入或保存 KEY' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await onTest(key);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ valid: false, message: err?.message || '测试失败' });
    } finally {
      setTesting(false);
    }
  };

  const inputEl = (
    <div className="relative">
      <input
        type={showKey ? 'text' : 'password'}
        id={`local-key-${providerKey}`}
        value={apiKey}
        onChange={(e) => {
          setApiKey(e.target.value);
          setTestResult(null);
        }}
        aria-label={`${providerLabel} API 密钥`}
        placeholder="输入 API 密钥（仅存于当前浏览器）"
        className="block w-full h-12 pl-3 pr-12 bg-dark-tertiary border border-dark-border text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent"
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 pr-3 flex items-center"
        onClick={() => setShowKey((s) => !s)}
        aria-label={showKey ? '隐藏密钥' : '显示密钥'}
      >
        <i className={`fas ${showKey ? 'fa-eye-slash' : 'fa-eye'} text-text-muted hover:text-text-secondary`} />
      </button>
    </div>
  );

  return (
    <div className="rounded-lg border border-dark-border bg-dark-tertiary p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">
          <i className="fas fa-key mr-2 text-accent-primary" />
          API 密钥（本浏览器）
        </span>
        {isSaved ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-500/20 text-success-500">
            <i className="fas fa-check-circle mr-1" />
            已保存本浏览器
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-500/20 text-warning-500">
            <i className="fas fa-exclamation-triangle mr-1" />
            当前浏览器未保存
          </span>
        )}
      </div>

      {mode === 'saved' ? (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            已在本浏览器保存 <span className="text-text-primary">{providerLabel}</span> 的密钥。明文不会回显，也不会发送到后端持久化。
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode('replace')}
              className="px-3 py-2 bg-dark-secondary border border-dark-border text-text-primary rounded-lg hover:bg-dark-primary transition-colors"
            >
              <i className="fas fa-sync mr-1" />
              替换 KEY
            </button>
            <button
              type="button"
              onClick={() => setClearConfirmOpen(true)}
              className="px-3 py-2 bg-dark-secondary border border-danger-500/40 text-danger-500 rounded-lg hover:bg-danger-500/10 transition-colors"
            >
              <i className="fas fa-trash mr-1" />
              清除 KEY
            </button>
            {onTest && providerId && (
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="px-3 py-2 bg-dark-secondary border border-dark-border text-text-primary rounded-lg hover:bg-dark-primary disabled:opacity-50 transition-colors"
              >
                {testing ? <i className="fas fa-spinner fa-spin mr-1" /> : <i className="fas fa-plug mr-1" />}
                测试连接
              </button>
            )}
          </div>
        </div>
      ) : mode === 'empty' ? (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            输入后将<span className="text-text-primary">仅保存到当前浏览器</span>。换浏览器、清除站点数据或无痕模式下需重新填写。
          </p>
          {inputEl}
          <label className="flex items-center space-x-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={saveToBrowser}
              onChange={(e) => setSaveToBrowser(e.target.checked)}
              className="h-4 w-4 text-accent-primary focus:ring-accent-primary border-dark-border rounded bg-dark-secondary"
            />
            <span>保存到当前浏览器（否则仅用于本次测试）</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!apiKey.trim() || (!saveToBrowser && !onTest)}
              className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saveToBrowser ? '保存 KEY' : '仅本次使用'}
            </button>
            {onTest && (
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2 bg-dark-secondary border border-dark-border text-text-primary rounded-lg hover:bg-dark-primary disabled:opacity-50 transition-colors"
              >
                {testing ? <i className="fas fa-spinner fa-spin mr-1" /> : <i className="fas fa-plug mr-1" />}
                测试连接
              </button>
            )}
          </div>
        </div>
      ) : null}

      {mode === 'replace' && (
        <div className="space-y-3 border-t border-dark-border pt-3">
          <p className="text-sm text-text-secondary">替换需重新输入<strong className="text-text-primary">完整</strong>密钥：</p>
          {inputEl}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReplace}
              disabled={!apiKey.trim()}
              className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-secondary disabled:opacity-50 transition-colors"
            >
              确认替换
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('saved');
                setApiKey('');
              }}
              className="px-4 py-2 bg-dark-secondary border border-dark-border text-text-primary rounded-lg hover:bg-dark-primary transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {testResult && (
        <div
          role="status"
          className={`text-sm rounded-lg p-2 ${
            testResult.valid ? 'bg-success-500/10 text-success-500' : 'bg-danger-500/10 text-danger-500'
          }`}
        >
          <i className={`fas ${testResult.valid ? 'fa-check-circle' : 'fa-times-circle'} mr-1`} />
          {testResult.valid ? '连接成功' : testResult.message || '连接失败'}
        </div>
      )}

      <ConfirmDialog
        isOpen={clearConfirmOpen}
        title="清除本地密钥"
        message={`确定要从当前浏览器清除 ${providerLabel} 的密钥吗？\n\n清除后该 provider 在本浏览器不再可用于个人 KEY 分析，除非再次设置或改用系统默认 provider。`}
        confirmText="清除"
        confirmButtonClass="bg-danger-500 hover:bg-danger-600"
        onConfirm={handleConfirmClear}
        onCancel={() => setClearConfirmOpen(false)}
      />
    </div>
  );
}

export default LocalKeyField;
