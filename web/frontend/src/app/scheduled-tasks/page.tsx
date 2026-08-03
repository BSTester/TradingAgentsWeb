'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useScheduledTasks, useScheduledTaskStats, useDeleteScheduledTask, useUpdateScheduledTask } from '@/hooks/useScheduledTasks';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { AppNavbar } from '@/components/common/AppNavbar';
import { Footer } from '@/components/common/Footer';
import { useToast, Toast } from '@/components/ui/Toast';
import { ResponsiveTaskCard } from '@/components/scheduled-tasks/ResponsiveTaskCard';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { RouteDataState } from '@/components/ui/RouteDataState';

export default function ScheduledTasksPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();
  const [page, setPage] = useState(1);
  const [showDeleteDialog, setShowDeleteDialog] = useState<number | null>(null);
  const limit = 10; // 每页显示10条
  const isMobile = useIsMobile();
  
  const { data: listData, isLoading, error } = useScheduledTasks(page, limit);
  const { data: statsData } = useScheduledTaskStats();
  const deleteTask = useDeleteScheduledTask();
  const updateTask = useUpdateScheduledTask();

  // 列表接口返回 { data: [...任务], meta: { total, ... } }；启用/暂停/完成统计来自独立的 /stats 全量接口，
  // 不再用当页数据冒充总计。
  const tasks = listData?.data ?? [];
  const total = listData?.meta?.total ?? 0;
  const stats = statsData?.data;

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
      
      // 如果当前页删除后为空且页码>1，则回退到上一页
      if (tasks.length === 1 && page > 1) {
        setPage(p => p - 1);
      }
      
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

  const getExecutionCycleLabel = (cycle: string, intervalDays?: number | null, dayOfWeek?: string | null) => {
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
      <div className="min-h-screen bg-dark-primary flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-accent-primary mb-4" />
          <p className="text-text-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-primary flex flex-col">
        <AppNavbar user={user} onLogout={logout} />
          <div className="flex-1 flex items-center justify-center"><RouteDataState loading loadingMessage="正在加载定期报告…">{null}</RouteDataState></div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-primary flex flex-col">
        <AppNavbar user={user} onLogout={logout} />
          <div className="flex-1 flex items-center justify-center"><RouteDataState error={error instanceof Error ? error : new Error('加载定期报告失败')} errorTitle="定期报告加载失败" onRetry={() => void refetch()}>{null}</RouteDataState></div>
        <Footer />
      </div>
    );
  }

  // 列表接口不返回 `stats` 汇总对象；启用/暂停/完成统计改用独立的全量 /stats 接口（见上方 stats）。

  return (
    <div className="min-h-screen bg-dark-primary flex flex-col">
      {/* 顶部导航栏 */}
      <AppNavbar user={user} onLogout={logout} />

      {/* 面包屑导航 */}
      <nav className="bg-dark-secondary/80 backdrop-blur-lg border-b border-dark-border shadow-lg pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-10 overflow-hidden">
          <div className="flex items-center space-x-2 text-sm whitespace-nowrap">
            <button
              onClick={() => router.push('/')}
              className="text-accent-primary hover:text-accent-secondary transition-colors flex-shrink-0"
            >
              <i className="fas fa-home mr-1" />
              首页
            </button>
            <i className="fas fa-chevron-right text-text-tertiary text-xs flex-shrink-0" />
            <span className="text-text-primary font-medium">定期报告</span>
          </div>
        </div>
      </nav>

      {/* 主要内容区域 */}
      <div className="flex-1 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-responsive-h2 text-text-primary mb-2">
            <i className="fas fa-clock mr-3 text-accent-secondary" />
            定期报告
          </h1>
          <p className="text-responsive-body text-text-secondary">
            管理您的定期分析报告，查看执行计划和历史记录
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-4 md:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <i className="fas fa-tasks text-2xl md:text-3xl text-accent-primary" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-text-secondary">总任务数</p>
                <p className="text-xl md:text-2xl font-bold text-text-primary">{total}</p>
              </div>
            </div>
          </div>

          <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-4 md:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <i className="fas fa-play-circle text-2xl md:text-3xl text-success-500" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-text-secondary">启用中</p>
                <p className="text-xl md:text-2xl font-bold text-text-primary">
                  {stats?.running ?? 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-4 md:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <i className="fas fa-pause-circle text-2xl md:text-3xl text-text-tertiary" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-text-secondary">已暂停</p>
                <p className="text-xl md:text-2xl font-bold text-text-primary">
                  {stats?.paused ?? 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-4 md:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <i className="fas fa-check-circle text-2xl md:text-3xl text-accent-primary" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs md:text-sm font-medium text-text-secondary">已完成</p>
                <p className="text-xl md:text-2xl font-bold text-text-primary">
                  {stats?.completed ?? 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border overflow-hidden">
          {tasks.length === 0 ? (
            <div className="text-center py-12 px-4">
              <i className="fas fa-calendar-times text-4xl md:text-6xl text-text-tertiary mb-4" />
              <h3 className="text-responsive-h4 text-text-primary mb-2">暂无定期报告</h3>
              <p className="text-responsive-body text-text-secondary mb-6">
                您还没有创建任何定期报告
              </p>
              <a
                href="/"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-glow-cyan hover:scale-105 transition-all"
              >
                <i className="fas fa-plus mr-2" />
                创建定期报告
              </a>
            </div>
          ) : isMobile ? (
            // Mobile: Card layout
            <div className="p-4 space-y-3">
              {tasks.map((task) => (
                <ResponsiveTaskCard
                  key={task.id}
                  task={task}
                  onToggleEnabled={handleToggleEnabled}
                  onDelete={(id) => setShowDeleteDialog(id)}
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
                      任务名称
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      股票代码
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      执行周期
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      下次执行
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      执行次数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-dark-secondary divide-y divide-dark-border">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-dark-tertiary transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <i className="fas fa-calendar-alt text-accent-secondary mr-2" />
                          <div>
                            <div className="text-sm font-medium text-text-primary">
                              {task.task_name}
                            </div>
                            <div className="text-sm text-text-secondary">
                              创建于 {new Date(task.created_at).toLocaleDateString('zh-CN')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-text-primary">{task.ticker}</div>
                        {task.market && (
                          <div className="text-sm text-text-secondary">{task.market}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-text-primary">
                          {getExecutionCycleLabel(task.execution_cycle, task.interval_days, task.day_of_week)}
                        </div>
                        <div className="text-sm text-text-secondary">{task.execution_time} 北京时间</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {task.next_run ? (
                          <div>
                            <div className="text-sm text-text-primary">
                              {new Date(task.next_run).toLocaleString('zh-CN')}
                            </div>
                            <div className="text-sm text-text-secondary">
                              {formatDistanceToNow(new Date(task.next_run), {
                                addSuffix: true,
                                locale: zhCN
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-text-secondary">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                        {task.total_executions} 次
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {task.status === 'completed' ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-accent-primary/20 text-accent-primary">
                            <i className="fas fa-check-circle mr-1" />
                            已完成
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleEnabled(task.id, task.is_enabled)}
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                              task.is_enabled
                                ? 'bg-success-500/20 text-success-500 hover:bg-success-500/30'
                                : 'bg-dark-tertiary text-text-tertiary hover:bg-dark-primary'
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
                          className="text-danger-500 hover:text-danger-400 ml-4 transition-colors"
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
          {tasks.length > 0 && total > limit && (
            <div className="mt-6 p-4 border-t border-dark-border">
              <div className="flex items-center justify-between">
                {/* 左侧：显示信息 */}
                <div className="text-sm text-text-secondary">
                  显示第 {(page - 1) * limit + 1} - {Math.min(page * limit, total)} 条，共 {total} 条记录
                </div>

                {/* 右侧：分页按钮 */}
                <div className="flex items-center space-x-2">
                  {/* 上一页 */}
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-2 text-sm font-medium text-text-primary bg-dark-tertiary border border-dark-border rounded-md hover:bg-dark-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <i className="fas fa-chevron-left mr-1" />
                    上一页
                  </button>

                  {/* 页码 */}
                  <div className="flex items-center space-x-1">
                    {(() => {
                      const totalPages = Math.max(1, Math.ceil(total / limit));
                      
                      // 第一页
                      if (page > 3) {
                        return (
                          <>
                            <button
                              onClick={() => setPage(1)}
                              className="px-3 py-2 text-sm font-medium text-text-primary bg-dark-tertiary border border-dark-border rounded-md hover:bg-dark-primary transition-colors"
                            >
                              1
                            </button>
                            {page > 4 && <span className="px-2 text-text-tertiary">...</span>}
                          </>
                        );
                      }
                      return null;
                    })()}

                    {/* 当前页附近的页码 */}
                    {(() => {
                      const totalPages = Math.max(1, Math.ceil(total / limit));
                      return Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p >= page - 2 && p <= page + 2)
                        .map(p => (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                              p === page
                                ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-dark-primary'
                                : 'text-text-primary bg-dark-tertiary border border-dark-border hover:bg-dark-primary'
                            }`}
                          >
                            {p}
                          </button>
                        ));
                    })()}

                    {/* 最后一页 */}
                    {(() => {
                      const totalPages = Math.max(1, Math.ceil(total / limit));
                      
                      if (page < totalPages - 2) {
                        return (
                          <>
                            {page < totalPages - 3 && <span className="px-2 text-text-tertiary">...</span>}
                            <button
                              onClick={() => setPage(totalPages)}
                              className="px-3 py-2 text-sm font-medium text-text-primary bg-dark-tertiary border border-dark-border rounded-md hover:bg-dark-primary transition-colors"
                            >
                              {totalPages}
                            </button>
                          </>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* 下一页 */}
                  <button
                    onClick={() => {
                      const totalPages = Math.max(1, Math.ceil(total / limit));
                      setPage(p => Math.min(totalPages, p + 1));
                    }}
                    disabled={page === Math.max(1, Math.ceil(total / limit))}
                    className="px-3 py-2 text-sm font-medium text-text-primary bg-dark-tertiary border border-dark-border rounded-md hover:bg-dark-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    下一页
                    <i className="fas fa-chevron-right ml-1" />
                  </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-secondary rounded-lg shadow-xl border border-dark-border max-w-md w-full p-4 md:p-6">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <i className="fas fa-exclamation-triangle text-danger-500 text-2xl md:text-3xl" />
              </div>
              <div className="ml-3 md:ml-4">
                <h3 className="text-responsive-h4 text-text-primary mb-2">
                  确认删除
                </h3>
                <p className="text-responsive-small text-text-secondary">
                  您确定要删除这个定期报告吗？此操作无法撤销。
                </p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row justify-end gap-3 md:space-x-3">
              <button
                onClick={() => setShowDeleteDialog(null)}
                className="w-full md:w-auto px-4 py-3 md:py-2 border border-dark-border rounded-md text-sm font-medium text-text-secondary hover:bg-dark-tertiary transition-colors min-h-touch"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(showDeleteDialog)}
                className="w-full md:w-auto px-4 py-3 md:py-2 bg-danger-500 border border-transparent rounded-md text-sm font-medium text-white hover:bg-danger-400 transition-colors min-h-touch"
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
