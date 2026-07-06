'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export function LoginNudge() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-center gap-3 border-t border-dark-border bg-dark-secondary/80 backdrop-blur-lg p-3">
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <i className="fas fa-lock text-accent-amber" aria-hidden="true" />
        <span>发送消息前请先登录，草稿将为你保留</span>
      </div>
      <button
        onClick={() => router.push('/login')}
        className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent-primary to-accent-secondary text-white text-sm font-medium hover:shadow-glow-cyan transition-all"
      >
        登录 / 注册
      </button>
    </div>
  );
}
