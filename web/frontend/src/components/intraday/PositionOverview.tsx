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
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center">
          <i className="fas fa-spinner fa-spin text-2xl text-blue-600 mr-3" />
          <span className="text-gray-600">加载持仓信息...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center text-red-600">
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

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <i className="fas fa-sort text-gray-400 ml-1" />;
    }
    return sortOrder === 'asc' ? (
      <i className="fas fa-sort-up text-blue-600 ml-1" />
    ) : (
      <i className="fas fa-sort-down text-blue-600 ml-1" />
    );
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">
          <i className="fas fa-list mr-2 text-green-600" />
          持仓概览
        </h2>
      </div>
      <div className="p-6">
        {filteredPositions.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-inbox text-6xl text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无持仓</h3>
            <p className="text-gray-600">
              当前没有持仓股票
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => handleSort('stock_code')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      股票代码
                      {getSortIcon('stock_code')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    市场
                  </th>
                  <th
                    onClick={() => handleSort('holding_days')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      持仓天数
                      {getSortIcon('holding_days')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    数量
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    成本价
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    当前价
                  </th>
                  <th
                    onClick={() => handleSort('pnl_percent')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      盈亏
                      {getSortIcon('pnl_percent')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('position_ratio')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      仓位占比
                      {getSortIcon('position_ratio')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPositions.map((position, index) => (
                      <tr key={`${position.stock_code}-${index}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {position.stock_code}
                          </div>
                          {position.stock_name && (
                            <div className="text-xs text-gray-500">
                              {position.stock_name}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {marketLabels[position.market_type] || position.market_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {position.holding_days || 0} 天
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {position.quantity?.toLocaleString() || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {position.currency || '$'}{position.cost_price?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {position.currency || '$'}{position.current_price?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className={`font-medium ${(position.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {(position.pnl || 0) >= 0 ? '+' : ''}{position.currency || '$'}{(position.pnl || 0).toFixed(2)}
                            </div>
                            <div className={`text-xs ${(position.pnl_percent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {(position.pnl_percent || 0) >= 0 ? '+' : ''}{(position.pnl_percent || 0).toFixed(2)}%
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                {(position.position_ratio || 0).toFixed(2)}%
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                <div
                                  className={`h-2 rounded-full ${
                                    (position.position_ratio || 0) > 30
                                      ? 'bg-red-600'
                                      : (position.position_ratio || 0) > 20
                                      ? 'bg-yellow-600'
                                      : 'bg-green-600'
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
