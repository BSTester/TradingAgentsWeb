'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildApiUrl } from '@/utils/api';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { getCurrencySymbol } from '@/utils/marketCurrency';
import { openFutuStockPage } from '@/utils/futuLink';

interface UserDetailPanelProps {
  isOpen: boolean;
  userId: number | null;
  username: string;
  market: string;
  onClose: () => void;
}

export function UserDetailPanel({ isOpen, userId, username, market, onClose }: UserDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'positions' | 'decisions'>('positions');
  const [selectedDecision, setSelectedDecision] = useState<any>(null);
  const [isDecisionDetailOpen, setIsDecisionDetailOpen] = useState(false);

  // 获取持仓数据（每5分钟刷新）
  const { data: allPositions, isLoading: positionsLoading } = useQuery({
    queryKey: ['user-positions', userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await fetch(buildApiUrl(`/api/public/leaderboard/user/${userId}/positions`));
      if (!response.ok) throw new Error('获取持仓失败');
      return response.json();
    },
    enabled: !!userId && isOpen,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    refetchInterval: 5 * 60 * 1000, // 每5分钟自动刷新
  });

  // 获取决策历史（每5分钟刷新）
  const { data: allDecisions, isLoading: decisionsLoading } = useQuery({
    queryKey: ['user-decisions', userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await fetch(buildApiUrl(`/api/public/leaderboard/user/${userId}/decisions`));
      if (!response.ok) throw new Error('获取决策历史失败');
      return response.json();
    },
    enabled: !!userId && isOpen,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    refetchInterval: 5 * 60 * 1000, // 每5分钟自动刷新
  });

  // 根据市场过滤持仓
  const positions = React.useMemo(() => {
    if (!allPositions) return [];
    const filtered = allPositions.filter((p: any) => p.market_type === market);
    // Debug: Log positions data
    console.log('[UserDetailPanel] Positions data:', filtered);
    filtered.forEach((p: any) => {
      console.log(`  ${p.stock_code}: stock_name = "${p.stock_name}"`);
    });
    return filtered;
  }, [allPositions, market]);

  // 根据市场过滤决策记录
  const decisions = React.useMemo(() => {
    if (!allDecisions) return [];
    return allDecisions.filter((d: any) => d.market_type === market);
  }, [allDecisions, market]);

  // 查看决策详情
  const handleViewDecision = (decision: any) => {
    setSelectedDecision(decision);
    setIsDecisionDetailOpen(true);
  };

  // 关闭决策详情
  const handleCloseDecisionDetail = () => {
    setIsDecisionDetailOpen(false);
    setTimeout(() => setSelectedDecision(null), 300);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* 侧边栏 */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full md:w-[600px] bg-dark-secondary border-l border-dark-border z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              <i className="fas fa-user mr-2" />
              {username}
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {market === 'US' ? '美股' : market === 'HK' ? '港股' : 'A股'} 市场
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-dark-tertiary transition-colors"
          >
            <i className="fas fa-times text-xl" />
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-dark-border">
          <button
            onClick={() => setActiveTab('positions')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'positions'
                ? 'text-accent-primary border-b-2 border-accent-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <i className="fas fa-briefcase mr-2" />
            持仓信息
            {positions && positions.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-accent-primary/20 text-accent-primary rounded-full text-xs">
                {positions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('decisions')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'decisions'
                ? 'text-accent-primary border-b-2 border-accent-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <i className="fas fa-history mr-2" />
            决策记录
            {decisions && decisions.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-accent-primary/20 text-accent-primary rounded-full text-xs">
                {decisions.length}
              </span>
            )}
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'positions' ? (
            <div className="space-y-3">
              {positionsLoading ? (
                <div className="text-center py-8">
                  <i className="fas fa-spinner fa-spin text-2xl text-accent-primary mb-2" />
                  <p className="text-text-secondary text-sm">加载中...</p>
                </div>
              ) : !positions || positions.length === 0 ? (
                <div className="text-center py-8">
                  <i className="fas fa-inbox text-3xl text-text-tertiary mb-2" />
                  <p className="text-text-secondary text-sm">暂无持仓数据</p>
                </div>
              ) : (
                positions.map((position: any, index: number) => (
                  <div
                    key={index}
                    className="bg-dark-tertiary rounded-lg p-4 border border-dark-border hover:border-accent-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <button
                          onClick={() => openFutuStockPage(position.stock_code, position.market_type)}
                          className="font-semibold text-accent-primary text-lg flex-shrink-0 hover:underline transition-opacity hover:opacity-80"
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

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-text-tertiary mb-1">开仓价格</p>
                        <p className="text-text-primary font-medium">
                          {getCurrencySymbol(position.market_type)}{position.first_open_price?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-tertiary mb-1">当前价格</p>
                        <p className="text-text-primary font-medium">
                          {getCurrencySymbol(position.market_type)}{position.current_price?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-tertiary mb-1">市值</p>
                        <p className="text-text-primary font-medium">
                          {getCurrencySymbol(position.market_type)}{position.market_value?.toLocaleString() || '0'}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-tertiary mb-1">盈亏</p>
                        <p className={`font-medium ${
                          (position.unrealized_pnl || 0) >= 0
                            ? 'text-[#f03a55]'
                            : 'text-[#00a870]'
                        }`}>
                          {position.unrealized_pnl && position.unrealized_pnl >= 0 ? '+' : ''}
                          {getCurrencySymbol(position.market_type)}{position.unrealized_pnl?.toLocaleString() || '0'}
                          {position.pnl_percentage !== undefined && (
                            <span className="text-xs ml-1">
                              ({position.pnl_percentage > 0 ? '+' : ''}
                              {position.pnl_percentage.toFixed(2)}%)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {(position.first_open_time || position.holding_days !== undefined) && (
                      <div className="mt-3 pt-3 border-t border-dark-border">
                        <div className="flex items-center justify-between text-xs">
                          {position.first_open_time && (
                            <span className="text-text-tertiary">
                              <i className="fas fa-calendar mr-1" />
                              开仓: {new Date(position.first_open_time).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
                          {position.holding_days !== undefined && (
                            <span className="text-text-tertiary">
                              <i className="fas fa-clock mr-1" />
                              持仓 {position.holding_days} 天
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {decisionsLoading ? (
                <div className="text-center py-8">
                  <i className="fas fa-spinner fa-spin text-2xl text-accent-primary mb-2" />
                  <p className="text-text-secondary text-sm">加载中...</p>
                </div>
              ) : !decisions || decisions.length === 0 ? (
                <div className="text-center py-8">
                  <i className="fas fa-inbox text-3xl text-text-tertiary mb-2" />
                  <p className="text-text-secondary text-sm">暂无决策记录</p>
                </div>
              ) : (
                decisions.map((decision: any) => (
                  <div
                    key={decision.id}
                    className="bg-dark-tertiary rounded-lg p-4 border border-dark-border hover:border-accent-primary/50 transition-colors cursor-pointer"
                    onClick={() => handleViewDecision(decision)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs px-2 py-1 bg-dark-primary rounded text-text-tertiary">
                          {decision.market_type}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          decision.status === 'completed'
                            ? 'bg-success-500/20 text-success-500'
                            : decision.status === 'running'
                            ? 'bg-warning-500/20 text-warning-500'
                            : 'bg-danger-500/20 text-danger-500'
                        }`}>
                          {decision.status === 'completed' ? '已完成' :
                           decision.status === 'running' ? '运行中' : '失败'}
                        </span>
                      </div>
                      <i className="fas fa-chevron-right text-text-tertiary" />
                    </div>

                    <div className="text-sm">
                      <div className="flex items-center text-text-secondary text-xs">
                        <span className="text-text-tertiary">
                          {new Date(decision.start_time).toLocaleString('zh-CN')}
                        </span>
                        {decision.end_time && (
                          <>
                            <span className="mx-2">→</span>
                            <span className="text-text-tertiary">
                              {new Date(decision.end_time).toLocaleString('zh-CN')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {decision.decision_report && (
                      <div className="mt-3 pt-3 border-t border-dark-border">
                        <p className="text-sm text-text-primary line-clamp-2">
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
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* 决策详情弹窗 */}
      {selectedDecision && (
        <>
          <div
            className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity duration-300 ${
              isDecisionDetailOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={handleCloseDecisionDetail}
          />
          <div
            className={`fixed inset-4 md:inset-10 lg:inset-20 bg-dark-secondary border border-dark-border rounded-lg z-50 transform transition-all duration-300 ease-in-out ${
              isDecisionDetailOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
            } flex flex-col`}
          >
            {/* 详情头部 */}
            <div className="flex items-center justify-between p-4 border-b border-dark-border">
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-bold text-text-primary">
                  <i className="fas fa-file-alt mr-2" />
                  决策详情
                </h3>
                <span className="text-xs px-2 py-1 bg-dark-primary rounded text-text-tertiary">
                  {selectedDecision.market_type}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${
                  selectedDecision.status === 'completed'
                    ? 'bg-success-500/20 text-success-500'
                    : selectedDecision.status === 'running'
                    ? 'bg-warning-500/20 text-warning-500'
                    : 'bg-danger-500/20 text-danger-500'
                }`}>
                  {selectedDecision.status === 'completed' ? '已完成' :
                   selectedDecision.status === 'running' ? '运行中' : '失败'}
                </span>
              </div>
              <button
                onClick={handleCloseDecisionDetail}
                className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-dark-tertiary transition-colors"
              >
                <i className="fas fa-times text-xl" />
              </button>
            </div>

            {/* 详情内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* 时间信息 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-dark-tertiary rounded-lg p-4">
                  <p className="text-sm text-text-tertiary mb-1">开始时间</p>
                  <p className="text-text-primary font-medium">
                    {new Date(selectedDecision.start_time).toLocaleString('zh-CN')}
                  </p>
                </div>
                {selectedDecision.end_time && (
                  <div className="bg-dark-tertiary rounded-lg p-4">
                    <p className="text-sm text-text-tertiary mb-1">结束时间</p>
                    <p className="text-text-primary font-medium">
                      {new Date(selectedDecision.end_time).toLocaleString('zh-CN')}
                    </p>
                  </div>
                )}
              </div>

              {/* 执行的交易 */}
              {selectedDecision.trades_executed && selectedDecision.trades_executed.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-text-primary mb-3 flex items-center">
                    <i className="fas fa-exchange-alt mr-2 text-warning-500" />
                    执行交易 ({selectedDecision.trades_executed.length})
                  </h4>
                  <div className="space-y-3">
                    {selectedDecision.trades_executed.map((trade: any, index: number) => {
                      const currencySymbol = getCurrencySymbol(selectedDecision.market_type || 'US');
                      
                      return (
                        <div
                          key={index}
                          className={`rounded-lg p-4 border-l-4 shadow-sm ${
                            trade.action === 'BUY'
                              ? 'bg-red-900/20 border-red-500'
                              : 'bg-green-900/20 border-green-500'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                trade.action === 'BUY' 
                                  ? 'bg-red-500 text-white' 
                                  : 'bg-green-500 text-white'
                              }`}>
                                {trade.action === 'BUY' ? '买入' : trade.action === 'SELL' ? '卖出' : trade.action || '未知'}
                              </span>
                              <span className="font-bold text-lg text-text-primary">
                                {trade.stock_code || trade.stock || trade.ticker || '未知股票'}
                              </span>
                            </div>
                            {trade.price && (
                              <span className="text-base font-semibold text-text-secondary">
                                {currencySymbol}{trade.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                          
                          {trade.quantity && (
                            <div className="text-sm text-text-secondary font-medium mb-2">
                              <i className="fas fa-layer-group mr-2 text-text-muted" />
                              数量: <span className="font-bold">{trade.quantity}</span> 股
                              {trade.price && (
                                <span className="ml-4">
                                  <i className="fas fa-calculator mr-2 text-text-muted" />
                                  总额: <span className="font-bold">{currencySymbol}{((trade.price || 0) * (trade.quantity || 0)).toFixed(2)}</span>
                                </span>
                              )}
                            </div>
                          )}
                          
                          {(trade.reason || trade.description) && (
                            <div className="text-sm text-text-secondary mt-3 pt-3 border-t border-dark-border leading-relaxed">
                              <i className="fas fa-info-circle mr-2 text-accent-primary" />
                              {trade.reason || trade.description}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 分析的持仓 */}
              {selectedDecision.positions_analyzed && selectedDecision.positions_analyzed.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-text-primary mb-3 flex items-center">
                    <i className="fas fa-chart-line mr-2 text-accent-primary" />
                    分析的持仓 ({selectedDecision.positions_analyzed.length})
                  </h4>
                  <div className="bg-dark-tertiary rounded-lg p-4">
                    <div className="flex flex-wrap gap-2">
                      {selectedDecision.positions_analyzed.map((code: string, index: number) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-dark-primary rounded text-text-primary text-sm"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 决策报告 */}
              {selectedDecision.decision_report && (
                <div>
                  <h4 className="text-md font-semibold text-text-primary mb-3 flex items-center">
                    <i className="fas fa-file-alt mr-2 text-accent-primary" />
                    决策报告
                  </h4>
                  <div className="bg-dark-tertiary rounded-lg p-4 border border-dark-border">
                    <div className="prose prose-invert prose-sm md:prose-base max-w-none">
                      <ReactMarkdown
                        rehypePlugins={[rehypeRaw, rehypeSanitize]}
                        components={{
                          h1: ({node, ...props}) => (
                            <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-4 mt-6 pb-2 border-b-2 border-accent-primary/30" {...props} />
                          ),
                          h2: ({node, ...props}) => (
                            <h2 className="text-xl md:text-2xl font-bold text-text-primary mb-3 mt-6 pb-2 border-b border-accent-primary/20" {...props} />
                          ),
                          h3: ({node, ...props}) => (
                            <h3 className="text-lg md:text-xl font-semibold text-text-primary mb-2 mt-5" {...props} />
                          ),
                          h4: ({node, ...props}) => (
                            <h4 className="text-base md:text-lg font-semibold text-text-primary mb-2 mt-4" {...props} />
                          ),
                          h5: ({node, ...props}) => (
                            <h5 className="text-sm md:text-base font-semibold text-text-primary mb-2 mt-3" {...props} />
                          ),
                          h6: ({node, ...props}) => (
                            <h6 className="text-sm font-semibold text-text-secondary mb-2 mt-3" {...props} />
                          ),
                          p: ({node, ...props}) => (
                            <p className="text-text-secondary mb-4 leading-relaxed text-sm md:text-base" {...props} />
                          ),
                          ul: ({node, ...props}) => (
                            <ul className="list-disc list-outside ml-5 mb-4 space-y-2 text-text-secondary" {...props} />
                          ),
                          ol: ({node, ...props}) => (
                            <ol className="list-decimal list-outside ml-5 mb-4 space-y-2 text-text-secondary" {...props} />
                          ),
                          li: ({node, ...props}) => (
                            <li className="text-text-secondary leading-relaxed text-sm md:text-base pl-1" {...props} />
                          ),
                          strong: ({node, ...props}) => (
                            <strong className="font-bold text-text-primary" {...props} />
                          ),
                          em: ({node, ...props}) => (
                            <em className="italic text-accent-secondary" {...props} />
                          ),
                          code: ({node, inline, ...props}: any) => 
                            inline 
                              ? <code className="bg-accent-primary/20 text-accent-primary px-2 py-0.5 rounded text-xs md:text-sm font-mono border border-accent-primary/30" {...props} />
                              : <code className="block bg-dark-primary text-text-primary p-3 md:p-4 rounded-lg border border-dark-border text-xs md:text-sm font-mono overflow-x-auto mb-4 leading-relaxed" {...props} />,
                          pre: ({node, ...props}) => (
                            <pre className="bg-dark-primary p-3 md:p-4 rounded-lg border border-dark-border overflow-x-auto mb-4 shadow-inner" {...props} />
                          ),
                          blockquote: ({node, ...props}) => (
                            <blockquote className="border-l-4 border-accent-primary bg-accent-primary/5 pl-4 pr-4 py-2 italic text-text-secondary my-4 rounded-r" {...props} />
                          ),
                          table: ({node, ...props}) => (
                            <div className="overflow-x-auto mb-4 rounded-lg border border-dark-border">
                              <table className="min-w-full border-collapse" {...props} />
                            </div>
                          ),
                          thead: ({node, ...props}) => (
                            <thead className="bg-dark-primary" {...props} />
                          ),
                          tbody: ({node, ...props}) => (
                            <tbody className="divide-y divide-dark-border" {...props} />
                          ),
                          tr: ({node, ...props}) => (
                            <tr className="hover:bg-dark-primary/50 transition-colors" {...props} />
                          ),
                          th: ({node, ...props}) => (
                            <th className="border-b-2 border-dark-border px-4 py-3 text-left font-bold text-text-primary text-sm md:text-base bg-dark-primary/80" {...props} />
                          ),
                          td: ({node, ...props}) => (
                            <td className="border-b border-dark-border px-4 py-3 text-text-secondary text-sm md:text-base" {...props} />
                          ),
                          a: ({node, ...props}) => (
                            <a className="text-accent-primary hover:text-accent-secondary underline decoration-accent-primary/50 hover:decoration-accent-secondary transition-colors" target="_blank" rel="noopener noreferrer" {...props} />
                          ),
                          hr: ({node, ...props}) => (
                            <hr className="my-6 border-t-2 border-dark-border" {...props} />
                          ),
                          img: ({node, ...props}) => (
                            <img className="rounded-lg border border-dark-border my-4 max-w-full h-auto" {...props} />
                          ),
                        }}
                      >
                        {selectedDecision.decision_report}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
