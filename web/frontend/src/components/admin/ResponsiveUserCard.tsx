'use client';

import React from 'react';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  can_access_intraday_trading: boolean;
  created_at: string;
}

interface ResponsiveUserCardProps {
  user: User;
  onToggleActive: (userId: number, currentStatus: boolean) => void;
  onToggleIntradayAccess: (userId: number, currentStatus: boolean) => void;
}

export function ResponsiveUserCard({
  user,
  onToggleActive,
  onToggleIntradayAccess
}: ResponsiveUserCardProps) {
  return (
    <div className="bg-dark-tertiary rounded-lg border border-dark-border p-4 hover:shadow-glow-cyan hover:border-accent-primary transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
            user.role === 'admin' 
              ? 'bg-gradient-to-br from-warning-500 to-warning-600 text-white' 
              : 'bg-gradient-to-br from-accent-primary to-accent-secondary text-dark-primary'
          }`}>
            {user.username.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-responsive-h4 text-text-primary truncate">
              {user.username}
            </h4>
            <p className="text-responsive-small text-text-tertiary truncate">
              {user.email}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 ml-2 ${
          user.role === 'admin' 
            ? 'bg-warning-500/20 text-warning-500' 
            : 'bg-accent-primary/20 text-accent-primary'
        }`}>
          {user.role === 'admin' ? '管理员' : '普通用户'}
        </span>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-text-tertiary mb-1">用户ID</p>
          <p className="text-sm font-semibold text-text-primary">#{user.id}</p>
        </div>
        <div>
          <p className="text-xs text-text-tertiary mb-1">注册时间</p>
          <p className="text-sm font-semibold text-text-primary">
            {new Date(user.created_at).toLocaleDateString('zh-CN')}
          </p>
        </div>
      </div>

      {/* Status Toggles */}
      <div className="space-y-2 mb-3 pt-3 border-t border-dark-border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">账户状态</span>
          <button
            onClick={() => onToggleActive(user.id, user.is_active)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors min-h-touch ${
              user.is_active
                ? 'bg-success-500/20 text-success-500 hover:bg-success-500/30'
                : 'bg-danger-500/20 text-danger-500 hover:bg-danger-500/30'
            }`}
          >
            {user.is_active ? '已激活' : '已禁用'}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">智能盯盘</span>
          <button
            onClick={() => onToggleIntradayAccess(user.id, user.can_access_intraday_trading)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors min-h-touch ${
              user.can_access_intraday_trading
                ? 'bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30'
                : 'bg-dark-tertiary text-text-tertiary hover:bg-dark-primary'
            }`}
          >
            {user.can_access_intraday_trading ? '已开通' : '未开通'}
          </button>
        </div>
      </div>
    </div>
  );
}
