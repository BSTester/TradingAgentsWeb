# Docker 部署验证清单

## 配置验证

### ✅ 1. 环境变量配置

**文件：`.env`**
```env
BACKEND_URL=http://backend:8000
NODE_ENV=production
DATABASE_URL=sqlite:///./db/tradingagents.db
```

### ✅ 2. Nginx 配置

**文件：`web/frontend/nginx-proxy.conf.template`**
```nginx
upstream nextjs {
    server nextjs:3000;  # ✅ 前端端口 3000
}

upstream backend {
    server ${BACKEND_HOST};  # ✅ 后端端口 8000 (来自环境变量)
}
```

### ✅ 3. 启动脚本

**文件：`web/frontend/start-nginx.sh`**
```bash
# 自动处理：http://backend:8000 → backend:8000
BACKEND_HOST=$(echo "${BACKEND_URL}" | sed 's|^https\?://||')
```

### ✅ 4. Docker Compose

**文件：`docker-compose.yml`**
```yaml
services:
  backend:
    ports:
      - "8080:8000"  # 容器内 8000，主机 8080
  
  nextjs:
    # 容器内 3000
  
  nginx:
    ports:
      - "8000:80"  # 容器内 80，主机 8000
```

## 端口映射

```
用户访问 → localhost:8000 (主机)
    ↓
nginx:80 (容器)
    ↓
    ├─ /api → backend:8000 (容器内部网络)
    ├─ /ws  → backend:8000 (容器内部网络)
    └─ /    → nextjs:3000 (容器内部网络)
```

## 部署步骤

### 1. 清理旧容器

```bash
docker-compose down
docker system prune -f
```

### 2. 构建镜像

```bash
# 构建所有服务
docker-compose build

# 或分别构建
docker-compose build backend
docker-compose build nextjs
docker-compose build nginx
```

### 3. 启动服务

```bash
docker-compose up -d
```

### 4. 验证服务状态

```bash
# 查看容器状态
docker-compose ps

# 应该看到：
# tradingagents-backend  running  0.0.0.0:8080->8000/tcp
# tradingagents-nextjs   running  
# tradingagents-nginx    running  0.0.0.0:8000->80/tcp
```

### 5. 查看日志

```bash
# 查看所有日志
docker-compose logs -f

# 查看特定服务
docker-compose logs -f nginx
docker-compose logs -f backend
docker-compose logs -f nextjs
```

### 6. 测试访问

```bash
# 测试 Nginx
curl http://localhost:8000

# 测试后端 API
curl http://localhost:8000/api/config

# 测试直接访问后端（绕过 Nginx）
curl http://localhost:8080/api/config
```

## 验证检查点

### ✅ Nginx 启动成功

**日志应该显示：**
```
Starting Nginx reverse proxy...
Backend URL: http://backend:8000
Backend Host: backend:8000
```

**不应该有错误：**
```
❌ nginx: [emerg] invalid host in upstream
```

### ✅ Backend 启动成功

**日志应该显示：**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
✅ Database tables initialized successfully
```

### ✅ Next.js 启动成功

**日志应该显示：**
```
▲ Next.js 15.5.4
- Local:        http://localhost:3000
- Network:      http://172.18.0.x:3000
✓ Ready in XXXms
```

### ✅ 网络连通性

```bash
# 从 nginx 容器 ping backend
docker-compose exec nginx ping -c 3 backend

# 从 nginx 容器 ping nextjs
docker-compose exec nginx ping -c 3 nextjs

# 应该都能 ping 通
```

### ✅ 端口监听

```bash
# 检查主机端口
netstat -an | findstr "8000"
netstat -an | findstr "8080"

# 应该看到：
# TCP    0.0.0.0:8000    LISTENING  (nginx)
# TCP    0.0.0.0:8080    LISTENING  (backend)
```

## 常见问题

### 问题 1: Nginx 启动失败

**症状：**
```
nginx: [emerg] invalid host in upstream
```

**解决：**
1. 检查 `.env` 文件中 `BACKEND_URL` 格式
2. 确认 `start-nginx.sh` 有执行权限
3. 重新构建 nginx 镜像

```bash
docker-compose build --no-cache nginx
docker-compose up -d nginx
```

### 问题 2: 无法访问后端 API

**症状：**
```
502 Bad Gateway
```

**解决：**
1. 检查 backend 容器是否运行
2. 检查 Docker 网络

```bash
docker-compose ps backend
docker-compose logs backend
docker network inspect tradingagents-network
```

### 问题 3: Next.js 警告

**症状：**
```
⚠ You are using a non-standard "NODE_ENV" value
```

**解决：**
这是警告不是错误，可以忽略。或者在 `.env` 中设置：
```env
NODE_ENV=production
```

### 问题 4: WebSocket 连接失败

**症状：**
```
WebSocket connection failed
```

**解决：**
1. 确认 `/ws` 路由配置正确
2. 检查超时设置
3. 查看 nginx 日志

```bash
docker-compose logs nginx | grep ws
```

## 性能检查

### 响应时间

```bash
# 测试 API 响应时间
time curl http://localhost:8000/api/config

# 应该在 1 秒内响应
```

### 内存使用

```bash
docker stats

# 查看各容器的内存使用情况
```

### 磁盘空间

```bash
docker system df

# 查看 Docker 占用的磁盘空间
```

## 生产环境建议

### 1. 使用具体版本标签

```yaml
# docker-compose.yml
services:
  backend:
    image: registry.cn-shenzhen.aliyuncs.com/ai_creator/tradingagents-backend:v1.0.0
```

### 2. 配置健康检查

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 3. 限制资源使用

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

### 4. 配置日志轮转

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 5. 使用 HTTPS

```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
}
```

## 监控和维护

### 定期检查

```bash
# 每天检查容器状态
docker-compose ps

# 每周清理未使用的镜像
docker system prune -a

# 每月备份数据库
cp db/tradingagents.db backups/tradingagents_$(date +%Y%m%d).db
```

### 日志监控

```bash
# 监控错误日志
docker-compose logs --tail=100 | grep -i error

# 监控访问日志
docker-compose exec nginx tail -f /var/log/nginx/access.log
```

## 回滚方案

如果部署出现问题：

```bash
# 1. 停止新版本
docker-compose down

# 2. 恢复旧版本镜像
docker-compose pull

# 3. 启动旧版本
docker-compose up -d

# 4. 验证服务
docker-compose ps
curl http://localhost:8000
```

## 成功标志

当看到以下所有内容时，部署成功：

- ✅ 所有容器状态为 `Up`
- ✅ Nginx 日志无错误
- ✅ Backend 显示 "Application startup complete"
- ✅ Next.js 显示 "Ready in XXXms"
- ✅ `curl http://localhost:8000` 返回页面
- ✅ `curl http://localhost:8000/api/config` 返回 JSON
- ✅ 浏览器可以正常访问和使用

恭喜！🎉 部署成功！
