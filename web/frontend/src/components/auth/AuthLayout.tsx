'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  toggleText: string;
  toggleLink: string;
  toggleLinkText: string;
}

export function AuthLayout({ 
  children, 
  title, 
  subtitle, 
  toggleText, 
  toggleLink, 
  toggleLinkText 
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-dark-primary flex flex-col justify-center py-4 px-4 sm:py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-accent-primary/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-accent-secondary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 sm:mx-auto w-full sm:max-w-md">
        <Link href="/" className="block">
          <div className="flex justify-center cursor-pointer group">
            <div className="relative">
              <div className="absolute inset-0 bg-accent-primary/20 rounded-full blur-xl animate-glow-pulse" />
              <div className="relative bg-gradient-to-br from-dark-secondary to-dark-tertiary p-3 sm:p-4 rounded-2xl border border-dark-border shadow-glow-cyan">
                <i className="fas fa-robot text-3xl sm:text-4xl text-accent-primary" />
              </div>
            </div>
          </div>
          <h1 className="mt-4 sm:mt-6 text-center text-2xl sm:text-3xl md:text-4xl font-bold">
            <span className="bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary bg-clip-text text-transparent">
              TradingAgentsWeb
            </span>
          </h1>
          <p className="mt-2 text-center text-xs sm:text-sm text-text-tertiary px-2">
            多智能体大语言模型金融交易框架
          </p>
        </Link>
        <h2 className="mt-6 sm:mt-8 text-center text-xl sm:text-2xl md:text-3xl font-extrabold text-text-primary">
          {title}
        </h2>
        <p className="mt-2 text-center text-sm text-text-secondary px-2">
          {subtitle}
        </p>
      </div>

      <div className="relative z-10 mt-6 sm:mt-8 sm:mx-auto w-full sm:max-w-md">
        <div className="bg-dark-secondary/80 backdrop-blur-lg py-6 px-4 sm:py-8 shadow-card-dark border border-dark-border sm:rounded-xl sm:px-10">
          {children}
        </div>
        
        <div className="mt-4 sm:mt-6 text-center px-2">
          <p className="text-sm text-text-secondary">
            {toggleText}{' '}
            <Link 
              href={toggleLink} 
              className="font-medium text-accent-primary hover:text-accent-secondary transition-colors"
            >
              {toggleLinkText}
            </Link>
          </p>
        </div>
      </div>
      
      <div className="relative z-10 mt-6 sm:mt-8 text-center space-y-2 sm:space-y-3 px-4">
        <p className="text-xs text-text-tertiary">
          © {new Date().getFullYear()} SmartAIGC. 保留所有权利
        </p>
        <p className="text-xs text-text-muted">
          基于{' '}
          <a 
            href="https://github.com/TauricResearch/TradingAgents" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-accent-primary hover:text-accent-secondary transition-colors"
          >
            TradingAgents
          </a>{' '}
          构建
        </p>
        <div className="flex items-center justify-center space-x-4 pt-2">
          <a 
            href="https://github.com/BSTester/TradingAgentsWeb" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-text-muted hover:text-accent-primary transition-colors"
            aria-label="GitHub"
          >
            <i className="fab fa-github text-xl" />
          </a>
        </div>
      </div>
    </div>
  );
}
