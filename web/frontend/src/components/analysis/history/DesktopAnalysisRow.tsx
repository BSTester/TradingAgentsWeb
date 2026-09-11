'use client';

import React from 'react';

interface AnalysisRecord {
  id: string;
  ticker: string;
  company_name?: string;
  market?: string;
  analysis_date: string;
  status: string;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  is_public: boolean;
  summary?: {
    recommendation?: string;
  };
}

interface DesktopAnalysisRowProps {
  analysis: AnalysisRecord;
  onViewResults: (analysisId: string) => void;
  onViewProgress: (analysisId: string) => void;
  onDelete: (analysisId: string, ticker: string) => void;
  isDeleting: boolean;
}

export function DesktopAnalysisRow({ analysis, onViewResults, onViewProgress, onDelete, isDeleting }: DesktopAnalysisRowProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      case 'interrupted':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-dark-tertiary text-text-secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'queued':
        return '排队中';
      case 'initializing':
        return '初始化中';
      case 'running':
        return '分析中';
      case 'completed':
        return '已完成';
      case 'error':
        return '错误';
      case 'interrupted':
        return '已中断';
      default:
        return status;
    }
  };

  const getRecommendationColor = (recommendation?: string) => {
    const rec = recommendation?.trim().toLowerCase();
    switch (rec) {
      case '买入':
      case 'buy':
        return 'text-white bg-gradient-to-br from-[#f03a55] to-[#d91744] shadow-md';
      case '持有':
      case '观望':
      case 'hold':
        return 'text-white bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-md';
      case '卖出':
      case 'sell':
        return 'text-white bg-gradient-to-br from-[#00a870] to-[#008c5e] shadow-md';
      default:
        return 'text-white bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-md';
    }
  };

  const getRecommendationIcon = (recommendation?: string) => {
    const rec = recommendation?.trim().toLowerCase();
    switch (rec) {
      case '买入':
      case 'buy':
        return 'fa-arrow-up';
      case '持有':
      case '观望':
      case 'hold':
        return 'fa-minus';
      case '卖出':
      case 'sell':
        return 'fa-arrow-down';
      default:
        return 'fa-question';
    }
  };

  return (
    <div
      className="border border-dark-border rounded-lg p-3 hover:shadow-glow-cyan hover:border-accent-primary transition-all duration-200 bg-dark-tertiary relative overflow-hidden"
    >
      {/* 右上角公开标记 - 三角形角标 */}
      {analysis.is_public && (
        <div className="absolute top-0 right-0 w-0 h-0 border-t-[40px] border-t-blue-500 border-l-[40px] border-l-transparent">
          <i className="fas fa-globe absolute -top-[32px] right-[4px] text-white text-xs" title="公开" />
        </div>
      )}

      {/* 五列布局：股票代码 | 投资建议 | 分析日期 | 创建时间 | 操作按钮 */}
      <div className="flex items-center gap-4">
        {/* 第1列：股票代码 - 左对齐 */}
        <div className="flex items-center justify-start space-x-2 flex-1 text-sm">
          <div className={`text-white w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-md ${analysis.summary?.recommendation?.toLowerCase().includes('买入') || analysis.summary?.recommendation?.toLowerCase().includes('buy')
            ? 'bg-gradient-to-br from-[#f03a55] to-[#d91744]'
            : analysis.summary?.recommendation?.toLowerCase().includes('卖出') || analysis.summary?.recommendation?.toLowerCase().includes('sell')
              ? 'bg-gradient-to-br from-[#00a870] to-[#008c5e]'
              : analysis.summary?.recommendation
                ? 'bg-gradient-to-br from-yellow-500 to-yellow-600'
                : 'bg-gradient-to-br from-gray-500 to-gray-600'
            }`}>
            {analysis.ticker.substring(0, 2)}
          </div>
          <div className="flex flex-col">
            <h4 className="text-sm font-bold text-text-primary">
              {analysis.ticker}{analysis.company_name && ` (${analysis.company_name})`}
            </h4>
            <div className="flex items-center space-x-2">
              {analysis.market && (
                <span className="text-xs text-text-tertiary">
                  {analysis.market === 'US' ? '美股' : analysis.market === 'HK' ? '港股' : 'A股'}
                </span>
              )}
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(analysis.status)} text-center`}>
                {getStatusLabel(analysis.status)}
              </span>
            </div>
          </div>
        </div>

        {/* 第2列：投资建议 - 自动平分 */}
        <div className="flex items-center justify-center flex-1 text-sm">
          {analysis.summary && analysis.status === 'completed' && (
            <span className={`px-3 py-1.5 rounded-lg font-bold text-sm flex items-center ${getRecommendationColor(analysis.summary.recommendation)}`}>
              <i className={`fas ${getRecommendationIcon(analysis.summary.recommendation)} mr-1.5 text-sm`} />
              {analysis.summary.recommendation}
            </span>
          )}
          {analysis.status === 'running' && (
            <div className="flex items-center text-blue-600 font-medium text-sm">
              <i className="fas fa-spinner fa-spin mr-1.5 text-sm" />
              <span>{analysis.progress_percentage.toFixed(0)}%</span>
            </div>
          )}
        </div>

        {/* 第3列：分析日期 - 上下排列 */}
        <div className="flex items-center justify-center text-sm flex-1">
          <i className={`far fa-calendar mr-1.5 text-xs ${analysis.summary?.recommendation?.toLowerCase().includes('买入') || analysis.summary?.recommendation?.toLowerCase().includes('buy')
            ? 'text-[#f03a55]'
            : analysis.summary?.recommendation?.toLowerCase().includes('卖出') || analysis.summary?.recommendation?.toLowerCase().includes('sell')
              ? 'text-[#00a870]'
              : analysis.summary?.recommendation
                ? 'text-yellow-500'
                : 'text-gray-500'
            }`} />
          <div className="flex flex-col">
            <span className="text-xs text-text-tertiary">分析日期</span>
            <span className="text-xs font-medium text-text-primary">{analysis.analysis_date}</span>
          </div>
        </div>

        {/* 第4列：创建时间 - 上下排列 */}
        <div className="flex items-center justify-center text-sm flex-1">
          <i className={`far fa-clock mr-1.5 text-xs ${analysis.summary?.recommendation?.toLowerCase().includes('买入') || analysis.summary?.recommendation?.toLowerCase().includes('buy')
            ? 'text-[#f03a55]'
            : analysis.summary?.recommendation?.toLowerCase().includes('卖出') || analysis.summary?.recommendation?.toLowerCase().includes('sell')
              ? 'text-[#00a870]'
              : analysis.summary?.recommendation
                ? 'text-yellow-500'
                : 'text-gray-500'
            }`} />
          <div className="flex flex-col">
            <span className="text-xs text-text-tertiary">创建时间</span>
            <span className="text-xs font-medium text-text-primary">{new Date(analysis.created_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {/* 第5列：完成时间 - 上下排列 */}
        <div className="flex items-center justify-center text-sm flex-1">
          {analysis.completed_at ? (
            <>
              <i className={`fas fa-check-circle mr-1.5 text-xs ${analysis.summary?.recommendation?.toLowerCase().includes('买入') || analysis.summary?.recommendation?.toLowerCase().includes('buy')
                ? 'text-[#f03a55]'
                : analysis.summary?.recommendation?.toLowerCase().includes('卖出') || analysis.summary?.recommendation?.toLowerCase().includes('sell')
                  ? 'text-[#00a870]'
                  : analysis.summary?.recommendation
                    ? 'text-yellow-500'
                    : 'text-gray-500'
                }`} />
              <div className="flex flex-col">
                <span className="text-xs text-text-tertiary">完成时间</span>
                <span className="text-xs font-medium text-text-primary">{new Date(analysis.completed_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </>
          ) : (
            <span className="text-xs text-text-muted">-</span>
          )}
        </div>

        {/* 第6列：操作按钮 - 自动平分 */}
        <div className="flex items-center justify-center space-x-2 flex-1">
          {analysis.status === 'completed' && (
            <button
              onClick={() => onViewResults(analysis.id)}
              className={`px-3 py-1.5 text-white rounded-md text-sm font-medium transition-colors flex items-center shadow-md ${analysis.summary?.recommendation?.toLowerCase().includes('买入') || analysis.summary?.recommendation?.toLowerCase().includes('buy')
                ? 'bg-[#f03a55] hover:bg-[#d91744]'
                : analysis.summary?.recommendation?.toLowerCase().includes('卖出') || analysis.summary?.recommendation?.toLowerCase().includes('sell')
                  ? 'bg-[#00a870] hover:bg-[#008c5e]'
                  : analysis.summary?.recommendation
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : 'bg-gray-600 hover:bg-gray-700'
                }`}
            >
              <i className="fas fa-chart-line mr-1.5 text-sm" />
              查看详情
            </button>
          )}

          {analysis.status === 'running' && (
            <button
              onClick={() => onViewProgress(analysis.id)}
              className="px-3 py-1.5 bg-dark-secondary text-text-secondary rounded-md text-sm font-medium hover:bg-dark-primary hover:text-text-primary transition-colors flex items-center"
            >
              <i className="fas fa-tasks mr-1.5 text-sm" />
              查看进度
            </button>
          )}

          <button
            onClick={() => onDelete(analysis.id, analysis.ticker)}
            disabled={analysis.status === 'running' || analysis.status === 'initializing' || isDeleting}
            className="px-2 py-1.5 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <i className="fas fa-spinner fa-spin mr-1.5 text-sm" />
                删除中
              </>
            ) : (
              <>
                <i className="fas fa-trash-alt mr-1.5 text-sm" />
                删除
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}