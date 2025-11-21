'use client';

import React from 'react';

interface Analysis {
  id: string;
  ticker: string;
  company_name?: string;
  market?: string;
  analysis_date: string;
  status: string;
  progress_percentage: number;
  created_at: string;
  completed_at?: string;
  is_public: boolean;
  summary?: {
    recommendation?: string;
  };
}

interface ResponsiveAnalysisCardProps {
  analysis: Analysis;
  onViewResults: (id: string) => void;
  onViewProgress: (id: string) => void;
  onDelete: (id: string, ticker: string) => void;
  isDeleting: boolean;
}

export function ResponsiveAnalysisCard({
  analysis,
  onViewResults,
  onViewProgress,
  onDelete,
  isDeleting
}: ResponsiveAnalysisCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'queued': return 'bg-yellow-100 text-yellow-800';
      case 'interrupted': return 'bg-orange-100 text-orange-800';
      default: return 'bg-dark-tertiary text-text-secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      queued: '排队中',
      initializing: '初始化中',
      running: '分析中',
      completed: '已完成',
      error: '错误',
      interrupted: '已中断'
    };
    return labels[status] || status;
  };

  const getRecommendationColor = (rec?: string) => {
    const r = rec?.trim().toLowerCase();
    if (r === '买入' || r === 'buy') return 'text-white bg-gradient-to-br from-[#f03a55] to-[#d91744]';
    if (r === '卖出' || r === 'sell') return 'text-white bg-gradient-to-br from-[#00a870] to-[#008c5e]';
    if (rec) return 'text-white bg-gradient-to-br from-yellow-500 to-yellow-600';
    return 'text-white bg-gradient-to-br from-gray-500 to-gray-600';
  };

  const getRecommendationIcon = (rec?: string) => {
    const r = rec?.trim().toLowerCase();
    if (r === '买入' || r === 'buy') return 'fa-arrow-up';
    if (r === '卖出' || r === 'sell') return 'fa-arrow-down';
    if (r === '持有' || r === '观望' || r === 'hold') return 'fa-minus';
    return 'fa-question';
  };

  return (
    <div className="bg-dark-tertiary rounded-lg border border-dark-border p-4 hover:shadow-glow-cyan hover:border-accent-primary transition-all duration-200 relative overflow-hidden">
      {/* Public badge */}
      {analysis.is_public && (
        <div className="absolute top-0 right-0 w-0 h-0 border-t-[40px] border-t-blue-500 border-l-[40px] border-l-transparent">
          <i className="fas fa-globe absolute -top-[32px] right-[4px] text-white text-xs" title="公开" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3 flex-1">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-md ${getRecommendationColor(analysis.summary?.recommendation)}`}>
            {analysis.ticker.substring(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-responsive-h4 text-text-primary truncate">
              {analysis.ticker}
              {analysis.company_name && ` (${analysis.company_name})`}
            </h4>
            <div className="flex items-center space-x-2 mt-1">
              {analysis.market && (
                <span className="text-xs text-text-tertiary">
                  {analysis.market === 'US' ? '美股' : analysis.market === 'HK' ? '港股' : 'A股'}
                </span>
              )}
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(analysis.status)}`}>
                {getStatusLabel(analysis.status)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-text-tertiary mb-1">投资建议</p>
          {analysis.summary && analysis.status === 'completed' ? (
            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg font-bold text-sm ${getRecommendationColor(analysis.summary.recommendation)}`}>
              <i className={`fas ${getRecommendationIcon(analysis.summary.recommendation)} mr-1.5 text-sm`} />
              {analysis.summary.recommendation}
            </span>
          ) : analysis.status === 'running' ? (
            <div className="flex items-center text-blue-600 font-medium text-sm">
              <i className="fas fa-spinner fa-spin mr-1.5" />
              {analysis.progress_percentage.toFixed(0)}%
            </div>
          ) : (
            <span className="text-sm text-text-muted">-</span>
          )}
        </div>
        <div>
          <p className="text-xs text-text-tertiary mb-1">分析日期</p>
          <p className="text-sm font-semibold text-text-primary">{analysis.analysis_date}</p>
        </div>
      </div>

      {/* Timestamps */}
      <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
        <div>
          <p className="text-text-tertiary mb-1">创建时间</p>
          <p className="text-text-primary">{new Date(analysis.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        {analysis.completed_at && (
          <div>
            <p className="text-text-tertiary mb-1">完成时间</p>
            <p className="text-text-primary">{new Date(analysis.completed_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t border-dark-border">
        {analysis.status === 'completed' && (
          <button
            onClick={() => onViewResults(analysis.id)}
            className={`flex-1 px-4 py-2.5 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center shadow-md min-h-touch ${getRecommendationColor(analysis.summary?.recommendation).replace('text-white ', '')}`}
          >
            <i className="fas fa-chart-line mr-2" />
            查看详情
          </button>
        )}
        {analysis.status === 'running' && (
          <button
            onClick={() => onViewProgress(analysis.id)}
            className="flex-1 px-4 py-2.5 bg-dark-secondary text-text-secondary rounded-lg text-sm font-medium hover:bg-dark-primary hover:text-text-primary transition-colors flex items-center justify-center min-h-touch"
          >
            <i className="fas fa-tasks mr-2" />
            查看进度
          </button>
        )}
        <button
          onClick={() => onDelete(analysis.id, analysis.ticker)}
          disabled={analysis.status === 'running' || analysis.status === 'initializing' || isDeleting}
          className="px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed min-h-touch"
        >
          {isDeleting ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2" />
              删除中
            </>
          ) : (
            <>
              <i className="fas fa-trash-alt mr-2" />
              删除
            </>
          )}
        </button>
      </div>
    </div>
  );
}
