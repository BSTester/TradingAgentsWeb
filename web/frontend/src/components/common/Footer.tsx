'use client';

import React from 'react';

export function Footer() {
  return (
    <footer className="bg-dark-secondary border-t border-dark-border mt-auto">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center text-sm text-text-tertiary space-y-2">
          <p className="text-text-secondary">© {new Date().getFullYear()} SmartAIGC. 保留所有权利</p>
          <p>
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
          <div className="flex items-center justify-center space-x-4 mt-4 text-text-muted">
            <a href="https://github.com/BSTester/TradingAgentsWeb" target="_blank" rel="noopener noreferrer" className="hover:text-accent-primary transition-colors">
              <i className="fab fa-github text-lg" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
