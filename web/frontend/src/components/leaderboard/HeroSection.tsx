'use client';

import React from 'react';

interface HeroSectionProps {
  onNewAnalysis: () => void;
}

export function HeroSection({ onNewAnalysis }: HeroSectionProps) {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <i className="fas fa-robot mr-3" />
            TradingAgentsWeb
          </h1>
          <p className="text-xl md:text-2xl mb-3">多智能体大语言模型金融交易框架</p>
          <p className="text-lg md:text-xl mb-6">
            <strong>工作流程：</strong>
            分析师团队 → 研究团队 → 交易员 → 风险管理 → 投资组合分析
          </p>
          <button
            onClick={onNewAnalysis}
            className="group relative bg-white text-blue-600 px-8 py-3 rounded-lg font-bold text-lg shadow-lg overflow-hidden transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:bg-gradient-to-r hover:from-green-500 hover:to-green-600 hover:text-white"
          >
            {/* 背景光效 */}
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-30 group-hover:animate-shimmer" style={{
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite'
            }} />
            
            {/* 按钮内容 */}
            <span className="relative flex items-center">
              <i className="fas fa-plus-circle mr-2 transition-transform duration-300 group-hover:rotate-90" />
              开始新分析
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
