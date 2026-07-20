'use client';

import React from 'react';

/**
 * Workflow Desk recoverable-error primitive.
 * Use for failed fetches / data-source errors. Always offer a retry path.
 */
export interface ErrorStateProps {
  title?: string | undefined;
  description?: string | undefined;
  /** Called when the user clicks "重试". Omit to hide the retry button. */
  onRetry?: (() => void) | undefined;
}

export function ErrorState({
  title = '加载失败',
  description = '数据源暂时不可用，请稍后重试。',
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="grid place-items-center text-center min-h-[200px] p-6 rounded-xl border border-danger-500/40 bg-danger-500/10"
    >
      <div>
        <div className="mx-auto mb-3 w-12 h-12 rounded-full border border-danger-500/40 grid place-items-center text-danger-500">
          <i className="fas fa-triangle-exclamation" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-medium text-danger-500">{title}</h2>
        <p className="mt-1 max-w-md mx-auto text-sm text-text-secondary leading-relaxed">{description}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-primary text-dark-primary font-bold px-4 py-2 text-sm hover:brightness-95 transition-all min-h-touch"
          >
            <i className="fas fa-rotate-right" aria-hidden="true" />
            重试
          </button>
        )}
      </div>
    </div>
  );
}
