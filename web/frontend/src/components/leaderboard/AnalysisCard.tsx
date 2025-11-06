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
  market?: string; // 添加市场参数，用于返回时定位
}

export function AnalysisCard({ analysis, onClick, market }: AnalysisCardProps) {
  // 安全获取交易决策，处理 null/undefined 情况
  const tradingDecision = analysis.trading_decision || '';
  
  const getDecisionColor = (decision: string) => {
    const d = (decision || '').toLowerCase();
    if (d.includes('买入') || d.includes('buy')) return 'text-white bg-gradient-to-br from-[#f03a55] to-[#d91744] border border-[#f03a55] shadow-red-200';
    if (d.includes('卖出') || d.includes('sell')) return 'text-white bg-gradient-to-br from-[#00a870] to-[#008c5e] border border-[#00a870] shadow-green-200';
    if (d.includes('持有') || d.includes('观望') || d.includes('hold')) return 'text-white bg-gradient-to-br from-yellow-500 to-yellow-600 border border-yellow-600 shadow-yellow-200';
    return 'text-white bg-gradient-to-br from-yellow-500 to-yellow-600 border border-yellow-600 shadow-yellow-200';
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
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 overflow-hidden group"
    >
      {/* 顶部渐变条 - 根据交易决策显示不同颜色 */}
      <div className={`h-2 transition-all ${
        tradingDecision.toLowerCase().includes('买入') || tradingDecision.toLowerCase().includes('buy')
          ? 'bg-gradient-to-r from-[#f03a55] to-[#d91744] group-hover:from-[#d91744] group-hover:to-[#c01535]'
          : tradingDecision.toLowerCase().includes('卖出') || tradingDecision.toLowerCase().includes('sell')
          ? 'bg-gradient-to-r from-[#00a870] to-[#008c5e] group-hover:from-[#008c5e] group-hover:to-[#00704c]'
          : 'bg-gradient-to-r from-yellow-500 to-yellow-600 group-hover:from-yellow-600 group-hover:to-yellow-700'
      }`} />
      
      <div className="p-6">
        {/* 顶部：股票代码和交易决策 */}
        <div className="flex items-start justify-between mb-4">
          {/* 左侧：股票代码 */}
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0 ${
              tradingDecision.toLowerCase().includes('买入') || tradingDecision.toLowerCase().includes('buy')
                ? 'bg-gradient-to-br from-[#f03a55] to-[#d91744]'
                : tradingDecision.toLowerCase().includes('卖出') || tradingDecision.toLowerCase().includes('sell')
                ? 'bg-gradient-to-br from-[#00a870] to-[#008c5e]'
                : 'bg-gradient-to-br from-yellow-500 to-yellow-600'
            }`}>
              {analysis.ticker.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{analysis.ticker}</h3>
              <p className="text-sm text-gray-500">
                {analysis.market === 'US' ? '美股' : analysis.market === 'HK' ? '港股' : analysis.market === 'CN' ? 'A股' : analysis.market}
                {analysis.company_name && ` | ${analysis.company_name}`}
              </p>
            </div>
          </div>

          {/* 右侧：交易决策 */}
          <div className={`flex items-center px-4 py-2 rounded-lg font-bold text-sm shadow-sm ${getDecisionColor(tradingDecision)} flex-shrink-0`}>
            <i className={`fas ${getDecisionIcon(tradingDecision)} mr-2`} />
            {tradingDecision || '未知'}
          </div>
        </div>

        {/* 分析信息：左右分布 */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          {/* 左侧：分析日期 */}
          <div className="flex items-center text-gray-600">
            <i className={`far fa-calendar mr-2 flex-shrink-0 ${
              tradingDecision.toLowerCase().includes('买入') || tradingDecision.toLowerCase().includes('buy')
                ? 'text-[#f03a55]'
                : tradingDecision.toLowerCase().includes('卖出') || tradingDecision.toLowerCase().includes('sell')
                ? 'text-[#00a870]'
                : 'text-yellow-500'
            }`} />
            <div>
              <div className="text-xs text-gray-500">分析日期</div>
              <div className="font-medium text-gray-900">{analysis.analysis_date}</div>
            </div>
          </div>

          {/* 右侧：完成时间 */}
          <div className="flex items-center justify-end text-gray-600">
            <i className={`far fa-clock mr-2 flex-shrink-0 ${
              tradingDecision.toLowerCase().includes('买入') || tradingDecision.toLowerCase().includes('buy')
                ? 'text-[#f03a55]'
                : tradingDecision.toLowerCase().includes('卖出') || tradingDecision.toLowerCase().includes('sell')
                ? 'text-[#00a870]'
                : 'text-yellow-500'
            }`} />
            <div>
              <div className="text-xs text-gray-500">完成时间</div>
              <div className="font-medium text-gray-900">{formatDate(analysis.completed_at)}</div>
            </div>
          </div>
        </div>

        {/* 查看详情按钮 - 根据交易决策显示不同颜色 */}
        <button className={`w-full text-white py-2 rounded-lg transition-colors font-medium ${
          tradingDecision.toLowerCase().includes('买入') || tradingDecision.toLowerCase().includes('buy')
            ? 'bg-[#f03a55] hover:bg-[#d91744] group-hover:bg-[#d91744]'
            : tradingDecision.toLowerCase().includes('卖出') || tradingDecision.toLowerCase().includes('sell')
            ? 'bg-[#00a870] hover:bg-[#008c5e] group-hover:bg-[#008c5e]'
            : 'bg-yellow-600 hover:bg-yellow-700 group-hover:bg-yellow-700'
        }`}>
          <i className="fas fa-chart-line mr-2" />
          查看详情
        </button>
      </div>
    </div>
  );
}
