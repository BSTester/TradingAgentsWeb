# 前端缓存策略说明

## React Query 核心概念

### `staleTime`（数据新鲜度）
- **含义**：数据被认为是"新鲜"的时间
- **行为**：在此时间内，React Query 使用缓存，不会重新获取数据
- **示例**：
  - `staleTime: 0` → 立即过期，每次都重新获取
  - `staleTime: 60000` → 1分钟内使用缓存

### `gcTime`（垃圾回收时间）
- **含义**：未使用的缓存数据保留时间
- **行为**：组件卸载后，缓存保留此时间，超时后清除
- **示例**：
  - `gcTime: 0` → 组件卸载后立即清除
  - `gcTime: 300000` → 保留5分钟

### `invalidateQueries`（使缓存失效）
- **含义**：手动标记查询为"过期"
- **行为**：强制重新获取数据，忽略 `staleTime`
- **用途**：在数据变更（增删改）后立即刷新

## 全局配置 (`src/lib/react-query.ts`)

```typescript
{
  queries: {
    staleTime: 1 * 60 * 1000,    // 1分钟 - 默认数据新鲜度
    gcTime: 10 * 60 * 1000,      // 10分钟 - 缓存保留时间
    retry: 3,                     // 失败重试次数
  }
}
```

## 历史记录列表的缓存策略

### 设计思路

✅ **列表不缓存**：设置 `staleTime: 0`，确保每次访问都获取最新数据
✅ **删除时立即刷新**：通过 `invalidateQueries` 触发重新获取

### 实现方式

```typescript
// 1. 列表查询 - 不缓存
useQuery({
  queryKey: queryKeys.analysis.list({ page, limit }),
  queryFn: fetchAnalysisList,
  staleTime: 0,  // 不缓存，每次都重新获取
  gcTime: 0,     // 不保留缓存
})

// 2. 删除操作 - 简单可靠
useMutation({
  mutationFn: deleteAnalysis,
  onSuccess: () => {
    // 删除成功后，使缓存失效并重新获取
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.analysis.all 
    });
  },
})
```

### 工作流程

```
用户访问列表页
  ↓
从服务器获取数据（不缓存）
  ↓
用户点击删除
  ↓
显示"删除中"状态
  ↓
发送删除请求
  ↓
删除成功：invalidateQueries 使缓存失效
  ↓
自动重新获取最新数据
  ↓
显示最新列表（已删除的项不再出现）
```

### 为什么不缓存列表？

**原因**：
- 历史记录列表是经常变化的数据（删除、新增分析）
- 不缓存可以确保用户始终看到最新数据
- 避免乐观更新带来的复杂性和潜在问题

**权衡**：
- ❌ 每次访问都需要请求（稍慢）
- ✅ 数据始终准确（无缓存问题）
- ✅ 代码简单可靠（无乐观更新）
- ✅ 删除后立即显示最新数据

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

### 核心机制：staleTime: 0 + invalidateQueries

**关键点**：列表不缓存（`staleTime: 0`），删除后通过 `invalidateQueries` 触发刷新

### 实现方案

#### 1. 使用 Mutation Hook（已实现）

创建了 `useDeleteAnalysis` hook，简单可靠：

```typescript
export function useDeleteAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (analysisId: string) => {
      // 发送删除请求
      const response = await fetch(buildApiUrl(`/api/analysis/${analysisId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.json();
    },
    onSuccess: () => {
      // 删除成功后，使缓存失效并重新获取
      queryClient.invalidateQueries({
        queryKey: queryKeys.analysis.all,
        refetchType: 'active'
      });
    },
  });
}
```

**使用示例**：
```typescript
const deleteMutation = useDeleteAnalysis();
await deleteMutation.mutateAsync(analysisId);
```

#### 2. invalidateQueries 的作用

```typescript
onSuccess: () => {
  // 使所有 analysis 相关的查询失效
  queryClient.invalidateQueries({ 
    queryKey: queryKeys.analysis.all,
    refetchType: 'active'
  });
}
```

**效果**：
- ✅ 标记查询为过期
- ✅ 触发重新获取数据
- ✅ 确保显示最新列表（已删除的项不再出现）

#### 3. 为什么选择 staleTime: 0？

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| `staleTime: 0` | 数据始终最新<br>代码简单 | 每次访问都请求 | ✅ 历史记录列表 |
| `staleTime: 60s + 乐观更新` | 有缓存，响应快 | 代码复杂<br>可能出错 | 其他数据 |

**结论**：对于历史记录列表，使用 `staleTime: 0` 更简单可靠，虽然每次都请求，但确保数据准确。

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

### 3. 不同场景的缓存配置建议

**当前配置**：所有查询使用全局默认（1分钟缓存），通过 `invalidateQueries` 处理数据变更

如需针对特定数据类型优化，可以覆盖配置：

```typescript
// 静态数据 - 长期缓存
useQuery({
  queryKey: queryKeys.config.all,
  queryFn: fetchConfig,
  staleTime: 10 * 60 * 1000, // 10分钟
  gcTime: 30 * 60 * 1000,    // 30分钟
});

// 详情数据 - 使用默认（1分钟）
useQuery({
  queryKey: queryKeys.analysis.detail(id),
  queryFn: fetchAnalysisDetail,
  // 使用全局默认配置
});

// 实时状态 - 短期缓存 + 自动刷新
useQuery({
  queryKey: queryKeys.analysis.status(id),
  queryFn: fetchAnalysisStatus,
  staleTime: 5 * 1000, // 5秒
  refetchInterval: 5000, // 每5秒自动刷新
});

// 列表数据 - 使用默认 + invalidateQueries
useQuery({
  queryKey: queryKeys.analysis.list({ page, limit }),
  queryFn: fetchAnalysisList,
  // 使用全局默认，删除时通过 invalidateQueries 刷新
});
```

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

## 用户切换时的缓存处理

### 退出登录时清除缓存

为了避免下一个用户看到上一个用户的数据，在退出登录时会清除所有缓存：

```typescript
// src/lib/auth.tsx
const logout = () => {
  setUser(null);
  setToken(null);
  localStorage.removeItem('access_token');
  document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
  
  // 清除所有 React Query 缓存
  queryClient.clear();
};
```

**效果**：
- ✅ 退出后清除所有缓存数据
- ✅ 下一个用户登录时从空白状态开始
- ✅ 避免数据泄露和隐私问题

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

### Q: 退出登录后，下一个用户会看到上一个用户的数据吗？

**A:** 不会。退出登录时会调用 `queryClient.clear()` 清除所有缓存，确保数据隔离。
