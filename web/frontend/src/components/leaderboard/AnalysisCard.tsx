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
  const getDecisionColor = (decision: string) => {
    const d = decision.toLowerCase();
    if (d.includes('买入') || d.includes('buy')) return 'text-white bg-red-500 border border-red-600';
    if (d.includes('卖出') || d.includes('sell')) return 'text-white bg-green-500 border border-green-600';
    if (d.includes('持有') || d.includes('观望') || d.includes('hold')) return 'text-white bg-yellow-500 border border-yellow-600';
    return 'text-white bg-yellow-500 border border-yellow-600';
  };

  const getDecisionIcon = (decision: string) => {
    const d = decision.toLowerCase();
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
      {/* 顶部渐变条 */}
      <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 group-hover:from-blue-600 group-hover:to-purple-600 transition-all" />
      
      <div className="p-6">
        {/* 顶部：股票代码和交易决策 */}
        <div className="flex items-start justify-between mb-4">
          {/* 左侧：股票代码 */}
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0">
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
          <div className={`flex items-center px-4 py-2 rounded-lg font-bold text-sm shadow-sm ${getDecisionColor(analysis.trading_decision)} flex-shrink-0`}>
            <i className={`fas ${getDecisionIcon(analysis.trading_decision)} mr-2`} />
            {analysis.trading_decision}
          </div>
        </div>

        {/* 分析信息：左右分布 */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          {/* 左侧：分析日期 */}
          <div className="flex items-center text-gray-600">
            <i className="far fa-calendar mr-2 text-blue-500 flex-shrink-0" />
            <div>
              <div className="text-xs text-gray-500">分析日期</div>
              <div className="font-medium text-gray-900">{analysis.analysis_date}</div>
            </div>
          </div>

          {/* 右侧：完成时间 */}
          <div className="flex items-center justify-end text-gray-600">
            <i className="far fa-clock mr-2 text-green-500 flex-shrink-0" />
            <div>
              <div className="text-xs text-gray-500">完成时间</div>
              <div className="font-medium text-gray-900">{formatDate(analysis.completed_at)}</div>
            </div>
          </div>
        </div>

        {/* 查看详情按钮 */}
        <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium group-hover:bg-blue-700">
          <i className="fas fa-chart-line mr-2" />
          查看详情
        </button>
      </div>
    </div>
  );
}
