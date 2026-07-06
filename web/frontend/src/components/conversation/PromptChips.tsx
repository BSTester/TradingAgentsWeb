'use client';

import React from 'react';

const SUGGESTIONS = [
  '分析 600519.SH 的基本面与风险',
  '帮我看看 0700.HK 最近走势',
  '对比 AAPL 的市场技术与舆情',
];

export function PromptChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center mt-6">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          onClick={() => onPick(s)}
          className="px-3 py-2 rounded-full border border-dark-border bg-dark-secondary text-text-secondary text-sm hover:border-accent-primary hover:text-accent-primary transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
