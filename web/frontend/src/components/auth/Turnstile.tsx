'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';

/**
 * Cloudflare Turnstile 人机验证组件。
 *
 * 通过 NEXT_PUBLIC_TURNSTILE_SITE_KEY 读取 sitekey，默认使用 Cloudflare 官方
 * 测试 sitekey（始终通过），方便联调；生产环境请覆盖为真实 sitekey。
 *
 * 组件挂载后加载 Turnstile 脚本并显式渲染 widget；token 获取后通过
 * onTokenChange 回传给父组件。父组件可通过 ref 调用 reset() 强制刷新挑战。
 */

// Cloudflare 官方测试 sitekey（始终通过）
const TEST_SITE_KEY = '1x00000000000000000000AA';
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || TEST_SITE_KEY;
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: any) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

let scriptLoadPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Turnstile script load failed')));
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Turnstile script load failed'));
    document.head.appendChild(s);
  });
  return scriptLoadPromise;
}

export interface TurnstileRef {
  reset: () => void;
}

interface TurnstileProps {
  onTokenChange: (token: string) => void;
  className?: string;
}

export const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(function Turnstile(
  { onTokenChange, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  // token callback 必须稳定，避免 widget 重新渲染时丢失引用
  const tokenCbRef = useRef<(token: string) => void>(onTokenChange);
  tokenCbRef.current = onTokenChange;

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {
          /* widget may already be removed */
        }
      }
    },
  }));

  useEffect(() => {
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        // 避免重复渲染
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            /* noop */
          }
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => tokenCbRef.current(token),
          'error-callback': () => tokenCbRef.current(''),
          'expired-callback': () => tokenCbRef.current(''),
          theme: 'dark',
        });
      })
      .catch(() => setLoadError(true));

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* noop */
        }
        widgetIdRef.current = null;
      }
    };
  }, []);

  return (
    <div className={className}>
      <div ref={containerRef} />
      {loadError && (
        <p className="mt-1 text-xs text-verdict-bear">
          人机验证组件加载失败，请检查网络后刷新页面
        </p>
      )}
    </div>
  );
});

export default Turnstile;
