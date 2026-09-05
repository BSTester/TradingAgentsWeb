'use client';

import React from 'react';
import { AdminLayout } from '@/components/ws133/AdminLayout';

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
