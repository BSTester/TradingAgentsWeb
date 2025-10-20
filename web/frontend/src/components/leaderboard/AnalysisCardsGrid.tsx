'use client';

import React from 'react';
import { AnalysisCard } from './AnalysisCard';

interface AnalysisCardData {
  analysis_id: string;
  ticker: string;
  company_name?: string;
  market: string;
  analysis_date: string;
  trading_decision: string;
  completed_at: string;
  progress_percentage: number;
}

interface AnalysisCardsGridProps {
  analyses: AnalysisCardData[];
  isLoading: boolean;
  isError: boolean;
  onCardClick: (analysisId: string) => void;
}

export function AnalysisCardsGrid({ analyses, isLoading, isError, onCardClick }: AnalysisCardsGridProps) {
  // 加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4" />
          <p className="text-gray-600">正在加载排行榜数据...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (isError) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <i className="fas fa-exclamation-triangle text-4xl text-red-600 mb-4" />
          <p className="text-gray-600 mb-4">加载排行榜数据失败</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <i className="fas fa-redo mr-2" />
            重试
          </button>
        </div>
      </div>
    );
  }

  // 空数据状态
  if (!analyses || analyses.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无分析记录</h3>
          <p className="text-gray-600">该市场还没有完成的分析报告</p>
        </div>
      </div>
    );
  }

  // 正常显示卡片网格
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {analyses.map((analysis) => (
        <AnalysisCard
          key={analysis.analysis_id}
          analysis={analysis}
          market={analysis.market}
          onClick={() => onCardClick(analysis.analysis_id)}
        />
      ))}
    </div>
  );
}
