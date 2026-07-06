'use client';

import React, { useState } from 'react';

interface SectionAccordionProps {
  title: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

export function SectionAccordion({ title, defaultOpen = false, badge, children }: SectionAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-dark-border rounded-lg overflow-hidden bg-dark-tertiary/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-dark-tertiary transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-medium text-text-primary">
          {title}
          {badge}
        </span>
        <i className={`fas fa-chevron-down text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && <div className="px-4 pb-4 pt-1 text-text-secondary text-sm leading-relaxed">{children}</div>}
    </div>
  );
}
