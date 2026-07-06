'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useConversation } from '@/lib/conversation-context';
import { SessionSidebar } from './SessionSidebar';
import { MessageFlow } from './MessageFlow';
import { Composer } from './Composer';
import { LoginNudge } from './LoginNudge';
import { InspectorPanel } from './InspectorPanel';

export function ConversationWorkbench() {
  const { user } = useAuth();
  const { sendMessage, stopAnalysis, isStreaming, streamingError } = useConversation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-dark-primary">
      {/* Left sidebar (desktop) */}
      <aside className="hidden md:block w-72 flex-shrink-0">
        <SessionSidebar />
      </aside>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw]">
            <SessionSidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top context bar */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-dark-border bg-dark-secondary/60">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-text-secondary hover:text-text-primary"
              aria-label="打开对话列表"
            >
              <i className="fas fa-bars" aria-hidden="true" />
            </button>
            <span className="text-sm font-medium text-text-primary">投研对话工作台</span>
          </div>
          <button
            onClick={() => setInspectorOpen(true)}
            className="lg:hidden text-text-secondary hover:text-text-primary"
            aria-label="打开检查面板"
          >
            <i className="fas fa-sliders-h" aria-hidden="true" />
          </button>
        </div>

        {streamingError && (
          <div className="px-4 py-2 bg-danger-500/10 border-b border-danger-500/30 text-sm text-danger-400 flex items-center gap-2">
            <i className="fas fa-exclamation-circle" aria-hidden="true" />
            {streamingError}
          </div>
        )}

        <MessageFlow onPickPrompt={(t) => sendMessage(t)} />

        {user ? (
          <Composer onSend={sendMessage} onStop={stopAnalysis} isStreaming={isStreaming} />
        ) : (
          <LoginNudge />
        )}
      </div>

      {/* Right inspector (desktop) */}
      <aside className="hidden lg:block w-80 flex-shrink-0">
        <InspectorPanel />
      </aside>

      {/* Mobile inspector drawer */}
      {inspectorOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setInspectorOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw]">
            <InspectorPanel />
          </div>
        </div>
      )}
    </div>
  );
}
