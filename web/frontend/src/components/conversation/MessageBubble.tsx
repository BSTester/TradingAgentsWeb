'use client';

import React from 'react';
import LazyMarkdown from '@/components/common/LazyMarkdown';
import type { Message, Report } from '@/types/conversation';
import { StageProgress } from '@/components/analysis/StageProgress';
import { ReportCard } from '@/components/analysis/ReportCard';

interface MessageBubbleProps {
  message: Message;
  reports: Record<string, Report>;
}

export function MessageBubble({ message, reports }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-text-tertiary bg-dark-tertiary rounded-full px-3 py-1">{message.content}</span>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex gap-3 max-w-[90%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            isUser ? 'bg-gradient-to-br from-accent-primary to-accent-secondary text-white' : 'bg-dark-tertiary text-accent-primary'
          }`}
          aria-hidden="true"
        >
          <i className={`fas ${isUser ? 'fa-user' : 'fa-robot'}`} />
        </div>

        {/* Body */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div
            className={`rounded-2xl px-4 py-3 ${
              isUser
                ? 'bg-gradient-to-br from-accent-primary to-accent-secondary text-white rounded-tr-sm'
                : 'bg-dark-secondary text-text-primary rounded-tl-sm border border-dark-border'
            }`}
          >
            {message.content_blocks && message.content_blocks.length > 0 ? (
              <Blocks blocks={message.content_blocks} reports={reports} user={isUser} />
            ) : (
              <LazyMarkdown preset="sanitize">{message.content}</LazyMarkdown>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Blocks({
  blocks,
  reports,
  user,
}: {
  blocks: Message['content_blocks'];
  reports: Record<string, Report>;
  user: boolean;
}) {
  if (!blocks) return null;
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === 'text') {
          return (
            <div key={i} className={user ? 'text-white' : 'text-text-primary'}>
              <LazyMarkdown preset="sanitize">{b.content}</LazyMarkdown>
            </div>
          );
        }
        if (b.type === 'stage_progress') {
          return <StageProgress key={i} blocks={[b]} />;
        }
        if (b.type === 'report') {
          const report = reports[b.report_id];
          if (!report) return null;
          return <ReportCard key={i} report={report} />;
        }
        return null;
      })}
    </>
  );
}
