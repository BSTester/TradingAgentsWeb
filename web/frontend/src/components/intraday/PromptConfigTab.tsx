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

    if (templateName.length > 200) {
      onShowToast('策略名称不能超过200个字符', 'error');
      return;
    }
    
    if (description.length > 500) {
      onShowToast('策略描述不能超过500个字符', 'error');
      return;
    }
    
    if (editedPrompt.length > 20000) {
      onShowToast('提示词不能超过20,000个字符（当前' + editedPrompt.length.toLocaleString() + '字符）', 'error');
      return;
    }

    setSaving(true);

    try {
      const updateData: any = {
        system_prompt: editedPrompt,
        version: (template?.version || '1.0') + '_edited',
      };
      if (templateName) updateData.template_name = templateName;
      if (description) updateData.description = description;
      
      const data = await updatePromptTemplate('intraday_trader', updateData);
      
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
      
      const validateData: any = {
        system_prompt: editedPrompt,
      };
      if (templateName) validateData.template_name = templateName;
      if (description) validateData.description = description;
      
      const result = await validatePromptTemplate('intraday_trader', validateData);

      setValidationResult(result);
      
      if (result.valid) {
        onShowToast('提示词验证通过', 'success');
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

  const charCountClass = editedPrompt.length > 20000 
    ? 'text-xs text-red-500 font-semibold' 
    : 'text-xs text-text-secondary';

  const saveButtonClass = saving || !hasChanges
    ? 'bg-gray-400 cursor-not-allowed'
    : 'bg-accent-primary hover:bg-accent-secondary';

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            策略名称
            <span className="ml-2 text-xs text-text-tertiary">
              ({templateName.length}/200)
            </span>
          </label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            maxLength={200}
            className="w-full px-3 py-2 bg-dark-tertiary border border-dark-border text-text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary"
            placeholder="例如：激进型日内交易策略"
          />
          <p className="text-xs text-text-tertiary mt-1">
            策略标题，最多200个字符
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            策略描述
            <span className="ml-2 text-xs text-text-tertiary">
              ({description.length}/500)
            </span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            className="w-full px-3 py-2 bg-dark-tertiary border border-dark-border text-text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary"
            placeholder="简要描述策略特点"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-text-primary">
              系统提示词
            </label>
            <span className={charCountClass}>
              {editedPrompt.length.toLocaleString()} / 20,000 字符
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
        <p className="text-xs text-text-tertiary mt-1">
          核心提示词内容，最多 20,000 个字符。系统会自动注入工具文档和变量说明。
        </p>
        
        {editedPrompt.length > 20000 && (
          <div className="mt-2 p-3 rounded-md text-sm bg-red-50 border border-red-200 text-red-800">
            <div className="flex items-start gap-2">
              <i className="fas fa-exclamation-triangle mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">提示词超出长度限制</p>
                <p className="text-xs mt-1">
                  当前 {editedPrompt.length.toLocaleString()} 字符，超出 {(editedPrompt.length - 20000).toLocaleString()} 字符。请精简内容后再保存。
                </p>
              </div>
            </div>
          </div>
        )}
        
        {validationResult && (
          <div className={validationResult.valid 
            ? 'mt-2 p-3 rounded-md text-sm bg-green-50 border border-green-200 text-green-800'
            : 'mt-2 p-3 rounded-md text-sm bg-red-50 border border-red-200 text-red-800'
          }>
            <div className="flex items-start gap-2">
              <i className={validationResult.valid ? 'fas fa-check-circle mt-0.5' : 'fas fa-exclamation-circle mt-0.5'} />
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

      <div className="flex gap-3 pt-4 border-t border-dark-border">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={'px-4 py-2 rounded-md text-white font-medium transition-colors ' + saveButtonClass}
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
