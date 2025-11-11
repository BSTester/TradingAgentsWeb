# 缓存优化总结

## 问题描述

在删除或修改列表项状态时，由于使用了 React Query 的缓存机制，会出现以下问题：
1. 删除成功后，前端列表中的项被移除
2. 但再次请求时，由于缓存未更新，删除的项又重新出现
3. 修改状态也有类似问题，状态变更不能立即反映在缓存中

## 解决方案

使用 **乐观更新（Optimistic Updates）** 策略，在请求发送前立即更新缓存，提供更好的用户体验。

### 核心原理

1. **onMutate**: 在 mutation 执行前
   - 取消所有相关的查询请求，避免覆盖乐观更新
   - 保存当前缓存数据快照（用于回滚）
   - 立即更新缓存数据（乐观更新）

2. **onError**: 如果请求失败
   - 使用保存的快照回滚缓存数据
   - 显示错误提示

3. **onSettled**: 无论成功或失败
   - 重新获取数据以确保与服务器同步

## 已优化的组件

### 1. 分析历史列表 (AnalysisHistory)

**文件**: `web/frontend/src/hooks/useDeleteAnalysis.ts`

**优化内容**:
- 删除分析时使用乐观更新
- 立即从所有列表缓存中移除已删除项
- 失败时自动回滚

**关键代码**:
```typescript
onMutate: async (analysisId) => {
  await queryClient.cancelQueries({ queryKey: queryKeys.analysis.all });
  const previousLists = queryClient.getQueriesData({ queryKey: queryKeys.analysis.all });
  
  queryClient.setQueriesData<AnalysisListResponse>(
    { queryKey: queryKeys.analysis.all },
    (old) => {
      if (!old || !old.analyses) return old;
      return {
        ...old,
        analyses: old.analyses.filter(a => a.id !== analysisId),
        total: Math.max(0, old.total - 1),
      };
    }
  );
  
  return { previousLists };
}
```

### 2. 定期报告列表 (ScheduledTasks)

**文件**: `web/frontend/src/hooks/useScheduledTasks.ts`

**优化内容**:
- 删除任务时使用乐观更新
- 修改任务状态（启用/暂停）时使用乐观更新
- 所有列表查询都会被同步更新

**关键改进**:
- `useDeleteScheduledTask`: 删除时立即从缓存移除
- `useUpdateScheduledTask`: 更新时立即修改缓存中的对应项

### 3. 用户管理 (UserManagement)

**文件**: `web/frontend/src/app/admin/users/page.tsx`

**优化内容**:
- 切换用户激活状态时使用乐观更新
- 切换智能盯盘权限时使用乐观更新
- 立即反映在 UI 中，无需等待服务器响应

**关键代码**:
```typescript
onMutate: async ({ userId, isActive }) => {
  await queryClient.cancelQueries({ queryKey: ['admin', 'users'] });
  const previousLists = queryClient.getQueriesData({ queryKey: ['admin', 'users'] });
  
  queryClient.setQueriesData({ queryKey: ['admin', 'users'] }, (old: any) => {
    if (!old || !old.users) return old;
    return {
      ...old,
      users: old.users.map((u: User) => 
        u.id === userId ? { ...u, is_active: isActive } : u
      ),
    };
  });
  
  return { previousLists };
}
```

### 4. API 客户端优化

**文件**: `web/frontend/src/lib/apiClient.ts`

**优化内容**:
- 统一 scheduledTasksAPI 的方法命名
- 添加向后兼容的别名
- 改进错误处理

## 优化效果

### 用户体验改进
1. ✅ 删除操作立即生效，无需等待
2. ✅ 状态切换立即反映，响应更快
3. ✅ 失败时自动回滚，数据一致性有保障
4. ✅ 减少不必要的网络请求

### 技术优势
1. ✅ 使用 React Query 的最佳实践
2. ✅ 乐观更新 + 错误回滚机制
3. ✅ 缓存管理更加智能
4. ✅ 代码结构清晰，易于维护

## 调试日志

为了便于调试，在关键操作中添加了 console.log：
- `🚀 Starting optimistic delete`: 开始乐观删除
- `🗑️ Optimistically removed`: 已从缓存移除
- `❌ Delete failed, rolling back`: 删除失败，回滚
- `🔄 Refetching to sync with server`: 重新获取以同步

## 注意事项

1. **缓存时间设置**: 
   - 列表数据：30秒 staleTime
   - 详情数据：根据需要调整
   - 统计数据：1分钟 staleTime

2. **错误处理**:
   - 所有 mutation 都有完整的错误处理
   - 失败时会自动回滚到之前的状态
   - 用户会看到友好的错误提示

3. **性能优化**:
   - 使用 `refetchType: 'active'` 只刷新活跃的查询
   - 避免不必要的全局刷新
   - 合理设置 gcTime（垃圾回收时间）

## 未来改进

1. 考虑添加更细粒度的缓存失效策略
2. 可以添加离线支持（使用 IndexedDB）
3. 考虑实现批量操作的乐观更新
4. 添加更多的性能监控指标

## 相关文档

- [React Query - Optimistic Updates](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)
- [React Query - Mutations](https://tanstack.com/query/latest/docs/react/guides/mutations)
- [React Query - Query Invalidation](https://tanstack.com/query/latest/docs/react/guides/query-invalidation)
