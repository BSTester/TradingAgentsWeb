'use client';

import { useState, useEffect } from 'react';
import {
  getPromptTemplate,
  updatePromptTemplate,
  resetToDefault,
  type PromptTemplate,
} from '@/lib/api/prompts';

interface PromptConfigTabProps {
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function PromptConfigTab({ onShowToast }: PromptConfigTabProps) {
  const [template, setTemplate] = useState<PromptTemplate | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (template) {
      const changed =
        editedPrompt !== template.system_prompt ||
        templateName !== (template.template_name || '') ||
        description !== (template.description || '');
      setHasChanges(changed);
    }
  }, [editedPrompt, templateName, description, template]);

  const loadData = async () => {
    setLoading(true);
    try {
      const templateData = await getPromptTemplate('intraday_trader');

      setTemplate(templateData);
      setEditedPrompt(templateData.system_prompt);
      setTemplateName(templateData.template_name || '');
      setDescription(templateData.description || '');
    } catch (error: any) {
      onShowToast(error.response?.data?.detail || '加载配置失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!hasChanges) {
      onShowToast('没有需要保存的更改', 'info');
      return;
    }

    setSaving(true);

    try {
      // Save the template directly (validation happens on backend)
      const data = await updatePromptTemplate('intraday_trader', {
        system_prompt: editedPrompt,
        template_name: templateName || undefined,
        description: description || undefined,
        version: `${template?.version || '1.0'}_edited`,
      });
      
      // Update local state with saved data
      setTemplate(data);
      setEditedPrompt(data.system_prompt);
      setTemplateName(data.template_name || '');
      setDescription(data.description || '');
      setHasChanges(false);
      setValidationResult(null);
      
      onShowToast('配置已保存', 'success');
    } catch (error: any) {
      onShowToast(error.response?.data?.detail || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    setValidationResult(null);

    try {
      const { validatePromptTemplate } = await import('@/lib/api/prompts');
      
      const result = await validatePromptTemplate('intraday_trader', {
        system_prompt: editedPrompt,
        template_name: templateName || undefined,
        description: description || undefined,
      });

      setValidationResult(result);
      
      if (result.valid) {
        onShowToast('✅ 提示词验证通过', 'success');
      } else {
        onShowToast(result.message || '验证失败', 'error');
      }
    } catch (error: any) {
      onShowToast('验证请求失败', 'error');
    } finally {
      setValidating(false);
    }
  };

  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const handleResetConfirm = async () => {
    setShowResetConfirm(false);
    setSaving(true);
    try {
      const data = await resetToDefault('intraday_trader');
      setTemplate(data);
      setEditedPrompt(data.system_prompt);
      setTemplateName(data.template_name || '');
      setDescription(data.description || '');
      setHasChanges(false);
      setValidationResult(null);
      onShowToast('已重置为默认配置', 'success');
    } catch (error: any) {
      onShowToast(error.response?.data?.detail || '重置失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetCancel = () => {
    setShowResetConfirm(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-text-secondary">加载中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">


      {/* Template Name and Description */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            策略名称
          </label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="w-full px-3 py-2 bg-dark-tertiary border border-dark-border text-text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary"
            placeholder="例如：激进型日内交易策略"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            策略描述
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 bg-dark-tertiary border border-dark-border text-text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary"
            placeholder="简要描述策略特点"
          />
        </div>
      </div>

      {/* Prompt Editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <label className="block text-sm font-medium text-text-primary">
              系统提示词
            </label>
            <span className="text-xs text-text-secondary">
              {editedPrompt.length.toLocaleString()} 字符
            </span>
          </div>
          <button
            onClick={handleValidate}
            disabled={validating || !editedPrompt.trim()}
            className="px-3 py-1 text-xs border border-dark-border rounded-md text-text-primary hover:bg-dark-tertiary disabled:opacity-50"
          >
            {validating ? '验证中...' : '验证提示词'}
          </button>
        </div>
        <textarea
          value={editedPrompt}
          onChange={(e) => {
            setEditedPrompt(e.target.value);
            setValidationResult(null);
          }}
          className="w-full h-96 px-3 py-2 font-mono text-sm bg-dark-tertiary border border-dark-border text-text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary resize-none"
          placeholder="定义 Agent 的行为、交易理念和执行流程..."
        />
        
        {/* Validation Result */}
        {validationResult && (
          <div className={`mt-2 p-3 rounded-md text-sm ${
            validationResult.valid 
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex items-start gap-2">
              <i className={`fas ${validationResult.valid ? 'fa-check-circle' : 'fa-exclamation-circle'} mt-0.5`} />
              <div className="flex-1">
                <p className="font-medium">{validationResult.message}</p>
                {validationResult.valid && validationResult.total_length && (
                  <p className="text-xs mt-1">
                    最终系统提示词长度: {validationResult.total_length.toLocaleString()} 字符
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>



      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-dark-border">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={`px-4 py-2 rounded-md text-white font-medium transition-colors ${
            saving || !hasChanges
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-accent-primary hover:bg-accent-secondary'
          }`}
        >
          {saving ? '保存中...' : '保存配置'}
        </button>
        <button
          onClick={handleResetClick}
          disabled={saving}
          className="px-4 py-2 border border-dark-border rounded-md text-text-primary font-medium hover:bg-dark-tertiary disabled:opacity-50 transition-colors"
        >
          重置为默认
        </button>
        {hasChanges && (
          <span className="flex items-center text-sm text-yellow-600">
            <i className="fas fa-exclamation-triangle mr-2" />
            有未保存的更改
          </span>
        )}
        {validationResult?.valid && (
          <span className="flex items-center text-sm text-green-600">
            <i className="fas fa-check-circle mr-2" />
            验证通过
          </span>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-secondary rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <i className="fas fa-exclamation-triangle text-yellow-500 text-2xl" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  确认重置
                </h3>
                <p className="text-sm text-text-secondary mb-4">
                  确定要重置为默认配置吗？这将清除所有自定义内容，此操作无法撤销。
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={handleResetCancel}
                    className="px-4 py-2 border border-dark-border rounded-md text-text-primary font-medium hover:bg-dark-tertiary transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleResetConfirm}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
                  >
                    确认重置
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
