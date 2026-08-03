'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { ConversationProvider } from '@/lib/conversation-context';
import { AppNavbar } from '@/components/common/AppNavbar';
import { ConversationWorkbench } from '@/components/conversation/ConversationWorkbench';
import { PageLoading } from '@/components/ui/PageLoading';

export default function HomePage() {
  const { user, logout, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoading message="正在恢复工作台..." />;
  }

  return (
    <div className="min-h-screen bg-dark-primary flex flex-col">
      <AppNavbar user={user} onLogout={logout} />
      <div className="pt-16 flex-1 flex flex-col">
        <ConversationProvider>
          <ConversationWorkbench />
        </ConversationProvider>
      </div>
    </div>
  );
}
