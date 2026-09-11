'use client';

import React, { useState } from 'react';

interface TradingExecutorSectionProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  baseUrl: string;
  onBaseUrlChange: (value: string) => void;
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  validated: boolean;
  validating: boolean;
  onValidate: () => void;
}

export function TradingExecutorSection({
  enabled,
  onEnabledChange,
  baseUrl,
  onBaseUrlChange,
  apiKey,
  onApiKeyChange,
  validated,
  validating,
  onValidate,
}: TradingExecutorSectionProps) {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="bg-dark-tertiary rounded-lg border border-dark-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <i className="fas fa-robot text-accent-primary"></i>
            执行交易
          </h4>
          <p className="text-sm text-text-secondary mt-1">
            启用模拟交易执行功能（需要富途 API）。部署模拟交易服务可访问{' '}
            <a 
              href="https://github.com/BSTester/futu-paper-trade-api" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              GitHub
            </a>
            {' '}获取代码
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
      
      {enabled && (
        <div className="space-y-4 pl-6 border-l-2 border-blue-500">
          <div>
            <label htmlFor="futu_api_base_url" className="block text-sm font-medium text-text-secondary mb-2">
              富途 API Base URL
              <span className="text-danger-500 ml-1">*</span>
            </label>
            <input
              type="text"
              id="futu_api_base_url"
              value={baseUrl}
              onChange={(e) => onBaseUrlChange(e.target.value)}
              placeholder="http://localhost:8000"
              className="w-full px-4 py-2 bg-dark-secondary border border-dark-border text-white rounded-lg focus:ring-2 focus:ring-accent-primary focus:border-accent-primary transition-all"
              required={enabled}
            />
          </div>
          
          <div>
            <label htmlFor="futu_api_key" className="block text-sm font-medium text-text-secondary mb-2">
              <i className="fas fa-key mr-1" />
              富途 API Key
              <span className="text-danger-500 ml-1">*</span>
            </label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  id="futu_api_key"
                  value={apiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  placeholder="输入富途 API Key"
                  className="w-full px-3 py-2 bg-dark-secondary border border-dark-border text-white rounded-md focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary transition-all"
                  required={enabled}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  <i className={`fas ${showApiKey ? 'fa-eye-slash' : 'fa-eye'} text-text-tertiary hover:text-accent-primary transition-colors`} />
                </button>
              </div>
              <button
                type="button"
                onClick={onValidate}
                disabled={!baseUrl || !apiKey || validating}
                className={`px-4 py-2 rounded-md border font-medium transition-colors ${
                  validated
                    ? 'bg-success-500/20 border-success-500 text-success-500'
                    : 'bg-dark-tertiary border-dark-border text-text-secondary hover:bg-dark-secondary'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {validating ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-1" />
                    验证中
                  </>
                ) : validated ? (
                  <>
                    <i className="fas fa-check mr-1" />
                    已验证
                </>
              ) : (
                <>
                  <i className="fas fa-check mr-1" />
                  验证
                </>
              )}
              </button>
            </div>
            <p className="text-xs text-text-tertiary mt-1">
              <i className="fas fa-lock mr-1" />
              API Key 将安全地保存在服务器上
            </p>
          </div>
          
          <div className="bg-accent-primary/10 border border-accent-primary/30 rounded-lg p-3">
            <p className="text-sm text-text-secondary">
              <i className="fas fa-info-circle mr-2 text-accent-primary"></i>
              <strong className="text-text-primary">注意：</strong>执行交易将在分析完成后自动执行模拟交易操作，包括投资组合管理、仓位控制和自动止盈止损。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}