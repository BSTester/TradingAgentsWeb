'use client';

import React from 'react';

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} SmartAIGC. 保留所有权利</p>
          <p className="mt-1">
            基于{' '}
            <a
              href="https://github.com/TauricResearch/TradingAgents"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700"
            >
              TradingAgents
            </a>{' '}
            构建
          </p>
        </div>
      </div>
    </footer>
  );
}
