'use client';

import { useState, useEffect } from 'react';
import {
  getAvailableTools,
  getEnabledTools,
  updateToolSelection,
  type Tool,
} from '@/lib/api/prompts';

interface ToolSelectorProps {
  agentType?: string;
  onUpdate?: (enabledTools: string[]) => void;
}

export default function ToolSelector({ agentType = 'intraday_trader', onUpdate }: ToolSelectorProps) {
  const [allTools, setAllTools] = useState<Tool[]>([]);
  const [enabledTools, setEnabledTools] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialEnabled, setInitialEnabled] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTools();
  }, [agentType]);

  useEffect(() => {
    // Check if there are changes
    const changed =
      enabledTools.size !== initialEnabled.size ||
      Array.from(enabledTools).some((tool) => !initialEnabled.has(tool));
    setHasChanges(changed);
  }, [enabledTools, initialEnabled]);

  const loadTools = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [tools, enabled] = await Promise.all([
        getAvailableTools(),
        getEnabledTools(agentType),
      ]);

      setAllTools(tools);
      const enabledSet = new Set(enabled);
      setEnabledTools(enabledSet);
      setInitialEnabled(new Set(enabled));
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || '加载工具列表失败',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (toolName: string) => {
    const newEnabled = new Set(enabledTools);
    if (newEnabled.has(toolName)) {
      newEnabled.delete(toolName);
    } else {
      newEnabled.add(toolName);
    }
    setEnabledTools(newEnabled);
  };

  const handleSelectAll = () => {
    setEnabledTools(new Set(allTools.map((t) => t.tool_name)));
  };

  const handleDeselectAll = () => {
    setEnabledTools(new Set());
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    setSaving(true);
    setMessage(null);

    try {
      const toolSelections = allTools.map((tool) => ({
        tool_name: tool.tool_name,
        is_enabled: enabledTools.has(tool.tool_name),
      }));

      await updateToolSelection(agentType, toolSelections);

      setInitialEnabled(new Set(enabledTools));
      setMessage({
        type: 'success',
        text: '工具选择已保存！将在下次执行时生效',
      });
      setHasChanges(false);

      if (onUpdate) {
        onUpdate(Array.from(enabledTools));
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

  // Group tools by category
  const toolsByCategory = allTools.reduce((acc, tool) => {
    const category = tool.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(tool);
    return acc;
  }, {} as Record<string, Tool[]>);

  const categoryNames: Record<string, string> = {
    account: '账户工具',
    market_data: '行情数据',
    trading: '交易执行',
    news: '新闻资讯',
    other: '其他',
  };

  const categoryIcons: Record<string, string> = {
    account: '💰',
    market_data: '📊',
    trading: '🔄',
    news: '📰',
    other: '🔧',
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
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">工具选择</h3>
            <p className="mt-1 text-sm text-gray-500">
              选择 Agent 可以使用的工具（已选择 {enabledTools.size}/{allTools.length}）
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              全选
            </button>
            <button
              onClick={handleDeselectAll}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              全不选
            </button>
          </div>
        </div>
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

      {/* Tools by Category */}
      <div className="p-6 space-y-6">
        {Object.entries(toolsByCategory).map(([category, tools]) => (
          <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h4 className="font-medium text-gray-900">
                {categoryIcons[category]} {categoryNames[category] || category}
                <span className="ml-2 text-sm text-gray-500">
                  ({tools.filter((t) => enabledTools.has(t.tool_name)).length}/{tools.length})
                </span>
              </h4>
            </div>
            <div className="divide-y divide-gray-200">
              {tools.map((tool) => (
                <label
                  key={tool.id}
                  className="flex items-start gap-3 p-4 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={enabledTools.has(tool.tool_name)}
                    onChange={() => handleToggle(tool.tool_name)}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm font-medium text-gray-900">
                      {tool.tool_name}
                    </div>
                    <div className="mt-1 text-sm text-gray-600">{tool.tool_description}</div>
                    {tool.tool_parameters && Object.keys(tool.tool_parameters.properties || {}).length > 0 && (
                      <div className="mt-2 text-xs text-gray-500">
                        参数: {Object.keys(tool.tool_parameters.properties).join(', ')}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`px-4 py-2 rounded-md text-white font-medium ${
              saving || !hasChanges
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving ? '保存中...' : '保存选择'}
          </button>
          <button
            onClick={loadTools}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            刷新
          </button>
        </div>
        {hasChanges && (
          <p className="mt-2 text-sm text-yellow-600">
            ⚠️ 有未保存的更改
          </p>
        )}
      </div>
    </div>
  );
}
