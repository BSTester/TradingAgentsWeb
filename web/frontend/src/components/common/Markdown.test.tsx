import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Markdown from './Markdown';

/**
 * The lazy renderer wraps react-markdown; these tests pin down that the two
 * presets still render correctly after the refactor (gfm = remark-gfm + breaks,
 * sanitize = rehype-sanitize). See frontend/issues/WS-86.
 */
describe('Markdown renderer (lazy-loaded)', () => {
  it('gfm preset renders headings and emphasis', () => {
    render(<Markdown preset="gfm">{`# Title\n\n**bold** and *italic*`}</Markdown>);
    expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toBeInTheDocument();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('italic').tagName).toBe('EM');
  });

  it('sanitize preset does not create script/element nodes from raw html', () => {
    const { container } = render(
      <Markdown preset="sanitize">{`<script>alert(1)</script>\n\n**safe** text`}</Markdown>,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('safe').tagName).toBe('STRONG');
  });

  it('gfm preset renders GFM tables', () => {
    const { container } = render(
      <Markdown preset="gfm">{`| a | b |\n| --- | --- |\n| 1 | 2 |`}</Markdown>,
    );
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelectorAll('tbody td')).toHaveLength(2);
  });

  it('defaults to the gfm preset', () => {
    const { container } = render(<Markdown>{`# hi`}</Markdown>);
    expect(container.querySelector('h1')).not.toBeNull();
  });
});
