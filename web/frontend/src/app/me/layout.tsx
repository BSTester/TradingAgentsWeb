'use client';

import React from 'react';
import { AccountLayout } from '@/components/ws133/AccountLayout';
import { SiteHeader } from '@/components/ws133/Shell';

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-dark-primary">
      <SiteHeader />
      <AccountLayout>{children}</AccountLayout>
    </div>
  );
}
