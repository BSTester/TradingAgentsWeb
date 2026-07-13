import Link from 'next/link';

import { EmptyState } from '@/components/ui/EmptyState';

/** Empty-state route for a missing resource or unmatched URL. */
export default function NotFound() {
  return (
    <main className="min-h-screen bg-dark-primary px-4 py-16">
      <EmptyState
        icon="fa-compass"
        title="未找到这个页面"
        description="它可能已被移动，或链接不再有效。"
        action={<Link href="/" className="rounded-lg bg-accent-primary px-4 py-2 font-bold text-dark-primary">返回工作台</Link>}
      />
    </main>
  );
}
