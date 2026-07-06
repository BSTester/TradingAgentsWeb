'use client';

import React from 'react';
import { useConversation } from '@/lib/conversation-context';
import { RatingScale } from '@/components/analysis/RatingScale';

const STATUS_COLOR: Record<string, string> = {
  healthy: 'text-success-500',
  degraded: 'text-warning-500',
  unavailable: 'text-danger-500',
};

const STATUS_LABEL: Record<string, string> = {
  healthy: '正常',
  degraded: '降级',
  unavailable: '不可用',
};

export function InspectorPanel() {
  const { skillsHealth, reports } = useConversation();
  const reportIds = Object.keys(reports);
  const lastId = reportIds.length > 0 ? reportIds[reportIds.length - 1] : undefined;
  const current = lastId ? reports[lastId] : null;

  return (
    <div className="flex flex-col h-full bg-dark-secondary border-l border-dark-border p-4 space-y-5 overflow-y-auto">
      <div>
        <h3 className="text-xs uppercase tracking-wide text-text-tertiary mb-2">当前研究对象</h3>
        {current ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-text-primary">{current.ticker}</span>
              <span className="px-1.5 py-0.5 rounded bg-dark-tertiary text-xs text-text-secondary">{current.market}</span>
            </div>
            <RatingScale rating={current.conclusion.rating} label={current.conclusion.rating_label} size="sm" />
            {current.company_name && <p className="text-sm text-text-secondary">{current.company_name}</p>}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">发起分析后将在此显示标的与评级。</p>
        )}
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-wide text-text-tertiary mb-2">技能健康</h3>
        {skillsHealth.length === 0 ? (
          <p className="text-sm text-text-tertiary">暂无数据</p>
        ) : (
          <ul className="space-y-1.5">
            {skillsHealth.map((s) => (
              <li key={s.name} className="flex items-center justify-between text-sm">
                <span className="text-text-secondary truncate" title={s.display_name}>
                  {s.display_name}
                </span>
                <span className={`flex items-center gap-1 ${STATUS_COLOR[s.status]}`}>
                  <i
                    className={`fas ${
                      s.status === 'healthy' ? 'fa-check-circle' : s.status === 'degraded' ? 'fa-exclamation-triangle' : 'fa-times-circle'
                    }`}
                    aria-hidden="true"
                  />
                  {STATUS_LABEL[s.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
