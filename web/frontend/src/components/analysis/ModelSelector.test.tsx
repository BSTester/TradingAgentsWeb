import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ModelSelector, NO_MODEL_MESSAGE } from '@/components/analysis/ModelSelector';
import { renderWithQuery } from '@/test/renderWithQuery';

vi.mock('@/hooks/useUserLLMSettings', () => ({
  useUserLLMSettings: vi.fn(),
}));

import { useUserLLMSettings } from '@/hooks/useUserLLMSettings';

const mockSettings = (data: any) => {
  vi.mocked(useUserLLMSettings).mockReturnValue({ data, isLoading: false } as any);
};

// Personal providers as returned by the (key-less) settings endpoint.
const personalProviders = [
  {
    id: '1',
    provider_name: 'openai',
    display_name: 'My OpenAI',
    base_url: 'https://api.openai.com',
    shallow_model: 'gpt-4o-mini',
    deep_model: 'gpt-4o',
    is_enabled: true,
    is_default: true,
  },
];

// Config deliberately carries sensitive fields that ModelSelector must NEVER surface.
const sensitiveConfig = {
  models: {
    openai: {
      shallow: [{ value: 'gpt-4o-mini', label: 'GPT-4o Mini' }],
      deep: [{ value: 'gpt-4o', label: 'GPT-4o' }],
    },
  },
  system_default: {
    provider_name: 'openai',
    display_name: 'OpenAI',
    base_url: 'https://api.openai.com',
    api_key_masked: 'sk-...1234',
    has_api_key: true,
  },
  llm_providers: [{ value: 'openai', label: 'OpenAI', url: 'https://api.openai.com' }],
};

describe('ModelSelector — model-only privacy boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders model display names only', () => {
    mockSettings({ providers: personalProviders });
    renderWithQuery(<ModelSelector config={sensitiveConfig} onChange={vi.fn()} />);

    // Display labels ARE shown.
    expect(screen.getByText('GPT-4o Mini / GPT-4o')).toBeInTheDocument();
  });

  it('never surfaces provider name, endpoint, masked/raw key or system-default provenance', () => {
    mockSettings({ providers: personalProviders });
    const { container } = renderWithQuery(
      <ModelSelector config={sensitiveConfig} onChange={vi.fn()} />,
    );

    // Forbidden disclosures:
    expect(screen.queryByText(/系统默认/)).toBeNull();
    expect(screen.queryByText(/api\.openai\.com/)).toBeNull(); // base URL / endpoint
    expect(screen.queryByText(/sk-\.\.\.1234/)).toBeNull(); // masked key
    expect(screen.queryByText('OpenAI')).toBeNull(); // provider display name
    expect(screen.queryByText('openai')).toBeNull(); // raw provider key as visible text
    // No masked/raw key string anywhere in the rendered DOM.
    expect(container.textContent).not.toMatch(/sk-\.\.\.1234/);
    expect(container.textContent).not.toMatch(/api\.openai\.com/);
  });

  it('resolves provider + model values silently on selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    mockSettings({ providers: personalProviders });
    renderWithQuery(<ModelSelector config={sensitiveConfig} onChange={onChange} />);

    await user.selectOptions(screen.getByRole('combobox'), 'GPT-4o Mini / GPT-4o');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        shallow: 'gpt-4o-mini',
        deep: 'gpt-4o',
        label: 'GPT-4o Mini / GPT-4o',
      }),
    );
  });

  it('shows the actionable recovery message when no usable model exists', () => {
    mockSettings({ providers: [] });
    renderWithQuery(<ModelSelector config={{ models: {} }} onChange={vi.fn()} />);

    expect(screen.getByText(NO_MODEL_MESSAGE)).toBeInTheDocument();
    // Recovery message must not leak whether a system/default provider exists.
    expect(screen.queryByText(/系统默认/)).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('makes an administrator-provided system model selectable without exposing its provenance', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    mockSettings({ providers: [] });

    renderWithQuery(
      <ModelSelector
        config={{
          models: {
            system: {
              shallow: [{ value: 'system-fast', label: 'System Fast' }],
              deep: [{ value: 'system-reasoning', label: 'System Reasoning' }],
            },
          },
          system_default: {
            provider_name: 'system',
            display_name: 'Private administrator provider',
            base_url: 'https://private.example.test',
            api_key_masked: 'sk-system-secret',
          },
        }}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('option', { name: 'System Fast / System Reasoning' })).toBeInTheDocument();
    expect(screen.queryByText(/系统默认|administrator provider|private\.example|sk-system-secret/i)).toBeNull();

    await user.selectOptions(screen.getByRole('combobox'), 'System Fast / System Reasoning');
    expect(onChange).toHaveBeenCalledWith({
      provider: 'system',
      shallow: 'system-fast',
      deep: 'system-reasoning',
      label: 'System Fast / System Reasoning',
    });
  });
});
