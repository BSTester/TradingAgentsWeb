'use client';

import React, { useMemo, useState } from 'react';
import { useConversation } from '@/lib/conversation-context';
import { SessionItem } from './SessionItem';

export function SessionSidebar({ onClose }: { onClose?: () => void }) {
  const { sessions, activeSessionId, loadingSessions, createSession, selectSession, renameSession, deleteSession } =
    useConversation();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q) || (s.last_message_preview ?? '').toLowerCase().includes(q));
  }, [sessions, query]);

  return (
    <div className="flex flex-col h-full bg-dark-secondary border-r border-dark-border">
      {/* Header */}
      <div className="p-3 border-b border-dark-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-text-primary">对话</h2>
          <button
            onClick={onClose}
            className="md:hidden text-text-tertiary hover:text-text-primary"
            aria-label="关闭侧栏"
          >
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>
        <button
          onClick={() => {
            createSession();
            onClose?.();
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-accent-primary to-accent-secondary text-white text-sm font-medium hover:shadow-glow-cyan transition-all"
        >
          <i className="fas fa-plus" aria-hidden="true" />
          新建对话
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索对话"
          className="mt-2 w-full bg-dark-tertiary text-text-primary text-sm rounded-lg px-3 py-2 outline-none border border-dark-border focus:border-accent-primary"
          aria-label="搜索对话"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loadingSessions ? (
          <p className="text-center text-text-tertiary text-sm py-8">加载中…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-text-tertiary text-sm py-8">
            {sessions.length === 0 ? '还没有对话，点击「新建对话」开始' : '无匹配对话'}
          </p>
        ) : (
          filtered.map((s) => (
            <SessionItem
              key={s.id}
              session={s}
              active={s.id === activeSessionId}
              onSelect={(id) => {
                selectSession(id);
                onClose?.();
              }}
              onRename={renameSession}
              onDelete={deleteSession}
            />
          ))
        )}
      </div>
    </div>
  );
}
