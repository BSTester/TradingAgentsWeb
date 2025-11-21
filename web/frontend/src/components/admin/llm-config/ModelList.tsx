import React from 'react';

interface Model {
  id: number;
  provider_id: number;
  model_name: string;
  model_type: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
  provider_name: string;
  provider_display_name: string;
  created_at: string;
  updated_at: string;
}

interface ModelListProps {
  models: Model[];
  onEdit: (model: Model) => void;
  onDelete: (model: Model) => void;
}

export function ModelList({ models, onEdit, onDelete }: ModelListProps) {
  if (models.length === 0) {
    return (
      <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-12 text-center">
        <div className="text-text-muted text-6xl mb-4">🤖</div>
        <h3 className="text-lg font-medium text-text-primary mb-2">暂无模型</h3>
        <p className="text-text-secondary">点击上方按钮添加第一个 LLM 模型</p>
      </div>
    );
  }

  const getModelTypeColor = (type: string) => {
    return type === 'deep_thinker' ? 'text-purple-500' : 'text-blue-500';
  };

  const getModelTypeIcon = (type: string) => {
    return type === 'deep_thinker' ? 'fa-brain' : 'fa-bolt';
  };

  const getModelTypeLabel = (type: string) => {
    return type === 'deep_thinker' ? '深度思考' : '快速响应';
  };

  return (
    <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-dark-border">
          <thead className="bg-dark-tertiary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                模型名称
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                类型
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                供应商
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                描述
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-dark-secondary divide-y divide-dark-border">
            {models.map((model) => (
              <tr key={model.id} className="hover:bg-dark-tertiary transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${model.is_active ? 'bg-success-500' : 'bg-text-muted'}`} />
                    <span className="text-xs text-text-muted">
                      {model.is_active ? '已启用' : '已禁用'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      {model.display_name}
                    </div>
                    <div className="text-xs text-text-muted font-mono mt-1">
                      {model.model_name}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    model.model_type === 'deep_thinker' 
                      ? 'bg-purple-500/20 text-purple-500' 
                      : 'bg-blue-500/20 text-blue-500'
                  }`}>
                    <i className={`fas ${getModelTypeIcon(model.model_type)} mr-1.5`} />
                    {getModelTypeLabel(model.model_type)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-text-secondary">
                    {model.provider_display_name}
                  </div>
                  <div className="text-xs text-text-muted font-mono">
                    {model.provider_name}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-text-secondary max-w-xs truncate" title={model.description || ''}>
                    {model.description || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => onEdit(model)}
                    className="text-accent-primary hover:text-accent-secondary mr-3"
                    title="编辑"
                  >
                    <i className="fas fa-edit" />
                  </button>
                  <button
                    onClick={() => onDelete(model)}
                    className="text-danger-500 hover:text-danger-600"
                    title="删除"
                  >
                    <i className="fas fa-trash" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
