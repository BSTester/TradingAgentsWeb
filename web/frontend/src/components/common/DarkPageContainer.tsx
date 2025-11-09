'use client';

import React, { ReactNode } from 'react';

interface DarkPageContainerProps {
  children: ReactNode;
  className?: string;
}

export function DarkPageContainer({ children, className = '' }: DarkPageContainerProps) {
  return (
    <div className={`min-h-screen bg-dark-primary ${className}`}>
      {children}
    </div>
  );
}
