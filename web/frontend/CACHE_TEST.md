# 缓存配置测试指南

## 测试1：验证删除操作后立即刷新

### 测试步骤

1. **打开分析历史页面**
   - 访问 `/history` 页面
   - 确保列表中有多条分析记录

2. **执行删除操作**
   - 点击任意一条记录的"删除"按钮
   - 确认删除

3. **验证结果**
   - ✅ 删除的记录应该立即从列表中消失（乐观更新）
   - ✅ 列表应该自动刷新显示最新数据
   - ✅ 如果删除失败，记录应该重新出现（错误回滚）

## 测试2：验证退出登录清除缓存

### 测试步骤

1. **用户A登录并访问历史列表**
   - 使用用户A的账号登录
   - 访问 `/history` 页面
   - 记住列表中的数据（例如：有3条记录）

2. **用户A退出登录**
   - 点击退出登录按钮
   - 确认已退出

3. **用户B登录**
   - 使用用户B的账号登录
   - 访问 `/history` 页面

4. **验证结果**
   - ✅ 应该看到用户B的数据，而不是用户A的数据
   - ✅ 如果用户B没有数据，应该显示空列表
   - ❌ 不应该看到用户A的任何记录

### 调试验证

打开浏览器控制台，在退出登录前后查看缓存：

```javascript
// 退出前
console.log('Queries:', queryClient.getQueryCache().getAll().length);

// 点击退出登录

// 退出后（应该是 0）
console.log('Queries:', queryClient.getQueryCache().getAll().length);
```

### 预期行为

#### 成功场景
```
1. 点击删除按钮
   → UI 立即移除该记录（乐观更新）
   
2. 发送删除请求到后端
   → 显示"删除中"状态
   
3. 后端返回成功
   → 自动刷新列表
   → 显示"分析已删除"提示
   → 如果是当前页最后一条且页码>1，自动跳转到上一页
```

#### 失败场景
```
1. 点击删除按钮
   → UI 立即移除该记录（乐观更新）
   
2. 发送删除请求到后端
   → 显示"删除中"状态
   
3. 后端返回失败
   → 记录重新出现在列表中（回滚）
   → 显示错误提示
```

## 验证缓存配置

### 使用浏览器开发者工具

1. **打开 Network 面板**
   ```
   F12 → Network 标签
   ```

2. **观察请求行为**
   - 删除操作后应该立即看到新的 GET 请求获取列表
   - 请求 URL: `/api/analyses?page=X&limit=10`

3. **检查请求时机**
   - ✅ 删除成功后立即发起
   - ✅ 窗口重新获得焦点时发起
   - ✅ 组件重新挂载时发起

### 使用 React Query DevTools（可选）

如果启用了 DevTools，可以查看：

1. **查询状态**
   - 查找 `['analysis', 'list', {...}]` 查询
   - 查看 `dataUpdatedAt` 时间戳
   - 确认 `staleTime: 0`

2. **观察失效过程**
   - 删除操作后，查询应该标记为 `stale`
   - 立即触发 `refetch`

## 常见问题排查

### 问题1：删除后列表没有立即更新

**可能原因**：
- 浏览器缓存了请求
- 后端返回了缓存的数据
- React Query 配置未生效

**排查步骤**：
```bash
# 1. 清除浏览器缓存
Ctrl+Shift+Delete → 清除缓存

# 2. 检查 Network 面板
- 确认删除后有新的 GET 请求
- 检查响应数据是否是最新的

# 3. 检查配置文件
- 确认 src/lib/react-query.ts 中 staleTime: 0
- 确认没有其他地方覆盖了配置
```

### 问题2：删除按钮一直显示"删除中"

**可能原因**：
- 后端请求超时
- 网络连接问题
- 后端返回了错误但前端未正确处理

**排查步骤**：
```bash
# 1. 检查 Console 面板
- 查看是否有错误日志
- 查看 "Delete error:" 相关信息

# 2. 检查 Network 面板
- 查看 DELETE 请求的状态码
- 查看响应内容

# 3. 检查后端日志
- 确认删除请求是否到达后端
- 确认后端是否正确处理
```

### 问题3：页面切换后数据还是旧的

**可能原因**：
- 组件未正确卸载/挂载
- 查询键未正确更新

**解决方案**：
```typescript
// 确保使用正确的查询键
queryKey: queryKeys.analysis.list({ page, limit })

// 而不是固定的查询键
queryKey: ['analysis', 'list'] // ❌ 错误
```

## 性能考虑

### 当前配置的影响

**优点**：
- ✅ 数据始终最新
- ✅ 删除等操作后立即刷新
- ✅ 避免显示过期数据

**缺点**：
- ⚠️ 每次访问都会发起请求
- ⚠️ 可能增加服务器负载
- ⚠️ 在网络较慢时可能影响体验

### 优化建议

如果发现性能问题，可以考虑：

1. **为静态数据设置长缓存**
   ```typescript
   // 配置数据很少变化，可以长期缓存
   useQuery({
     queryKey: queryKeys.config.all,
     queryFn: fetchConfig,
     staleTime: 10 * 60 * 1000, // 10分钟
   });
   ```

2. **使用防抖/节流**
   ```typescript
   // 避免频繁刷新
   const debouncedRefetch = useMemo(
     () => debounce(refetch, 1000),
     [refetch]
   );
   ```

3. **实现分页缓存**
   ```typescript
   // 缓存已访问的页面
   queryKey: queryKeys.analysis.list({ page, limit }),
   staleTime: 30 * 1000, // 30秒内不重新获取
   ```

## 监控和日志

### 查看请求日志

在组件中已经添加了日志：
```typescript
logger.log('📋 Fetched analyses:', result);
```

在 Console 中可以看到：
- 每次获取列表的时间
- 返回的数据内容
- 请求是否成功

### 添加性能监控（可选）

```typescript
const { data, isLoading, dataUpdatedAt } = useQuery({
  // ...
  onSuccess: (data) => {
    console.log('✅ Query success:', {
      timestamp: new Date().toISOString(),
      recordCount: data.analyses.length,
      page: data.page,
    });
  },
  onError: (error) => {
    console.error('❌ Query error:', error);
  },
});

// 显示数据更新时间
console.log('Last updated:', new Date(dataUpdatedAt));
```
