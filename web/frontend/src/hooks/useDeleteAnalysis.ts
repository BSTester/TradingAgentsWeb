import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buildApiUrl } from '@/utils/api';
import { queryKeys } from '@/lib/react-query';

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
    // 删除成功后，使缓存失效并重新获取数据
    onSuccess: () => {
      // 使所有 analysis 相关的查询失效
      // 由于列表的 staleTime: 0，会立即重新获取最新数据
      queryClient.invalidateQueries({
        queryKey: queryKeys.analysis.all,
        refetchType: 'active'
      });
    },
  });
}
