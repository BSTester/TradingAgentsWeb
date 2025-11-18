'use client';

import React from 'react';
import { formatAmount } from '@/utils/marketCurrency';
import { openFutuStockPage } from '@/utils/futuLink';

interface Position {
  stock_code: string;
  stock_name?: string;
  market_type: string;
  quantity: number;
  cost_price?: number;
  current_price?: number;
  market_value?: number;
  unrealized_pnl?: number;
  pnl_percentage?: number;
  first_open_time?: string;
  holding_days?: number;
}

interface UserPositionsPanelProps {
  userId: number;
  username: string;
  positions: Position[] | null;
}

export function UserPositionsPanel({ userId, username, positions }: UserPositionsPanelProps) {
  return (
    <div className="bg-dark-secondary rounded-lg border border-dark-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-text-primary">
          <i className="fas fa-briefcase mr-2" />
          持仓详情
        </h3>
        <span className="text-sm text-text-secondary">{username}</span>
      </div>

      {!positions ? (
        <div className="text-center py-8">
          <i className="fas fa-spinner fa-spin text-2xl text-accent-primary mb-2" />
          <p className="text-text-secondary text-sm">加载中...</p>
        </div>
      ) : positions.length === 0 ? (
        <div className="text-center py-8">
          <i className="fas fa-inbox text-3xl text-text-tertiary mb-2" />
          <p className="text-text-secondary text-sm">暂无持仓数据</p>
        </div>
      ) : (
        <div className="space-y-3">
          {positions.map((position, index) => (
            <div
              key={index}
              className="bg-dark-tertiary rounded-lg p-4 border border-dark-border hover:border-accent-primary/50 transition-colors"
            >
              {/* 头部：股票代码、公司名称、市场、数量 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <button
                    onClick={() => openFutuStockPage(position.stock_code, position.market_type)}
                    className="font-semibold text-accent-primary flex-shrink-0 hover:underline transition-opacity hover:opacity-80"
                    title="点击查看富途股票详情"
                  >
                    {position.stock_code}
                  </button>
                  {position.stock_name && (
                    <span className="text-sm text-text-secondary truncate">
                      {position.stock_name}
                    </span>
                  )}
                  <span className="text-xs px-2 py-1 bg-dark-primary rounded text-text-tertiary flex-shrink-0">
                    {position.market_type}
                  </span>
                </div>
                <span className="text-sm font-medium text-text-primary flex-shrink-0 ml-2">
                  {position.quantity.toLocaleString()} 股
                </span>
              </div>

              {/* 持仓时长和开仓时间 */}
              {(position.holding_days !== undefined || position.first_open_time) && (
                <div className="flex items-center space-x-4 mb-3 text-xs text-text-tertiary">
                  {position.holding_days !== undefined && (
                    <div className="flex items-center space-x-1">
                      <i className="fas fa-clock" />
                      <span>持仓 {position.holding_days} 天</span>
                    </div>
                  )}
                  {position.first_open_time && (
                    <div className="flex items-center space-x-1">
                      <i className="fas fa-calendar" />
                      <span>
                        开仓: {new Date(position.first_open_time).toLocaleDateString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 价格和盈亏信息 */}
              {position.current_price && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-text-tertiary text-xs">成本价</p>
                    <p className="text-text-primary font-medium">
                      {formatAmount(position.cost_price || 0, position.market_type, 2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-tertiary text-xs">当前价</p>
                    <p className="text-text-primary font-medium">
                      {formatAmount(position.current_price, position.market_type, 2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-tertiary text-xs">市值</p>
                    <p className="text-text-primary font-medium">
                      {formatAmount(position.market_value || 0, position.market_type, 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-tertiary text-xs">盈亏</p>
                    <p
                      className={`font-medium ${
                        (position.unrealized_pnl || 0) >= 0
                          ? 'text-success-500'
                          : 'text-danger-500'
                      }`}
                    >
                      {position.unrealized_pnl && position.unrealized_pnl >= 0 ? '+' : ''}
                      {formatAmount(position.unrealized_pnl || 0, position.market_type, 0)}
                      {position.pnl_percentage !== undefined && (
                        <span className="text-xs ml-1">
                          ({position.pnl_percentage > 0 ? '+' : ''}
                          {position.pnl_percentage.toFixed(2)}%)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
