'use client';

import React, { useState } from 'react';
import { useDecisions } from '@/hooks/useIntradayTrading';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { buildApiUrl } from '@/utils/api';
import { getCurrencySymbol } from '@/utils/marketCurrency';

interface DecisionHistoryProps {
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function DecisionHistory({ onShowToast }: DecisionHistoryProps) {
  const [detailModalId, setDetailModalId] = useState<number | null>(null);
  const [detailSequenceNumber, setDetailSequenceNumber] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Fetch latest 20 decisions (no pagination)
  const { data, isLoading, error } = useDecisions(1, 20);

  const handleViewDetail = async (id: number, sequenceNumber: number) => {
    setDetailModalId(id);
    setDetailSequenceNumber(sequenceNumber);
    setLoadingDetail(true);
    
    try {
      // Fetch full decision details from API
      const response = await fetch(buildApiUrl(`/api/intraday/decisions/${id}`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch decision details');
      }
      
      const data = await response.json();
      setDetailData(data);
    } catch (error: any) {
      onShowToast(error.message || '获取决策详情失败', 'error');
      setDetailModalId(null);
      setDetailSequenceNumber(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseDetail = () => {
    setDetailModalId(null);
    setDetailSequenceNumber(null);
    setDetailData(null);
  };

  if (isLoading) {
    return (
      <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-6">
        <div className="flex items-center justify-center">
          <i className="fas fa-spinner fa-spin text-2xl text-accent-primary mr-3" />
          <span className="text-text-secondary">加载决策历史...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-6">
        <div className="flex items-center justify-center text-danger-500">
          <i className="fas fa-exclamation-triangle mr-2" />
          <span>加载决策历史失败</span>
        </div>
      </div>
    );
  }

  const decisions = (data as any)?.items || [];
  const total = (data as any)?.total || 0;

  const getStatusBadge = (status: string) => {
    const defaultBadge = { color: 'bg-green-500/20 text-green-400 border border-green-500/50', icon: 'fa-check-circle', label: '已完成' };
    const badges: Record<string, { color: string; icon: string; label: string }> = {
      running: { color: 'bg-blue-500/20 text-blue-400 border border-blue-500/50', icon: 'fa-spinner fa-spin', label: '运行中' },
      completed: defaultBadge,
      failed: { color: 'bg-red-500/20 text-red-400 border border-red-500/50', icon: 'fa-times-circle', label: '失败' },
    };

    const badge = badges[status] || defaultBadge;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <i className={`fas ${badge.icon} mr-1`} />
        {badge.label}
      </span>
    );
  };

  return (
    <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border">
      <div className="px-6 py-4 border-b border-dark-border">
        <h2 className="text-xl font-bold text-text-primary">
          <i className="fas fa-history mr-2 text-orange-600" />
          决策历史
        </h2>
      </div>
      <div className="p-4 md:p-6">
        {decisions.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-file-alt text-6xl text-text-muted mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">暂无决策记录</h3>
            <p className="text-text-secondary">
              系统还没有生成任何决策记录
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {decisions.map((decision: any, index: number) => {
              // Calculate user-specific sequence number
              // Since decisions are sorted by time DESC (newest first),
              // the sequence number should be: total - index
              // This gives: newest = total, oldest = 1
              const sequenceNumber = total - index;
              
              // Get market label and color
              const getMarketInfo = (market: string) => {
                switch (market?.toUpperCase()) {
                  case 'US':
                    return { label: '美股', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' };
                  case 'HK':
                    return { label: '港股', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' };
                  case 'CN':
                    return { label: 'A股', color: 'bg-red-500/20 text-red-400 border-red-500/50' };
                  default:
                    return { label: market || '未知', color: 'bg-gray-500/20 text-gray-400 border-gray-500/50' };
                }
              };
              
              const marketInfo = getMarketInfo(decision.market_type);
              
              return (
                <div
                  key={`${decision.id}-${index}`}
                  className="border border-dark-border rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-dark-tertiary"
                >
                  {/* Decision Card - Click to open detail modal */}
                  <div
                    className="p-4 cursor-pointer hover:bg-dark-primary transition-colors"
                    onClick={() => handleViewDetail(decision.id, sequenceNumber)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          <h3 className="text-lg font-medium text-text-primary">
                            决策 #{sequenceNumber}
                          </h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${marketInfo.color}`}>
                            {marketInfo.label}
                          </span>
                          {getStatusBadge(decision.status)}
                        </div>
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                          <span>
                            <i className="fas fa-clock mr-1" />
                            {new Date(decision.start_time).toLocaleString('zh-CN')}
                          </span>
                          <span>
                            <i className="fas fa-exchange-alt mr-1" />
                            执行 {decision.trades_count ?? decision.trades_executed?.length ?? 0} 笔交易
                          </span>
                        </div>
                        {decision.end_time && (
                          <div className="text-xs text-text-tertiary mt-1">
                            {formatDistanceToNow(new Date(decision.end_time), {
                              addSuffix: true,
                              locale: zhCN,
                            })}
                          </div>
                        )}
                      </div>
                      <div>
                        <i className="fas fa-chevron-right text-text-muted" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Total count display */}
        {total > 0 && (
          <div className="mt-6 pt-4 border-t border-dark-border">
            <div className="text-sm text-text-secondary text-center">
              共 {total} 条决策记录，只显示最新的20条
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailModalId && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-dark-secondary md:rounded-lg shadow-xl border-0 md:border border-dark-border max-w-4xl w-full h-full md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header - Sticky */}
            <div className="sticky top-0 z-10 px-4 md:px-6 py-3 md:py-4 border-b border-dark-border flex items-center justify-between bg-dark-secondary">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-responsive-h4 text-text-primary">
                  <i className="fas fa-file-alt mr-2 text-accent-primary" />
                  决策详情 #{detailSequenceNumber || detailModalId}
                </h3>
                {detailData?.market_type && (() => {
                  const getMarketInfo = (market: string) => {
                    switch (market?.toUpperCase()) {
                      case 'US':
                        return { label: '美股', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' };
                      case 'HK':
                        return { label: '港股', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' };
                      case 'CN':
                        return { label: 'A股', color: 'bg-red-500/20 text-red-400 border-red-500/50' };
                      default:
                        return { label: market, color: 'bg-gray-500/20 text-gray-400 border-gray-500/50' };
                    }
                  };
                  const marketInfo = getMarketInfo(detailData.market_type);
                  return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${marketInfo.color}`}>
                      {marketInfo.label}
                    </span>
                  );
                })()}
              </div>
              <button
                onClick={handleCloseDetail}
                className="text-text-muted hover:text-text-secondary min-w-touch min-h-touch flex items-center justify-center"
              >
                <i className="fas fa-times text-xl" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-12">
                  <i className="fas fa-spinner fa-spin text-2xl text-accent-primary mr-3" />
                  <span className="text-text-secondary">加载详情...</span>
                </div>
              ) : detailData ? (
                <div className="space-y-6">
                  {/* Session Info */}
                  <div className="bg-gradient-to-r from-blue-900/20 to-indigo-900/20 rounded-lg p-5 border border-accent-primary/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start">
                        <i className="fas fa-fingerprint text-accent-primary mt-1 mr-3" />
                        <div>
                          <div className="text-xs text-text-tertiary font-medium mb-1">会话ID</div>
                          <div className="font-mono text-sm text-text-primary break-all">{detailData.session_id}</div>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <i className="fas fa-globe text-success-500 mt-1 mr-3" />
                        <div>
                          <div className="text-xs text-text-tertiary font-medium mb-1">市场</div>
                          <div className="font-semibold text-sm text-text-primary">{detailData.market_type}</div>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <i className="fas fa-play-circle text-accent-secondary mt-1 mr-3" />
                        <div>
                          <div className="text-xs text-text-tertiary font-medium mb-1">开始时间</div>
                          <div className="text-sm text-text-primary">
                            {new Date(detailData.start_time).toLocaleString('zh-CN')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <i className="fas fa-stop-circle text-warning-500 mt-1 mr-3" />
                        <div>
                          <div className="text-xs text-text-tertiary font-medium mb-1">结束时间</div>
                          <div className="text-sm text-text-primary">
                            {detailData.end_time ? new Date(detailData.end_time).toLocaleString('zh-CN') : '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Full Decision Report */}
                  {detailData.decision_report && (
                    <div>
                      <h4 className="text-lg font-semibold text-text-primary mb-3">
                        <i className="fas fa-file-alt mr-2 text-accent-primary" />
                        完整决策报告
                      </h4>
                      <div className="bg-dark-tertiary border border-dark-border rounded-lg p-4 md:p-6 shadow-inner">
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
                            {detailData.decision_report}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Trades Executed */}
                  {detailData.trades_executed && detailData.trades_executed.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-text-primary mb-3">
                        <i className="fas fa-exchange-alt mr-2 text-warning-500" />
                        执行交易 ({detailData.trades_executed.length})
                      </h4>
                      <div className="space-y-3">
                        {detailData.trades_executed.map((trade: any, idx: number) => {
                          // Get currency symbol based on market type
                          const currencySymbol = getCurrencySymbol(detailData.market_type || 'US');
                          
                          return (
                            <div
                              key={idx}
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
                                    {trade.stock || '未知股票'}
                                  </span>
                                </div>
                                {trade.price && (
                                  <span className="text-base font-semibold text-text-secondary">
                                    {currencySymbol}{trade.price}
                                  </span>
                                )}
                              </div>
                              {trade.quantity && (
                                <div className="text-sm text-text-secondary font-medium mb-2">
                                  <i className="fas fa-layer-group mr-2 text-text-muted" />
                                  数量: <span className="font-bold">{trade.quantity}</span> 股
                                </div>
                              )}
                              {trade.description && (
                                <div className="text-sm text-text-secondary mt-3 pt-3 border-t border-dark-border leading-relaxed">
                                  <i className="fas fa-info-circle mr-2 text-accent-primary" />
                                  {trade.description}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-text-secondary">
                  无法加载详情
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-dark-border flex justify-end">
              <button
                onClick={handleCloseDetail}
                className="px-4 py-2 bg-dark-tertiary text-text-primary rounded-md hover:bg-dark-primary border border-dark-border"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
