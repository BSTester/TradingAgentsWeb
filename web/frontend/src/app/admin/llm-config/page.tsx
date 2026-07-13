'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { buildApiUrl } from '@/utils/api';
import { useToast, Toast } from '@/components/ui/Toast';
import { AppNavbar } from '@/components/common/AppNavbar';
import { Footer } from '@/components/common/Footer';
import { ProviderList } from '@/components/admin/llm-config/ProviderList';
import { ModelList } from '@/components/admin/llm-config/ModelList';
import { PageLoading } from '@/components/ui/PageLoading';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProviderForm } from '@/components/admin/llm-config/ProviderForm';
import { ModelForm } from '@/components/admin/llm-config/ModelForm';
import { ConfirmDialog } from '@/components/admin/llm-config/ConfirmDialog';

export default function LLMConfigPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'providers' | 'models'>('providers');
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [showModelForm, setShowModelForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<any>(null);
  const [editingModel, setEditingModel] = useState<any>(null);
  
  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // 权限检查
  React.useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // 获取供应商列表
  const { data: providers, isLoading: providersLoading, isError: providersError, error: providersLoadError, refetch: refetchProviders } = useQuery({
    queryKey: ['admin', 'llm-providers'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(buildApiUrl('/api/admin/llm/providers?include_inactive=true'), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('获取供应商列表失败');
      return response.json();
    },
    enabled: !!user && user.role === 'admin',
  });

  // 获取模型列表
  const { data: models, isLoading: modelsLoading, isError: modelsError, error: modelsLoadError, refetch: refetchModels } = useQuery({
    queryKey: ['admin', 'llm-models'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(buildApiUrl('/api/admin/llm/models?include_inactive=true'), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('获取模型列表失败');
      return response.json();
    },
    enabled: !!user && user.role === 'admin',
  });

  // 删除供应商
  const deleteProviderMutation = useMutation({
    mutationFn: async (providerId: number) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(buildApiUrl(`/api/admin/llm/providers/${providerId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || '删除供应商失败');
      }
    },
    onSuccess: () => {
      showToast('供应商已删除', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'llm-providers'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'llm-models'] });
    },
    onError: (error: Error) => {
      showToast(error.message, 'error');
    },
  });

  // 删除模型
  const deleteModelMutation = useMutation({
    mutationFn: async (modelId: number) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(buildApiUrl(`/api/admin/llm/models/${modelId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || '删除模型失败');
      }
    },
    onSuccess: () => {
      showToast('模型已删除', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'llm-models'] });
    },
    onError: (error: Error) => {
      showToast(error.message, 'error');
    },
  });

  const handleEditProvider = async (provider: any) => {
    // Fetch full provider details including API key
    const token = localStorage.getItem('access_token');
    const response = await fetch(buildApiUrl(`/api/admin/llm/providers/${provider.id}`), {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (response.ok) {
      const fullProvider = await response.json();
      setEditingProvider(fullProvider);
      setShowProviderForm(true);
    }
  };

  const handleEditModel = async (model: any) => {
    setEditingModel(model);
    setShowModelForm(true);
  };

  const handleDeleteProvider = (provider: any) => {
    setConfirmDialog({
      isOpen: true,
      title: '删除供应商',
      message: `确定要删除供应商 "${provider.display_name}" 吗？

⚠️ 警告：这将同时删除该供应商下的所有模型！`,
      onConfirm: () => {
        deleteProviderMutation.mutate(provider.id);
      },
    });
  };

  const handleDeleteModel = (model: any) => {
    setConfirmDialog({
      isOpen: true,
      title: '删除模型',
      message: `确定要删除模型 "${model.display_name}" 吗？

此操作无法撤销。`,
      onConfirm: () => {
        deleteModelMutation.mutate(model.id);
      },
    });
  };

  if (authLoading || !user || user.role !== 'admin') {
    return <PageLoading message="正在验证管理员权限..." />;
  }

  return (
    <div className="min-h-screen bg-dark-primary flex flex-col">
      <AppNavbar user={user} onLogout={logout} />

      <div className="flex-1 max-w-7xl mx-auto px-4 py-8 pt-20 sm:px-6 lg:px-8 w-full">
        {/* 页面标题 */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-text-primary">
            <i className="fas fa-brain mr-3 text-accent-primary" />
            LLM 配置管理
          </h2>
          <p className="mt-2 text-text-secondary">管理 LLM 供应商和模型配置</p>
        </div>

        {/* 标签页 */}
        <div className="mb-6 border-b border-dark-border">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('providers')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'providers'
                  ? 'border-accent-primary text-accent-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-dark-border'
              }`}
            >
              <i className="fas fa-server mr-2" />
              供应商管理
            </button>
            <button
              onClick={() => setActiveTab('models')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'models'
                  ? 'border-accent-primary text-accent-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-dark-border'
              }`}
            >
              <i className="fas fa-cube mr-2" />
              模型管理
            </button>
          </nav>
        </div>

        {/* 内容区域 */}
        {activeTab === 'providers' && (
          <div>
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-text-primary">
                供应商列表 ({providers?.length || 0})
              </h3>
              <button
                onClick={() => {
                  setEditingProvider(null);
                  setShowProviderForm(true);
                }}
                className="px-4 py-2 bg-accent-primary text-dark-primary rounded-lg hover:bg-accent-secondary transition-colors"
              >
                <i className="fas fa-plus mr-2" />
                添加供应商
              </button>
            </div>

            {providersLoading ? (
              <PageLoading message="正在加载供应商目录..." />
            ) : providersError ? (
              <ErrorState
                title="供应商目录加载失败"
                description={providersLoadError instanceof Error ? providersLoadError.message : '无法读取供应商目录。'}
                onRetry={() => refetchProviders()}
              />
            ) : (
              <ProviderList
                providers={providers || []}
                onEdit={handleEditProvider}
                onDelete={handleDeleteProvider}
              />
            )}
          </div>
        )}

        {activeTab === 'models' && (
          <div>
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-text-primary">
                模型列表 ({models?.length || 0})
              </h3>
              <button
                onClick={() => {
                  setEditingModel(null);
                  setShowModelForm(true);
                }}
                className="px-4 py-2 bg-accent-primary text-dark-primary rounded-lg hover:bg-accent-secondary transition-colors"
              >
                <i className="fas fa-plus mr-2" />
                添加模型
              </button>
            </div>

            {modelsLoading ? (
              <PageLoading message="正在加载模型目录..." />
            ) : modelsError ? (
              <ErrorState
                title="模型目录加载失败"
                description={modelsLoadError instanceof Error ? modelsLoadError.message : '无法读取模型目录。'}
                onRetry={() => refetchModels()}
              />
            ) : (
              <ModelList
                models={models || []}
                onEdit={handleEditModel}
                onDelete={handleDeleteModel}
              />
            )}
          </div>
        )}
      </div>

      <Footer />

      {/* 供应商表单模态框 */}
      {showProviderForm && (
        <ProviderForm
          provider={editingProvider}
          onClose={() => {
            setShowProviderForm(false);
            setEditingProvider(null);
          }}
          onSuccess={() => {
            setShowProviderForm(false);
            setEditingProvider(null);
            queryClient.invalidateQueries({ queryKey: ['admin', 'llm-providers'] });
            showToast(editingProvider ? '供应商已更新' : '供应商已创建', 'success');
          }}
        />
      )}

      {/* 模型表单模态框 */}
      {showModelForm && (
        <ModelForm
          model={editingModel}
          providers={providers || []}
          onClose={() => {
            setShowModelForm(false);
            setEditingModel(null);
          }}
          onSuccess={() => {
            setShowModelForm(false);
            setEditingModel(null);
            queryClient.invalidateQueries({ queryKey: ['admin', 'llm-models'] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'llm-providers'] });
            showToast(editingModel ? '模型已更新' : '模型已创建', 'success');
          }}
        />
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  );
}
