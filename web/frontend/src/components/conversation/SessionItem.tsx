'use client';

import React, { useState } from 'react';
import type { Session } from '@/types/conversation';

interface SessionItemProps {
  session: Session;
  active: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function SessionItem({ session, active, onSelect, onRename, onDelete }: SessionItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(session.title);

  const commitRename = () => {
    const t = title.trim();
    if (t && t !== session.title) onRename(session.id, t);
    setEditing(false);
    setMenuOpen(false);
  };

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
        active ? 'bg-accent-primary/15 border border-accent-primary/40' : 'hover:bg-dark-tertiary border border-transparent'
      }`}
      onClick={() => !editing && onSelect(session.id)}
    >
      <i className="fas fa-comments text-text-tertiary text-sm" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setTitle(session.title);
                setEditing(false);
              }
            }}
            className="w-full bg-dark-primary text-text-primary text-sm rounded px-1 outline-none border border-accent-primary"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <p className="text-sm text-text-primary truncate">{session.title}</p>
        )}
        {session.last_message_preview && !editing && (
          <p className="text-xs text-text-tertiary truncate">{session.last_message_preview}</p>
        )}
      </div>

      {session.has_active_analysis && !editing && (
        <i className="fas fa-spinner fa-spin text-accent-primary text-xs" aria-hidden="true" />
      )}

      {!editing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-text-primary transition-opacity"
          aria-label="会话菜单"
        >
          <i className="fas fa-ellipsis-v" aria-hidden="true" />
        </button>
      )}

      {menuOpen && (
        <div
          className="absolute right-2 top-9 z-20 w-32 bg-dark-secondary border border-dark-border rounded-lg shadow-lg py-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:text-accent-primary hover:bg-dark-tertiary"
            onClick={() => {
              setEditing(true);
              setMenuOpen(false);
            }}
          >
            <i className="fas fa-pen mr-2" aria-hidden="true" />
            重命名
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-danger-500 hover:bg-danger-500/10"
            onClick={() => {
              if (confirm('确定删除该对话？')) onDelete(session.id);
              setMenuOpen(false);
            }}
          >
            <i className="fas fa-trash mr-2" aria-hidden="true" />
            删除
          </button>
        </div>
      )}
    </div>
  );
}
