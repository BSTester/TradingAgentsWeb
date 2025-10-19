'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { buildApiUrl } from '@/utils/api';
import { useToast, Toast } from '@/components/ui/Toast';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
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
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();
  const [page, setPage] = useState(1);
  const limit = 20;

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
    staleTime: 5 * 60 * 1000, // 5分钟缓存
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
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    refetchOnWindowFocus: false, // 窗口聚焦时不自动刷新
  });

  // 权限检查
  React.useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      showToast('需要管理员权限', 'error');
      setTimeout(() => router.push('/'), 1500);
    }
  }, [user, authLoading, router, showToast]);

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <nav className="bg-gray-900 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button onClick={() => router.push('/')} className="flex-shrink-0">
                <h1 className="text-white text-xl font-bold">
                  <i className="fas fa-chart-line mr-2" />
                  TradingAgents
                </h1>
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                <i className="fas fa-home mr-1" />
                返回首页
              </button>
              <div className="text-gray-300 flex items-center">
                <i className="fas fa-crown mr-2" />
                {user.username}
                <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-gray-900 text-xs font-bold rounded">
                  管理员
                </span>
              </div>
              <button
                onClick={logout}
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                <i className="fas fa-sign-out-alt mr-1" />
                退出
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 主要内容 */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">
            <i className="fas fa-users-cog mr-3 text-blue-600" />
            用户管理
          </h2>
          <p className="mt-2 text-gray-600">查看和管理系统中的所有用户</p>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                  <i className="fas fa-users text-white text-2xl" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">总用户数</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.users.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                  <i className="fas fa-user-check text-white text-2xl" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">活跃用户</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.users.active}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                  <i className="fas fa-crown text-white text-2xl" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">管理员</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.users.admin}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                  <i className="fas fa-chart-bar text-white text-2xl" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">总分析数</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.analyses.total}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 用户列表 */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              <i className="fas fa-list mr-2 text-blue-600" />
              用户列表
            </h3>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4" />
              <p className="text-gray-600">加载中...</p>
            </div>
          ) : isError ? (
            <div className="p-12 text-center">
              <i className="fas fa-exclamation-triangle text-4xl text-red-600 mb-4" />
              <p className="text-gray-600 mb-4">加载失败</p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                重试
              </button>
            </div>
          ) : data && data.users.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        用户名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        邮箱
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        角色
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        注册时间
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {u.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <i className={`fas ${u.role === 'admin' ? 'fa-crown text-yellow-500' : 'fa-user text-gray-400'} mr-2`} />
                            <span className="text-sm font-medium text-gray-900">{u.username}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {u.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            u.role === 'admin' 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {u.role === 'admin' ? '管理员' : '普通用户'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            u.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {u.is_active ? '活跃' : '禁用'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(u.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {data.total_pages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      显示第 {(page - 1) * limit + 1} - {Math.min(page * limit, data.total)} 条，共 {data.total} 条
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={!data.has_prev}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <i className="fas fa-chevron-left mr-1" />
                        上一页
                      </button>
                      <span className="px-4 py-2 text-sm text-gray-700">
                        第 {page} / {data.total_pages} 页
                      </span>
                      <button
                        onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                        disabled={!data.has_next}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        下一页
                        <i className="fas fa-chevron-right ml-1" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">👥</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无用户</h3>
              <p className="text-gray-600">系统中还没有注册用户</p>
            </div>
          )}
        </div>
      </div>

      {/* Toast组件 */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
}
