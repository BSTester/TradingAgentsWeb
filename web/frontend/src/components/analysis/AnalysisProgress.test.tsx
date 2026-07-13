import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;

  readonly readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(_url: string, _protocols?: string | string[]) {
    MockWebSocket.instances.push(this);
  }

  close() {
    this.onclose?.({ code: 1000, reason: '' } as CloseEvent);
  }
}

describe('AnalysisProgress — terminal Risk Judge band', () => {
  afterEach(() => {
    MockWebSocket.instances = [];
    vi.unstubAllGlobals();
  });

  it('keeps the independent Risk Judge final band when executor is disabled by a config event', async () => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ selected_analysts: ['market'], enable_trading_executor: false }),
      }),
    );

    render(
      <AnalysisProgress
        analysisId="analysis-1"
        onComplete={vi.fn()}
        onBackToConfig={vi.fn()}
        onShowToast={vi.fn()}
      />,
    );

    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));

    act(() => {
      MockWebSocket.instances[0]!.onmessage?.({
        data: JSON.stringify({
          type: 'config',
          data: { selected_analysts: ['market'], enable_trading_executor: false },
        }),
      } as MessageEvent);
    });

    act(() => {
      MockWebSocket.instances[0]!.onmessage?.({
        data: JSON.stringify({
          type: 'log',
          data: {
            agent: 'risk_manager',
            phase: '完成阶段',
            step: '开始',
            message: 'Risk Judge 正在汇总风险意见',
          },
        }),
      } as MessageEvent);
    });

    expect(screen.getByText('最终裁决')).toBeInTheDocument();
    expect(screen.getByText('风险裁决（Risk Judge）输出最终交易建议')).toBeInTheDocument();
    expect(screen.getByText('风险裁决')).toBeInTheDocument();
    expect(screen.queryByText('交易执行')).toBeNull();
  });
});
