# Docker 部署指南

## 架构说明

新的Docker部署架构使用Next.js服务器模式 + Nginx反向代理，支持动态路由和所有Next.js功能。

```
用户 → Nginx (80) → Next.js (3000) 
                  → Backend API (8000)
```

## 部署方式

### 方式1：分离容器（推荐用于生产环境）

**优势**：
- 独立扩展前端和后端
- 更好的资源隔离
- 便于监控和调试

**使用**：
```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

**容器说明**：
- `backend`: FastAPI后端 (端口8080→8000)
- `nextjs`: Next.js服务器 (内部端口3000)
- `nginx`: Nginx反向代理 (端口8000→80)

### 方式2：组合容器（推荐用于开发/小型部署）

**优势**：
- 单个前端容器
- 部署更简单
- 资源占用更少

**使用**：
```bash
# 使用简化版配置
docker-compose -f docker-compose.simple.yml up -d --build

# 查看日志
docker-compose -f docker-compose.simple.yml logs -f

# 停止
docker-compose -f docker-compose.simple.yml down
```

**容器说明**：
- `backend`: FastAPI后端 (端口8080→8000)
- `frontend`: Next.js + Nginx组合 (端口8000→80)

## 访问地址

- **前端**: http://localhost:8000
- **后端API**: http://localhost:8080
- **后端API文档**: http://localhost:8080/docs

## 环境变量

在 `.env` 文件中配置：

```env
# 数据库
DATABASE_URL=sqlite:///./db/tradingagents.db

# API密钥（可选）
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here

# JWT密钥
SECRET_KEY=your-secret-key-change-in-production
```

## 数据持久化

数据卷挂载：
- `./db:/app/db` - 数据库文件
- `./eval_results:/app/eval_results` - 分析结果

## 生产环境建议

### 1. 使用HTTPS

在Nginx前添加SSL终止：

```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://nginx:80;
    }
}
```

### 2. 资源限制

在docker-compose.yml中添加：

```yaml
services:
  nextjs:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### 3. 健康检查

```yaml
services:
  nextjs:
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 4. 日志管理

```yaml
services:
  nextjs:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 故障排查

### 查看容器状态
```bash
docker-compose ps
```

### 查看实时日志
```bash
# 所有容器
docker-compose logs -f

# 特定容器
docker-compose logs -f nextjs
docker-compose logs -f nginx
docker-compose logs -f backend
```

### 进入容器调试
```bash
# Next.js容器
docker exec -it tradingagents-nextjs sh

# Nginx容器
docker exec -it tradingagents-nginx sh

# 后端容器
docker exec -it tradingagents-backend sh
```

### 重启服务
```bash
# 重启所有
docker-compose restart

# 重启特定服务
docker-compose restart nextjs
```

## 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build

# 清理旧镜像
docker image prune -f
```

## 性能优化

### Next.js优化
- 已启用生产模式构建
- 自动代码分割
- 图片优化
- 移除console日志

### Nginx优化
- Gzip压缩
- 静态文件缓存
- Keep-alive连接
- 合理的超时设置

## 监控建议

推荐使用以下工具监控：
- **Prometheus + Grafana**: 指标监控
- **ELK Stack**: 日志聚合
- **Sentry**: 错误追踪
- **Uptime Kuma**: 服务可用性监控
