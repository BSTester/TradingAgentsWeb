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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-full shadow-lg">
            <i className="fas fa-robot text-white text-3xl" />
          </div>
        </div>
        <h1 className="mt-4 text-center text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          TradingAgents
        </h1>
        <p className="mt-1 text-center text-sm text-gray-500">
          多智能体大语言模型金融交易框架
        </p>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {title}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {subtitle}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {children}
        </div>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {toggleText}{' '}
            <Link 
              href={toggleLink} 
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              {toggleLinkText}
            </Link>
          </p>
        </div>
      </div>
      
      <div className="mt-8 text-center space-y-2">
        <p className="text-xs text-gray-500">
          © {new Date().getFullYear()} SmartAIGC. 保留所有权利
        </p>
        <p className="text-xs text-gray-400">
          基于 <a href="https://github.com/TauricResearch/TradingAgents" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">TradingAgents</a> 构建
        </p>
      </div>
    </div>
  );
}