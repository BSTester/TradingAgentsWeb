# 缓存刷新流程详解

## invalidateQueries 的调用位置

### 文件位置
`web/frontend/src/hooks/useDeleteAnalysis.ts` 第72-76行

### 代码位置
```typescript
export function useDeleteAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (analysisId: string) => {
      // 发送删除请求到后端
    },
    onMutate: async (analysisId: string) => {
      // 乐观更新：立即从 UI 移除
    },
    onError: (err, analysisId, context) => {
      // 如果失败，回滚 UI
    },
    onSettled: () => {
      // 👇👇👇 这里调用 invalidateQueries 👇👇👇
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.analysis.all,
        refetchType: 'active'
      });
    },
  });
}
```

## 完整的调用链

### 1. 用户点击删除按钮

**文件**：`web/frontend/src/components/analysis/AnalysisHistory.tsx`

```typescript
// 第95行左右
const handleDeleteClick = (analysisId: string, ticker: string) => {
  setDeleteConfirm({ show: true, analysisId, ticker });
};
```

### 2. 用户确认删除

**文件**：`web/frontend/src/components/analysis/AnalysisHistory.tsx`

```typescript
// 第99行左右
const handleDeleteConfirm = async () => {
  const analysisId = deleteConfirm.analysisId;
  setDeleteConfirm({ show: false, analysisId: '', ticker: '' });
  
  try {
    // 👇 调用删除 mutation
    await deleteMutation.mutateAsync(analysisId);
    
    if (analyses.length === 1 && page > 1) {
      setPage(p => p - 1);
    }
    
    onShowToast('分析已删除', 'success');
  } catch (error) {
    logger.error('Delete error:', error);
    onShowToast(error instanceof Error ? error.message : '删除失败', 'error');
  }
};
```

### 3. 执行删除 mutation

**文件**：`web/frontend/src/hooks/useDeleteAnalysis.ts`

```typescript
// 执行流程：
return useMutation({
  // 步骤1：发送删除请求
  mutationFn: async (analysisId: string) => {
    const response = await fetch(buildApiUrl(`/api/analysis/${analysisId}`), {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  },
  
  // 步骤2：请求发送前 - 乐观更新
  onMutate: async (analysisId: string) => {
    // 立即从 UI 移除该项
    queryClient.setQueriesData(/* ... */);
  },
  
  // 步骤3：如果失败 - 回滚
  onError: (err, analysisId, context) => {
    // 恢复之前的数据
    queryClient.setQueryData(/* ... */);
  },
  
  // 步骤4：无论成功失败 - 刷新数据
  onSettled: () => {
    // 👇👇👇 这里调用 invalidateQueries 👇👇👇
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.analysis.all,
      refetchType: 'active'
    });
  },
});
```

### 4. invalidateQueries 执行

```typescript
queryClient.invalidateQueries({ 
  queryKey: queryKeys.analysis.all,  // ['analysis']
  refetchType: 'active'
});
```

**作用**：
1. 查找所有匹配 `['analysis']` 开头的查询
2. 标记这些查询为"过期"（忽略 staleTime）
3. 如果查询正在被使用（active），立即触发 refetch

### 5. 自动重新获取列表数据

**文件**：`web/frontend/src/components/analysis/AnalysisHistory.tsx`

```typescript
// 第54行左右
const { data, isLoading, isError, error } = useQuery<AnalysisListResponse>({
  queryKey: queryKeys.analysis.list({ page, limit }),
  queryFn: async () => {
    // 👇 这个函数会被自动调用
    const response = await fetch(buildApiUrl(`${API_ENDPOINTS.ANALYSIS.LIST}?page=${page}&limit=${limit}`), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  },
});
```

### 6. UI 更新显示最新数据

React Query 自动更新 `data`，组件重新渲染，显示最新的列表（已删除的项不再出现）

## 时间线流程图

```
用户操作                    前端处理                      后端处理
   |                          |                            |
   | 点击删除按钮              |                            |
   |------------------------->|                            |
   |                          | handleDeleteClick          |
   |                          | 显示确认对话框              |
   |                          |                            |
   | 确认删除                  |                            |
   |------------------------->|                            |
   |                          | handleDeleteConfirm        |
   |                          |                            |
   |                          | deleteMutation.mutateAsync |
   |                          |                            |
   |                          | onMutate (乐观更新)         |
   | 看到记录立即消失 <--------|  - 从 UI 移除该项          |
   |                          |                            |
   |                          | mutationFn (发送请求)       |
   |                          |--------------------------->|
   |                          |                            | 执行删除
   |                          |                            | 从数据库删除
   |                          |                            |
   |                          |<---------------------------|
   |                          | 收到成功响应                |
   |                          |                            |
   |                          | onSettled                  |
   |                          | invalidateQueries 👈👈👈   |
   |                          |  - 标记查询为过期           |
   |                          |  - 触发 refetch            |
   |                          |                            |
   |                          | queryFn (重新获取)          |
   |                          |--------------------------->|
   |                          |                            | 查询最新列表
   |                          |                            |
   |                          |<---------------------------|
   |                          | 收到最新数据                |
   |                          |                            |
   | 看到最新列表 <-----------|  UI 更新                   |
   | (已删除的项不再出现)      |                            |
```

## 关键点说明

### 为什么在 onSettled 中调用？

```typescript
onSettled: () => {
  queryClient.invalidateQueries({ ... });
}
```

**原因**：
- `onSettled` 在 mutation 完成后调用（无论成功或失败）
- 确保无论删除成功还是失败，都能获取最新的服务器数据
- 如果成功：获取删除后的最新列表
- 如果失败：获取服务器的实际状态（可能有其他变化）

### 为什么用 queryKeys.analysis.all？

```typescript
queryKey: queryKeys.analysis.all  // ['analysis']
```

**原因**：
- 使所有以 `['analysis']` 开头的查询失效
- 包括：
  - `['analysis', 'list', { page: 1, limit: 10 }]`
  - `['analysis', 'list', { page: 2, limit: 10 }]`
  - `['analysis', 'detail', 'xxx']`
  - 等等...

### 为什么用 refetchType: 'active'？

```typescript
refetchType: 'active'
```

**原因**：
- 只刷新当前正在使用的查询
- 不刷新已卸载组件的查询
- 节省资源，提高性能

## 其他操作的 invalidateQueries

### 创建分析后刷新列表

```typescript
// 创建分析的 mutation
useMutation({
  mutationFn: createAnalysis,
  onSuccess: () => {
    // 创建成功后刷新列表
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.analysis.all 
    });
  },
});
```

### 更新分析后刷新详情

```typescript
// 更新分析的 mutation
useMutation({
  mutationFn: updateAnalysis,
  onSuccess: (data, variables) => {
    // 刷新该分析的详情
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.analysis.detail(variables.id) 
    });
    // 同时刷新列表
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.analysis.all 
    });
  },
});
```

## 调试技巧

### 1. 查看 invalidateQueries 是否被调用

在 `useDeleteAnalysis.ts` 中添加日志：

```typescript
onSettled: () => {
  console.log('🔄 Invalidating queries...');
  queryClient.invalidateQueries({ 
    queryKey: queryKeys.analysis.all,
    refetchType: 'active'
  });
  console.log('✅ Queries invalidated');
},
```

### 2. 查看哪些查询被失效

```typescript
onSettled: () => {
  const queries = queryClient.getQueryCache().findAll({ 
    queryKey: queryKeys.analysis.all 
  });
  console.log('📋 Queries to invalidate:', queries.map(q => q.queryKey));
  
  queryClient.invalidateQueries({ 
    queryKey: queryKeys.analysis.all,
    refetchType: 'active'
  });
},
```

### 3. 监听查询状态变化

在 `AnalysisHistory.tsx` 中：

```typescript
const { data, isLoading, isFetching, dataUpdatedAt } = useQuery({
  queryKey: queryKeys.analysis.list({ page, limit }),
  queryFn: fetchAnalysisList,
});

useEffect(() => {
  console.log('📊 Query state:', {
    isLoading,
    isFetching,
    dataUpdatedAt: new Date(dataUpdatedAt),
    recordCount: data?.analyses.length,
  });
}, [isLoading, isFetching, dataUpdatedAt, data]);
```

## 总结

**invalidateQueries 的位置**：
- 文件：`web/frontend/src/hooks/useDeleteAnalysis.ts`
- 位置：`onSettled` 回调中（第72-76行）
- 时机：删除操作完成后（无论成功或失败）

**作用**：
- 强制标记查询为"过期"
- 触发自动重新获取数据
- 确保 UI 显示最新数据

**效果**：
- 删除后列表立即刷新
- 已删除的项不再出现
- 保持数据一致性
