'use client';

import dynamic from 'next/dynamic';
import type { MarkdownProps } from './Markdown';

/**
 * Lazily-loaded markdown renderer. `next/dynamic` splits react-markdown +
 * remark/rehype into a separate chunk fetched on demand (only when the first
 * markdown actually needs to render), keeping it out of the first-screen JS.
 *
 * The dynamic module is resolved once and cached, so streaming chat / repeated
 * report sections only pay the load cost on first use. See `frontend/issues/WS-86`.
 */
const Markdown = dynamic(() => import('./Markdown'), {
  ssr: false,
  loading: () => (
    <span
      className="inline-block min-h-[1em] w-full max-w-prose animate-pulse rounded bg-dark-tertiary/60 align-middle"
      aria-label="内容加载中"
    />
  ),
});

export default function LazyMarkdown(props: MarkdownProps) {
  return <Markdown {...props} />;
}
