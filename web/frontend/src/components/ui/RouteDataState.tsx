'use client';

import React from 'react';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { PageLoading } from './PageLoading';

interface RouteDataStateProps {
  children: React.ReactNode;
  loading?: boolean;
  loadingMessage?: string;
  error?: Error | null;
  errorTitle?: string;
  onRetry?: () => void;
  empty?: boolean;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}

/** Local state boundary for client-side route data, separate from Next route boundaries. */
export function RouteDataState({ children, loading = false, loadingMessage, error, errorTitle, onRetry, empty = false, emptyIcon, emptyTitle, emptyDescription, emptyAction }: RouteDataStateProps) {
  if (loading) return <PageLoading fullScreen={false} message={loadingMessage} />;
  if (error) return <ErrorState title={errorTitle} description={error.message || '数据源暂时不可用，请稍后重试。'} onRetry={onRetry} />;
  if (empty) return <EmptyState icon={emptyIcon} title={emptyTitle || '暂无数据'} description={emptyDescription} action={emptyAction} />;
  return <>{children}</>;
}
