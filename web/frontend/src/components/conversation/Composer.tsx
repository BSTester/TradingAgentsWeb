'use client';

import React, { useState, useRef, KeyboardEvent } from 'react';

interface ComposerProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function Composer({ onSend, onStop, isStreaming, disabled, placeholder }: ComposerProps) {
  const [value, setValue] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const text = value.trim();
    if (!text || isStreaming || disabled) return;
    onSend(text);
    setValue('');
    if (taRef.current) taRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  return (
    <div className="border-t border-dark-border bg-dark-secondary/80 backdrop-blur-lg p-3">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <textarea
          ref={taRef}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            setValue(e.target.value);
            autoGrow(e.target);
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={placeholder ?? '用自然语言描述你的投研需求，例如：分析 0700.HK 的风险'}
          className="flex-1 resize-none bg-dark-tertiary text-text-primary rounded-xl px-4 py-3 outline-none border border-dark-border focus:border-accent-primary disabled:opacity-50"
          aria-label="消息输入框"
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            className="flex-shrink-0 w-11 h-11 rounded-xl bg-danger-500 hover:bg-danger-600 text-white flex items-center justify-center transition-colors"
            aria-label="停止生成"
          >
            <i className="fas fa-stop" aria-hidden="true" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={disabled || !value.trim()}
            className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary text-dark-primary flex items-center justify-center hover:shadow-glow-cyan transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="发送"
          >
            <i className="fas fa-paper-plane" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="text-center text-xs text-text-tertiary mt-1">Enter 发送 · Shift+Enter 换行</p>
    </div>
  );
}
