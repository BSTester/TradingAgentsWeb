# 首页重定向问题修复

## 问题描述

首次访问首页 `/` 时会自动跳转到登录页 `/login`。

## 根本原因

当用户首次访问首页时，如果浏览器 localStorage 中存在一个**过期的 token**（例如之前登录过但 token 已过期），会发生以下情况：

1. 首页加载，`useAuth` hook 初始化
2. `useAuth` 检测到 localStorage 中有 token
3. 自动调用 `getCurrentUser()` 验证 token
4. 后端返回 401 Unauthorized（token 已过期）
5. `lib/api.ts` 和 `lib/http-client.ts` 的拦截器捕获 401 错误
6. **自动重定向到 `/login`**（这是问题所在）

## 解决方案

修改 401 错误处理逻辑，**在公开页面不自动重定向**：

### 修改文件 1: `web/frontend/src/lib/api.ts`

```typescript
if (response.status === 401) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('access_token');
      document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
      
      // ✅ 只在非公开页面重定向
      const publicPages = ['/', '/login', '/register', '/auth'];
      const currentPath = window.location.pathname;
      if (!publicPages.includes(currentPath) && !currentPath.startsWith('/analysis/')) {
        window.location.href = '/login';
      }
    } catch {}
  }
  throw new Error('无法验证凭据');
}
```

### 修改文件 2: `web/frontend/src/lib/http-client.ts`

```typescript
if (error.response?.status === 401) {
  removeAuthToken();
  
  // ✅ 只在非公开页面重定向
  if (typeof window !== 'undefined') {
    const publicPages = ['/', '/login', '/register', '/auth'];
    const currentPath = window.location.pathname;
    if (!publicPages.includes(currentPath) && !currentPath.startsWith('/analysis/')) {
      window.location.href = '/login';
    }
  }
}
```

## 修复效果

### 修复前
- 访问 `/` → 自动跳转到 `/login` ❌
- 用户无法查看公开的排行榜

### 修复后
- 访问 `/` → 显示排行榜页面 ✅
- Token 过期时静默清除，不影响浏览
- 访问受保护页面（如 `/dashboard`）时才重定向到登录页

## 公开页面列表

以下页面不需要登录，401 错误时不会重定向：

1. `/` - 首页（排行榜）
2. `/login` - 登录页
3. `/register` - 注册页
4. `/auth` - 认证页
5. `/analysis/*` - 分析详情页（公开分析）

## 受保护页面

以下页面需要登录，401 错误时会重定向到登录页：

1. `/dashboard` - 用户仪表板
2. `/history` - 分析历史
3. `/settings` - 用户设置
4. `/admin/*` - 管理员页面

## 测试步骤

### 测试 1: 首次访问
```bash
1. 清除浏览器缓存和 localStorage
2. 访问 http://localhost:3000/
3. ✅ 应该显示排行榜，不重定向
```

### 测试 2: 过期 Token
```bash
1. 登录系统
2. 手动修改 localStorage 中的 token 为无效值
3. 刷新首页
4. ✅ 应该显示排行榜，token 被静默清除
```

### 测试 3: 受保护页面
```bash
1. 清除 localStorage
2. 访问 http://localhost:3000/dashboard
3. ✅ 应该重定向到登录页
```

### 测试 4: 公开分析详情
```bash
1. 清除 localStorage
2. 访问 http://localhost:3000/analysis/xxx?from=leaderboard
3. ✅ 应该显示分析详情，不重定向
```

## 相关文件

- `web/frontend/src/lib/api.ts` - API 客户端
- `web/frontend/src/lib/http-client.ts` - HTTP 客户端
- `web/frontend/src/lib/auth.tsx` - 认证 Hook
- `web/frontend/src/middleware.ts` - Next.js Middleware

## 注意事项

1. **Token 验证失败不等于需要登录**
   - 在公开页面，token 验证失败是正常的
   - 只需要静默清除 token，不需要重定向

2. **用户体验优先**
   - 公开内容应该无障碍访问
   - 只在必要时才要求登录

3. **安全性不受影响**
   - 受保护的 API 仍然需要有效 token
   - 后端会验证所有需要认证的请求

## 未来改进

可以考虑以下改进：

1. **更智能的重定向**
   - 记录用户尝试访问的页面
   - 登录后自动跳转回原页面

2. **Token 刷新机制**
   - 在 token 即将过期时自动刷新
   - 减少用户被迫重新登录的次数

3. **更好的错误提示**
   - 在公开页面显示"登录已过期"提示
   - 提供"重新登录"按钮

## 总结

通过修改 401 错误处理逻辑，我们确保了：
- ✅ 首页可以正常访问，不会自动重定向
- ✅ 过期 token 被静默清除
- ✅ 受保护页面仍然会正确重定向到登录页
- ✅ 用户体验得到改善
