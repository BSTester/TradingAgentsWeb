'use client';

import React from 'react';

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

interface AnalysisCardProps {
  analysis: AnalysisCardData;
  onClick: () => void;
  market?: string;
}

export function AnalysisCard({ analysis, onClick, market }: AnalysisCardProps) {
  const tradingDecision = analysis.trading_decision || '';
  
  const getDecisionColor = (decision: string) => {
    const d = (decision || '').toLowerCase();
    if (d.includes('买入') || d.includes('buy')) return 'from-success-500 to-success-600';
    if (d.includes('卖出') || d.includes('sell')) return 'from-danger-500 to-danger-600';
    if (d.includes('持有') || d.includes('观望') || d.includes('hold')) return 'from-warning-500 to-warning-600';
    return 'from-warning-500 to-warning-600';
  };

  const getDecisionIcon = (decision: string) => {
    const d = (decision || '').toLowerCase();
    if (d.includes('买入') || d.includes('buy')) return 'fa-arrow-up';
    if (d.includes('卖出') || d.includes('sell')) return 'fa-arrow-down';
    if (d.includes('持有') || d.includes('观望') || d.includes('hold')) return 'fa-minus';
    return 'fa-question';
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div 
      onClick={onClick}
      className="group bg-dark-secondary rounded-xl border border-dark-border hover:border-accent-primary hover:shadow-glow-cyan transition-all duration-300 cursor-pointer overflow-hidden"
    >
      {/* Top gradient bar */}
      <div className={`h-1 bg-gradient-to-r ${getDecisionColor(tradingDecision)}`} />
      
      <div className="p-6">
        {/* Header: Ticker and Decision */}
        <div className="flex items-start justify-between mb-4">
          {/* Left: Ticker */}
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0 bg-gradient-to-br ${getDecisionColor(tradingDecision)}`}>
              {analysis.ticker.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold text-text-primary">{analysis.ticker}</h3>
              <p className="text-sm text-text-tertiary">
                {analysis.market === 'US' ? '美股' : analysis.market === 'HK' ? '港股' : analysis.market === 'CN' ? 'A股' : analysis.market}
                {analysis.company_name && ` | ${analysis.company_name}`}
              </p>
            </div>
          </div>

          {/* Right: Decision Badge */}
          <div className={`flex items-center px-4 py-2 rounded-lg font-bold text-sm shadow-sm text-white bg-gradient-to-br ${getDecisionColor(tradingDecision)} flex-shrink-0`}>
            <i className={`fas ${getDecisionIcon(tradingDecision)} mr-2`} />
            {tradingDecision || '未知'}
          </div>
        </div>

        {/* Analysis Info */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          {/* Left: Analysis Date */}
          <div className="flex items-center text-text-tertiary">
            <i className="far fa-calendar mr-2 flex-shrink-0 text-accent-primary" />
            <div>
              <div className="text-xs text-text-muted">分析日期</div>
              <div className="font-medium text-text-secondary">{analysis.analysis_date}</div>
            </div>
          </div>

          {/* Right: Completed Time */}
          <div className="flex items-center justify-end text-text-tertiary">
            <i className="far fa-clock mr-2 flex-shrink-0 text-accent-primary" />
            <div>
              <div className="text-xs text-text-muted">完成时间</div>
              <div className="font-medium text-text-secondary">{formatDate(analysis.completed_at)}</div>
            </div>
          </div>
        </div>

        {/* View Details Button */}
        <button className={`w-full text-white py-2 rounded-lg transition-all font-medium bg-gradient-to-r ${getDecisionColor(tradingDecision)} hover:shadow-glow-cyan group-hover:scale-105`}>
          <i className="fas fa-chart-line mr-2" />
          查看详情
        </button>
      </div>
    </div>
  );
}
