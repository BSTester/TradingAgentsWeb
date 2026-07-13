'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useToast, Toast } from '@/components/ui/Toast';
import { useUserLLMSettings } from '@/hooks/useUserLLMSettings';
import { useLocalLLMKeys } from '@/hooks/useLocalLLMKeys';
import { AppNavbar } from '@/components/common/AppNavbar';
import { Footer } from '@/components/common/Footer';
import { ConfirmDialog } from '@/components/admin/llm-config/ConfirmDialog';
import ProviderList from '@/components/profile/ProviderList';
import ProviderFormDrawer from '@/components/profile/ProviderFormDrawer';
import { UserLLMProviderSetting } from '@/lib/types';
import { PageLoading } from '@/components/ui/PageLoading';
import { ErrorState } from '@/components/ui/ErrorState';

function providerKeyOf(p: { provider_name?: string; id?: string | number }): string {
  return String(p.provider_name || p.id || '').trim();
}

export default function AISettingsPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();
  const { data, isLoading, isError, error, refetch, setDefault, deleteProvider } = useUserLLMSettings();
  const { clearLocalKey } = useLocalLLMKeys();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserLLMProviderSetting | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserLLMProviderSetting | null>(null);

  React.useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const handleNew = () => {
    setEditing(null);
    setShowForm(true);
  };

  const handleEdit = (provider: UserLLMProviderSetting) => {
    setEditing(provider);
    setShowForm(true);
  };

  const handleSetDefault = async (provider: UserLLMProviderSetting) => {
    try {
      await setDefault.mutateAsync({ id: provider.id, isDefault: true });
      showToast(`已将「${provider.display_name}」设为默认`, 'success');
    } catch (err: any) {
      showToast(err?.message || '设置默认失败', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const key = providerKeyOf(deleteTarget);
    try {
      await deleteProvider.mutateAsync(deleteTarget.id);
      clearLocalKey(key); // 同步清除本浏览器孤儿 KEY
      showToast('provider 已删除，本浏览器 KEY 已清除', 'success');
    } catch (err: any) {
      showToast(err?.message || '删除失败', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  if (authLoading || !user) {
    return <PageLoading message="正在加载 AI 设置..." />;
  }

  if (isLoading) {
    return <PageLoading message="正在加载个人模型..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="个人模型加载失败"
        description={error instanceof Error ? error.message : '无法加载个人模型。'}
        onRetry={() => refetch()}
      />
    );
  }

  const providers = data?.providers || [];
  const hasLegacy = data?.has_legacy_config;

  return (
    <div className="min-h-screen bg-dark-primary flex flex-col">
      <AppNavbar user={user} onLogout={logout} />

      <div className="flex-1 py-8 pt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <button
              onClick={() => router.push('/profile')}
              className="text-sm text-text-secondary hover:text-text-primary mb-3 inline-flex items-center"
            >
              <i className="fas fa-arrow-left mr-1" />
              返回个人中心
            </button>
            <h1 className="text-responsive-h2 text-text-primary">
              <i className="fas fa-brain mr-3 text-accent-primary" />
              AI 设置
            </h1>
            <p className="mt-2 text-responsive-body text-text-secondary">
              管理您的 AI provider、模型与 API 密钥。您的密钥仅保存在当前浏览器，不会发送到后端持久化。
            </p>
          </div>

          {hasLegacy && (
            <div className="mb-6 rounded-lg border border-warning-500/40 bg-warning-500/10 p-4 flex items-start justify-between gap-4">
              <div className="text-sm text-text-secondary">
                <i className="fas fa-info-circle text-warning-500 mr-2" />
                检测到旧版 API KEY 缓存，建议在当前浏览器重新保存 KEY 到 localStorage。
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-responsive-h3 text-text-primary">Provider 列表 ({providers.length})</h2>
            <button
              onClick={handleNew}
              className="px-4 py-2.5 bg-accent-primary text-dark-primary rounded-lg hover:bg-accent-secondary transition-colors"
            >
              <i className="fas fa-plus mr-2" />
              新增 provider
            </button>
          </div>

          <ProviderList
            providers={providers}
            loading={isLoading}
            onEdit={handleEdit}
            onSetDefault={handleSetDefault}
            onDelete={(p) => setDeleteTarget(p)}
          />
        </div>
      </div>

      {showForm && (
        <ProviderFormDrawer
          provider={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <Footer />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="删除 provider"
        message={
          deleteTarget
            ? `确定要删除「${deleteTarget.display_name}」吗？\n\n删除后该 provider 的元数据将从服务器移除，并同步清除本浏览器保存的 KEY。`
            : ''
        }
        confirmText="删除"
        confirmButtonClass="bg-danger-500 hover:bg-danger-600"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} />
    </div>
  );
}
