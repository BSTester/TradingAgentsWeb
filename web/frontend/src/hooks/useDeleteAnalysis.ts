import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buildApiUrl } from '@/utils/api';
import { queryKeys } from '@/lib/react-query';

interface AnalysisListResponse {
  analyses: any[];
  total: number;
  page: number;
  limit: number;
}

export function useDeleteAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (analysisId: string) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(buildApiUrl(`/api/analysis/${analysisId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || '删除失败');
      }

      return response.json();
    },
    // 乐观更新：在删除请求发送前立即更新 UI
    onMutate: async (analysisId) => {
      console.log('🚀 Starting optimistic delete for:', analysisId);
      
      // 取消所有正在进行的查询，避免覆盖我们的乐观更新
      await queryClient.cancelQueries({ queryKey: queryKeys.analysis.all });

      // 保存之前的数据快照，以便出错时回滚
      const previousLists = queryClient.getQueriesData({ queryKey: queryKeys.analysis.all });

      // 乐观更新：立即从所有列表缓存中移除该项
      queryClient.setQueriesData<AnalysisListResponse>(
        { queryKey: queryKeys.analysis.all },
        (old) => {
          if (!old || !old.analyses || !Array.isArray(old.analyses)) {
            return old;
          }
          
          const filteredAnalyses = old.analyses.filter(a => a.id !== analysisId);
          console.log(`🗑️ Optimistically removed from cache: ${old.analyses.length} → ${filteredAnalyses.length}`);
          
          return {
            ...old,
            analyses: filteredAnalyses,
            total: Math.max(0, old.total - 1),
          };
        }
      );

      // 返回上下文对象，包含快照数据
      return { previousLists };
    },
    // 如果删除失败，回滚到之前的状态
    onError: (_err, _analysisId, context) => {
      console.error('❌ Delete failed, rolling back optimistic update');
      
      // 恢复之前的数据
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    // 无论成功还是失败，都重新获取数据以确保与服务器同步
    onSettled: () => {
      console.log('🔄 Refetching analysis list to sync with server');
      
      queryClient.invalidateQueries({
        queryKey: queryKeys.analysis.all,
        refetchType: 'active'
      });
    },
  });
}
