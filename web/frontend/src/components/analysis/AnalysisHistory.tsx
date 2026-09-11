'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildApiUrl, API_ENDPOINTS } from '../../utils/api';
import { logger } from '@/utils/logger';
import { useDeleteAnalysis } from '@/hooks/useDeleteAnalysis';
import { queryKeys } from '@/lib/react-query';
import { ResponsiveAnalysisCard } from './ResponsiveAnalysisCard';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { RouteDataState } from '@/components/ui/RouteDataState';
import { DesktopAnalysisRow } from './history/DesktopAnalysisRow';
import { AnalysisHistoryPagination } from './history/AnalysisHistoryPagination';
import { DeleteConfirmDialog } from './history/DeleteConfirmDialog';


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
  const [page, setPage] = useState(1);
  const limit = 10; // 每页显示10条
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; analysisId: string; ticker: string }>({
    show: false,
    analysisId: '',
    ticker: ''
  });
  const isMobile = useIsMobile();

  // 使用删除 mutation
  const deleteMutation = useDeleteAnalysis();

  // 使用 useQuery 获取分析历史
  const { data, isLoading, isError, error, refetch } = useQuery<AnalysisListResponse>({
    queryKey: queryKeys.analysis.list({ page, limit }),
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('请先登录');
      }

      const response = await fetch(buildApiUrl(`${API_ENDPOINTS.ANALYSIS.LIST}?page=${page}&limit=${limit}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
    staleTime: 30 * 1000, // 30秒缓存，减少不必要的请求
    gcTime: 5 * 60 * 1000, // 5分钟保留缓存
    retry: 3, // 最多重试3次
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

    try {
      await deleteMutation.mutateAsync(analysisId);

      // 如果当前页删除后为空且页码>1，则回退到上一页
      if (analyses.length === 1 && page > 1) {
        setPage(p => p - 1);
      }

      onShowToast('分析已删除', 'success');
    } catch (error) {
      logger.error('Delete error:', error);
      onShowToast(error instanceof Error ? error.message : '删除失败', 'error');
    }
  };

  // 处理错误提示
  useEffect(() => {
    if (isError && error) {
      onShowToast(error instanceof Error ? error.message : '获取分析历史失败', 'error');
    }
  }, [isError, error, onShowToast]);

  if (isLoading || isError) return <RouteDataState loading={isLoading} loadingMessage="正在加载分析历史..." error={isError ? (error instanceof Error ? error : new Error('获取分析历史失败')) : null} errorTitle="分析历史加载失败" onRetry={() => void refetch()}>{null}</RouteDataState>;

  return (
    <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border">
      <div className="p-6 border-b border-dark-border">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-text-primary">
            <i className="fas fa-history mr-2 text-accent-primary" />
            分析历史
          </h3>
          <button
            onClick={onBackToConfig}
            className="text-text-secondary hover:text-text-primary"
          >
            <i className="fas fa-times" />
          </button>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {analyses.length === 0 ? (
          <RouteDataState empty emptyIcon="fa-chart-line" emptyTitle="暂无分析记录" emptyDescription="您还没有创建任何股票分析" emptyAction={<button onClick={onBackToConfig} className="px-4 py-2 bg-accent-primary text-dark-primary rounded-md hover:bg-accent-secondary">创建新分析</button>}>{null}</RouteDataState>
        ) : isMobile ? (
          // Mobile: Card layout
          <div className="space-y-3">
            {analyses.map((analysis) => (
              <ResponsiveAnalysisCard
                key={analysis.id}
                analysis={analysis}
                onViewResults={onViewResults}
                onViewProgress={onViewProgress}
                onDelete={handleDeleteClick}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        ) : (
          // Desktop: Table layout
          <div className="space-y-3">
            {analyses.map((analysis) => (
              <DesktopAnalysisRow
                key={analysis.id}
                analysis={analysis}
                onViewResults={onViewResults}
                onViewProgress={onViewProgress}
                onDelete={handleDeleteClick}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* 分页控件 */}
      {analyses.length > 0 && totalPages > 1 && (
        <AnalysisHistoryPagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          isMobile={isMobile}
          onPageChange={setPage}
        />
      )}

      {/* 底部新建分析按钮 */}
      {analyses.length > 0 && (
        <div className="mt-6 p-6 bg-dark-tertiary border-t border-dark-border">
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
        <DeleteConfirmDialog
          ticker={deleteConfirm.ticker}
          onCancel={() => setDeleteConfirm({ show: false, analysisId: '', ticker: '' })}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}