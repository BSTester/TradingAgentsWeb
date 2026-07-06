'use client';

import React, { useEffect, useRef } from 'react';
import { useConversation } from '@/lib/conversation-context';
import { MessageBubble } from './MessageBubble';
import { PromptChips } from './PromptChips';
import { StreamingCursor } from './StreamingCursor';

export function MessageFlow({ onPickPrompt }: { onPickPrompt: (text: string) => void }) {
  const { messages, reports, isStreaming, activeSessionId } = useConversation();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-4xl mx-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white text-2xl mb-4 shadow-glow-cyan">
              <i className="fas fa-robot" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-bold text-text-primary">开始你的投研对话</h1>
            <p className="text-text-secondary mt-2 max-w-md">
              用自然语言描述需求，多智能体团队会流式推进分析，并在对话内产出结构化报告。
            </p>
            <PromptChips onPick={onPickPrompt} />
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} reports={reports} />
            ))}
            {isStreaming && (
              <div className="flex justify-start mb-4">
                <div className="flex gap-3 max-w-[90%]">
                  <div className="w-8 h-8 rounded-full bg-dark-tertiary text-accent-primary flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-robot" aria-hidden="true" />
                  </div>
                  <div className="bg-dark-secondary border border-dark-border rounded-2xl rounded-tl-sm px-4 py-3 text-text-secondary">
                    正在生成<StreamingCursor />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>
      {!activeSessionId && !isEmpty && null}
    </div>
  );
}
