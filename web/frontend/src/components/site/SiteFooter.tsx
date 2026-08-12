import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-dark-border bg-dark-primary">
      <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-text-tertiary">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-5 w-5 rounded bg-gradient-to-br from-accent-primary to-accent-secondary" />
            <span className="font-heading text-sm font-semibold text-text-secondary">TradingAgents</span>
            <span className="text-text-tertiary">多智能体股票研究</span>
          </div>
          <nav className="flex flex-wrap gap-4">
            <Link href="/" className="hover:text-text-secondary">研究</Link>
            <Link href="/leaderboard" className="hover:text-text-secondary">公开榜单</Link>
            <Link href="/subscription" className="hover:text-text-secondary">订阅</Link>
            <Link href="/settings" className="hover:text-text-secondary">本地模型</Link>
          </nav>
        </div>
        <p className="disclaimer-strip mt-6 leading-relaxed">
          本平台由 AI 多智能体生成研究报告，所有行情与价格均为示例或延迟数据，仅供研究参考，不构成任何投资建议。
          本平台不提供任何下单、委托或交易执行入口。
        </p>
      </div>
    </footer>
  );
}

