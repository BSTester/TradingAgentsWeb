import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RouteDataState } from './RouteDataState';

describe('RouteDataState', () => {
  it('renders loading instead of normal content', () => {
    render(<RouteDataState loading loadingMessage="正在加载分析历史"><p>normal content</p></RouteDataState>);
    expect(screen.getByText('正在加载分析历史')).toBeInTheDocument();
    expect(screen.queryByText('normal content')).not.toBeInTheDocument();
  });
  it('renders retryable error state', () => {
    const onRetry = vi.fn();
    render(<RouteDataState error={new Error('请求超时')} errorTitle="分析历史加载失败" onRetry={onRetry}><p>normal content</p></RouteDataState>);
    expect(screen.getByRole('alert')).toHaveTextContent('请求超时');
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
  it('renders route-specific empty state after loading', () => {
    render(<RouteDataState empty emptyTitle="暂无分析记录"><p>normal content</p></RouteDataState>);
    expect(screen.getByText('暂无分析记录')).toBeInTheDocument();
    expect(screen.queryByText('normal content')).not.toBeInTheDocument();
  });
  it('renders normal content for populated data', () => {
    render(<RouteDataState><p>normal content</p></RouteDataState>);
    expect(screen.getByText('normal content')).toBeInTheDocument();
  });
});
