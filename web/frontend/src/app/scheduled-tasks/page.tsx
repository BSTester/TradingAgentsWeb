'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useScheduledTasks, useDeleteScheduledTask, useUpdateScheduledTask } from '@/hooks/useScheduledTasks';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { AppNavbar } from '@/components/common/AppNavbar';
import { Footer } from '@/components/leaderboard/Footer';
import { useToast, Toast } from '@/components/ui/Toast';

export default function ScheduledTasksPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();
  const [page, setPage] = useState(1);
  const [showDeleteDialog, setShowDeleteDialog] = useState<number | null>(null);
  
  const { data, isLoading, error } = useScheduledTasks(page, 20);
  const deleteTask = useDeleteScheduledTask();
  const updateTask = useUpdateScheduledTask();

  // 认证保护逻辑
  useEffect(() => {
    if (!authLoading && !user) {
      const timer = setTimeout(() => {
        const token = localStorage.getItem('access_token');
        if (!token && !user) {
          router.push('/login');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [user, authLoading, router]);

  const handleToggleEnabled = async (taskId: number, currentEnabled: boolean) => {
    try {
      await updateTask.mutateAsync({
        taskId,
        data: { is_enabled: !currentEnabled }
      });
      showToast(currentEnabled ? '任务已暂停' : '任务已启用', 'success');
    } catch (error: any) {
      // Show user-friendly error message
      showToast(error.message || '操作失败', 'error');
      // Log error details for debugging (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.warn('Task toggle failed:', error.message);
      }
    }
  };

  const handleDelete = async (taskId: number) => {
    try {
      const result = await deleteTask.mutateAsync(taskId);
      setShowDeleteDialog(null);
      // Show detailed success message from backend
      showToast(result.message || '任务已删除', 'success');
    } catch (error: any) {
      // Show user-friendly error message
      showToast(error.message || '删除失败', 'error');
      // Log error details for debugging (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.warn('Task deletion failed:', error.message);
      }
    }
  };

  const getExecutionCycleLabel = (cycle: string, intervalDays?: number, dayOfWeek?: string) => {
    const labels: Record<string, string> = {
      daily: '每天',
      weekly: '每周',
      workdays: '工作日',
      every_n_days: intervalDays ? `每${intervalDays}天` : '每N天'
    };
    
    let label = labels[cycle] || cycle;
    
    // Add day of week for weekly cycle
    if (cycle === 'weekly' && dayOfWeek) {
      const dayLabels: Record<string, string> = {
        '0': '周日',
        '1': '周一',
        '2': '周二',
        '3': '周三',
        '4': '周四',
        '5': '周五',
        '6': '周六'
      };
      label += ` (${dayLabels[dayOfWeek] || ''})`;
    }
    
    return label;
  };

  // 如果正在认证检查，显示加载状态
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <AppNavbar user={user} onLogout={logout} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4" />
            <p className="text-gray-600">加载定期报告...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <AppNavbar user={user} onLogout={logout} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-exclamation-triangle text-4xl text-red-600 mb-4" />
            <p className="text-gray-600">加载失败：{error.message}</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 顶部导航栏 */}
      <AppNavbar user={user} onLogout={logout} />

      {/* 面包屑导航 */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-2 text-sm">
            <button
              onClick={() => router.push('/')}
              className="text-blue-600 hover:text-blue-800"
            >
              <i className="fas fa-home mr-1" />
              首页
            </button>
            <i className="fas fa-chevron-right text-gray-400 text-xs" />
            <span className="text-gray-900 font-medium">定期报告</span>
          </div>
        </div>
      </nav>

      {/* 主要内容区域 */}
      <div className="flex-1 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            <i className="fas fa-clock mr-3 text-purple-600" />
            定期报告
          </h1>
          <p className="text-gray-600">
            管理您的定期分析报告，查看执行计划和历史记录
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <i className="fas fa-tasks text-3xl text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">总任务数</p>
                <p className="text-2xl font-bold text-gray-900">{data?.total || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <i className="fas fa-play-circle text-3xl text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">启用中</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data?.items.filter(t => t.status === 'pending' && t.is_enabled).length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <i className="fas fa-pause-circle text-3xl text-gray-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">已暂停</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data?.items.filter(t => t.status === 'pending' && !t.is_enabled).length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <i className="fas fa-check-circle text-3xl text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">已完成</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data?.items.filter(t => t.status === 'completed').length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {!data?.items || data.items.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-calendar-times text-6xl text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无定期报告</h3>
              <p className="text-gray-600 mb-6">
                您还没有创建任何定期报告
              </p>
              <a
                href="/dashboard"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <i className="fas fa-plus mr-2" />
                创建定期报告
              </a>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      任务名称
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      股票代码
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      执行周期
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      下次执行
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      执行次数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.items.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <i className="fas fa-calendar-alt text-purple-600 mr-2" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {task.task_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              创建于 {new Date(task.created_at).toLocaleDateString('zh-CN')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{task.ticker}</div>
                        {task.market && (
                          <div className="text-sm text-gray-500">{task.market}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {getExecutionCycleLabel(task.execution_cycle, task.interval_days, task.day_of_week)}
                        </div>
                        <div className="text-sm text-gray-500">{task.execution_time} 北京时间</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {task.next_run_time ? (
                          <div>
                            <div className="text-sm text-gray-900">
                              {new Date(task.next_run_time).toLocaleString('zh-CN')}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatDistanceToNow(new Date(task.next_run_time), {
                                addSuffix: true,
                                locale: zhCN
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {task.total_executions} 次
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {task.status === 'completed' ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <i className="fas fa-check-circle mr-1" />
                            已完成
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleEnabled(task.id, task.is_enabled)}
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              task.is_enabled
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            <i className={`fas ${task.is_enabled ? 'fa-check-circle' : 'fa-pause-circle'} mr-1`} />
                            {task.is_enabled ? '启用中' : '已暂停'}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => setShowDeleteDialog(task.id)}
                          className="text-red-600 hover:text-red-900 ml-4"
                          title="删除任务"
                        >
                          <i className="fas fa-trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data && data.total > 20 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={!data.has_prev}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!data.has_next}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    显示第 <span className="font-medium">{(page - 1) * 20 + 1}</span> 到{' '}
                    <span className="font-medium">{Math.min(page * 20, data.total)}</span> 条，
                    共 <span className="font-medium">{data.total}</span> 条
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={!data.has_prev}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className="fas fa-chevron-left" />
                    </button>
                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                      {page}
                    </span>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={!data.has_next}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className="fas fa-chevron-right" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Toast组件 */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <i className="fas fa-exclamation-triangle text-red-600 text-3xl" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  确认删除
                </h3>
                <p className="text-sm text-gray-600">
                  您确定要删除这个定期报告吗？此操作无法撤销。
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteDialog(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(showDeleteDialog)}
                className="px-4 py-2 bg-red-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-red-700"
              >
                <i className="fas fa-trash mr-2" />
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
