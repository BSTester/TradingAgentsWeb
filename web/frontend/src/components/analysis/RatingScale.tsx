'use client';

import React from 'react';

interface RatingScaleProps {
  rating: number; // 1-5
  label?: string;
  size?: 'sm' | 'md';
}

const RATING_LABELS: Record<number, string> = {
  1: '高风险',
  2: '谨慎',
  3: '中性',
  4: '偏积极',
  5: '高置信积极',
};

// Color per level (number + text always present — never color-only, per a11y spec).
const RATING_COLORS: Record<number, string> = {
  1: 'text-danger-500 border-danger-500',
  2: 'text-warning-500 border-warning-500',
  3: 'text-text-secondary border-dark-border',
  4: 'text-accent-primary border-accent-primary',
  5: 'text-success-500 border-success-500',
};

export function RatingScale({ rating, label, size = 'md' }: RatingScaleProps) {
  const clamped = Math.max(1, Math.min(5, rating));
  const displayLabel = label ?? RATING_LABELS[clamped] ?? `评级 ${clamped}`;
  const dot = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  return (
    <div className="flex items-center gap-2" aria-label={`五级评级 ${clamped} 级：${displayLabel}`}>
      <div className="flex items-center gap-1" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((lvl) => (
          <span
            key={lvl}
            className={`${dot} rounded-full border ${
              lvl <= clamped ? RATING_COLORS[clamped] : 'border-dark-border text-dark-border'
            } ${lvl <= clamped ? 'bg-current' : ''}`}
          />
        ))}
      </div>
      <span className={`font-semibold ${RATING_COLORS[clamped]} ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
        {clamped} · {displayLabel}
      </span>
    </div>
  );
}
