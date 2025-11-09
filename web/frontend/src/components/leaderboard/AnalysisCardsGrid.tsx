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
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="relative inline-block mb-4">
            {/* Outer ring */}
            <div className="w-16 h-16 border-4 border-accent-primary/20 border-t-accent-primary rounded-full animate-spin"></div>
            {/* Inner ring */}
            <div className="absolute top-2 left-2 w-12 h-12 border-4 border-accent-secondary/20 border-b-accent-secondary rounded-full animate-spin-reverse"></div>
          </div>
          <p className="text-text-primary font-medium">正在加载排行榜数据...</p>
          <p className="text-sm text-text-tertiary mt-2">请稍候</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <i className="fas fa-exclamation-triangle text-4xl text-danger-500 mb-4" />
          <p className="text-text-secondary mb-4">加载排行榜数据失败</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gradient-to-r from-accent-primary to-accent-secondary text-white rounded-lg hover:shadow-glow-cyan transition-all"
          >
            <i className="fas fa-redo mr-2" />
            重试
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!analyses || analyses.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-accent-primary text-6xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-text-primary mb-2">暂无分析记录</h3>
          <p className="text-text-tertiary">该市场还没有完成的分析报告</p>
        </div>
      </div>
    );
  }

  // Normal grid display
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
