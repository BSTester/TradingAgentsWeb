'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { SearchBar } from '@/components/site/SearchBar';
import { SiteLayout } from '@/components/site/SiteLayout';
import { useAuth } from '@/lib/auth';
import { analysisAPI } from '@/lib/apiClient';
import { useState } from 'react';

function ResearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const { user } = useAuth();
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');

  const launch = async () => {
    if (!q) return;
    if (!user) {
      router.push('/auth?next=/research?q=' + encodeURIComponent(q));
      return;
    }
    setLaunching(true);
    setError('');
    try {
      const res = await analysisAPI.startAnalysis({ ticker: q, of_company: q });
      const aid = res?.analysis_id || res?.id;
      if (aid) router.push('/me?analysis=' + aid);
      else setError('已提交，请到「我的分析」查看进度。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '启动分析失败');
    } finally {
      setLaunching(false);
    }
  };

  return (
    <SiteLayout maxWidth="max-w-3xl">
      <h1 className="h-serif text-2xl">发起研究</h1>
      <p className="mt-1 text-sm text-text-secondary">确认你的研究目标，多智能体团队将开始全维度分析。</p>

      <div className="mt-6"><SearchBar size="md" /></div>

      <div className="surface-panel mt-6 p-5">
        <div className="text-xs text-text-tertiary">研究目标</div>
        <div className="mt-1 text-lg font-medium text-text-primary">{q || '（请在上方输入）'}</div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { i: 'fa-chart-line', t: '市场 / 技术面' },
            { i: 'fa-comments', t: '舆情 / 情绪' },
            { i: 'fa-newspaper', t: '新闻 / 宏观' },
            { i: 'fa-table-list', t: '基本面 / 财务' },
            { i: 'fa-users-rays', t: '多空研究辩论' },
            { i: 'fa-shield-halved', t: '风险裁决' },
          ].map((s) => (
            <div key={s.t} className="flex items-center gap-2 rounded-lg border border-dark-border bg-dark-secondary px-3 py-2">
              <i className={`fa-solid ${s.i} text-xs text-accent-secondary`} />
              <span className="text-xs text-text-secondary">{s.t}</span>
            </div>
          ))}
        </div>

        {!user && (
          <p className="mt-4 text-xs text-verdict-hold">
            <i className="fa-solid fa-circle-info mr-1" />保存分析结果与公开报告需要先登录。
          </p>
        )}
        {error && <p className="mt-4 text-xs text-verdict-bear">{error}</p>}

        <div className="mt-5 flex items-center justify-between">
          <p className="disclaimer-strip">研究建议 · 非下单执行 · 示例 / 延迟数据</p>
          <button onClick={launch} disabled={launching || !q} className="btn-primary text-sm">
            {launching ? <><i className="fa-solid fa-circle-notch animate-spin mr-1.5" />启动中</> : <><i className="fa-solid fa-rocket mr-1.5" />开始多智能体分析</>}
          </button>
        </div>
      </div>
    </SiteLayout>
  );
}

export default function ResearchPage() {
  return (
    <Suspense fallback={null}>
      <ResearchInner />
    </Suspense>
  );
}

