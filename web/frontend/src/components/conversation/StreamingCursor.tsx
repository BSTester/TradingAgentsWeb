'use client';

import React from 'react';

export function StreamingCursor() {
  return (
    <span className="inline-flex items-center ml-1" aria-label="生成中">
      <span className="w-1.5 h-4 bg-accent-primary rounded-sm animate-pulse" />
    </span>
  );
}
