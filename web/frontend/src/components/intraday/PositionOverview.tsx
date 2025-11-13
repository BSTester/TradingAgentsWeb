'use client';

import React, { useState } from 'react';
import { usePositions } from '@/hooks/useIntradayTrading';

interface PositionOverviewProps {
  selectedMarket: string;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type SortField = 'stock_code' | 'holding_days' | 'pnl_percent' | 'position_ratio';
type SortOrder = 'asc' | 'desc';

export function PositionOverview({ selectedMarket, onShowToast }: PositionOverviewProps) {
  const { data: positions, isLoading, error } = usePositions(selectedMarket);
  const [sortField, setSortField] = useState<SortField>('stock_code');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-6">
        <div className="flex items-center justify-center">
          <i className="fas fa-spinner fa-spin text-2xl text-accent-primary mr-3" />
          <span className="text-text-secondary">加载持仓信息...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-6">
        <div className="flex items-center justify-center text-danger-500">
          <i className="fas fa-exclamation-triangle mr-2" />
          <span>加载持仓信息失败</span>
        </div>
      </div>
    );
  }

  // Sort positions (no need to filter by market since API already filters)
  let filteredPositions = [...(positions || [])].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === 'stock_code') {
      aVal = aVal.toString();
      bVal = bVal.toString();
    }

    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  // Group by market
  const groupedPositions = filteredPositions.reduce((acc, pos) => {
    const market = pos.market_type;
    if (!acc[market]) {
      acc[market] = [];
    }
    acc[market].push(pos);
    return acc;
  }, {} as Record<string, typeof filteredPositions>);

  const marketLabels: Record<string, string> = {
    US: '美股',
    HK: '港股',
    CN: 'A股',
  };

  const getMarketBadgeColor = (market: string) => {
    switch (market?.toUpperCase()) {
      case 'US':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/50';
      case 'HK':
        return 'bg-purple-500/20 text-purple-400 border border-purple-500/50';
      case 'CN':
        return 'bg-red-500/20 text-red-400 border border-red-500/50';
      default:
        return 'bg-gray-500/20 text-gray-400 border border-gray-500/50';
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <i className="fas fa-sort text-text-muted ml-1" />;
    }
    return sortOrder === 'asc' ? (
      <i className="fas fa-sort-up text-accent-primary ml-1" />
    ) : (
      <i className="fas fa-sort-down text-accent-primary ml-1" />
    );
  };

  return (
    <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border">
      <div className="px-6 py-4 border-b border-dark-border">
        <h2 className="text-xl font-bold text-text-primary">
          <i className="fas fa-list mr-2 text-green-600" />
          持仓概览
        </h2>
      </div>
      <div className="p-4 md:p-6">
        {filteredPositions.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-inbox text-6xl text-text-muted mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">暂无持仓</h3>
            <p className="text-text-secondary">
              当前没有持仓股票
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-dark-border">
              <thead className="bg-dark-tertiary">
                <tr>
                  <th
                    onClick={() => handleSort('stock_code')}
                    className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-tight cursor-pointer hover:bg-dark-primary whitespace-nowrap"
                  >
                    <div className="flex items-center">
                      股票代码
                      {getSortIcon('stock_code')}
                    </div>
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-tight whitespace-nowrap">
                    市场
                  </th>
                  <th
                    onClick={() => handleSort('holding_days')}
                    className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-tight cursor-pointer hover:bg-dark-primary whitespace-nowrap"
                  >
                    <div className="flex items-center">
                      持仓天数
                      {getSortIcon('holding_days')}
                    </div>
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-tight whitespace-nowrap">
                    数量
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-tight whitespace-nowrap">
                    成本价
                  </th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-tight whitespace-nowrap">
                    当前价
                  </th>
                  <th
                    onClick={() => handleSort('pnl_percent')}
                    className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-tight cursor-pointer hover:bg-dark-primary whitespace-nowrap"
                  >
                    <div className="flex items-center">
                      盈亏
                      {getSortIcon('pnl_percent')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('position_ratio')}
                    className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-tight cursor-pointer hover:bg-dark-primary whitespace-nowrap"
                  >
                    <div className="flex items-center">
                      仓位占比
                      {getSortIcon('position_ratio')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-dark-secondary divide-y divide-dark-border">
                {filteredPositions.map((position, index) => (
                      <tr key={`${position.stock_code}-${index}`} className="hover:bg-dark-tertiary transition-colors">
                        <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap">
                          <div className="text-xs md:text-sm font-medium text-text-primary">
                            {position.stock_code}
                          </div>
                          {position.stock_name && (
                            <div className="text-xs text-text-tertiary hidden md:block">
                              {position.stock_name}
                            </div>
                          )}
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-1 md:px-2 py-0.5 md:py-1 rounded text-xs font-medium ${getMarketBadgeColor(position.market_type)}`}>
                            {position.market_type}
                          </span>
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap text-xs md:text-sm text-text-primary">
                          {position.holding_days || 0} 天
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap text-xs md:text-sm text-text-primary">
                          {position.quantity?.toLocaleString() || 0}
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap text-xs md:text-sm text-text-primary">
                          {currency}{position.cost_price?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap text-xs md:text-sm text-text-primary">
                          {currency}{position.current_price?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap">
                          <div className="text-xs md:text-sm">
                            <div className={`font-medium ${(position.pnl || 0) >= 0 ? 'text-[#f03a55]' : 'text-[#00a870]'}`}>
                              {(position.pnl || 0) >= 0 ? '+' : ''}{currency}{(position.pnl || 0).toFixed(2)}
                            </div>
                            <div className={`text-xs ${(position.pnl_percent || 0) >= 0 ? 'text-[#f03a55]' : 'text-[#00a870]'}`}>
                              {(position.pnl_percent || 0) >= 0 ? '+' : ''}{(position.pnl_percent || 0).toFixed(2)}%
                            </div>
                          </div>
                        </td>
                        <td className="px-2 md:px-4 py-2 md:py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-1">
                              <div className="text-xs md:text-sm font-medium text-text-primary">
                                {(position.position_ratio || 0).toFixed(1)}%
                              </div>
                              <div className="w-full bg-dark-tertiary rounded-full h-1.5 md:h-2 mt-1 hidden md:block">
                                <div
                                  className={`h-1.5 md:h-2 rounded-full ${
                                    (position.pnl || 0) >= 0
                                      ? 'bg-[#f03a55]'
                                      : 'bg-[#00a870]'
                                  }`}
                                  style={{ width: `${Math.min(position.position_ratio || 0, 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
