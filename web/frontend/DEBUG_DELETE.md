# 删除操作调试指南

## 错误：Cannot read properties of undefined (reading 'filter')

### 错误原因

这个错误发生在乐观更新时，尝试访问 `old.analyses.filter()` 但 `old.analyses` 是 `undefined`。

### 可能的情况

1. **缓存中没有数据**
   - 首次加载页面，还没有获取过列表数据
   - 缓存已被清除（如退出登录后）

2. **数据结构不匹配**
   - 后端返回的数据结构与预期不符
   - `analyses` 字段不存在或不是数组

3. **查询键不匹配**
   - `setQueriesData` 使用的查询键与实际查询不匹配
   - 导致找不到对应的缓存数据

## 已修复的代码

### 修复前（会报错）

```typescript
queryClient.setQueriesData<AnalysisListResponse>(
  { queryKey: queryKeys.analysis.all },
  (old) => {
    if (!old) return old;
    return {
      ...old,
      analyses: old.analyses.filter(a => a.id !== analysisId), // ❌ 如果 old.analyses 是 undefined 会报错
      total: old.total - 1,
    };
  }
);
```

### 修复后（安全）

```typescript
queryClient.setQueriesData<AnalysisListResponse>(
  { queryKey: queryKeys.analysis.all },
  (old) => {
    // ✅ 检查数据结构是否完整
    if (!old || !old.analyses || !Array.isArray(old.analyses)) {
      console.warn('⚠️ Invalid data structure, skipping optimistic update');
      return old;
    }
    
    const newAnalyses = old.analyses.filter(a => a.id !== analysisId);
    
    return {
      ...old,
      analyses: newAnalyses,
      total: Math.max(0, old.total - 1), // ✅ 确保 total 不会变成负数
    };
  }
);
```

## 调试步骤

### 1. 打开浏览器控制台

按 `F12` 打开开发者工具，切换到 Console 标签

### 2. 查看删除操作的日志

删除时会输出以下日志：

```
🔄 Starting optimistic update for: <analysisId>
📸 Snapshot taken, queries count: <数量>
📊 Current data: <数据对象>
✅ Optimistic update: removed item, count: <删除前> → <删除后>
🔄 Invalidating queries to fetch latest data...
✅ Queries invalidated, refetch triggered
```

### 3. 检查数据结构

如果看到警告：
```
⚠️ Invalid data structure, skipping optimistic update
```

说明缓存中的数据结构不正确，检查：

```javascript
// 在控制台执行
const queries = queryClient.getQueryCache().findAll({ 
  queryKey: ['analysis'] 
});

queries.forEach(q => {
  console.log('Query key:', q.queryKey);
  console.log('Query data:', q.state.data);
});
```

### 4. 检查后端返回的数据

在 Network 标签中查看 `/api/analyses` 请求的响应：

```json
{
  "analyses": [
    {
      "id": "xxx",
      "ticker": "AAPL",
      // ...
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 10
}
```

确保：
- ✅ `analyses` 字段存在
- ✅ `analyses` 是数组
- ✅ 数组中的对象有 `id` 字段

## 常见问题排查

### 问题1：删除时报错 "Cannot read properties of undefined"

**检查**：
```javascript
// 在删除前，在控制台执行
const data = queryClient.getQueryData(['analysis', 'list', { page: 1, limit: 10 }]);
console.log('Current data:', data);
console.log('Has analyses?', data?.analyses);
console.log('Is array?', Array.isArray(data?.analyses));
```

**可能原因**：
- 缓存中没有数据（首次加载或已清除）
- 查询键不匹配

**解决方案**：
- 已在代码中添加了安全检查
- 如果数据不存在，跳过乐观更新，等待 `invalidateQueries` 刷新

### 问题2：删除后 UI 没有立即更新

**检查日志**：
```
🔄 Starting optimistic update for: xxx
⚠️ Invalid data structure, skipping optimistic update
```

**原因**：乐观更新被跳过，因为数据结构不正确

**效果**：
- UI 不会立即更新（没有乐观更新）
- 但删除请求仍会发送
- `invalidateQueries` 会触发重新获取
- 最终 UI 会更新（稍有延迟）

### 问题3：删除后看到重复的加载

**正常行为**：
1. 乐观更新：UI 立即移除（如果成功）
2. 发送删除请求
3. `invalidateQueries`：重新获取数据
4. UI 更新显示最新数据

**如果看到两次加载**：
- 第一次：乐观更新失败，跳过
- 第二次：`invalidateQueries` 触发的正常刷新

## 测试场景

### 场景1：正常删除（有缓存）

```
1. 访问历史列表页面
   → 获取数据并缓存
   
2. 点击删除
   → 乐观更新：UI 立即移除 ✅
   → 发送删除请求
   → invalidateQueries：重新获取
   → UI 显示最新数据
```

### 场景2：首次删除（无缓存）

```
1. 直接访问某个分析的详情页
   → 没有访问过列表页，列表缓存为空
   
2. 从详情页点击删除
   → 乐观更新：跳过（无缓存数据）⚠️
   → 发送删除请求
   → invalidateQueries：重新获取
   → UI 显示最新数据
```

### 场景3：退出登录后删除

```
1. 用户A退出登录
   → queryClient.clear() 清除所有缓存
   
2. 用户B登录并访问列表
   → 获取用户B的数据并缓存
   
3. 用户B点击删除
   → 乐观更新：UI 立即移除 ✅
   → 发送删除请求
   → invalidateQueries：重新获取
   → UI 显示最新数据
```

## 性能优化建议

### 当前实现

```typescript
// 乐观更新 + invalidateQueries
onMutate: async (analysisId) => {
  // 立即更新 UI（如果有缓存）
  queryClient.setQueriesData(/* ... */);
},
onSettled: () => {
  // 重新获取确保数据准确
  queryClient.invalidateQueries(/* ... */);
}
```

**优点**：
- ✅ 有缓存时 UI 立即响应
- ✅ 最终数据准确（从服务器获取）
- ✅ 失败时自动回滚

**缺点**：
- ⚠️ 无缓存时没有立即反馈
- ⚠️ 会发起两次更新（乐观 + 实际）

### 替代方案：仅使用 invalidateQueries

```typescript
// 不使用乐观更新
useMutation({
  mutationFn: deleteAnalysis,
  onSuccess: () => {
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.analysis.all 
    });
  },
});
```

**优点**：
- ✅ 代码简单
- ✅ 不会出现数据结构问题
- ✅ 数据始终准确

**缺点**：
- ❌ UI 响应稍慢（需要等待服务器响应）

### 推荐

**当前实现（乐观更新 + invalidateQueries）更好**，因为：
- 大多数情况下有缓存，用户体验更好
- 已添加安全检查，不会报错
- 无缓存时自动降级为普通刷新

## 监控和日志

### 生产环境

在生产环境中，可以移除详细日志，只保留错误日志：

```typescript
onMutate: async (analysisId: string) => {
  try {
    await queryClient.cancelQueries({ queryKey: queryKeys.analysis.all });
    const previousData = queryClient.getQueriesData({ queryKey: queryKeys.analysis.all });
    
    queryClient.setQueriesData<AnalysisListResponse>(
      { queryKey: queryKeys.analysis.all },
      (old) => {
        if (!old || !old.analyses || !Array.isArray(old.analyses)) {
          return old;
        }
        return {
          ...old,
          analyses: old.analyses.filter(a => a.id !== analysisId),
          total: Math.max(0, old.total - 1),
        };
      }
    );
    
    return { previousData };
  } catch (error) {
    console.error('Optimistic update failed:', error);
    return { previousData: [] };
  }
},
```

### 添加错误追踪

如果使用 Sentry 等错误追踪服务：

```typescript
onError: (err, analysisId, context) => {
  console.error('Delete failed:', err);
  
  // 发送到错误追踪服务
  if (window.Sentry) {
    window.Sentry.captureException(err, {
      tags: {
        operation: 'delete_analysis',
        analysisId,
      },
    });
  }
  
  // 回滚
  if (context?.previousData) {
    context.previousData.forEach(([queryKey, data]) => {
      queryClient.setQueryData(queryKey, data);
    });
  }
},
```

## 总结

### 修复内容

1. ✅ 添加了数据结构检查，避免 `undefined.filter()` 错误
2. ✅ 添加了详细的调试日志
3. ✅ 确保 `total` 不会变成负数
4. ✅ 改进了错误处理

### 预期行为

- **有缓存**：删除时 UI 立即更新，然后刷新确认
- **无缓存**：删除时跳过乐观更新，等待刷新后更新 UI
- **失败时**：自动回滚到删除前的状态

### 用户体验

- 大多数情况下：立即响应 ⚡
- 特殊情况下：稍有延迟但不会报错 ✅
- 失败时：自动恢复，显示错误提示 🔄
