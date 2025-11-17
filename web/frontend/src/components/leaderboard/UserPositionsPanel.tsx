'use client';

import React from 'react';

interface Position {
  stock_code: string;
  market_type: string;
  quantity: number;
  current_price?: number;
  market_value?: number;
  unrealized_pnl?: number;
  pnl_percentage?: number;
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
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-text-primary">
                    {position.stock_code}
                  </span>
                  <span className="text-xs px-2 py-1 bg-dark-primary rounded text-text-tertiary">
                    {position.market_type}
                  </span>
                </div>
                <span className="text-sm font-medium text-text-primary">
                  {position.quantity.toLocaleString()} 股
                </span>
              </div>

              {position.current_price && (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-text-tertiary">当前价格</p>
                    <p className="text-text-primary font-medium">
                      ${position.current_price.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-tertiary">市值</p>
                    <p className="text-text-primary font-medium">
                      ${position.market_value?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-tertiary">盈亏</p>
                    <p
                      className={`font-medium ${
                        (position.unrealized_pnl || 0) >= 0
                          ? 'text-success-500'
                          : 'text-danger-500'
                      }`}
                    >
                      {position.unrealized_pnl && position.unrealized_pnl >= 0 ? '+' : ''}
                      ${position.unrealized_pnl?.toLocaleString() || '0'}
                      {position.pnl_percentage && (
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
