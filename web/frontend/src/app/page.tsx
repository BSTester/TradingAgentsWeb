'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { ConversationProvider } from '@/lib/conversation-context';
import { AppNavbar } from '@/components/common/AppNavbar';
import { ConversationWorkbench } from '@/components/conversation/ConversationWorkbench';

export default function HomePage() {
  const { user, logout, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-primary flex items-center justify-center">
        <i className="fas fa-spinner fa-spin text-2xl text-accent-primary" aria-hidden="true" />
      </div>
    );
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
