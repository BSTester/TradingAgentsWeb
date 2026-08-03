import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AnalysisResultsSkeleton } from './AnalysisResultsSkeleton';

describe('AnalysisResultsSkeleton', () => {
  it('renders an accessible busy status', () => {
    const { container } = render(<AnalysisResultsSkeleton />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});
