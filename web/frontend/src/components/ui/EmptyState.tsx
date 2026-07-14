'use client';

import React from 'react';

/**
 * Workflow Desk empty-state primitive.
 * Use for filtered/empty lists, no-data results, etc. Pair with an actionable CTA.
 */
export interface EmptyStateProps {
  /** Short glyph (Font Awesome class) or short text symbol. */
  icon?: string | undefined;
  title: string;
  description?: string | undefined;
  /** Optional call-to-action node (button / link). */
  action?: React.ReactNode | undefined;
}

export function EmptyState({ icon = 'fa-circle-plus', title, description, action }: EmptyStateProps) {
  return (
    <div className="grid place-items-center text-center min-h-[230px] p-6 rounded-xl border border-dashed border-dark-border bg-dark-secondary/40">
      <div>
        <div className="mx-auto mb-3 w-12 h-12 rounded-full border border-dashed border-dark-border grid place-items-center text-text-tertiary">
          <i className={`fas ${icon}`} aria-hidden="true" />
        </div>
        <h2 className="text-lg font-medium text-text-primary">{title}</h2>
        {description && (
          <p className="mt-1 max-w-md mx-auto text-sm text-text-secondary leading-relaxed">{description}</p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}
