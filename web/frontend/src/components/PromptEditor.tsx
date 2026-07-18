'use client';

import { useState, useEffect } from 'react';
import { getPromptTemplate, updatePromptTemplate, resetToDefault, type PromptTemplate } from '@/lib/api/prompts';

interface PromptEditorProps {
  agentType?: string;
  onSave?: (template: PromptTemplate) => void;
}

export default function PromptEditor({ agentType = 'intraday_trader', onSave }: PromptEditorProps) {
  const [template, setTemplate] = useState<PromptTemplate | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'variables'>('edit');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadTemplate();
  }, [agentType]);

  useEffect(() => {
    if (template) {
      const changed =
        editedPrompt !== template.system_prompt ||
        templateName !== (template.template_name || '') ||
        description !== (template.description || '');
      setHasChanges(changed);
    }
  }, [editedPrompt, templateName, description, template]);

  const loadTemplate = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await getPromptTemplate(agentType);
      setTemplate(data);
      setEditedPrompt(data.system_prompt);
      setTemplateName(data.template_name || '');
      setDescription(data.description || '');
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || '加载提示词失败',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    setSaving(true);
    setMessage(null);

    try {
      // 仅在填写后才附带可选字段，避免向 exactOptionalPropertyTypes 形参传入 undefined。
      const payload: {
        system_prompt: string;
        template_name?: string;
        description?: string;
        version: string;
      } = {
        system_prompt: editedPrompt,
        version: `${template?.version || '1.0'}_edited`,
      };
      if (templateName) payload.template_name = templateName;
      if (description) payload.description = description;

      const data = await updatePromptTemplate(agentType, payload);

      setTemplate(data);
      setMessage({
        type: 'success',
        text: '保存成功！新提示词将在下次执行时生效',
      });
      setHasChanges(false);

      if (onSave) {
        onSave(data);
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || '保存失败',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('确定要重置为默认提示词吗？当前修改将丢失。')) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const data = await resetToDefault(agentType);
      setTemplate(data);
      setEditedPrompt(data.system_prompt);
      setTemplateName(data.template_name || '');
      setDescription(data.description || '');
      setMessage({
        type: 'success',
        text: '已重置为默认提示词',
      });
      setHasChanges(false);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || '重置失败',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">加载中...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <h3 className="text-lg font-semibold text-gray-900">Agent 提示词配置</h3>
        <p className="mt-1 text-sm text-gray-500">
          自定义日内交易 Agent 的行为逻辑和决策风格
        </p>
        {template && (
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <span>版本: {template.version}</span>
            <span>最后更新: {new Date(template.updated_at).toLocaleString('zh-CN')}</span>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mx-6 mt-4 p-4 rounded-md ${
            message.type === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-green-50 text-green-800 border border-green-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px px-6" aria-label="Tabs">
          {[
            { id: 'edit', label: '编辑模式' },
            { id: 'preview', label: '预览模式' },
            { id: 'variables', label: '变量说明' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'edit' && (
          <div className="space-y-4">
            {/* Template Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                模板名称
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例如：激进型交易策略"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                描述
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="简要描述这个策略的特点"
              />
            </div>

            {/* Prompt Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                系统提示词
              </label>
              <textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                className="w-full h-[600px] px-3 py-2 font-mono text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="输入系统提示词..."
              />
              <p className="mt-2 text-xs text-gray-500">
                提示：使用 {'{market_type}'}, {'{session_id}'}, {'{timestamp}'} 等变量
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  saving || !hasChanges
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {saving ? '保存中...' : '保存修改'}
              </button>
              <button
                onClick={handleReset}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                重置为默认
              </button>
              <button
                onClick={loadTemplate}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                刷新
              </button>
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="bg-gray-50 rounded-lg p-6 min-h-[600px] overflow-auto">
            <pre className="whitespace-pre-wrap text-xs font-mono text-gray-800">
              {editedPrompt}
            </pre>
          </div>
        )}

        {activeTab === 'variables' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-3">可用的运行时变量</h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>
                  <code className="bg-blue-100 px-2 py-1 rounded">{'{market_type}'}</code> - 市场类型 (US/HK/CN)
                </li>
                <li>
                  <code className="bg-blue-100 px-2 py-1 rounded">{'{session_id}'}</code> - 会话ID
                </li>
                <li>
                  <code className="bg-blue-100 px-2 py-1 rounded">{'{timestamp}'}</code> - 当前时间戳
                </li>
                <li>
                  <code className="bg-blue-100 px-2 py-1 rounded">{'{user_id}'}</code> - 用户ID
                </li>
              </ul>
              <p className="mt-4 text-xs text-blue-700">
                这些变量会在 Agent 执行时自动替换为实际值
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-900 mb-3">💡 使用提示</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
                <li>支持使用变量来动态注入运行时信息</li>
                <li>修改后需要保存才能生效，下次执行智能盯盘时将使用新提示词</li>
                <li>建议在修改前先备份当前版本（可以复制到本地）</li>
                <li>可以调整风险偏好、交易策略、分析深度等参数</li>
                <li>可以自定义执行流程和输出格式</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
