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
            TradingAgents
          </h1>
          <p className="text-xl md:text-2xl mb-3">多智能体大语言模型金融交易框架</p>
          <p className="text-lg md:text-xl mb-6">
            <strong>工作流程：</strong>
            分析师团队 → 研究团队 → 交易员 → 风险管理 → 投资组合分析
          </p>
          <button
            onClick={onNewAnalysis}
            className="bg-white text-blue-600 px-8 py-3 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors shadow-lg"
          >
            <i className="fas fa-plus-circle mr-2" />
            开始新分析
          </button>
        </div>
      </div>
    </div>
  );
}
