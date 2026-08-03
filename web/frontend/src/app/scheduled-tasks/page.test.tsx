import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, render, within } from '@testing-library/react';

import ScheduledTasksPage from './page';
import type { ScheduledTaskItem } from '@/lib/api';
import {
  useScheduledTasks,
  useScheduledTaskStats,
} from '@/hooks/useScheduledTasks';

// --- 模块级 mock：把页面从真实网络/认证/导航/响应式中隔离出来 ---

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/scheduled-tasks',
}));

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 1, username: 'alice', role: 'user' },
    logout: vi.fn(),
    isLoading: false,
  })),
}));

vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => false, // 桌面表格布局
}));

vi.mock('@/components/common/AppNavbar', () => ({
  AppNavbar: () => null,
}));
vi.mock('@/components/common/Footer', () => ({
  Footer: () => null,
}));

vi.mock('@/hooks/useScheduledTasks', () => ({
  useScheduledTasks: vi.fn(),
  useScheduledTaskStats: vi.fn(),
  useDeleteScheduledTask: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useUpdateScheduledTask: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

const mockedUseScheduledTasks = vi.mocked(useScheduledTasks);
const mockedUseScheduledTaskStats = vi.mocked(useScheduledTaskStats);

const baseTask = (over: Partial<ScheduledTaskItem>): ScheduledTaskItem => ({
  id: 1,
  task_name: 'AAPL 每日',
  ticker: 'AAPL',
  market: 'US',
  is_enabled: true,
  status: 'pending',
  execution_cycle: 'daily',
  execution_time: '09:30',
  interval_days: null,
  day_of_week: null,
  end_date: null,
  next_run: null,
  last_run: null,
  total_executions: 5,
  last_report: { report_id: null, status: null, rating: null },
  analysts: ['market'],
  research_depth: 1,
  created_at: '2026-07-01T00:00:00+08:00',
  updated_at: '2026-07-01T00:00:00+08:00',
  ...over,
});

// 读取某张统计卡片的数值（统计标签是 <p>，与行内徽标 <span>/按钮 <button> 区分）。
function statValueFor(label: string): string {
  const labelEl = screen.getAllByText(label, { selector: 'p' })[0];
  if (!labelEl) throw new Error(`stat label not found: ${label}`);
  const container = labelEl.parentElement;
  if (!container) throw new Error(`stat container not found: ${label}`);
  return within(container).getByText(/^\d+$/).textContent ?? '';
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ScheduledTasksPage 定期任务契约', () => {
  it('消费真实 { data, meta } 响应：渲染任务行，总数取自 meta.total，并按 meta.total 生成分页', () => {
    // 仅 2 条在当前页，但 meta.total = 25 → 应分 3 页、总数显示 25（多页场景）。
    mockedUseScheduledTasks.mockReturnValue({
      data: {
        data: [
          baseTask({ id: 1, task_name: 'AAPL 每日', is_enabled: true, total_executions: 5 }),
          baseTask({ id: 2, task_name: 'TSLA 每周', is_enabled: false, total_executions: 7, ticker: 'TSLA' }),
        ],
        meta: { page: 1, limit: 10, total: 25, has_next: true },
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useScheduledTasks>);
    mockedUseScheduledTaskStats.mockReturnValue({
      data: { data: { running: 0, paused: 0, scheduled_today: 0, failed: 0, completed: 0 } },
    } as unknown as ReturnType<typeof useScheduledTaskStats>);

    render(<ScheduledTasksPage />);

    // 列表行来自 data.data
    expect(screen.getByText('AAPL 每日')).toBeInTheDocument();
    expect(screen.getByText('TSLA 每周')).toBeInTheDocument();

    // 总任务数取自 meta.total（而非当页 items.length）
    expect(statValueFor('总任务数')).toBe('25');

    // 多页：基于 meta.total / limit 生成页码，第 3 页按钮存在
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
    expect(screen.getByText(/共 25 条记录/)).toBeInTheDocument();
  });

  it('三项统计来自全量 /stats，而非当页数据（避免用当页冒充总计）', () => {
    // 当页只有 1 条已完成任务，但 /stats 全量为 running=3 / paused=1 / completed=2。
    mockedUseScheduledTasks.mockReturnValue({
      data: {
        data: [baseTask({ id: 10, task_name: '已完成的任务', status: 'completed', is_enabled: false })],
        meta: { page: 1, limit: 10, total: 1, has_next: false },
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useScheduledTasks>);
    mockedUseScheduledTaskStats.mockReturnValue({
      data: { data: { running: 3, paused: 1, scheduled_today: 0, failed: 0, completed: 2 } },
    } as unknown as ReturnType<typeof useScheduledTaskStats>);

    render(<ScheduledTasksPage />);

    expect(statValueFor('启用中')).toBe('3');
    expect(statValueFor('已暂停')).toBe('1');
    expect(statValueFor('已完成')).toBe('2');
  });

  it('完成态任务展示“已完成”徽标，且不渲染启用/暂停切换按钮', () => {
    mockedUseScheduledTasks.mockReturnValue({
      data: {
        data: [baseTask({ id: 20, task_name: '完成的任务', status: 'completed', is_enabled: true })],
        meta: { page: 1, limit: 10, total: 1, has_next: false },
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useScheduledTasks>);
    mockedUseScheduledTaskStats.mockReturnValue({
      data: { data: { running: 0, paused: 0, scheduled_today: 0, failed: 0, completed: 1 } },
    } as unknown as ReturnType<typeof useScheduledTaskStats>);

    render(<ScheduledTasksPage />);

    // 行内存在“已完成”徽标（与统计卡片标签同名，故用 getAllByText 并断言 >=2）
    expect(screen.getAllByText('已完成').length).toBeGreaterThanOrEqual(2);
    // 完成态行没有启用/暂停切换按钮
    expect(screen.queryByRole('button', { name: /启用中|已暂停/ })).toBeNull();
  });

  it('空列表展示空态，三项统计仍取自 /stats', () => {
    mockedUseScheduledTasks.mockReturnValue({
      data: { data: [], meta: { page: 1, limit: 10, total: 0, has_next: false } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useScheduledTasks>);
    mockedUseScheduledTaskStats.mockReturnValue({
      data: { data: { running: 0, paused: 0, scheduled_today: 0, failed: 0, completed: 0 } },
    } as unknown as ReturnType<typeof useScheduledTaskStats>);

    render(<ScheduledTasksPage />);

    expect(screen.getByText('暂无定期报告')).toBeInTheDocument();
    expect(statValueFor('总任务数')).toBe('0');
  });
});
