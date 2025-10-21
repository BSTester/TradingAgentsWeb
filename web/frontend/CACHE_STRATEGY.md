# 前端缓存策略说明

## React Query 缓存配置

### 全局配置 (`src/lib/react-query.ts`)

```typescript
{
  queries: {
    staleTime: 1 * 60 * 1000,    // 1分钟 - 数据新鲜度
    gcTime: 10 * 60 * 1000,      // 10分钟 - 缓存保留时间
    retry: 3,                     // 失败重试次数
  }
}
```

### 关键概念

1. **staleTime（数据新鲜度）**
   - 数据被认为是"新鲜"的时间
   - 在此期间，React Query 不会重新获取数据
   - 设置为 `0` 表示数据立即过期，每次都会重新获取

2. **gcTime（垃圾回收时间，原 cacheTime）**
   - 未使用的缓存数据保留时间
   - 超过此时间后，缓存会被清理

3. **invalidateQueries（使缓存失效）**
   - 手动标记查询为过期
   - 会触发重新获取数据

## 删除操作的缓存刷新策略

### 实现方案

#### 1. 使用 Mutation Hook（已实现）

创建了 `useDeleteAnalysis` hook，包含以下特性：

- **乐观更新**：删除前立即更新 UI，提升用户体验
- **错误回滚**：如果删除失败，自动恢复之前的状态
- **自动刷新**：删除成功后自动使相关查询失效并重新获取

```typescript
// 使用示例
const deleteMutation = useDeleteAnalysis();

await deleteMutation.mutateAsync(analysisId);
```

#### 2. 列表查询配置

为分析列表设置 `staleTime: 0`，确保：
- 删除后立即重新获取最新数据
- 避免显示已删除的项目
- 保持数据一致性

```typescript
useQuery({
  queryKey: queryKeys.analysis.list({ page, limit }),
  staleTime: 0, // 立即过期
  // ...
})
```

### 其他需要立即刷新的操作

对于其他修改数据的操作（创建、更新等），也应该：

1. **创建对应的 Mutation Hook**
   ```typescript
   export function useCreateAnalysis() {
     const queryClient = useQueryClient();
     
     return useMutation({
       mutationFn: createAnalysisFn,
       onSuccess: () => {
         queryClient.invalidateQueries({ 
           queryKey: queryKeys.analysis.all 
         });
       },
     });
   }
   ```

2. **在操作成功后使相关查询失效**
   ```typescript
   queryClient.invalidateQueries({ 
     queryKey: queryKeys.analysis.all 
   });
   ```

3. **可选：实现乐观更新**
   - 提升用户体验
   - 需要处理失败回滚

## 最佳实践

### 1. 查询键管理

使用统一的查询键工厂（`queryKeys`）：

```typescript
export const queryKeys = {
  analysis: {
    all: ['analysis'] as const,
    list: (params?: Record<string, unknown>) => 
      ['analysis', 'list', params] as const,
    detail: (id: string) => 
      ['analysis', 'detail', id] as const,
  },
};
```

### 2. 缓存失效策略

- **精确失效**：只失效需要更新的查询
  ```typescript
  queryClient.invalidateQueries({ 
    queryKey: queryKeys.analysis.detail(id) 
  });
  ```

- **批量失效**：失效所有相关查询
  ```typescript
  queryClient.invalidateQueries({ 
    queryKey: queryKeys.analysis.all 
  });
  ```

### 3. 不同场景的 staleTime 配置

- **静态数据**（配置、字典等）：`staleTime: Infinity`
- **频繁变化的数据**（列表、状态）：`staleTime: 0`
- **一般数据**：`staleTime: 1-5分钟`

### 4. 乐观更新的使用场景

适合使用乐观更新：
- ✅ 删除操作
- ✅ 简单的状态切换（点赞、收藏）
- ✅ 表单提交

不适合使用乐观更新：
- ❌ 复杂的数据转换
- ❌ 需要服务器计算的结果
- ❌ 有复杂验证逻辑的操作

## 调试技巧

### 1. 启用 React Query DevTools

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<ReactQueryDevtools initialIsOpen={false} />
```

### 2. 查看缓存状态

```typescript
const queryState = queryClient.getQueryState(queryKey);
console.log('Query state:', queryState);
```

### 3. 手动清除缓存

```typescript
// 清除特定查询
queryClient.removeQueries({ queryKey: ['analysis'] });

// 清除所有缓存
queryClient.clear();
```

## 常见问题

### Q: 删除后列表没有立即更新？

**A:** 检查以下几点：
1. 是否调用了 `invalidateQueries`
2. `staleTime` 是否设置过长
3. 查询键是否匹配

### Q: 页面切换后数据还是旧的？

**A:** 可能是缓存时间过长，考虑：
1. 减少 `staleTime`
2. 在页面进入时手动刷新：`refetch()`

### Q: 如何避免重复请求？

**A:** React Query 自动处理：
- 相同查询键的请求会被合并
- 使用 `staleTime` 控制重新获取频率
