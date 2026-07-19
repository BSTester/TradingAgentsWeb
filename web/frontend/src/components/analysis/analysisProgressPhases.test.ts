import { describe, expect, it, vi } from 'vitest';

import { applyProgressConfig, createAnalysisPhases, loadAnalysisProgressConfig, phaseIndexForAgent } from '@/components/analysis/AnalysisProgress';

describe('AnalysisProgress graph stages', () => {
  it('keeps Risk Judge as a separate terminal band when executor is disabled', () => {
    const phases = applyProgressConfig(createAnalysisPhases(), {
      selected_analysts: ['market'],
      enable_trading_executor: false,
    });

    expect(phases).toHaveLength(5);
    expect(phases.at(-1)).toMatchObject({ id: 'risk-judge', name: '最终裁决' });
  });

  it('routes risk_manager events to the terminal Risk Judge band', () => {
    const phases = createAnalysisPhases();

    expect(phaseIndexForAgent('risk_manager', phases)).toBe(4);
    expect(phases[phaseIndexForAgent('risk_manager', phases)]?.name).toBe('最终裁决');
  });

  it('turns a non-2xx status response into a retryable error', async () => {
    const fetchStatus = vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' });

    await expect(loadAnalysisProgressConfig('analysis-1', null, fetchStatus)).rejects.toThrow('503');
  });
});
