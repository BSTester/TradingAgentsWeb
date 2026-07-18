'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { ScheduledTaskItem } from '@/lib/api';

interface ResponsiveTaskCardProps {
  task: ScheduledTaskItem;
  onToggleEnabled: (taskId: number, currentEnabled: boolean) => void;
  onDelete: (taskId: number) => void;
}

export function ResponsiveTaskCard({ task, onToggleEnabled, onDelete }: ResponsiveTaskCardProps) {
  const getExecutionCycleLabel = (cycle: string, intervalDays?: number | null, dayOfWeek?: string | null) => {
    const labels: Record<string, string> = {
      daily: '每天',
      weekly: '每周',
      workdays: '工作日',
      every_n_days: intervalDays ? `每${intervalDays}天` : '每N天'
    };
    
    let label = labels[cycle] || cycle;
    
    if (cycle === 'weekly' && dayOfWeek) {
      const dayLabels: Record<string, string> = {
        '0': '周日', '1': '周一', '2': '周二', '3': '周三',
        '4': '周四', '5': '周五', '6': '周六'
      };
      label += ` (${dayLabels[dayOfWeek] || ''})`;
    }
    
    return label;
  };

  return (
    <div className="bg-dark-tertiary rounded-lg border border-dark-border p-4 hover:shadow-glow-cyan hover:border-accent-primary transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <i className="fas fa-calendar-alt text-accent-secondary text-xl flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-bold text-text-primary truncate">
              {task.task_name}
            </h4>
            <p className="text-xs text-text-tertiary">
              创建于 {new Date(task.created_at).toLocaleDateString('zh-CN')}
            </p>
          </div>
        </div>
        {task.status === 'completed' ? (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-accent-primary/20 text-accent-primary flex-shrink-0">
            <i className="fas fa-check-circle mr-1" />
            已完成
          </span>
        ) : (
          <button
            onClick={() => onToggleEnabled(task.id, task.is_enabled)}
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors flex-shrink-0 min-h-touch ${
              task.is_enabled
                ? 'bg-success-500/20 text-success-500 hover:bg-success-500/30'
                : 'bg-dark-tertiary text-text-tertiary hover:bg-dark-primary border border-dark-border'
            }`}
          >
            <i className={`fas ${task.is_enabled ? 'fa-check-circle' : 'fa-pause-circle'} mr-1`} />
            {task.is_enabled ? '启用中' : '已暂停'}
          </button>
        )}
      </div>

      {/* Key Info Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-text-tertiary mb-1">股票代码</p>
          <div>
            <p className="text-sm font-semibold text-text-primary">{task.ticker}</p>
            {task.market && (
              <p className="text-xs text-text-tertiary">{task.market}</p>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-text-tertiary mb-1">执行周期</p>
          <p className="text-sm font-semibold text-text-primary">
            {getExecutionCycleLabel(task.execution_cycle, task.interval_days, task.day_of_week)}
          </p>
          <p className="text-xs text-text-tertiary">{task.execution_time} 北京时间</p>
        </div>
      </div>

      {/* Next Run & Executions */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-text-tertiary mb-1">下次执行</p>
          {task.next_run ? (
            <>
              <p className="text-sm font-semibold text-text-primary">
                {new Date(task.next_run).toLocaleString('zh-CN', { 
                  month: '2-digit', 
                  day: '2-digit', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
              <p className="text-xs text-text-tertiary">
                {formatDistanceToNow(new Date(task.next_run), {
                  addSuffix: true,
                  locale: zhCN
                })}
              </p>
            </>
          ) : (
            <p className="text-sm text-text-muted">-</p>
          )}
        </div>
        <div>
          <p className="text-xs text-text-tertiary mb-1">执行次数</p>
          <p className="text-sm font-semibold text-text-primary">{task.total_executions} 次</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t border-dark-border">
        <button
          onClick={() => onDelete(task.id)}
          className="flex-1 px-4 py-2.5 text-danger-500 hover:bg-danger-500/10 rounded-lg text-sm font-medium transition-colors flex items-center justify-center min-h-touch"
        >
          <i className="fas fa-trash mr-2" />
          删除任务
        </button>
      </div>
    </div>
  );
}
