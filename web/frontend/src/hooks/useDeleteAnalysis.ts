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
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || '删除失败');
      }

      return response.json();
    },
    // 乐观更新：在删除请求发送前立即更新 UI
    onMutate: async (analysisId: string) => {
      // 取消所有正在进行的查询，避免覆盖我们的乐观更新
      await queryClient.cancelQueries({ queryKey: queryKeys.analysis.all });

      // 获取当前所有列表查询的快照
      const previousData = queryClient.getQueriesData({ queryKey: queryKeys.analysis.all });

      // 乐观更新：从所有列表中移除该项
      queryClient.setQueriesData<AnalysisListResponse>(
        { queryKey: queryKeys.analysis.all },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            analyses: old.analyses.filter(a => a.id !== analysisId),
            total: old.total - 1,
          };
        }
      );

      // 返回快照以便在失败时回滚
      return { previousData };
    },
    // 如果删除失败，回滚到之前的状态
    onError: (err, analysisId, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    // 无论成功还是失败，都重新获取数据以确保同步
    onSettled: () => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.analysis.all,
        refetchType: 'active'
      });
    },
  });
}
