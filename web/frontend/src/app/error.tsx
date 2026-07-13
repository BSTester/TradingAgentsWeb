'use client';

import { ErrorState } from '@/components/ui/ErrorState';

/** Route-level recovery boundary shared by every existing App Router page. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-dark-primary px-4 py-12 flex items-center justify-center">
      <ErrorState title="页面暂时不可用" description="加载页面时发生了问题，请重试。" onRetry={reset} />
    </main>
  );
}
