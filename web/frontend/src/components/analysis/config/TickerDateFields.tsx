'use client';

import React from 'react';

interface TickerDateFieldsProps {
  ticker: string;
  analysisDate: string;
  tickerError: string;
  onFieldChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function TickerDateFields({ ticker, analysisDate, tickerError, onFieldChange }: TickerDateFieldsProps) {
  return (
    <>
      {/* 步骤1: 股票代码 */}
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
            1
          </div>
          <h4 className="text-lg font-medium text-text-primary">股票代码</h4>
        </div>
        <div className="ml-11">
          <label htmlFor="ticker" className="block text-sm font-medium text-text-secondary mb-2">
            输入要分析的股票代码
          </label>
          <input
            type="text"
            id="ticker"
            name="ticker"
            value={ticker}
            onChange={onFieldChange}
            className={`w-full px-3 py-2 md:py-2 h-12 md:h-auto text-base md:text-sm bg-dark-tertiary text-white border rounded-md focus:outline-none focus:ring-2 focus:border-transparent transition-all ${tickerError
              ? 'border-danger-500 focus:ring-danger-500'
              : 'border-dark-border focus:ring-accent-primary'
              }`}
            placeholder="例如：TSLA, 600519, 00700.HK"
            required
          />
          {tickerError && (
            <div className="mt-2 text-sm text-red-600 whitespace-pre-line">
              <i className="fas fa-exclamation-circle mr-1" />
              {tickerError}
            </div>
          )}
          <p className="text-sm text-text-tertiary mt-2">
            <i className="fas fa-info-circle mr-1" />
            支持美股（如 AAPL）、A股（如 600519）、港股（如 00700.HK）
          </p>
        </div>
      </div>

      {/* 步骤2: 分析日期 */}
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
            2
          </div>
          <h4 className="text-lg font-medium text-text-primary">分析日期</h4>
        </div>
        <div className="ml-11">
          <label htmlFor="analysis_date" className="block text-sm font-medium text-text-secondary mb-2">
            选择分析日期
          </label>
          <input
            type="date"
            id="analysis_date"
            name="analysis_date"
            value={analysisDate}
            onChange={onFieldChange}
            className="w-full px-3 py-2 h-12 md:h-auto text-base md:text-sm bg-dark-tertiary border border-dark-border text-white rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary transition-all"
            required
          />
        </div>
      </div>
    </>
  );
}