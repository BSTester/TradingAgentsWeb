'use client';

import React from 'react';
import type { ContentBlock } from '@/types/conversation';
import { StageRow } from './StageRow';

export function StageProgress({ blocks }: { blocks: Extract<ContentBlock, { type: 'stage_progress' }>[] }) {
  if (blocks.length === 0) return null;
  return (
    <div className="rounded-lg border border-dark-border bg-dark-secondary/60 p-2 my-2">
      <p className="text-xs uppercase tracking-wide text-text-tertiary px-3 pt-1 pb-1">分析阶段进展</p>
      <div className="divide-y divide-dark-border/60">
        {blocks.map((b) => (
          <StageRow key={b.stage_id} stage={b} />
        ))}
      </div>
    </div>
  );
}
