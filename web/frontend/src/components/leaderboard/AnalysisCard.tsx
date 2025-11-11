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
      
      <div className="p-4 md:p-6">
        {/* Header: Ticker and Decision */}
        <div className="flex items-start justify-between mb-3 md:mb-4 gap-2">
          {/* Left: Ticker */}
          <div className="flex items-center space-x-2 md:space-x-3 flex-1 min-w-0">
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center text-white font-bold text-base md:text-lg shadow-md flex-shrink-0 bg-gradient-to-br ${getDecisionColor(tradingDecision)}`}>
              {analysis.ticker.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base md:text-xl font-bold text-text-primary truncate">{analysis.ticker}</h3>
              <p className="text-xs md:text-sm text-text-tertiary truncate">
                {analysis.market === 'US' ? '美股' : analysis.market === 'HK' ? '港股' : analysis.market === 'CN' ? 'A股' : analysis.market}
                {analysis.company_name && ` | ${analysis.company_name}`}
              </p>
            </div>
          </div>

          {/* Right: Decision Badge */}
          <div className={`flex items-center px-2 md:px-4 py-1.5 md:py-2 rounded-lg font-bold text-xs md:text-sm shadow-sm text-white bg-gradient-to-br ${getDecisionColor(tradingDecision)} flex-shrink-0`}>
            <i className={`fas ${getDecisionIcon(tradingDecision)} mr-1 md:mr-2`} />
            <span className="hidden sm:inline">{tradingDecision || '未知'}</span>
            <span className="sm:hidden">{(tradingDecision || '未知').substring(0, 2)}</span>
          </div>
        </div>

        {/* Analysis Info */}
        <div className="grid grid-cols-2 gap-2 md:gap-3 mb-3 md:mb-4 text-xs md:text-sm">
          {/* Left: Analysis Date */}
          <div className="flex items-start text-text-tertiary">
            <i className="far fa-calendar mr-1 md:mr-2 flex-shrink-0 text-accent-primary mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs text-text-muted">分析日期</div>
              <div className="font-medium text-text-secondary truncate">{analysis.analysis_date}</div>
            </div>
          </div>

          {/* Right: Completed Time */}
          <div className="flex items-start justify-end text-text-tertiary text-right">
            <div className="min-w-0">
              <div className="text-xs text-text-muted">完成时间</div>
              <div className="font-medium text-text-secondary truncate">{formatDate(analysis.completed_at)}</div>
            </div>
            <i className="far fa-clock ml-1 md:ml-2 flex-shrink-0 text-accent-primary mt-0.5" />
          </div>
        </div>

        {/* View Details Button */}
        <button className={`w-full text-white py-2 md:py-2.5 rounded-lg transition-all font-medium text-sm md:text-base bg-gradient-to-r ${getDecisionColor(tradingDecision)} hover:shadow-glow-cyan group-hover:scale-105 min-h-touch`}>
          <i className="fas fa-chart-line mr-2" />
          查看详情
        </button>
      </div>
    </div>
  );
}
