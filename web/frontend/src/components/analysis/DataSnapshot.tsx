'use client';

import React from 'react';
import type { Report } from '@/types/conversation';

export function DataSnapshot({ report }: { report: Report }) {
  const sources = new Map<string, string>();
  report.sections.forEach((s) => {
    (s.data_sources ?? []).forEach((d) => {
      sources.set(d.name, d.snapshot_time);
    });
  });

  return (
    <div className="text-xs text-text-secondary space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-text-tertiary">标的</span>
        <span className="font-mono text-text-primary">{report.ticker}</span>
        <span className="px-1.5 py-0.5 rounded bg-dark-tertiary text-text-secondary">{report.market}</span>
      </div>
      {report.company_name && <div className="text-text-tertiary">公司：{report.company_name}</div>}
      {sources.size > 0 && (
        <div>
          <span className="text-text-tertiary">数据来源：</span>
          {Array.from(sources.entries()).map(([name, time]) => (
            <span key={name} className="inline-flex items-center mr-2">
              {name}
              <span className="text-text-tertiary ml-1">({new Date(time).toLocaleString('zh-CN')})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
