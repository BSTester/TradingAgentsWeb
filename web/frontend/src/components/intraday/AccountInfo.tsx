'use client';

import React, { useEffect, useState } from 'react';
import { useAccountInfo, intradayTradingKeys } from '@/hooks/useIntradayTrading';
import { useQueryClient } from '@tanstack/react-query';
import { AccountTrendModal } from './AccountTrendModal';

interface AccountInfoProps {
  selectedMarket: string;
  onMarketChange: (market: string) => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function AccountInfo({ selectedMarket, onMarketChange, onShowToast }: AccountInfoProps) {
  const { data: account, isLoading, error, refetch, isFetching } = useAccountInfo(selectedMarket);
  const queryClient = useQueryClient();
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'total_assets' | 'cash' | 'market_value'>('total_assets');

  // Handle refresh - refresh account, positions, and orders
  const handleRefresh = () => {
    refetch();
    // Also refresh positions and orders for the same market
    queryClient.invalidateQueries({ 
      queryKey: [...intradayTradingKeys.positions(), selectedMarket] 
    });
    queryClient.invalidateQueries({ 
      queryKey: [...intradayTradingKeys.orders(), selectedMarket] 
    });
  };

  // Removed auto-refresh - now using WebSocket for real-time updates

  const handleOpenTrendModal = (metric: 'total_assets' | 'cash' | 'market_value') => {
    setSelectedMetric(metric);
    setShowTrendModal(true);
  };

  if (isLoading) {
    return (
      <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-6">
        <div className="flex items-center justify-center">
          <i className="fas fa-spinner fa-spin text-2xl text-accent-primary mr-3" />
          <span className="text-text-secondary">加载账户信息...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-6">
        <div className="flex items-center justify-center text-danger-500">
          <i className="fas fa-exclamation-triangle mr-2" />
          <span>加载账户信息失败</span>
        </div>
      </div>
    );
  }

  const totalAssets = account?.total_assets || 0;
  const cash = account?.cash || 0;
  const positionValue = account?.position_value || 0;
  const todayProfitLoss = account?.today_profit_loss || 0;
  const todayProfitLossRatio = account?.today_profit_loss_ratio || 0;
  
  // Determine currency based on market type
  const getCurrencySymbol = (market: string) => {
    switch (market.toUpperCase()) {
      case 'US':
        return '$';
      case 'HK':
        return 'HK$';
      case 'CN':
        return '¥';
      default:
        return '$';
    }
  };
  const currency = getCurrencySymbol(selectedMarket);
  
  const positionRatio = totalAssets > 0 ? (positionValue / totalAssets) * 100 : 0;

  return (
    <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border">
      <div className="px-6 py-4 border-b border-dark-border">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary">
            <i className="fas fa-wallet mr-2 text-accent-secondary" />
            账户信息
          </h2>
          <div className="flex items-center space-x-3">
            <select
              value={selectedMarket}
              onChange={(e) => onMarketChange(e.target.value)}
              className="px-3 py-1 bg-dark-tertiary border border-dark-border text-text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
            >
              <option value="US" className="bg-dark-tertiary text-text-primary">美股</option>
              <option value="HK" className="bg-dark-tertiary text-text-primary">港股</option>
              <option value="CN" className="bg-dark-tertiary text-text-primary">A股</option>
            </select>
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              className="text-sm text-accent-primary hover:text-accent-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              title="刷新账户、持仓和订单信息"
            >
              <i className={`fas fa-sync-alt mr-1 ${isFetching ? 'fa-spin' : ''}`} />
              {isFetching ? '刷新中...' : '刷新'}
            </button>
          </div>
        </div>
      </div>
      <div className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* Total Assets */}
          <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-lg p-4 md:p-6 border border-blue-500/30 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-400">总资产</span>
              <i className="fas fa-chart-pie text-2xl text-blue-500" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-text-primary flex-1">
              {currency}{totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="flex items-center justify-between mt-1">
              <p className={`text-xs md:text-sm ${todayProfitLoss >= 0 ? 'text-[#f03a55]' : 'text-[#00a870]'}`}>
                {todayProfitLoss >= 0 ? '+' : ''}{currency}{todayProfitLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({todayProfitLoss >= 0 ? '+' : ''}{(todayProfitLossRatio * 100).toFixed(2)}%)
              </p>
              <button
                onClick={() => handleOpenTrendModal('total_assets')}
                className="text-blue-400 hover:text-blue-300 transition-colors p-2 hover:bg-blue-900/30 rounded-md"
                title="查看趋势图"
              >
                <i className="fas fa-chart-line text-sm md:text-base" />
              </button>
            </div>
          </div>

          {/* Available Cash */}
          <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-lg p-4 md:p-6 border border-green-500/30 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-400">可用资金</span>
              <i className="fas fa-money-bill-wave text-2xl text-green-500" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-text-primary flex-1">
              {currency}{cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs md:text-sm text-green-400">
                {totalAssets > 0 ? ((cash / totalAssets) * 100).toFixed(1) : 0}% 现金比例
              </p>
              <button
                onClick={() => handleOpenTrendModal('cash')}
                className="text-green-400 hover:text-green-300 transition-colors p-2 hover:bg-green-900/30 rounded-md"
                title="查看趋势图"
              >
                <i className="fas fa-chart-line text-sm md:text-base" />
              </button>
            </div>
          </div>

          {/* Position Value */}
          <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-lg p-4 md:p-6 border border-purple-500/30 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-purple-400">持仓市值</span>
              <i className="fas fa-briefcase text-2xl text-purple-500" />
            </div>
            <p className="text-2xl md:text-3xl font-bold text-text-primary flex-1">
              {currency}{positionValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs md:text-sm text-purple-400">
                {positionRatio.toFixed(1)}% 仓位占比
              </p>
              <button
                onClick={() => handleOpenTrendModal('market_value')}
                className="text-purple-400 hover:text-purple-300 transition-colors p-2 hover:bg-purple-900/30 rounded-md"
                title="查看趋势图"
              >
                <i className="fas fa-chart-line text-sm md:text-base" />
              </button>
            </div>
          </div>
        </div>

        {/* Position Ratio Warning */}
        {positionRatio > 90 && (
          <div className="mt-4 bg-danger-900/20 border border-danger-500/30 rounded-lg p-4">
            <div className="flex items-start">
              <i className="fas fa-exclamation-triangle text-danger-500 mt-1 mr-3" />
              <div>
                <p className="text-sm font-medium text-danger-400">仓位预警</p>
                <p className="text-sm text-text-secondary mt-1">
                  当前仓位占比 {positionRatio.toFixed(1)}% 已超过90%，建议控制仓位风险
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trend Modal */}
      {showTrendModal && (
        <AccountTrendModal
          marketType={selectedMarket}
          metric={selectedMetric}
          onClose={() => setShowTrendModal(false)}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}
