# API URL 配置说明

## 问题

之前前端代码中存在环境变量名称不一致的问题：
- 部分代码使用 `NEXT_PUBLIC_API_BASE_URL`
- 部分代码使用 `NEXT_PUBLIC_API_URL`

## 解决方案

已统一使用 `NEXT_PUBLIC_API_BASE_URL` 作为 API 基础 URL 的环境变量名称。

## 配置文件

### 开发环境

**文件**: `web/frontend/.env.local`

```env
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Application Configuration
NEXT_PUBLIC_APP_NAME=TradingAgents
NEXT_PUBLIC_APP_VERSION=1.0.0

# Development Configuration
NODE_ENV=development
```

### 生产环境

**文件**: `web/frontend/.env.production`

```env
# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://your-production-domain.com

# Application Configuration
NEXT_PUBLIC_APP_NAME=TradingAgents
NEXT_PUBLIC_APP_VERSION=1.0.0

# Production Configuration
NODE_ENV=production
```

## 使用方式

### 在代码中使用

```typescript
// 方式1: 直接使用环境变量
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// 方式2: 从 utils/api.ts 导入
import { API_BASE_URL } from '@/utils/api';

// 方式3: 在组件中使用
const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
```

### API 调用示例

```typescript
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// 获取账户快照趋势
const response = await axios.get(
  `${API_BASE_URL}/api/account-snapshots/trend/US`,
  {
    params: { days: 30 },
    headers: { Authorization: `Bearer ${token}` }
  }
);
```

## 修改的文件

1. ✅ `web/frontend/.env.local` - 开发环境配置
2. ✅ `web/frontend/.env.local.example` - 示例配置
3. ✅ `web/frontend/src/utils/api.ts` - API 工具函数
4. ✅ `web/frontend/src/lib/api/accountSnapshots.ts` - 快照 API（已正确）
5. ✅ `web/frontend/src/lib/api/prompts.ts` - 提示词 API（已正确）

## 环境变量说明

### NEXT_PUBLIC_API_BASE_URL

- **类型**: String
- **必需**: 否（有默认值）
- **默认值**: `http://localhost:8000`
- **说明**: 后端 API 的基础 URL
- **示例**:
  - 开发: `http://localhost:8000`
  - 生产: `https://api.yourdomain.com`
  - Docker: `http://backend:8000`

### 为什么使用 NEXT_PUBLIC_ 前缀？

Next.js 要求在浏览器中可访问的环境变量必须以 `NEXT_PUBLIC_` 开头。

- ✅ `NEXT_PUBLIC_API_BASE_URL` - 可在浏览器中访问
- ❌ `API_BASE_URL` - 只能在服务器端访问

## 部署配置

### Docker 部署

**docker-compose.yml**:
```yaml
services:
  frontend:
    build: ./web/frontend
    environment:
      - NEXT_PUBLIC_API_BASE_URL=http://backend:8000
    ports:
      - "3000:3000"
  
  backend:
    build: ./web/backend
    ports:
      - "8000:8000"
```

### Vercel 部署

在 Vercel 项目设置中添加环境变量：
```
NEXT_PUBLIC_API_BASE_URL=https://your-backend-api.com
```

### Nginx 反向代理

如果使用 Nginx 反向代理，可以配置为相同域名：

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # 前端
    location / {
        proxy_pass http://localhost:3000;
    }
    
    # 后端 API
    location /api {
        proxy_pass http://localhost:8000;
    }
}
```

此时前端配置：
```env
NEXT_PUBLIC_API_BASE_URL=https://yourdomain.com
```

## 测试

### 验证配置

```bash
# 在前端目录
cd web/frontend

# 查看环境变量
echo $NEXT_PUBLIC_API_BASE_URL

# 或在 Windows
echo %NEXT_PUBLIC_API_BASE_URL%
```

### 测试 API 连接

```typescript
// 在浏览器控制台
console.log(process.env.NEXT_PUBLIC_API_BASE_URL);

// 测试 API 调用
fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/me`, {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
  }
})
.then(res => res.json())
.then(data => console.log(data));
```

## 常见问题

### Q1: 修改环境变量后不生效？

A: Next.js 需要重启开发服务器才能读取新的环境变量：
```bash
# 停止服务器 (Ctrl+C)
# 重新启动
npm run dev
```

### Q2: 生产环境如何配置？

A: 创建 `.env.production` 文件或在部署平台设置环境变量。

### Q3: API 请求返回 CORS 错误？

A: 确保后端配置了正确的 CORS 设置：
```python
# web/backend/app.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Q4: 如何在不同环境使用不同的 URL？

A: 使用不同的环境变量文件：
- `.env.local` - 本地开发
- `.env.development` - 开发环境
- `.env.production` - 生产环境

## 相关文档

- [Next.js 环境变量文档](https://nextjs.org/docs/basic-features/environment-variables)
- [API 路由文档](docs/API_ROUTES.md)
- [部署指南](docs/DEPLOYMENT_CHECKLIST.md)
