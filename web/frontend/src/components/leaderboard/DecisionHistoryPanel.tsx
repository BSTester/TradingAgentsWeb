'use client';

import React, { useState } from 'react';

interface Decision {
  id: number;
  start_time: string;
  end_time?: string;
  status: string;
  market_type: string;
  decision_report?: string;
  trades_executed?: any[];
}

interface DecisionHistoryPanelProps {
  userId: number;
  username: string;
  decisions: Decision[] | null;
}

export function DecisionHistoryPanel({ userId, username, decisions }: DecisionHistoryPanelProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'running'>('all');

  const filteredDecisions = !decisions
    ? []
    : decisions.filter((decision) => {
        if (activeTab === 'all') return true;
        if (activeTab === 'completed') return decision.status === 'completed';
        if (activeTab === 'running') return decision.status === 'running';
        return true;
      });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500">
            已完成
          </span>
        );
      case 'running':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-warning-500/20 text-warning-500">
            运行中
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-danger-500/20 text-danger-500">
            失败
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-dark-tertiary text-text-tertiary">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-dark-secondary rounded-lg border border-dark-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-text-primary">
          <i className="fas fa-history mr-2" />
          决策历史
        </h3>
        <span className="text-sm text-text-secondary">{username}</span>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-4 border-b border-dark-border">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'all'
              ? 'text-accent-primary border-b-2 border-accent-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          全部 ({decisions?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'completed'
              ? 'text-accent-primary border-b-2 border-accent-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          已完成
        </button>
        <button
          onClick={() => setActiveTab('running')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'running'
              ? 'text-accent-primary border-b-2 border-accent-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          运行中
        </button>
      </div>

      {!decisions ? (
        <div className="text-center py-8">
          <i className="fas fa-spinner fa-spin text-2xl text-accent-primary mb-2" />
          <p className="text-text-secondary text-sm">加载中...</p>
        </div>
      ) : filteredDecisions.length === 0 ? (
        <div className="text-center py-8">
          <i className="fas fa-inbox text-3xl text-text-tertiary mb-2" />
          <p className="text-text-secondary text-sm">暂无决策历史</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredDecisions.map((decision) => (
            <div
              key={decision.id}
              className="bg-dark-tertiary rounded-lg p-4 border border-dark-border hover:border-accent-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs px-2 py-1 bg-dark-primary rounded text-text-tertiary">
                      {decision.market_type}
                    </span>
                    {getStatusBadge(decision.status)}
                  </div>
                  <p className="text-xs text-text-tertiary">
                    开始时间: {new Date(decision.start_time).toLocaleString('zh-CN')}
                  </p>
                  {decision.end_time && (
                    <p className="text-xs text-text-tertiary">
                      结束时间: {new Date(decision.end_time).toLocaleString('zh-CN')}
                    </p>
                  )}
                </div>
              </div>

              {decision.decision_report && (
                <div className="mt-3 pt-3 border-t border-dark-border">
                  <p className="text-sm text-text-primary line-clamp-3">
                    {decision.decision_report}
                  </p>
                </div>
              )}

              {decision.trades_executed && decision.trades_executed.length > 0 && (
                <div className="mt-3 pt-3 border-t border-dark-border">
                  <p className="text-xs text-text-tertiary">
                    执行交易: {decision.trades_executed.length} 笔
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
