'use client';

import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import type { PluggableList } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeSanitize from 'rehype-sanitize';

/**
 * Preset plugin bundles for markdown rendering. Keeping the plugin objects owned
 * by this (lazily-loaded) module is what prevents remark/rehype/react-markdown
 * from being pulled into the first-screen bundle. See `frontend/issues/WS-86`.
 *
 * - `gfm`      → remark-gfm + remark-breaks (analysis reports)
 * - `sanitize` → rehype-sanitize (chat messages, report sections)
 */
export type MarkdownPreset = 'gfm' | 'sanitize';

const REMARK_PLUGINS: Record<MarkdownPreset, PluggableList> = {
  gfm: [remarkGfm, remarkBreaks],
  sanitize: [],
};
const REHYPE_PLUGINS: Record<MarkdownPreset, PluggableList> = {
  gfm: [],
  sanitize: [rehypeSanitize],
};

export interface MarkdownProps {
  preset?: MarkdownPreset;
  /** Optional custom component overrides — passed straight through to react-markdown. */
  components?: Components;
  children?: React.ReactNode;
}

/**
 * Heavy markdown renderer. Always consume via `LazyMarkdown` (next/dynamic) so
 * react-markdown + remark/rehype ship in a deferred chunk, not the first screen.
 */
export default function Markdown({ preset = 'gfm', components, children }: MarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS[preset]}
      rehypePlugins={REHYPE_PLUGINS[preset]}
      components={components}
    >
      {children as React.ComponentProps<typeof ReactMarkdown>['children']}
    </ReactMarkdown>
  );
}
