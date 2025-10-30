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
    // 删除成功后的处理
    onSuccess: (data, analysisId) => {
      console.log('✅ Delete successful, updating cache for:', analysisId);
      
      // 1. 先手动从所有列表缓存中移除该项
      queryClient.setQueriesData<AnalysisListResponse>(
        { queryKey: queryKeys.analysis.all },
        (old) => {
          if (!old || !old.analyses || !Array.isArray(old.analyses)) {
            return old;
          }
          
          const filteredAnalyses = old.analyses.filter(a => a.id !== analysisId);
          console.log(`🗑️ Removed from cache: ${old.analyses.length} → ${filteredAnalyses.length}`);
          
          return {
            ...old,
            analyses: filteredAnalyses,
            total: Math.max(0, old.total - 1),
          };
        }
      );
      
      // 2. 然后使缓存失效并重新获取（确保与服务器同步）
      queryClient.invalidateQueries({
        queryKey: queryKeys.analysis.all,
        refetchType: 'active'
      });
      
      console.log('🔄 Cache updated and queries invalidated');
    },
  });
}
