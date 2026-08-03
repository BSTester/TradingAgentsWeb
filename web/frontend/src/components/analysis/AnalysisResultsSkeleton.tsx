'use client';

import React from 'react';

/**
 * Skeleton for the (code-split) AnalysisResults view. Used both as the
 * `next/dynamic` loading fallback while the AnalysisResults chunk is fetched,
 * and as the data-loading state inside AnalysisResults itself — so route
 * switches go straight to a skeleton instead of "white screen then pop".
 * See `frontend/issues/WS-86`.
 */
export function AnalysisResultsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="分析结果加载中" aria-busy="true">
      {/* Header / conclusion card */}
      <div className="rounded-xl border border-dark-border bg-dark-secondary p-5 shadow-card-dark">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-6 w-32 rounded bg-dark-tertiary animate-pulse" />
            <div className="h-4 w-48 rounded bg-dark-tertiary/70 animate-pulse" />
          </div>
          <div className="h-9 w-24 rounded-lg bg-dark-tertiary animate-pulse" />
        </div>
        <div className="mt-4 h-3 w-full rounded bg-dark-tertiary/60 animate-pulse" />
        <div className="mt-2 h-3 w-5/6 rounded bg-dark-tertiary/60 animate-pulse" />
      </div>

      {/* Phase tabs */}
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-28 flex-shrink-0 rounded-lg bg-dark-tertiary animate-pulse" />
        ))}
      </div>

      {/* Content block */}
      <div className="space-y-3 rounded-xl border border-dark-border bg-dark-secondary p-5">
        <div className="h-5 w-40 rounded bg-dark-tertiary animate-pulse" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-3 rounded bg-dark-tertiary/60 animate-pulse"
            style={{ width: `${88 - i * 9}%` }}
          />
        ))}
      </div>
    </div>
  );
}
