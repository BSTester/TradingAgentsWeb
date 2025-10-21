# React Query 缓存机制详解

## 参数对比

### staleTime vs gcTime

```
时间轴示例：

0s ────────── 60s ────────── 600s
    staleTime=60s   gcTime=600s

[数据获取] → [新鲜期] → [过期期] → [清除]
             ↓          ↓          ↓
             使用缓存    重新获取    缓存清除
```

### staleTime（数据新鲜度）

```typescript
staleTime: 60000 // 60秒

// 行为：
0-60秒：   数据"新鲜" → 使用缓存，不发请求
60秒后：   数据"过期" → 下次访问时重新获取
```

**示例场景**：
```
用户访问列表页（0秒）
  → 从服务器获取数据
  → 数据标记为"新鲜"

用户30秒后刷新页面
  → 数据仍然"新鲜"
  → 直接使用缓存 ✅（快速）

用户70秒后刷新页面
  → 数据已"过期"
  → 重新从服务器获取 🔄
```

### gcTime（垃圾回收时间）

```typescript
gcTime: 600000 // 600秒（10分钟）

// 行为：
组件挂载：   缓存存在 → 立即显示缓存
组件卸载：   开始计时 → 10分钟后清除缓存
重新挂载：   10分钟内 → 可以使用缓存
```

**示例场景**：
```
用户访问列表页
  → 获取数据并缓存

用户离开页面（组件卸载）
  → 缓存保留，开始倒计时

用户5分钟后返回
  → 缓存仍存在
  → 立即显示缓存数据 ✅
  → 根据 staleTime 决定是否刷新

用户15分钟后返回
  → 缓存已清除
  → 需要重新获取 🔄
```

## 历史记录列表的缓存策略

### 当前配置

```typescript
// 全局默认
staleTime: 1 * 60 * 1000  // 1分钟
gcTime: 10 * 60 * 1000    // 10分钟

// 列表查询 - 使用全局默认
useQuery({
  queryKey: queryKeys.analysis.list({ page, limit }),
  queryFn: fetchAnalysisList,
  // 继承全局配置
})

// 删除操作 - 使用 invalidateQueries
useMutation({
  mutationFn: deleteAnalysis,
  onSettled: () => {
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.analysis.all 
    });
  },
})
```

### 工作流程详解

#### 场景1：正常浏览

```
时间线：
0s     用户访问列表页
       ↓ 从服务器获取数据
       ↓ 缓存1分钟

30s    用户刷新页面
       ↓ 数据仍新鲜
       ✅ 使用缓存（快速）

70s    用户再次刷新
       ↓ 数据已过期
       🔄 重新获取
```

#### 场景2：删除操作

```
时间线：
0s     用户访问列表页
       ↓ 从服务器获取数据
       ↓ 缓存1分钟

10s    用户点击删除
       ↓ 乐观更新：UI 立即移除
       ↓ 发送删除请求
       ↓ 删除成功
       ↓ invalidateQueries 使缓存失效
       🔄 立即重新获取最新数据
       ✅ 显示最新列表
```

### 为什么这样设计？

#### ❌ 方案A：staleTime: 0（不推荐）

```typescript
useQuery({
  staleTime: 0,  // 每次��重新获取
  gcTime: 0,     // 不保留缓存
})
```

**问题**：
- 用户每次访问都要等待加载
- 增加服务器负载
- 浪费带宽
- 用户体验差

**场景**：
```
用户访问列表 → 加载中... 🔄
用户点击详情 → 返回列表 → 加载中... 🔄
用户刷新页面 → 加载中... 🔄
```

#### ✅ 方案B：staleTime: 60s + invalidateQueries（推荐）

```typescript
useQuery({
  staleTime: 60000,  // 1分钟缓存
  gcTime: 600000,    // 10分钟保留
})

// 删除时
queryClient.invalidateQueries({ 
  queryKey: queryKeys.analysis.all 
});
```

**优点**：
- 正常浏览时使用缓存（快速）
- 删除时强制刷新（准确）
- 平衡性能和数据准确性

**场景**：
```
用户访问列表 → 加载中... 🔄
用户点击详情 → 返回列表 → 立即显示 ✅（缓存）
用户删除记录 → 立即刷新 🔄（invalidate）
用户刷新页面 → 立即显示 ✅（缓存仍有效）
```

## invalidateQueries 的工作原理

### 基本用法

```typescript
// 使特定查询失效
queryClient.invalidateQueries({ 
  queryKey: ['analysis', 'list'] 
});

// 使所有匹配的查询失效
queryClient.invalidateQueries({ 
  queryKey: queryKeys.analysis.all  // ['analysis']
});
```

### 失效过程

```
调用 invalidateQueries
  ↓
标记查询为"过期"（忽略 staleTime）
  ↓
如果组件正在使用该查询
  ↓
立即触发 refetch
  ↓
获取最新数据
  ↓
更新 UI
```

### 与 staleTime 的关系

```typescript
// 正常情况
staleTime: 60000
0-60秒：使用缓存
60秒后：重新获取

// 调用 invalidateQueries 后
立即标记为过期（忽略 staleTime）
立即重新获取
```

## 最佳实践总结

### 1. 列表数据

```typescript
// ✅ 推荐：使用默认缓存 + invalidateQueries
useQuery({
  queryKey: queryKeys.analysis.list({ page, limit }),
  // 使用全局默认配置
})

// 变更操作后
queryClient.invalidateQueries({ 
  queryKey: queryKeys.analysis.all 
});
```

### 2. 详情数据

```typescript
// ✅ 推荐：中等缓存时间
useQuery({
  queryKey: queryKeys.analysis.detail(id),
  staleTime: 2 * 60 * 1000, // 2分钟
})

// 更新后
queryClient.invalidateQueries({ 
  queryKey: queryKeys.analysis.detail(id) 
});
```

### 3. 静态数据

```typescript
// ✅ 推荐：长期缓存
useQuery({
  queryKey: queryKeys.config.all,
  staleTime: 10 * 60 * 1000, // 10分钟
  gcTime: 30 * 60 * 1000,    // 30分钟
})
```

### 4. 实时数据

```typescript
// ✅ 推荐：短缓存 + 自动刷新
useQuery({
  queryKey: queryKeys.analysis.status(id),
  staleTime: 5 * 1000,      // 5秒
  refetchInterval: 5000,     // 每5秒刷新
})
```

## 常见误区

### 误区1：认为 staleTime: 0 是最安全的

**错误想法**：设置 `staleTime: 0` 可以确保数据始终最新

**实际情况**：
- 浪费资源（每次都请求）
- 用户体验差（频繁加载）
- 增加服务器负载

**正确做法**：
- 使用合理的 `staleTime`
- 在数据变更时使用 `invalidateQueries`

### 误区2：混淆 staleTime 和 gcTime

**错误理解**：
- `staleTime` = 缓存保留时间 ❌
- `gcTime` = 数据新鲜度 ❌

**正确理解**：
- `staleTime` = 数据新鲜度（决定何时重新获取）
- `gcTime` = 缓存保留时间（决定何时清除缓存）

### 误区3：不使用 invalidateQueries

**错误做法**：
```typescript
// 删除后不刷新，依赖 staleTime 自然过期
await deleteAnalysis(id);
// 用户可能看到已删除的数据（直到 staleTime 过期）
```

**正确做法**：
```typescript
// 删除后立即使缓存失效
await deleteAnalysis(id);
queryClient.invalidateQueries({ 
  queryKey: queryKeys.analysis.all 
});
// 立即显示最新数据
```

## 用户切换时的缓存管理

### 退出登录清除缓存

**问题**：如果不清除缓存，下一个用户登录时可能看到上一个用户的数据

**解决方案**：在退出登录时清除所有缓存

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

### 工作流程

```
用户A登录
  ↓
访问历史列表（缓存用户A的数据）
  ↓
用户A退出登录
  ↓
queryClient.clear() 清除所有缓存
  ↓
用户B登录
  ↓
访问历史列表（从服务器获取用户B的数据）
  ✅ 不会看到用户A的数据
```

### queryClient.clear() vs invalidateQueries()

| 方法 | 作用 | 使用场景 |
|------|------|----------|
| `clear()` | 清除所有缓存 | 退出登录、用户切换 |
| `invalidateQueries()` | 标记特定查询为过期 | 数据变更（增删改） |

```typescript
// 退出登录 - 清除所有
queryClient.clear();

// 删除操作 - 只刷新相关查询
queryClient.invalidateQueries({ 
  queryKey: queryKeys.analysis.all 
});
```

## 调试技巧

### 1. 查看查询状态

```typescript
const queryState = queryClient.getQueryState(queryKey);
console.log({
  dataUpdatedAt: new Date(queryState.dataUpdatedAt),
  isStale: queryState.isStale,
  isFetching: queryState.isFetching,
});
```

### 2. 监听查询变化

```typescript
useQuery({
  queryKey: ['analysis', 'list'],
  onSuccess: (data) => {
    console.log('✅ Data fetched:', new Date().toISOString());
  },
  onError: (error) => {
    console.error('❌ Fetch failed:', error);
  },
});
```

### 3. 使用 React Query DevTools

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<ReactQueryDevtools initialIsOpen={false} />
```

可以查看：
- 所有查询的状态
- 缓存数据
- 刷新时机
- 失效操作

### 4. 验证缓存清除

```typescript
// 退出前
console.log('Queries before logout:', queryClient.getQueryCache().getAll().length);

logout();

// 退出后
console.log('Queries after logout:', queryClient.getQueryCache().getAll().length);
// 应该输出 0
```
