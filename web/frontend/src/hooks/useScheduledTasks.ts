/**
 * React Query hooks for scheduled tasks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduledTasksAPI } from '@/lib/api';

// Query keys
export const scheduledTasksKeys = {
  all: ['scheduled-tasks'] as const,
  lists: () => [...scheduledTasksKeys.all, 'list'] as const,
  list: (page: number, limit: number) => [...scheduledTasksKeys.lists(), { page, limit }] as const,
  details: () => [...scheduledTasksKeys.all, 'detail'] as const,
  detail: (id: number) => [...scheduledTasksKeys.details(), id] as const,
};

// Hook to list scheduled tasks
export function useScheduledTasks(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: scheduledTasksKeys.list(page, limit),
    queryFn: () => scheduledTasksAPI.list({ page, limit }),
    staleTime: 30 * 1000, // 30秒缓存，减少不必要的请求
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

// Hook to get a single scheduled task
export function useScheduledTask(taskId: number) {
  return useQuery({
    queryKey: scheduledTasksKeys.detail(taskId),
    queryFn: () => scheduledTasksAPI.get(taskId),
    enabled: !!taskId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Hook to create a scheduled task
export function useCreateScheduledTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: scheduledTasksAPI.create,
    onSuccess: () => {
      // Invalidate and refetch scheduled tasks list
      queryClient.invalidateQueries({ queryKey: scheduledTasksKeys.lists() });
    },
  });
}

// Hook to update a scheduled task
export function useUpdateScheduledTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: { is_enabled?: boolean; task_name?: string } }) =>
      scheduledTasksAPI.update(taskId, data),
    onMutate: async ({ taskId, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: scheduledTasksKeys.detail(taskId) });

      // Snapshot the previous value
      const previousTask = queryClient.getQueryData(scheduledTasksKeys.detail(taskId));

      // Optimistically update to the new value
      if (previousTask) {
        queryClient.setQueryData(scheduledTasksKeys.detail(taskId), {
          ...previousTask,
          ...data,
        });
      }

      // Return a context object with the snapshotted value
      return { previousTask };
    },
    onError: (_err, { taskId }, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousTask) {
        queryClient.setQueryData(scheduledTasksKeys.detail(taskId), context.previousTask);
      }
    },
    onSettled: (_data, _error, { taskId }) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: scheduledTasksKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: scheduledTasksKeys.lists() });
    },
  });
}

// Hook to delete a scheduled task
export function useDeleteScheduledTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: number) => scheduledTasksAPI.delete(taskId),
    onMutate: async (taskId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: scheduledTasksKeys.lists() });

      // Snapshot the previous value
      const previousLists = queryClient.getQueriesData({ queryKey: scheduledTasksKeys.lists() });

      // Optimistically update all list queries
      queryClient.setQueriesData({ queryKey: scheduledTasksKeys.lists() }, (old: any) => {
        if (!old || !old.items) return old;
        
        return {
          ...old,
          items: old.items.filter((task: any) => task.id !== taskId),
          total: old.total - 1,
        };
      });

      // Return a context object with the snapshotted value
      return { previousLists };
    },
    onError: (_err, _taskId, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: scheduledTasksKeys.lists() });
    },
  });
}
