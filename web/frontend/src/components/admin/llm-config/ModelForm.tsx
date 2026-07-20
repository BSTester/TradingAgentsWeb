import React, { useState, useEffect } from 'react';
import { buildApiUrl } from '@/utils/api';

interface Model {
  id?: number;
  provider_id: number;
  model_name: string;
  model_type: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
  config_json?: any;
}

interface Provider {
  id: number;
  provider_name: string;
  display_name: string;
  is_active: boolean;
}

interface ModelFormProps {
  model: Model | null;
  providers: Provider[];
  onClose: () => void;
  onSuccess: () => void;
}

export function ModelForm({ model, providers, onClose, onSuccess }: ModelFormProps) {
  const [formData, setFormData] = useState<Model>({
    provider_id: 0,
    model_name: '',
    model_type: 'shallow_thinker',
    display_name: '',
    description: null,
    is_active: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (model) {
      // 编辑模式：使用现有模型数据
      setFormData(model);
    } else if (providers.length > 0) {
      // 新建模式：设置默认供应商
      setFormData(prev => ({ 
        ...prev, 
        provider_id: providers[0]!.id 
      }));
    }
  }, [model, providers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // 验证 provider_id
    if (!formData.provider_id || formData.provider_id === 0) {
      setError('请选择供应商');
      return;
    }
    
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('access_token');
      const url = model
        ? buildApiUrl(`/api/admin/llm/models/${model.id}`)
        : buildApiUrl('/api/admin/llm/models');
      
      const method = model ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '操作失败');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeProviders = providers.filter(p => p.is_active);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-secondary rounded-lg shadow-xl border border-dark-border max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header - Fixed */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-dark-border flex items-center justify-between bg-dark-secondary">
          <h3 className="text-lg font-semibold text-text-primary">
            <i className="fas fa-cube mr-2 text-accent-primary" />
            {model ? '编辑模型' : '添加模型'}
          </h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <i className="fas fa-times text-xl" />
          </button>
        </div>

        {/* Form - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-danger-500/20 border border-danger-500 rounded-lg text-danger-500 text-sm">
              <i className="fas fa-exclamation-circle mr-2" />
              {error}
            </div>
          )}

          {/* Provider Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              供应商 *
            </label>
            <select
              required
              value={formData.provider_id || ''}
              onChange={(e) => setFormData({ ...formData, provider_id: parseInt(e.target.value) })}
              className="w-full px-4 py-2 bg-dark-tertiary border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-accent-primary"
            >
              <option value="">选择供应商...</option>
              {activeProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.display_name} ({provider.provider_name})
                </option>
              ))}
            </select>
            {activeProviders.length === 0 && (
              <p className="mt-1 text-xs text-warning-500">
                <i className="fas fa-exclamation-triangle mr-1" />
                没有可用的供应商，请先添加供应商
              </p>
            )}
          </div>

          {/* Model Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              模型类型 *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                formData.model_type === 'shallow_thinker'
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-dark-border hover:border-dark-border/50'
              }`}>
                <input
                  type="radio"
                  name="model_type"
                  value="shallow_thinker"
                  checked={formData.model_type === 'shallow_thinker'}
                  onChange={(e) => setFormData({ ...formData, model_type: e.target.value })}
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <i className="fas fa-bolt text-blue-500" />
                    <span className="font-medium text-text-primary">快速响应</span>
                  </div>
                  <p className="text-xs text-text-muted">适用于快速分析任务</p>
                </div>
              </label>

              <label className={`flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                formData.model_type === 'deep_thinker'
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-dark-border hover:border-dark-border/50'
              }`}>
                <input
                  type="radio"
                  name="model_type"
                  value="deep_thinker"
                  checked={formData.model_type === 'deep_thinker'}
                  onChange={(e) => setFormData({ ...formData, model_type: e.target.value })}
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <i className="fas fa-brain text-purple-500" />
                    <span className="font-medium text-text-primary">深度思考</span>
                  </div>
                  <p className="text-xs text-text-muted">适用于复杂分析任务</p>
                </div>
              </label>
            </div>
          </div>

          {/* Model Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              模型名称 *
            </label>
            <input
              type="text"
              required
              value={formData.model_name}
              onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
              className="w-full px-4 py-2 bg-dark-tertiary border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-accent-primary font-mono"
              placeholder="例如: gpt-4o, claude-3-5-sonnet-20241022"
            />
            <p className="mt-1 text-xs text-text-muted">
              实际调用时使用的模型标识符
            </p>
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
              placeholder="例如: GPT-4o, Claude 3.5 Sonnet"
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
              placeholder="模型描述..."
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
              <span className="text-sm text-text-secondary">启用此模型</span>
            </label>
          </div>

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
              disabled={isSubmitting || activeProviders.length === 0}
              className="flex-1 px-4 py-2 bg-accent-primary text-dark-primary rounded-lg hover:bg-accent-secondary transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2" />
                  保存中...
                </>
              ) : (
                <>
                  <i className="fas fa-save mr-2" />
                  {model ? '更新' : '创建'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
