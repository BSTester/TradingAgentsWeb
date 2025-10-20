# TradingAgents Docker 部署指南

## 项目架构

- **前端**: Next.js (React) - 端口 3000
- **后端**: FastAPI (Python) - 端口 8000
- **数据库**: SQLite (可选 PostgreSQL/MySQL)
- **反向代理**: Nginx (可选)

## 快速开始

### 1. 准备环境变量

复制 `.env.example` 为 `.env` 并填入你的 API 密钥：

```bash
cp .env.example .env
cp web/frontend/.env.local.example web/frontend/.env.local
```

编辑 `.env` 文件：
```env
OPENAI_API_KEY=your_openai_api_key_here
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_API_KEY=your_google_api_key_here
```

编辑 `web/frontend/.env.local` 文件：
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### 2. 使用 Docker Compose（推荐）

构建并启动所有服务（前端 + 后端）：
```bash
docker-compose up -d
```

查看日志：
```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
```

停止服务：
```bash
docker-compose down
```

### 3. 分别构建前后端

#### 构建后端
```bash
docker build -t tradingagents-backend:latest .
```

运行后端：
```bash
docker run -d \
  --name tradingagents-backend \
  -p 8000:8000 \
  -e OPENAI_API_KEY=your_key \
  -v $(pwd)/.env:/app/.env \
  -v $(pwd)/tradingagents.db:/app/tradingagents.db \
  tradingagents-backend:latest
```

#### 构建前端
```bash
cd web/frontend
docker build -t tradingagents-frontend:latest .
```

运行前端：
```bash
docker run -d \
  --name tradingagents-frontend \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 \
  tradingagents-frontend:latest
```

## 访问应用

- **前端界面**: http://localhost:3000
- **后端 API**: http://localhost:8000
- **API 文档**: http://localhost:8000/docs
- **Nginx (如启用)**: http://localhost

## 运行模式

### 1. 完整 Web 应用（前端 + 后端）
```bash
docker-compose up -d
```

### 2. 仅后端服务
```bash
docker-compose up -d backend
```

### 3. 使用 Nginx 反向代理
取消 `docker-compose.yml` 中 nginx 服务的注释：
```bash
docker-compose up -d nginx
```

### 4. CLI 模式
```bash
docker run -it --rm \
  -v $(pwd)/.env:/app/.env \
  tradingagents-backend:latest \
  python cli/main.py
```

### 5. 自定义脚本模式
```bash
docker run -it --rm \
  -v $(pwd)/.env:/app/.env \
  tradingagents-backend:latest \
  python main.py
```

## 数据持久化

以下目录会被挂载以保持数据持久化：
- `.env` - 环境变量配置
- `tradingagents.db` - SQLite 数据库
- `eval_results/` - 评估结果

## 故障排查

### 查看容器日志
```bash
# 所有服务
docker-compose logs -f

# 后端
docker-compose logs -f backend

# 前端
docker-compose logs -f frontend
```

### 进入容器调试
```bash
# 后端容器
docker exec -it tradingagents-backend bash

# 前端容器
docker exec -it tradingagents-frontend sh
```

### 重新构建镜像
```bash
# 重新构建所有服务
docker-compose build --no-cache
docker-compose up -d

# 重新构建特定服务
docker-compose build --no-cache backend
docker-compose up -d backend
```

### 检查服务健康状态
```bash
# 检查后端健康
curl http://localhost:8000/health

# 检查前端
curl http://localhost:3000
```

### 常见问题

#### 1. 前端无法连接后端
- 检查 `NEXT_PUBLIC_API_BASE_URL` 环境变量
- 确保后端服务已启动：`docker-compose ps`
- 检查网络连接：`docker network inspect tradingagents_tradingagents-network`

#### 2. 端口冲突
修改 `docker-compose.yml` 中的端口映射：
```yaml
ports:
  - "8001:8000"  # 将主机端口改为 8001
```

#### 3. 构建失败
- 清理 Docker 缓存：`docker system prune -a`
- 检查磁盘空间：`docker system df`

## 生产环境部署

### 1. 启用 Nginx 反向代理

取消 `docker-compose.yml` 中 nginx 服务的注释，然后：
```bash
docker-compose up -d nginx
```

### 2. 配置 HTTPS

创建 SSL 证书目录：
```bash
mkdir -p ssl
```

将证书文件放入 `ssl/` 目录，然后取消 `nginx.conf` 中 HTTPS 配置的注释。

### 3. 使用外部数据库

修改 `docker-compose.yml`，添加 PostgreSQL：
```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: tradingagents
      POSTGRES_USER: tradingagents
      POSTGRES_PASSWORD: your_password
    volumes:
      - postgres-data:/var/lib/postgresql/data

  backend:
    environment:
      - DATABASE_URL=postgresql://tradingagents:your_password@postgres:5432/tradingagents
```

### 4. 配置 Redis 缓存

取消 `docker-compose.yml` 中 redis 服务的注释。

### 5. 设置资源限制

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
  
  frontend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### 6. 配置日志

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 环境变量说明

### 后端环境变量

| 变量名 | 说明 | 必需 | 默认值 |
|--------|------|------|--------|
| OPENAI_API_KEY | OpenAI API 密钥 | 是 | - |
| ALPHA_VANTAGE_API_KEY | Alpha Vantage API 密钥 | 否 | - |
| ANTHROPIC_API_KEY | Anthropic API 密钥 | 否 | - |
| GOOGLE_API_KEY | Google API 密钥 | 否 | - |
| DATABASE_URL | 数据库连接 URL | 否 | sqlite:///./tradingagents.db |

### 前端环境变量

| 变量名 | 说明 | 必需 | 默认值 |
|--------|------|------|--------|
| NEXT_PUBLIC_API_BASE_URL | 后端 API 地址 | 是 | http://localhost:8000 |
| NODE_ENV | 运行环境 | 否 | production |

## 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 3000 | Frontend | Next.js 前端应用 |
| 8000 | Backend | FastAPI 后端 API |
| 80 | Nginx | HTTP 反向代理 |
| 443 | Nginx | HTTPS 反向代理 |
| 6379 | Redis | 缓存服务（可选）|
| 5432 | PostgreSQL | 数据库（可选）|

## 性能优化

### 1. 启用 Next.js 缓存
前端已配置 standalone 输出模式，优化了构建大小。

### 2. 后端缓存
考虑使用 Redis 缓存频繁访问的数据。

### 3. CDN 配置
将静态资源部署到 CDN 以提高加载速度。

### 4. 数据库优化
- 使用 PostgreSQL 替代 SQLite
- 配置连接池
- 添加适当的索引

## 监控和日志

### 查看实时日志
```bash
docker-compose logs -f --tail=100
```

### 导出日志
```bash
docker-compose logs > logs.txt
```

### 监控资源使用
```bash
docker stats
```
