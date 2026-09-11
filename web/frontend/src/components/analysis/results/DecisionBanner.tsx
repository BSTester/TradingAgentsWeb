'use client';

import React from 'react';

interface DecisionBannerProps {
  market?: string;
  companyName?: string;
  ticker?: string;
  tradingDecision?: string;
}

export function DecisionBanner({ market, companyName, ticker, tradingDecision }: DecisionBannerProps) {
  return (
    <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-xl p-3 md:p-6 text-white shadow-lg">
      <div className="flex items-center justify-between gap-2 md:gap-4">
        {/* 左侧：股票代码 */}
        <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
          <div className="w-10 h-10 md:w-16 md:h-16 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
            <i className="fas fa-chart-line text-lg md:text-3xl" />
          </div>
          <div className="min-w-0">
            <p className="text-xs opacity-90 truncate">
              {market === 'US' ? '美股' : market === 'HK' ? '港股' : market === 'CN' ? 'A股' : '股票'}
              {companyName && ` | ${companyName}`}
            </p>
            <p className="text-xl md:text-3xl font-bold truncate">{ticker}</p>
          </div>
        </div>

        {/* 中间：交易决策 */}
        <div className="flex-1 text-center px-2 md:px-6 min-w-0">
          <p className="text-xs opacity-90 mb-0.5 md:mb-1">最终交易决策</p>
          <p className="text-2xl md:text-5xl font-bold truncate">{tradingDecision}</p>
        </div>

        {/* 右侧：勾选图标 */}
        <div className="w-12 h-12 md:w-20 md:h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center flex-shrink-0">
          <i className="fas fa-check-circle text-2xl md:text-5xl" />
        </div>
      </div>
    </div>
  );
}
