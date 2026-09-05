'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { analysisAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageShell } from '@/components/ws133/Shell';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: any) => string;
      reset: (id: string) => void;
    };
  }
}

export default function AuthPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const { data: config } = useQuery({ queryKey: ['config'], queryFn: () => analysisAPI.getConfig(), staleTime: 60_000 });
  const turnstileEnabled = !!config?.turnstile_enabled;
  const siteKey = config?.turnstile_site_key ?? '';

  useEffect(() => {
    if (user) {
      router.replace(user.role === 'admin' ? '/admin' : '/me');
    }
  }, [user, router]);

  return (
    <PageShell className="flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-dark-border bg-dark-secondary p-6 shadow-card-dark">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-primary text-white">
              <i className="fas fa-chart-line" aria-hidden="true" />
            </div>
            <h1 className="text-responsive-h4 text-text-primary">
              {mode === 'login' ? '登录 TradingAgents' : '注册新账号'}
            </h1>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-dark-border bg-dark-tertiary p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  mode === m ? 'bg-accent-primary text-white' : 'text-text-secondary'
                }`}
              >
                {m === 'login' ? '登录' : '注册'}
              </button>
            ))}
          </div>

          {mode === 'login' ? (
            <LoginForm siteKey={siteKey} enabled={turnstileEnabled} />
          ) : (
            <RegisterForm siteKey={siteKey} enabled={turnstileEnabled} />
          )}
        </div>
      </div>
    </PageShell>
  );
}

function TurnstileWidget({ siteKey, enabled, onToken }: { siteKey: string; enabled: boolean; onToken?: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !siteKey) return;
    (ref.current as HTMLDivElement).id = `turnstile-${Math.random().toString(36).slice(2)}`;

    const load = () => {
      if (window.turnstile && ref.current) {
        window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (t: string) => onToken?.(t),
        });
      }
    };
    if (window.turnstile) load();
    else {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = load;
      document.head.appendChild(s);
    }
  }, [enabled, siteKey]);

  return (
    <div className="flex justify-center">
      <div ref={ref} />
    </div>
  );
}

function LoginForm({ siteKey, enabled }: { siteKey: string; enabled: boolean }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [turnstile, setTurnstile] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      await login(username, password, undefined, turnstile);
    } catch (err: any) {
      setErr(err?.message ?? '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="用户名">
        <input value={username} onChange={(e) => setUsername(e.target.value)} className="form-control" autoComplete="username" />
      </Field>
      <Field label="密码">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="form-control" autoComplete="current-password" />
      </Field>
      <TurnstileWidget siteKey={siteKey} enabled={enabled} onToken={setTurnstile} />
      {err && <p className="text-sm text-danger-400">{err}</p>}
      <button disabled={loading} className="w-full rounded-lg bg-accent-primary py-2.5 text-sm font-semibold text-white hover:bg-accent-secondary disabled:opacity-60">
        {loading ? '登录中…' : '登录'}
      </button>
    </form>
  );
}

function RegisterForm({ siteKey, enabled }: { siteKey: string; enabled: boolean }) {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstile, setTurnstile] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      await register(username, email, password, undefined, undefined, turnstile);
    } catch (err: any) {
      setErr(err?.message ?? '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="用户名">
        <input value={username} onChange={(e) => setUsername(e.target.value)} className="form-control" autoComplete="username" />
      </Field>
      <Field label="邮箱">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-control" autoComplete="email" />
      </Field>
      <Field label="密码（至少 6 位）">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="form-control" autoComplete="new-password" />
      </Field>
      <TurnstileWidget siteKey={siteKey} enabled={enabled} onToken={setTurnstile} />
      {err && <p className="text-sm text-danger-400">{err}</p>}
      <button disabled={loading} className="w-full rounded-lg bg-accent-primary py-2.5 text-sm font-semibold text-white hover:bg-accent-secondary disabled:opacity-60">
        {loading ? '注册中…' : '注册'}
      </button>
      <p className="text-xs text-text-tertiary">注：生产环境注册需邮箱验证码（需配置 SMTP）。</p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
