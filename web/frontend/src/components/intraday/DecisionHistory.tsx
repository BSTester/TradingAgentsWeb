'use client';

import React, { useState } from 'react';
import { useDecisions } from '@/hooks/useIntradayTrading';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { buildApiUrl } from '@/utils/api';

interface DecisionHistoryProps {
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function DecisionHistory({ onShowToast }: DecisionHistoryProps) {
  const [page, setPage] = useState(1);
  const [detailModalId, setDetailModalId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const limit = 20; // Show 20 records per page

  const { data, isLoading, error } = useDecisions(page, limit);

  const handleViewDetail = async (id: number) => {
    setDetailModalId(id);
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
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseDetail = () => {
    setDetailModalId(null);
    setDetailData(null);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center">
          <i className="fas fa-spinner fa-spin text-2xl text-blue-600 mr-3" />
          <span className="text-gray-600">加载决策历史...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center text-red-600">
          <i className="fas fa-exclamation-triangle mr-2" />
          <span>加载决策历史失败</span>
        </div>
      </div>
    );
  }

  const decisions = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: string; label: string }> = {
      running: { color: 'bg-blue-100 text-blue-800', icon: 'fa-spinner fa-spin', label: '运行中' },
      completed: { color: 'bg-green-100 text-green-800', icon: 'fa-check-circle', label: '已完成' },
      failed: { color: 'bg-red-100 text-red-800', icon: 'fa-times-circle', label: '失败' },
    };

    const badge = badges[status] || badges.completed;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <i className={`fas ${badge.icon} mr-1`} />
        {badge.label}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">
          <i className="fas fa-history mr-2 text-orange-600" />
          决策历史
        </h2>
      </div>
      <div className="p-6">
        {decisions.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-file-alt text-6xl text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无决策记录</h3>
            <p className="text-gray-600">
              系统还没有生成任何决策记录
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {decisions.map((decision, index) => (
              <div
                key={`${decision.id}-${index}`}
                className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Decision Card - Click to open detail modal */}
                <div
                  className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleViewDetail(decision.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          决策 #{decision.id}
                        </h3>
                        {getStatusBadge(decision.status)}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>
                          <i className="fas fa-clock mr-1" />
                          {new Date(decision.start_time).toLocaleString('zh-CN')}
                        </span>
                        <span>
                          <i className="fas fa-exchange-alt mr-1" />
                          执行 {decision.trades_executed?.length || 0} 笔交易
                        </span>
                      </div>
                      {decision.end_time && (
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDistanceToNow(new Date(decision.end_time), {
                            addSuffix: true,
                            locale: zhCN,
                          })}
                        </div>
                      )}
                    </div>
                    <div>
                      <i className="fas fa-chevron-right text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                显示第 {(page - 1) * limit + 1} - {Math.min(page * limit, total)} 条，共 {total} 条记录
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fas fa-chevron-left mr-1" />
                  上一页
                </button>
                <span className="text-sm text-gray-600">
                  第 {page} / {totalPages} 页
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                  <i className="fas fa-chevron-right ml-1" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailModalId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                <i className="fas fa-file-alt mr-2 text-blue-600" />
                决策详情 #{detailModalId}
              </h3>
              <button
                onClick={handleCloseDetail}
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="fas fa-times text-xl" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-12">
                  <i className="fas fa-spinner fa-spin text-2xl text-blue-600 mr-3" />
                  <span className="text-gray-600">加载详情...</span>
                </div>
              ) : detailData ? (
                <div className="space-y-6">
                  {/* Session Info */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-5 border border-blue-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start">
                        <i className="fas fa-fingerprint text-blue-500 mt-1 mr-3" />
                        <div>
                          <div className="text-xs text-gray-600 font-medium mb-1">会话ID</div>
                          <div className="font-mono text-sm text-gray-900 break-all">{detailData.session_id}</div>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <i className="fas fa-globe text-green-500 mt-1 mr-3" />
                        <div>
                          <div className="text-xs text-gray-600 font-medium mb-1">市场</div>
                          <div className="font-semibold text-sm text-gray-900">{detailData.market_type}</div>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <i className="fas fa-play-circle text-purple-500 mt-1 mr-3" />
                        <div>
                          <div className="text-xs text-gray-600 font-medium mb-1">开始时间</div>
                          <div className="text-sm text-gray-900">
                            {new Date(detailData.start_time).toLocaleString('zh-CN')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <i className="fas fa-stop-circle text-orange-500 mt-1 mr-3" />
                        <div>
                          <div className="text-xs text-gray-600 font-medium mb-1">结束时间</div>
                          <div className="text-sm text-gray-900">
                            {detailData.end_time ? new Date(detailData.end_time).toLocaleString('zh-CN') : '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Full Decision Report */}
                  {detailData.decision_report && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">
                        <i className="fas fa-file-alt mr-2 text-blue-600" />
                        完整决策报告
                      </h4>
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="markdown-content">
                          <ReactMarkdown
                            rehypePlugins={[rehypeRaw, rehypeSanitize]}
                            components={{
                              h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-gray-900 mb-4 mt-6" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-xl font-bold text-gray-900 mb-3 mt-5" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4" {...props} />,
                              h4: ({node, ...props}) => <h4 className="text-base font-semibold text-gray-900 mb-2 mt-3" {...props} />,
                              p: ({node, ...props}) => <p className="text-gray-700 mb-3 leading-relaxed" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc list-inside mb-3 space-y-1 text-gray-700" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-3 space-y-1 text-gray-700" {...props} />,
                              li: ({node, ...props}) => <li className="text-gray-700 ml-4" {...props} />,
                              strong: ({node, ...props}) => <strong className="font-semibold text-gray-900" {...props} />,
                              em: ({node, ...props}) => <em className="italic text-gray-700" {...props} />,
                              code: ({node, inline, ...props}: any) => 
                                inline 
                                  ? <code className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
                                  : <code className="block bg-gray-50 text-gray-800 p-3 rounded border border-gray-200 text-sm font-mono overflow-x-auto mb-3" {...props} />,
                              pre: ({node, ...props}) => <pre className="bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto mb-3" {...props} />,
                              blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-700 my-3" {...props} />,
                              table: ({node, ...props}) => <table className="min-w-full border-collapse border border-gray-300 mb-3" {...props} />,
                              thead: ({node, ...props}) => <thead className="bg-gray-50" {...props} />,
                              th: ({node, ...props}) => <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-900" {...props} />,
                              td: ({node, ...props}) => <td className="border border-gray-300 px-4 py-2 text-gray-700" {...props} />,
                              a: ({node, ...props}) => <a className="text-blue-600 hover:text-blue-800 underline" {...props} />,
                              hr: ({node, ...props}) => <hr className="my-4 border-gray-300" {...props} />,
                            }}
                          >
                            {detailData.decision_report}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Account Snapshot */}
                  {detailData.account_snapshot && Object.keys(detailData.account_snapshot).length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">
                        <i className="fas fa-wallet mr-2 text-green-600" />
                        账户快照
                      </h4>
                      <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
                        <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono overflow-x-auto">
                          {JSON.stringify(detailData.account_snapshot, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Trades Executed */}
                  {detailData.trades_executed && detailData.trades_executed.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">
                        <i className="fas fa-exchange-alt mr-2 text-orange-600" />
                        执行交易 ({detailData.trades_executed.length})
                      </h4>
                      <div className="space-y-3">
                        {detailData.trades_executed.map((trade: any, idx: number) => (
                          <div
                            key={idx}
                            className={`rounded-lg p-4 border-l-4 shadow-sm ${
                              trade.action === 'BUY'
                                ? 'bg-green-50 border-green-500'
                                : 'bg-red-50 border-red-500'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  trade.action === 'BUY' 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-red-500 text-white'
                                }`}>
                                  {trade.action === 'BUY' ? '买入' : trade.action === 'SELL' ? '卖出' : trade.action || '未知'}
                                </span>
                                <span className="font-bold text-lg text-gray-900">
                                  {trade.stock || '未知股票'}
                                </span>
                              </div>
                              {trade.price && (
                                <span className="text-base font-semibold text-gray-700">
                                  ${trade.price}
                                </span>
                              )}
                            </div>
                            {trade.quantity && (
                              <div className="text-sm text-gray-700 font-medium mb-2">
                                <i className="fas fa-layer-group mr-2 text-gray-500" />
                                数量: <span className="font-bold">{trade.quantity}</span> 股
                              </div>
                            )}
                            {trade.description && (
                              <div className="text-sm text-gray-700 mt-3 pt-3 border-t border-gray-300 leading-relaxed">
                                <i className="fas fa-info-circle mr-2 text-blue-500" />
                                {trade.description}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-600">
                  无法加载详情
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={handleCloseDetail}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
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
