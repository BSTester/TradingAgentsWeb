import React, { useState, useEffect } from 'react';
import { buildApiUrl } from '@/utils/api';

interface Provider {
  id?: number;
  provider_name: string;
  display_name: string;
  api_key: string | null;
  base_url: string | null;
  description: string | null;
  is_active: boolean;
  config_json?: any;
}

interface ProviderFormProps {
  provider: Provider | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProviderForm({ provider, onClose, onSuccess }: ProviderFormProps) {
  const [formData, setFormData] = useState<Provider>({
    provider_name: '',
    display_name: '',
    api_key: null,
    base_url: '',
    description: null,
    is_active: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyChanged, setApiKeyChanged] = useState(false); // 跟踪API Key是否被用户修改

  useEffect(() => {
    if (provider) {
      // 编辑模式：清空API key（显示为掩码），但不立即更新数据库中的值
      const editedProvider = {
        ...provider,
        api_key: null  // 编辑时清空API key，只有用户输入新值时才更新
      };
      setFormData(editedProvider);
    }
  }, [provider]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('access_token');
      const url = provider
        ? buildApiUrl(`/api/admin/llm/providers/${provider.id}`)
        : buildApiUrl('/api/admin/llm/providers');
      
      const method = provider ? 'PATCH' : 'POST';
      
      // 过滤请求数据，只包含后端schema允许的字段
      let requestData: any;
      if (provider) {
        // 编辑模式：只发送可更新的字段
        requestData = {
          display_name: formData.display_name,
          base_url: formData.base_url,
          description: formData.description,
          is_active: formData.is_active,
          config_json: formData.config_json,
        };
        
        // 只有当用户修改了API Key或输入了新的API Key时才发送该字段
        if (formData.api_key && formData.api_key.trim() !== '') {
          requestData.api_key = formData.api_key;
        }
      } else {
        // 创建模式：发送所有必要字段
        requestData = formData;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = '操作失败';
        
        // 处理多种错误格式
        if (errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            // Pydantic验证错误格式
            errorMessage = errorData.detail.map((item: any) => {
              if (typeof item === 'string') return item;
              if (item.msg) return `${item.loc?.join('.') || 'field'}: ${item.msg}`;
              if (item.message) return item.message;
              return JSON.stringify(item);
            }).join('; ');
          } else {
            errorMessage = errorData.detail;
          }
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
        
        throw new Error(errorMessage);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!formData.api_key || !formData.base_url?.trim()) {
      setTestResult({ success: false, message: '请先填写 API Key 和 Base URL' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(buildApiUrl('/api/admin/llm/test-connection'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider_id: provider?.id,
          provider_name: formData.provider_name,
          api_key: formData.api_key,
          base_url: formData.base_url,
        }),
      });

      const result = await response.json();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: `测试失败: ${err.message}` });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-secondary rounded-lg shadow-xl border border-dark-border max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-border flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">
            <i className="fas fa-server mr-2 text-accent-primary" />
            {provider ? '编辑供应商' : '添加供应商'}
          </h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <i className="fas fa-times text-xl" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {/* Important Notice */}
          <div className="mb-6 p-4 bg-amber-500/20 border border-amber-500 rounded-lg">
            <div className="flex items-start">
              <i className="fas fa-info-circle text-amber-500 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-amber-500 font-medium mb-1">重要说明</h4>
                <p className="text-amber-400 text-sm">
                  适配 <strong>Google (Gemini)</strong>、<strong>Anthropic</strong> 和 <strong>OpenAI</strong>（以及所有符合 OpenAI 标准的第三方提供商）。供应商必须实现相应的接口规范，包括标准的请求/响应格式、认证方式和端点结构。
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-danger-500/20 border border-danger-500 rounded-lg text-danger-500 text-sm">
              <i className="fas fa-exclamation-circle mr-2" />
              {error}
            </div>
          )}

          {/* Provider Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              供应商标识 *
              <span className="text-text-muted ml-2 text-xs">(仅支持字母、数字、下划线和连字符)</span>
            </label>
            <input
              type="text"
              required
              disabled={!!provider}
              value={formData.provider_name}
              onChange={(e) => setFormData({ ...formData, provider_name: e.target.value.toLowerCase() })}
              className="w-full px-4 py-2 bg-dark-tertiary border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="例如: openai, anthropic, custom"
            />
            {provider && (
              <p className="mt-1 text-xs text-text-muted">供应商标识不可修改</p>
            )}
          </div>

          {/* Display Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              显示名称 *
            </label>
            <input
              type="text"
              required
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              className="w-full px-4 py-2 bg-dark-tertiary border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-accent-primary"
              placeholder="例如: OpenAI, Anthropic"
            />
          </div>

          {/* Base URL */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Base URL *
            </label>
            <input
              type="url"
              required
              value={formData.base_url || ''}
              onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
              className="w-full px-4 py-2 bg-dark-tertiary border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-accent-primary"
              placeholder="https://api.example.com/v1"
            />
          </div>

          {/* API Key */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              API Key
            </label>
            <input
              type="password"
              value={formData.api_key || ''}
              onChange={(e) => {
                const newValue = e.target.value || null;
                setFormData({ ...formData, api_key: newValue });
                if (provider && !apiKeyChanged && newValue) {
                  setApiKeyChanged(true); // 用户开始输入新的API Key
                }
              }}
              className="w-full px-4 py-2 bg-dark-tertiary border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-accent-primary font-mono"
              placeholder="sk-..."
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              描述
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
              rows={3}
              className="w-full px-4 py-2 bg-dark-tertiary border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-accent-primary resize-none"
              placeholder="供应商描述..."
            />
          </div>

          {/* Is Active */}
          <div className="mb-6">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-5 h-5 text-accent-primary bg-dark-tertiary border-dark-border rounded focus:ring-accent-primary focus:ring-2"
              />
              <span className="text-sm text-text-secondary">启用此供应商</span>
            </label>
          </div>

          {/* Test Connection */}
          {formData.api_key?.trim() && formData.base_url?.trim() && (
            <div className="mb-6">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="w-full px-4 py-2 bg-dark-tertiary border border-dark-border text-text-primary rounded-lg hover:bg-dark-primary transition-colors disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2" />
                    测试中...
                  </>
                ) : (
                  <>
                    <i className="fas fa-plug mr-2" />
                    测试连接
                  </>
                )}
              </button>

              {testResult && (
                <div className={`mt-3 p-3 rounded-lg border ${
                  testResult.success
                    ? 'bg-success-500/20 border-success-500 text-success-500'
                    : 'bg-danger-500/20 border-danger-500 text-danger-500'
                }`}>
                  <i className={`fas ${testResult.success ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-2`} />
                  {testResult.message}
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-dark-tertiary border border-dark-border text-text-primary rounded-lg hover:bg-dark-primary transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-secondary transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2" />
                  保存中...
                </>
              ) : (
                <>
                  <i className="fas fa-save mr-2" />
                  {provider ? '更新' : '创建'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
