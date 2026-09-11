import { ReactNode } from 'react';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

export function SiteLayout({ children, maxWidth = 'max-w-6xl' }: { children: ReactNode; maxWidth?: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-dark-primary">
      <SiteHeader />
      <main className={`mx-auto w-full flex-1 ${maxWidth} px-4 py-6`}>{children}</main>
      <SiteFooter />
    </div>
  );
}

