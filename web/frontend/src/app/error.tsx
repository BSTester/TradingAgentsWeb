'use client';

import { ErrorState } from '@/components/ui/ErrorState';

/** Route-level recoverable error boundary inherited by every application route. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-dark-primary px-4 py-16">
      <ErrorState title="页面暂时不可用" description="加载此页面时出现问题，请重试。" onRetry={reset} />
    </main>
  );
}
