'use client';

import React from 'react';
import type { StageProgressBlock, StageStatus } from '@/types/conversation';

const STATUS_META: Record<StageStatus, { icon: string; color: string; label: string }> = {
  pending: { icon: 'fa-circle', color: 'text-text-tertiary', label: '等待中' },
  active: { icon: 'fa-spinner fa-spin', color: 'text-accent-primary', label: '进行中' },
  complete: { icon: 'fa-check-circle', color: 'text-success-500', label: '完成' },
  warning: { icon: 'fa-exclamation-triangle', color: 'text-warning-500', label: '警告' },
  error: { icon: 'fa-times-circle', color: 'text-danger-500', label: '失败' },
  stopped: { icon: 'fa-stop-circle', color: 'text-text-secondary', label: '已停止' },
};

export function StageRow({ stage }: { stage: StageProgressBlock }) {
  const meta = STATUS_META[stage.status];
  return (
    <div className="flex items-start gap-3 py-2 px-3 rounded-lg">
      <i className={`fas ${meta.icon} mt-1 ${meta.color}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-text-primary">{stage.stage_name}</span>
          <span className={`text-xs ${meta.color}`}>{meta.label}</span>
        </div>
        {stage.summary && <p className="text-xs text-text-secondary mt-0.5 break-words">{stage.summary}</p>}
      </div>
    </div>
  );
}
