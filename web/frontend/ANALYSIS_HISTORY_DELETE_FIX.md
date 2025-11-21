# 分析历史删除操作优化

## 问题描述

分析历史列表在删除操作后，列表不会立即刷新，用户需要手动刷新页面才能看到更新后的列表。

## 解决方案

参考定时分析列表的实现，为分析历史的删除操作添加**乐观更新**（Optimistic Update）机制。

## 修改内容

### 文件：`web/frontend/src/hooks/useDeleteAnalysis.ts`

**修改前的问题：**
- 只在删除成功后（`onSuccess`）更新缓存
- UI 更新有延迟，用户体验不佳

**修改后的改进：**
1. **乐观更新（`onMutate`）**：在删除请求发送前立即更新 UI
   - 取消正在进行的查询，避免覆盖乐观更新
   - 保存数据快照，以便出错时回滚
   - 立即从列表中移除被删除的项

2. **错误回滚（`onError`）**：如果删除失败，恢复之前的数据
   - 使用保存的快照恢复 UI 状态
   - 确保数据一致性

3. **数据同步（`onSettled`）**：无论成功还是失败，都重新获取数据
   - 确保 UI 与服务器状态同步
   - 处理并发操作的情况

## 实现对比

### 定时任务删除（参考实现）

```typescript
export function useDeleteScheduledTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: number) => scheduledTasksAPI.delete(taskId),
    onMutate: async (taskId) => {
      // 乐观更新：立即从 UI 中移除
      await queryClient.cancelQueries({ queryKey: scheduledTasksKeys.lists() });
      const previousLists = queryClient.getQueriesData({ queryKey: scheduledTasksKeys.lists() });
      
      queryClient.setQueriesData({ queryKey: scheduledTasksKeys.lists() }, (old: any) => {
        if (!old || !old.items) return old;
        return {
          ...old,
          items: old.items.filter((task: any) => task.id !== taskId),
          total: old.total - 1,
        };
      });

      return { previousLists };
    },
    onError: (_err, _taskId, context) => {
      // 回滚
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // 重新获取数据
      queryClient.invalidateQueries({ queryKey: scheduledTasksKeys.lists() });
    },
  });
}
```

### 分析历史删除（修复后）

```typescript
export function useDeleteAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (analysisId: string) => {
      // ... 删除请求
    },
    onMutate: async (analysisId) => {
      // 乐观更新：立即从 UI 中移除
      await queryClient.cancelQueries({ queryKey: queryKeys.analysis.all });
      const previousLists = queryClient.getQueriesData({ queryKey: queryKeys.analysis.all });
      
      queryClient.setQueriesData<AnalysisListResponse>(
        { queryKey: queryKeys.analysis.all },
        (old) => {
          if (!old || !old.analyses || !Array.isArray(old.analyses)) return old;
          
          const filteredAnalyses = old.analyses.filter(a => a.id !== analysisId);
          return {
            ...old,
            analyses: filteredAnalyses,
            total: Math.max(0, old.total - 1),
          };
        }
      );

      return { previousLists };
    },
    onError: (_err, _analysisId, context) => {
      // 回滚
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // 重新获取数据
      queryClient.invalidateQueries({
        queryKey: queryKeys.analysis.all,
        refetchType: 'active'
      });
    },
  });
}
```

## 用户体验改进

### 修改前
1. 用户点击删除按钮
2. 等待服务器响应（可能需要几秒）
3. 服务器响应成功后，UI 才更新
4. 用户看到列表刷新

**问题**：删除操作有明显延迟，用户体验不佳

### 修改后
1. 用户点击删除按钮
2. **UI 立即更新**，被删除的项立即从列表中消失
3. 后台发送删除请求到服务器
4. 如果成功：保持 UI 状态，后台同步数据
5. 如果失败：回滚 UI 状态，显示错误提示

**优势**：
- ✅ 即时反馈，用户体验流畅
- ✅ 减少等待时间
- ✅ 错误处理完善，数据一致性有保障
- ✅ 与定时任务列表行为一致

## 技术要点

### 乐观更新的三个关键步骤

1. **`onMutate`**：在请求发送前执行
   - 取消正在进行的查询
   - 保存当前数据快照
   - 立即更新 UI

2. **`onError`**：请求失败时执行
   - 使用快照恢复数据
   - 显示错误提示

3. **`onSettled`**：无论成功失败都执行
   - 使缓存失效
   - 重新获取最新数据
   - 确保与服务器同步

### React Query 最佳实践

- 使用 `cancelQueries` 避免竞态条件
- 使用 `setQueriesData` 批量更新多个查询
- 使用 `invalidateQueries` 触发重新获取
- 返回上下文对象用于错误回滚

## 测试建议

1. **正常删除**：删除一条记录，验证 UI 立即更新
2. **网络延迟**：模拟慢网络，验证 UI 仍然立即响应
3. **删除失败**：模拟服务器错误，验证 UI 正确回滚
4. **并发删除**：快速删除多条记录，验证数据一致性
5. **分页场景**：删除当前页最后一条记录，验证是否正确回退到上一页

## 相关文件

- `web/frontend/src/hooks/useDeleteAnalysis.ts` - 分析历史删除 hook
- `web/frontend/src/hooks/useScheduledTasks.ts` - 定时任务 hooks（参考实现）
- `web/frontend/src/components/analysis/AnalysisHistory.tsx` - 分析历史组件
- `web/frontend/src/app/scheduled-tasks/page.tsx` - 定时任务页面（参考实现）
