'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * 全局 404 页面（WS-4 M5-S3 旧路由收口）。
 * 由于项目使用 `output: 'export'` 静态导出，无法使用 next.config 的 redirects()，
 * 故已下线的模拟交易 / 交易排行榜 / 仪表盘等旧路由统一在此友好提示并引导至对话工作台。
 */
export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    // 旧路由（/leaderboard、/intraday-trading、/dashboard 等）访问后自动回到对话工作台
    const timer = setTimeout(() => {
      router.replace('/');
    }, 4000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-primary px-4">
      <div className="max-w-md w-full">
        <EmptyState
          icon="fa-comments"
          title="页面已迁移"
          description="您访问的页面已下线或已合并至对话式分析工作台，即将在几秒后自动跳转。"
          action={
            <a href="/" className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gradient-to-r from-accent-primary to-accent-secondary text-dark-primary font-semibold hover:shadow-glow-cyan transition-all">
              <i className="fas fa-arrow-right mr-2" />
              前往对话工作台
            </a>
          }
        />
      </div>
    </div>
  );
}
