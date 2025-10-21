'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { buildApiUrl, API_ENDPOINTS } from '../../utils/api';
import { logger } from '@/utils/logger';


interface AnalysisHistoryProps {
  onBackToConfig: () => void;
  onViewResults: (analysisId: string) => void;
  onViewProgress: (analysisId: string) => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

interface AnalysisRecord {
  id: string;
  ticker: string;
  company_name?: string;
  market?: string;
  analysis_date: string;
  status: string;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  is_public: boolean;
  summary?: {
    recommendation?: string;
  };
}

interface AnalysisListResponse {
  analyses: AnalysisRecord[];
  total: number;
  page: number;
  limit: number;
}

export function AnalysisHistory({ onBackToConfig, onViewResults, onViewProgress, onShowToast }: AnalysisHistoryProps) {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  const limit = 10; // 每页显示10条
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; analysisId: string; ticker: string }>({
    show: false,
    analysisId: '',
    ticker: ''
  });

  // 使用 useQuery 获取分析历史
  const { data, isLoading, isError, error } = useQuery<AnalysisListResponse>({
    queryKey: ['analysis', 'list', page, limit],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('请先登录');
      }

      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.ANALYSIS.LIST}?page=${page}&limit=${limit}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('登录已过期，请重新登录');
        }
        throw new Error('获取分析历史失败');
      }

      const result = await response.json();
      logger.log('📋 Fetched analyses:', result);
      return result;
    },
    retry: 10, // 最多重试10次
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // 指数退避，最多10秒
  });

  const analyses = data?.analyses || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleDeleteClick = (analysisId: string, ticker: string) => {
    setDeleteConfirm({ show: true, analysisId, ticker });
  };

  const handleDeleteConfirm = async () => {
    const analysisId = deleteConfirm.analysisId;
    setDeleteConfirm({ show: false, analysisId: '', ticker: '' });
    setDeleting(analysisId);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(buildApiUrl(`/api/analysis/${analysisId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || '删除失败');
      }

      // 如果当前页删除后为空且页码>1，则先回退到上一页
      // 这样 invalidateQueries 会自动获取上一页的数据
      if (analyses.length === 1 && page > 1) {
        setPage(p => p - 1);
        // 等待 state 更新后再使缓存失效
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['analysis', 'list'] });
        }, 0);
      } else {
        // 否则直接使缓存失效，重新获取当前页数据
        queryClient.invalidateQueries({ queryKey: ['analysis', 'list'] });
      }

      onShowToast('分析已删除', 'success');
    } catch (error) {
      logger.error('Delete error:', error);
      onShowToast(error instanceof Error ? error.message : '删除失败', 'error');
    } finally {
      setDeleting(null);
    }
  };

  // 处理错误提示
  useEffect(() => {
    if (isError && error) {
      onShowToast(error instanceof Error ? error.message : '获取分析历史失败', 'error');
    }
  }, [isError, error, onShowToast]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      case 'interrupted':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'queued':
        return '排队中';
      case 'initializing':
        return '初始化中';
      case 'running':
        return '分析中';
      case 'completed':
        return '已完成';
      case 'error':
        return '错误';
      case 'interrupted':
        return '已中断';
      default:
        return status;
    }
  };

  const getRecommendationColor = (recommendation?: string) => {
    const rec = recommendation?.trim().toLowerCase();
    switch (rec) {
      case '买入':
      case 'buy':
        return 'text-white bg-gradient-to-br from-green-500 to-green-600 shadow-md';
      case '持有':
      case '观望':
      case 'hold':
        return 'text-white bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-md';
      case '卖出':
      case 'sell':
        return 'text-white bg-gradient-to-br from-red-500 to-red-600 shadow-md';
      default:
        return 'text-white bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-md';
    }
  };

  const getRecommendationIcon = (recommendation?: string) => {
    const rec = recommendation?.trim().toLowerCase();
    switch (rec) {
      case '买入':
      case 'buy':
        return 'fa-arrow-up';
      case '持有':
      case '观望':
      case 'hold':
        return 'fa-minus';
      case '卖出':
      case 'sell':
        return 'fa-arrow-down';
      default:
        return 'fa-question';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-12">
        <div className="text-center">
          <div className="relative inline-block mb-4">
            {/* 外圈旋转 */}
            <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            {/* 内圈反向旋转 */}
            <div className="absolute top-2 left-2 w-16 h-16 border-4 border-purple-200 border-b-purple-600 rounded-full animate-spin-reverse"></div>
          </div>
          <p className="text-gray-700 font-medium text-lg">正在加载分析历史...</p>
          <p className="text-sm text-gray-500 mt-2">正在获取您的分析记录</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            <i className="fas fa-history mr-2 text-blue-600" />
            分析历史
          </h3>
          <button
            onClick={onBackToConfig}
            className="text-gray-500 hover:text-gray-700"
          >
            <i className="fas fa-times" />
          </button>
        </div>
      </div>

      <div className="p-6">
        {analyses.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无分析记录</h3>
            <p className="text-gray-600 mb-4">您还没有创建任何股票分析</p>
            <button
              onClick={onBackToConfig}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              创建新分析
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {analyses.map((analysis) => (
              <div
                key={analysis.id}
                className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow duration-200 bg-white relative overflow-hidden"
              >
                {/* 右上角公开标记 - 三角形角标 */}
                {analysis.is_public && (
                  <div className="absolute top-0 right-0 w-0 h-0 border-t-[40px] border-t-blue-500 border-l-[40px] border-l-transparent">
                    <i className="fas fa-globe absolute -top-[32px] right-[4px] text-white text-xs" title="公开" />
                  </div>
                )}

                {/* 五列布局：股票代码 | 投资建议 | 分析日期 | 创建时间 | 操作按钮 */}
                <div className="flex items-center gap-4">
                  {/* 第1列：股票代码 - 左对齐 */}
                  <div className="flex items-center justify-start space-x-2 flex-1 text-sm">
                    <div className={`text-white w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-md ${
                      analysis.summary?.recommendation?.toLowerCase().includes('买入') || analysis.summary?.recommendation?.toLowerCase().includes('buy')
                        ? 'bg-gradient-to-br from-green-500 to-green-600'
                        : analysis.summary?.recommendation?.toLowerCase().includes('卖出') || analysis.summary?.recommendation?.toLowerCase().includes('sell')
                        ? 'bg-gradient-to-br from-red-500 to-red-600'
                        : analysis.summary?.recommendation
                        ? 'bg-gradient-to-br from-yellow-500 to-yellow-600'
                        : 'bg-gradient-to-br from-gray-500 to-gray-600'
                    }`}>
                      {analysis.ticker.substring(0, 2)}
                    </div>
                    <div className="flex flex-col">
                      <h4 className="text-sm font-bold text-gray-900">
                        {analysis.ticker}{analysis.company_name && ` (${analysis.company_name})`}
                      </h4>
                      <div className="flex items-center space-x-2">
                        {analysis.market && (
                          <span className="text-xs text-gray-500">
                            {analysis.market === 'US' ? '美股' : analysis.market === 'HK' ? '港股' : 'A股'}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(analysis.status)} text-center`}>
                          {getStatusLabel(analysis.status)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 第2列：投资建议 - 自动平分 */}
                  <div className="flex items-center justify-center flex-1 text-sm">
                    {analysis.summary && analysis.status === 'completed' && (
                      <span className={`px-3 py-1.5 rounded-lg font-bold text-sm flex items-center ${getRecommendationColor(analysis.summary.recommendation)}`}>
                        <i className={`fas ${getRecommendationIcon(analysis.summary.recommendation)} mr-1.5 text-sm`} />
                        {analysis.summary.recommendation}
                      </span>
                    )}
                    {analysis.status === 'running' && (
                      <div className="flex items-center text-blue-600 font-medium text-sm">
                        <i className="fas fa-spinner fa-spin mr-1.5 text-sm" />
                        <span>{analysis.progress_percentage.toFixed(0)}%</span>
                      </div>
                    )}
                  </div>

                  {/* 第3列：分析日期 - 上下排列 */}
                  <div className="flex items-center justify-center text-sm flex-1">
                    <i className={`far fa-calendar mr-1.5 text-xs ${
                      analysis.summary?.recommendation?.toLowerCase().includes('买入') || analysis.summary?.recommendation?.toLowerCase().includes('buy')
                        ? 'text-green-500'
                        : analysis.summary?.recommendation?.toLowerCase().includes('卖出') || analysis.summary?.recommendation?.toLowerCase().includes('sell')
                        ? 'text-red-500'
                        : analysis.summary?.recommendation
                        ? 'text-yellow-500'
                        : 'text-gray-500'
                    }`} />
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500">分析日期</span>
                      <span className="text-xs font-medium text-gray-900">{analysis.analysis_date}</span>
                    </div>
                  </div>

                  {/* 第4列：创建时间 - 上下排列 */}
                  <div className="flex items-center justify-center text-sm flex-1">
                    <i className={`far fa-clock mr-1.5 text-xs ${
                      analysis.summary?.recommendation?.toLowerCase().includes('买入') || analysis.summary?.recommendation?.toLowerCase().includes('buy')
                        ? 'text-green-500'
                        : analysis.summary?.recommendation?.toLowerCase().includes('卖出') || analysis.summary?.recommendation?.toLowerCase().includes('sell')
                        ? 'text-red-500'
                        : analysis.summary?.recommendation
                        ? 'text-yellow-500'
                        : 'text-gray-500'
                    }`} />
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500">创建时间</span>
                      <span className="text-xs font-medium text-gray-900">{new Date(analysis.created_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* 第5列：完成时间 - 上下排列 */}
                  <div className="flex items-center justify-center text-sm flex-1">
                    {analysis.completed_at ? (
                      <>
                        <i className={`fas fa-check-circle mr-1.5 text-xs ${
                          analysis.summary?.recommendation?.toLowerCase().includes('买入') || analysis.summary?.recommendation?.toLowerCase().includes('buy')
                            ? 'text-green-500'
                            : analysis.summary?.recommendation?.toLowerCase().includes('卖出') || analysis.summary?.recommendation?.toLowerCase().includes('sell')
                            ? 'text-red-500'
                            : analysis.summary?.recommendation
                            ? 'text-yellow-500'
                            : 'text-gray-500'
                        }`} />
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500">完成时间</span>
                          <span className="text-xs font-medium text-gray-900">{new Date(analysis.completed_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </div>

                  {/* 第6列：操作按钮 - 自动平分 */}
                  <div className="flex items-center justify-center space-x-2 flex-1">
                    {analysis.status === 'completed' && (
                      <button
                        onClick={() => onViewResults(analysis.id)}
                        className={`px-3 py-1.5 text-white rounded-md text-sm font-medium transition-colors flex items-center shadow-md ${
                          analysis.summary?.recommendation?.toLowerCase().includes('买入') || analysis.summary?.recommendation?.toLowerCase().includes('buy')
                            ? 'bg-green-600 hover:bg-green-700'
                            : analysis.summary?.recommendation?.toLowerCase().includes('卖出') || analysis.summary?.recommendation?.toLowerCase().includes('sell')
                            ? 'bg-red-600 hover:bg-red-700'
                            : analysis.summary?.recommendation
                            ? 'bg-yellow-600 hover:bg-yellow-700'
                            : 'bg-gray-600 hover:bg-gray-700'
                        }`}
                      >
                        <i className="fas fa-chart-line mr-1.5 text-sm" />
                        查看详情
                      </button>
                    )}

                    {analysis.status === 'running' && (
                      <button
                        onClick={() => onViewProgress(analysis.id)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors flex items-center"
                      >
                        <i className="fas fa-tasks mr-1.5 text-sm" />
                        查看进度
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteClick(analysis.id, analysis.ticker)}
                      disabled={analysis.status === 'running' || analysis.status === 'initializing' || deleting === analysis.id}
                      className="px-2 py-1.5 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting === analysis.id ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-1.5 text-sm" />
                          删除中
                        </>
                      ) : (
                        <>
                          <i className="fas fa-trash-alt mr-1.5 text-sm" />
                          删除
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 分页控件 */}
      {analyses.length > 0 && totalPages > 1 && (
        <div className="mt-6 p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            {/* 左侧：显示信息 */}
            <div className="text-sm text-gray-600">
              显示第 {(page - 1) * limit + 1} - {Math.min(page * limit, total)} 条，共 {total} 条记录
            </div>

            {/* 右侧：分页按钮 */}
            <div className="flex items-center space-x-2">
              {/* 上一页 */}
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <i className="fas fa-chevron-left mr-1" />
                上一页
              </button>

              {/* 页码 */}
              <div className="flex items-center space-x-1">
                {/* 第一页 */}
                {page > 3 && (
                  <>
                    <button
                      onClick={() => setPage(1)}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      1
                    </button>
                    {page > 4 && <span className="px-2 text-gray-500">...</span>}
                  </>
                )}

                {/* 当前页附近的页码 */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p >= page - 2 && p <= page + 2)
                  .map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${p === page
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      {p}
                    </button>
                  ))}

                {/* 最后一页 */}
                {page < totalPages - 2 && (
                  <>
                    {page < totalPages - 3 && <span className="px-2 text-gray-500">...</span>}
                    <button
                      onClick={() => setPage(totalPages)}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>

              {/* 下一页 */}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                下一页
                <i className="fas fa-chevron-right ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 底部新建分析按钮 */}
      {analyses.length > 0 && (
        <div className="mt-6 p-6 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-center mb-6">
            <button
              onClick={onBackToConfig}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center font-medium"
            >
              <i className="fas fa-plus-circle mr-2" />
              新建分析
            </button>
          </div>

          {/* 免责声明 */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <div className="flex items-start">
              <i className="fas fa-exclamation-triangle text-yellow-600 text-xl mr-3 mt-1" />
              <div>
                <h4 className="text-sm font-bold text-yellow-800 mb-1">免责声明</h4>
                <p className="text-xs text-yellow-700 leading-relaxed">
                  本报告由AI智能体系统生成，仅供参考，不构成任何投资建议。股市有风险，投资需谨慎。
                  投资者应当根据自身风险承受能力、投资目标和财务状况，独立做出投资决策并自行承担投资风险。
                  过往业绩不代表未来表现，市场波动可能导致本金损失。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-fade-in">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mr-4">
                  <i className="fas fa-exclamation-triangle text-red-600 text-xl" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
                  <p className="text-sm text-gray-600">此操作无法撤销</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-700">
                  确定要删除 <span className="font-bold text-gray-900">{deleteConfirm.ticker}</span> 的分析记录吗？
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  删除后，所有相关的分析数据和结果都将被永久删除。
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setDeleteConfirm({ show: false, analysisId: '', ticker: '' })}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}