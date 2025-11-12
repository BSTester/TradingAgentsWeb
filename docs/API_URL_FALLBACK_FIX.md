# API URL 回退机制修复

## 问题发现

盯盘页面的图表数据接口与其他接口的 URL 配置方式不同，导致生产环境可能出现问题。

### 问题对比

#### ❌ 之前的实现（有问题）

**文件**: `web/frontend/src/lib/api/accountSnapshots.ts`, `prompts.ts`

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
```

**问题**：
- 开发环境：✅ 正常（使用 localhost:8000）
- 生产环境：❌ 错误（如果未设置环境变量，仍然使用 localhost:8000）

#### ✅ 正确的实现

**文件**: `web/frontend/src/utils/api.ts`

```typescript
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || 
  (typeof window !== 'undefined' ? window.location.origin : '')
).replace(/\/+$/, '');
```

**优势**：
- 开发环境：✅ 使用环境变量或 localhost
- 生产环境：✅ 自动使用当前域名（window.location.origin）

## 回退机制说明

### 三层回退

```typescript
1. process.env.NEXT_PUBLIC_API_BASE_URL  // 优先使用环境变量
   ↓ 如果未设置
2. window.location.origin                 // 使用当前页面域名
   ↓ 如果在服务器端
3. ''                                     // 空字符串（服务器端渲染时）
```

### 实际场景

#### 场景1：开发环境（设置了环境变量）

```env
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

结果：
```
API_BASE_URL = "http://localhost:8000"
```

#### 场景2：开发环境（未设置环境变量）

```env
# 没有 .env.local 或未设置变量
```

当前页面：`http://localhost:3000`

结果：
```
API_BASE_URL = "http://localhost:3000"  // 使用前端域名
```

#### 场景3：生产环境（未设置环境变量）

当前页面：`https://yourdomain.com`

结果：
```
API_BASE_URL = "https://yourdomain.com"  // 自动使用生产域名
```

#### 场景4：生产环境（设置了环境变量）

```env
# 生产环境配置
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
```

结果：
```
API_BASE_URL = "https://api.yourdomain.com"  // 使用独立API域名
```

## 修复内容

### 修改的文件

1. ✅ `web/frontend/src/lib/api/accountSnapshots.ts`
2. ✅ `web/frontend/src/lib/api/prompts.ts`

### 修改前后对比

#### 修改前

```typescript
// ❌ 硬编码回退值
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// 问题：生产环境如果未设置环境变量，会请求 localhost:8000
```

#### 修改后

```typescript
// ✅ 使用统一的 buildApiUrl 函数
import { buildApiUrl } from '@/utils/api';

const response = await axios.get(
  buildApiUrl('/api/account-snapshots/trend/US'),
  { headers: { Authorization: `Bearer ${token}` } }
);

// 优势：
// 1. 代码复用，避免重复
// 2. 统一管理 URL 配置
// 3. 生产环境自动使用当前域名
```

## 为什么这样设计？

### 1. 开发便利性

开发时可以不设置环境变量，自动使用合理的默认值。

### 2. 生产环境灵活性

#### 情况A：前后端同域名

```
前端: https://yourdomain.com
后端: https://yourdomain.com/api

配置: 不需要设置 NEXT_PUBLIC_API_BASE_URL
结果: 自动使用 https://yourdomain.com
```

#### 情况B：前后端不同域名

```
前端: https://app.yourdomain.com
后端: https://api.yourdomain.com

配置: NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
结果: 使用配置的 API 域名
```

### 3. Docker 部署

```yaml
# docker-compose.yml
services:
  frontend:
    environment:
      - NEXT_PUBLIC_API_BASE_URL=http://backend:8000
  backend:
    ports:
      - "8000:8000"
```

### 4. Nginx 反向代理

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://frontend:3000;
    }
    
    location /api {
        proxy_pass http://backend:8000;
    }
}
```

配置：不需要设置环境变量，自动使用 `yourdomain.com`

## 测试验证

### 测试1：开发环境

```bash
# 不设置环境变量
cd web/frontend
npm run dev

# 在浏览器控制台
console.log(window.location.origin);  // http://localhost:3000

# API 调用会使用 http://localhost:3000/api/...
```

### 测试2：生产环境

```bash
# 部署到 https://yourdomain.com
# 不设置 NEXT_PUBLIC_API_BASE_URL

# 在浏览器控制台
console.log(window.location.origin);  // https://yourdomain.com

# API 调用会使用 https://yourdomain.com/api/...
```

### 测试3：独立 API 域名

```bash
# 设置环境变量
export NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com

# API 调用会使用 https://api.yourdomain.com/api/...
```

## 代码一致性

现在所有 API 客户端都统一使用 `buildApiUrl` 函数：

```typescript
// ✅ 统一使用 buildApiUrl
import { buildApiUrl } from '@/utils/api';

// 使用方式
const response = await axios.get(
  buildApiUrl('/api/account-snapshots/trend/US'),
  { headers: { Authorization: `Bearer ${token}` } }
);
```

### buildApiUrl 实现

**文件**: `web/frontend/src/utils/api.ts`

```typescript
// API base URL with smart fallback
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || 
  (typeof window !== 'undefined' ? window.location.origin : '')
).replace(/\/+$/, '');

// Build full API URL
export const buildApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};
```

使用 `buildApiUrl` 的文件：
- ✅ `web/frontend/src/utils/api.ts` - 定义
- ✅ `web/frontend/src/lib/api/accountSnapshots.ts` - 使用
- ✅ `web/frontend/src/lib/api/prompts.ts` - 使用
- ✅ `web/frontend/src/components/**/*.tsx` - 使用

## 最佳实践

### 开发环境

**推荐**：设置 `.env.local`
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

**原因**：明确指定后端地址，避免混淆

### 生产环境

#### 同域名部署

**推荐**：不设置环境变量

**原因**：自动使用当前域名，简化配置

#### 不同域名部署

**必须**：设置环境变量
```env
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
```

**原因**：需要明确指定 API 域名

## 常见问题

### Q1: 为什么要检查 `typeof window !== 'undefined'`？

A: Next.js 支持服务器端渲染 (SSR)，在服务器端 `window` 对象不存在。这个检查确保代码在服务器端也能正常运行。

### Q2: `.replace(/\/+$/, '')` 是做什么的？

A: 移除 URL 末尾的斜杠，确保 URL 格式统一。

```typescript
"http://localhost:8000/"  → "http://localhost:8000"
"http://localhost:8000//" → "http://localhost:8000"
```

### Q3: 生产环境一定要设置环境变量吗？

A: 不一定。如果前后端部署在同一域名下（通过 Nginx 反向代理），可以不设置，系统会自动使用当前域名。

### Q4: 如何验证当前使用的 API URL？

A: 在浏览器控制台执行：
```javascript
// 查看环境变量
console.log(process.env.NEXT_PUBLIC_API_BASE_URL);

// 查看当前域名
console.log(window.location.origin);

// 查看实际使用的 API URL（需要在代码中导出）
import { API_BASE_URL } from '@/utils/api';
console.log(API_BASE_URL);
```

## 总结

通过使用智能回退机制，系统可以：

1. ✅ 在开发环境自动工作
2. ✅ 在生产环境自动适应部署方式
3. ✅ 支持灵活的部署架构
4. ✅ 减少配置错误
5. ✅ 提高代码一致性

这种设计使得系统在不同环境下都能正确工作，无需复杂的配置。
