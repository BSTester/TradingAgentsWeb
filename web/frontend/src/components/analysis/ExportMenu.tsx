'use client';

import React, { useState } from 'react';
import { reportAPI } from '@/lib/conversation';
import { useToastContext } from '@/components/ui/ToasterProvider';

const FORMATS: { key: 'md' | 'json' | 'pdf'; label: string; icon: string }[] = [
  { key: 'md', label: 'Markdown', icon: 'fa-file-lines' },
  { key: 'json', label: 'JSON', icon: 'fa-file-code' },
  { key: 'pdf', label: 'PDF', icon: 'fa-file-pdf' },
];

export function ExportMenu({ reportId }: { reportId: string }) {
  const { showToast } = useToastContext();
  const [busy, setBusy] = useState<string | null>(null);

  const handleExport = (format: 'md' | 'json' | 'pdf') => {
    setBusy(format);
    try {
      const url = reportAPI.exportUrl(reportId, format);
      // open in new tab triggers the attachment download
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      showToast('导出失败，请重试', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="inline-flex items-center gap-1">
      <span className="text-xs text-text-tertiary mr-1">导出</span>
      {FORMATS.map((f) => (
        <button
          key={f.key}
          onClick={() => handleExport(f.key)}
          disabled={busy === f.key}
          className="px-2 py-1 rounded-lg text-xs text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary transition-colors disabled:opacity-50"
          aria-label={`导出 ${f.label}`}
        >
          <i className={`fas ${busy === f.key ? 'fa-spinner fa-spin' : f.icon} mr-1`} aria-hidden="true" />
          {f.label}
        </button>
      ))}
    </div>
  );
}
