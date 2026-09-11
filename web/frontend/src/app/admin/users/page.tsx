'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { buildApiUrl } from '@/utils/api';
import { useToast, Toast } from '@/components/ui/Toast';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { SiteLayout } from '@/components/site/SiteLayout';
import { ResponsiveUserCard } from '@/components/admin/ResponsiveUserCard';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { RouteDataState } from '@/components/ui/RouteDataState';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  can_access_intraday_trading: boolean;
  created_at: string;
  updated_at: string;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

interface SystemStats {
  users: {
    total: number;
    active: number;
    admin: number;
  };
  analyses: {
    total: number;
    completed: number;
    running: number;
    error: number;
  };
  markets: {
    US: number;
    HK: number;
    CN: number;
  };
}

export default function UserManagementPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();
  const [page, setPage] = useState(1);
  const limit = 20;
  const isMobile = useIsMobile();

  // 获取系统统计
  const { data: stats } = useQuery<SystemStats>({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(buildApiUrl('/api/admin/stats'), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('获取统计信息失败');
      return response.json();
    },
    enabled: !!user && user.role === 'admin',
    staleTime: 1 * 60 * 1000, // 1分钟缓存
    refetchOnWindowFocus: false, // 窗口聚焦时不自动刷新
  });

  // 获取用户列表
  const { data, isLoading, isError, refetch } = useQuery<UsersResponse>({
    queryKey: ['admin', 'users', page, limit],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(buildApiUrl(`/api/admin/users?page=${page}&limit=${limit}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('需要管理员权限');
        }
        throw new Error('获取用户列表失败');
      }
      return response.json();
    },
    enabled: !!user && user.role === 'admin',
    staleTime: 1 * 60 * 1000, // 1分钟缓存
    refetchOnWindowFocus: false, // 窗口聚焦时不自动刷新
  });

  const queryClient = useQueryClient();
  const [updatingUsers, setUpdatingUsers] = useState<Set<number>>(new Set());

  // 更新用户状态的 mutation
  const updateUserStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: number; isActive: boolean }) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(buildApiUrl(`/api/admin/users/${userId}/status`), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: isActive }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || '更新用户状态失败');
      }
      return response.json();
    },
    onMutate: async ({ userId, isActive }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['admin', 'users'] });

      // Snapshot the previous values
      const previousLists = queryClient.getQueriesData({ queryKey: ['admin', 'users'] });

      // Optimistically update all user list queries
      queryClient.setQueriesData({ queryKey: ['admin', 'users'] }, (old: any) => {
        if (!old || !old.users) return old;
        
        return {
          ...old,
          users: old.users.map((u: User) => 
            u.id === userId ? { ...u, is_active: isActive } : u
          ),
        };
      });

      return { previousLists };
    },
    onError: (error: Error, _variables, context) => {
      // Roll back on error
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      showToast(error.message, 'error');
    },
    onSuccess: () => {
      showToast('用户状态已更新', 'success');
    },
    onSettled: () => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });

  // 更新智能盯盘权限的 mutation
  const updateIntradayAccessMutation = useMutation({
    mutationFn: async ({ userId, canAccess }: { userId: number; canAccess: boolean }) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(buildApiUrl(`/api/admin/users/${userId}/intraday-access`), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ can_access_intraday_trading: canAccess }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || '更新智能盯盘权限失败');
      }
      return response.json();
    },
    onMutate: async ({ userId, canAccess }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['admin', 'users'] });

      // Snapshot the previous values
      const previousLists = queryClient.getQueriesData({ queryKey: ['admin', 'users'] });

      // Optimistically update all user list queries
      queryClient.setQueriesData({ queryKey: ['admin', 'users'] }, (old: any) => {
        if (!old || !old.users) return old;
        
        return {
          ...old,
          users: old.users.map((u: User) => 
            u.id === userId ? { ...u, can_access_intraday_trading: canAccess } : u
          ),
        };
      });

      return { previousLists };
    },
    onError: (error: Error, _variables, context) => {
      // Roll back on error
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      showToast(error.message, 'error');
    },
    onSuccess: () => {
      showToast('智能盯盘权限已更新', 'success');
    },
    onSettled: () => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  // 处理用户状态切换
  const handleStatusToggle = async (userId: number, currentStatus: boolean) => {
    setUpdatingUsers(prev => new Set(prev).add(userId));
    try {
      await updateUserStatusMutation.mutateAsync({
        userId,
        isActive: !currentStatus,
      });
    } finally {
      setUpdatingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  // 处理智能盯盘权限切换
  const handleIntradayAccessToggle = async (userId: number, currentAccess: boolean) => {
    setUpdatingUsers(prev => new Set(prev).add(userId));
    try {
      await updateIntradayAccessMutation.mutateAsync({
        userId,
        canAccess: !currentAccess,
      });
    } finally {
      setUpdatingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  // 权限检查
  React.useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      // 如果用户未登录或不是管理员，跳转到首页
      // 不显示toast，因为可能是正常的退出登录操作
      router.push('/');
    }
  }, [user, authLoading, router]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (authLoading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-dark-primary flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-accent-primary mb-4" />
          <p className="text-text-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <SiteLayout maxWidth="max-w-7xl">
      {/* 页面标题 */}
      <div className="mb-8">
          <h2 className="text-3xl font-bold text-text-primary">
            <i className="fas fa-users-cog mr-3 text-accent-primary" />
            用户管理
          </h2>
          <p className="mt-2 text-text-secondary">查看和管理系统中的所有用户</p>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-4 md:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-accent-primary rounded-md p-3">
                  <i className="fas fa-users text-white text-2xl" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-text-secondary">总用户数</p>
                  <p className="text-2xl font-bold text-text-primary">{stats.users.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-4 md:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-success-500 rounded-md p-3">
                  <i className="fas fa-user-check text-white text-2xl" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-text-secondary">活跃用户</p>
                  <p className="text-2xl font-bold text-text-primary">{stats.users.active}</p>
                </div>
              </div>
            </div>

            <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-4 md:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-warning-500 rounded-md p-3">
                  <i className="fas fa-crown text-white text-2xl" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-text-secondary">管理员</p>
                  <p className="text-2xl font-bold text-text-primary">{stats.users.admin}</p>
                </div>
              </div>
            </div>

            <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-4 md:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-accent-secondary rounded-md p-3">
                  <i className="fas fa-chart-bar text-white text-2xl" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-text-secondary">总分析数</p>
                  <p className="text-2xl font-bold text-text-primary">{stats.analyses.total}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 用户列表 */}
        <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border">
          <div className="px-6 py-4 border-b border-dark-border">
            <h3 className="text-lg font-semibold text-text-primary">
              <i className="fas fa-list mr-2 text-accent-primary" />
              用户列表
            </h3>
          </div>

          {isLoading || isError || !data?.users.length ? (
            <RouteDataState loading={isLoading} loadingMessage="正在加载用户列表..." error={isError ? new Error('获取用户列表失败') : null} errorTitle="用户列表加载失败" onRetry={() => void refetch()} empty={!isLoading && !isError && !data?.users.length} emptyIcon="fa-users" emptyTitle="暂无用户" emptyDescription="系统中还没有注册用户。">{null}</RouteDataState>
          ) : data && data.users.length > 0 ? (
            <>
              {isMobile ? (
                // Mobile: Card layout
                <div className="p-4 space-y-3">
                  {data.users.map((u) => (
                    <ResponsiveUserCard
                      key={u.id}
                      user={u}
                      onToggleActive={handleStatusToggle}
                      onToggleIntradayAccess={handleIntradayAccessToggle}
                    />
                  ))}
                </div>
              ) : (
                // Desktop: Table layout
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-dark-border">
                  <thead className="bg-dark-tertiary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        用户名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        邮箱
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        角色
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        账户状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        智能盯盘
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                        注册时间
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-dark-secondary divide-y divide-dark-border">
                    {data.users.map((u) => (
                      <tr key={u.id} className="hover:bg-dark-tertiary">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                          {u.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <i className={`fas ${u.role === 'admin' ? 'fa-crown text-warning-500' : 'fa-user text-text-muted'} mr-2`} />
                            <span className="text-sm font-medium text-text-primary">{u.username}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                          {u.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            u.role === 'admin' 
                              ? 'bg-warning-500/20 text-warning-500' 
                              : 'bg-dark-tertiary text-text-secondary'
                          }`}>
                            {u.role === 'admin' ? '管理员' : '普通用户'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <ToggleSwitch
                            enabled={u.is_active}
                            disabled={u.id === user?.id}
                            loading={updatingUsers.has(u.id)}
                            onChange={() => handleStatusToggle(u.id, u.is_active)}
                            size="sm"
                          />
                          {u.id === user?.id && (
                            <span className="ml-2 text-xs text-text-muted">
                              (当前用户)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <ToggleSwitch
                            enabled={u.can_access_intraday_trading}
                            loading={updatingUsers.has(u.id)}
                            onChange={() => handleIntradayAccessToggle(u.id, u.can_access_intraday_trading)}
                            size="sm"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                          {formatDate(u.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}

              {/* 分页 */}
              {data.total_pages > 1 && (
                <div className="px-4 md:px-6 py-4 border-t border-dark-border">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                    <div className="text-sm text-text-secondary text-center md:text-left">
                      显示第 {(page - 1) * limit + 1} - {Math.min(page * limit, data.total)} 条，共 {data.total} 条
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={!data.has_prev}
                        className="px-3 py-2 text-sm font-medium text-text-primary bg-dark-tertiary border border-dark-border rounded-md hover:bg-dark-primary disabled:opacity-50 disabled:cursor-not-allowed min-h-touch"
                      >
                        <i className="fas fa-chevron-left mr-1" />
                        <span className="hidden md:inline">上一页</span>
                      </button>
                      <span className="px-3 md:px-4 py-2 text-sm text-text-primary">
                        {page} / {data.total_pages}
                      </span>
                      <button
                        onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                        disabled={!data.has_next}
                        className="px-3 py-2 text-sm font-medium text-text-primary bg-dark-tertiary border border-dark-border rounded-md hover:bg-dark-primary disabled:opacity-50 disabled:cursor-not-allowed min-h-touch"
                      >
                        <span className="hidden md:inline">下一页</span>
                        <i className="fas fa-chevron-right ml-1" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center">
              <div className="text-text-muted text-6xl mb-4">👥</div>
              <h3 className="text-lg font-medium text-text-primary mb-2">暂无用户</h3>
              <p className="text-text-secondary">系统中还没有注册用户</p>
            </div>
          )}
        </div>

      {/* Toast组件 */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </SiteLayout>
  );
}
