'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { analysisAPI, reportsAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageShell } from '@/components/ws133/Shell';
import type { AnalysisStatus } from '@/lib/types';

export default function ResearchPage() {
  const params = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const { user, isLoading: authLoading } = useAuth();

  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // Best-effort config for starting an analysis.
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => analysisAPI.getConfig(),
    staleTime: 60_000,
    enabled: !!user,
  });

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const start = async () => {
    setLaunching(true);
    setLaunchError(null);
    try {
      // 优先使用前台「自定义模型」保存的本地配置（provider/base_url/api_key/模型）。
      // 否则回退到系统默认（/api/config 的第一个供应商）。
      let custom: any = null;
      try {
        custom = JSON.parse(localStorage.getItem('ws133_local_model_config') || 'null');
      } catch {}
      const hasCustom = custom && custom.provider && custom.api_key;

      let provider: string, base_url: string, shallow: string, deep: string, api_key: string | undefined;
      if (hasCustom) {
        provider = custom.provider;
        base_url = custom.base_url || 'https://api.openai.com/v1';
        shallow = custom.shallow_model || 'gpt-5.5';
        deep = custom.deep_model || 'gpt-5.5';
        api_key = custom.api_key;
      } else {
        const providers = config?.llm_providers ?? [];
        const p = providers[0] ?? { value: 'openai', url: 'https://api.openai.com/v1' };
        const models = config?.models?.[p.value] ?? {};
        provider = p.value;
        base_url = p.url;
        shallow = models?.shallow?.[0]?.value ?? 'gpt-5.5';
        deep = models?.deep?.[0]?.value ?? 'gpt-5.5';
        api_key = undefined;
      }

      const res = await analysisAPI.startAnalysis({
        ticker: q,
        analysis_date: today,
        analysts: ['market', 'fundamentals', 'news', 'social'],
        research_depth: 1,
        llm_provider: provider,
        backend_url: base_url,
        shallow_thinker: shallow,
        deep_thinker: deep,
        ...(api_key ? { api_key } : {}),
      });
      setAnalysisId(res.analysis_id);
    } catch (err: any) {
      setLaunchError(err?.message ?? '无法启动分析');
    } finally {
      setLaunching(false);
    }
  };

  // Poll status while running.
  const { data: status } = useQuery({
    queryKey: ['analysis-status', analysisId],
    queryFn: () => analysisAPI.getStatus(analysisId!) as Promise<any>,
    enabled: !!analysisId,
    refetchInterval: 2500,
    retry: false,
  });

  const complete = status && (status.status === 'completed');
  const failed = status && (status.status === 'error' || status.status === 'failed');

  const isTickerLike = /^[a-zA-Z][a-zA-Z0-9.\-]{0,10}$|^\d{4,6}(\.(SH|SZ|HK))?$/.test(q);

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-text-tertiary hover:text-text-secondary">
          ← 返回搜索
        </Link>
        <h1 className="mt-3 text-responsive-h2 text-text-primary">研究结果</h1>
        <p className="mt-2 text-sm text-text-secondary">
          研究主题：<span className="font-semibold text-text-primary">{q || '—'}</span>
        </p>

        {!q && (
          <div className="mt-6 rounded-xl border border-dashed border-dark-border bg-dark-secondary/50 p-10 text-center text-sm text-text-tertiary">
            未提供研究标的。
          </div>
        )}

        {q && authLoading && <Skeleton />}

        {q && !authLoading && !user && (
          <div className="mt-6 rounded-xl border border-dark-border bg-dark-secondary p-6">
            <p className="flex items-center gap-2 text-sm text-text-primary">
              <i className="fas fa-lock text-accent-primary" aria-hidden="true" />
              启动分析需要登录。
            </p>
            <p className="mt-2 text-sm text-text-tertiary">
              登录后可使用订阅次数，或在「自定义模型」中配置自有 LLM Key。
            </p>
            <div className="mt-4 flex gap-2">
              <Link href="/auth" className="rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold text-white">
                登录 / 注册
              </Link>
              <Link href="/subscribe" className="rounded-lg border border-dark-border px-4 py-2 text-sm text-text-secondary">
                订阅中心
              </Link>
            </div>
          </div>
        )}

        {q && user && !isTickerLike && (
          <div className="mt-6 rounded-xl border border-accent-primary/30 bg-accent-primary/5 p-6 text-sm text-text-secondary">
            <i className="fas fa-wand-magic-sparkles mr-2 text-accent-primary" aria-hidden="true" />
            「{q}」为自然语言研究指令。将作为研究主题交给多智能体团队进行分析。
          </div>
        )}

        {q && user && isTickerLike && !analysisId && (
          <div className="mt-6 rounded-xl border border-dark-border bg-dark-secondary p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-primary">
                标的：<span className="num font-semibold">{q}</span>
              </p>
              <button
                onClick={start}
                disabled={launching}
                className="rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold text-white hover:bg-accent-secondary disabled:opacity-60"
              >
                {launching ? '正在启动…' : '开始分析'}
              </button>
            </div>

            {launchError && (
              <div className="mt-4 rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-sm text-danger-400">
                <i className="fas fa-triangle-exclamation mr-2" aria-hidden="true" />
                {launchError}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Link href="/subscribe" className="text-sm text-accent-primary hover:underline">
                购买分析次数
              </Link>
              <span className="text-sm text-text-tertiary">或</span>
              <Link href="/settings" className="text-sm text-accent-primary hover:underline">
                配置自有模型
              </Link>
            </div>
          </div>
        )}

        {analysisId && status && (
          <div className="mt-6 rounded-xl border border-dark-border bg-dark-secondary p-6">
            <div className="flex items-center gap-2 text-sm text-text-primary">
              <i
                className={`fas ${complete ? 'fa-circle-check text-down' : 'fa-spinner fa-spin text-accent-primary'}`}
                aria-hidden="true"
              />
              {complete ? '分析完成' : failed ? '分析失败' : '多智能体团队正在分析…'}
            </div>
            {status.current_step && (
              <p className="mt-1 text-sm text-text-tertiary">{status.current_step}</p>
            )}
            {!complete && !failed && (status.progress_percentage ?? 0) > 0 && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-dark-tertiary">
                <div
                  className="h-full rounded-full bg-accent-primary transition-all"
                  style={{ width: `${status.progress_percentage}%` }}
                />
              </div>
            )}
            {complete && (
              <Link
                href={`/reports/${analysisId}`}
                className="mt-4 inline-block rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold text-white"
              >
                查看研究报告 →
              </Link>
            )}
            {failed && (
              <p className="mt-3 text-sm text-danger-400">分析中断或失败，请稍后重试。</p>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}

function Skeleton() {
  return (
    <div className="mt-6 space-y-3">
      <div className="h-24 animate-pulse rounded-xl bg-dark-secondary" />
    </div>
  );
}
