# 首页重定向问题排查

## 问题描述
第一次访问首页 `/` 会跳转到登录页 `/login`

## 排查步骤

### 1. 清除浏览器缓存和 Cookie
```
1. 打开浏览器开发者工具 (F12)
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"
4. 或者使用无痕模式访问
```

### 2. 检查控制台错误
打开浏览器控制台，查看是否有以下错误：
- 401 Unauthorized
- Token 相关错误
- API 请求失败

### 3. 检查网络请求
在 Network 标签中查看：
- 是否有 `/api/leaderboard` 请求
- 请求状态码是否为 200
- 是否有重定向 (3xx 状态码)

### 4. 检查 localStorage
在控制台执行：
```javascript
console.log('Token:', localStorage.getItem('access_token'));
console.log('All storage:', localStorage);
```

### 5. 检查 Cookie
在控制台执行：
```javascript
console.log('Cookies:', document.cookie);
```

## 可能的原因

### 原因 1: 旧的 Token 导致
如果 localStorage 中有过期的 token，可能会触发重定向。

**解决方案**：
```javascript
// 在控制台执行
localStorage.clear();
location.reload();
```

### 原因 2: API 请求失败
如果 `/api/leaderboard` 请求返回 401，可能会触发重定向。

**检查**：
1. 确认后端服务正在运行
2. 检查 `/api/leaderboard` 是否需要认证（应该不需要）

### 原因 3: useAuth Hook 的问题
`useAuth` hook 在加载时可能会触发某些逻辑。

**检查**：
查看 `web/frontend/src/lib/auth.tsx` 中的 `useEffect`

### 原因 4: 浏览器缓存的重定向
浏览器可能缓存了之前的 301/302 重定向。

**解决方案**：
- 使用无痕模式测试
- 清除浏览器缓存
- 使用不同的浏览器测试

## 验证步骤

### 步骤 1: 测试无认证访问
```bash
# 使用 curl 测试
curl -I http://localhost:3000/

# 应该返回 200，而不是 3xx
```

### 步骤 2: 测试排行榜 API
```bash
curl http://localhost:8000/api/leaderboard

# 应该返回 JSON 数据
```

### 步骤 3: 检查前端日志
在 `page.tsx` 中添加日志：
```typescript
export default function LeaderboardPage() {
  console.log('=== LeaderboardPage mounted ===');
  const { user, logout, isLoading: authLoading } = useAuth();
  console.log('User:', user);
  console.log('Auth loading:', authLoading);
  // ...
}
```

## 临时解决方案

如果问题持续存在，可以尝试：

### 方案 1: 修改 middleware
在 `web/frontend/src/middleware.ts` 中添加更明确的日志：

```typescript
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log('Middleware:', pathname);
  
  // ... 其余代码
}
```

### 方案 2: 禁用 middleware 测试
临时注释掉 middleware 的 matcher：

```typescript
export const config = {
  matcher: [],  // 临时禁用
};
```

### 方案 3: 简化首页
创建一个最简单的首页测试：

```typescript
// web/frontend/src/app/page.tsx
export default function HomePage() {
  return <div>Hello World</div>;
}
```

## 预期行为

正确的行为应该是：
1. 访问 `/` → 显示排行榜页面（无需登录）
2. 点击"新建分析" → 如果未登录，跳转到 `/login`
3. 点击"登录"按钮 → 跳转到 `/login`
4. 访问 `/dashboard` → 如果未登录，跳转到 `/login`

## 相关文件

- `web/frontend/src/app/page.tsx` - 首页组件
- `web/frontend/src/middleware.ts` - Next.js middleware
- `web/frontend/src/lib/auth.tsx` - 认证 hook
- `web/frontend/src/lib/api.ts` - API 客户端（可能有重定向逻辑）
- `web/frontend/src/lib/http-client.ts` - HTTP 客户端（可能有重定向逻辑）

## 下一步

请按照上述步骤排查，并提供：
1. 浏览器控制台的错误信息
2. Network 标签中的请求记录
3. localStorage 和 Cookie 的内容
