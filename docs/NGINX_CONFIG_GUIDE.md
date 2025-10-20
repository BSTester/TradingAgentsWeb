# Nginx 配置说明

## 两种配置文件

### 1. nginx-proxy.conf.template (Docker 部署)

用于 Docker Compose 多容器部署。

**特点：**
- 使用 `upstream` 指令定义后端服务
- 需要去除 `http://` 前缀
- 通过 `start-nginx.sh` 脚本处理环境变量

**配置示例：**
```nginx
upstream backend {
    server backend:8000;  # ✅ 不包含 http://
}

location /api {
    proxy_pass http://backend;  # ✅ 引用 upstream 名称
}
```

**环境变量：**
```env
BACKEND_URL=http://backend:8000
```

**启动脚本处理：**
```bash
# 自动去除 http:// 前缀
BACKEND_HOST=$(echo "${BACKEND_URL}" | sed 's|^https\?://||')
# BACKEND_HOST = backend:8000
```

### 2. nginx-combined.conf.template (本地部署)

用于单机部署，Nginx 直接代理本地服务。

**特点：**
- 直接使用 `proxy_pass` 指令
- 需要完整的 URL（包含 `http://`）
- 不使用 `upstream` 指令

**配置示例：**
```nginx
location /api {
    proxy_pass http://localhost:8000;  # ✅ 完整 URL
}

location /ws {
    proxy_pass http://localhost:8000;  # ✅ 完整 URL
}
```

**环境变量：**
```env
BACKEND_URL=http://localhost:8000
```

## 关键区别

### upstream vs proxy_pass

| 指令 | 是否需要协议前缀 | 示例 |
|------|-----------------|------|
| `upstream` | ❌ 不需要 | `server backend:8000;` |
| `proxy_pass` (直接) | ✅ 需要 | `proxy_pass http://backend:8000;` |
| `proxy_pass` (引用upstream) | ✅ 需要 | `proxy_pass http://backend;` |

### 正确示例

**✅ 正确 - 使用 upstream：**
```nginx
upstream backend {
    server backend:8000;
}

location /api {
    proxy_pass http://backend;
}
```

**✅ 正确 - 直接 proxy_pass：**
```nginx
location /api {
    proxy_pass http://backend:8000;
}
```

**❌ 错误 - upstream 包含协议：**
```nginx
upstream backend {
    server http://backend:8000;  # ❌ 错误！
}
```

## 使用场景

### Docker Compose 部署

使用 `nginx-proxy.conf.template`

```yaml
# docker-compose.yml
nginx:
  build:
    target: nginx
  environment:
    - BACKEND_URL=http://backend:8000
```

**优点：**
- 支持负载均衡
- 支持健康检查
- 更好的性能

### 本地开发部署

使用 `nginx-combined.conf.template`

```bash
# 启动后端
cd web/backend
uvicorn app:app --host 0.0.0.0 --port 8000

# 启动前端
cd web/frontend
npm run dev

# 启动 nginx
nginx -c nginx-combined.conf
```

**优点：**
- 配置简单
- 适合开发调试
- 不需要 Docker

## 故障排查

### 错误：invalid host in upstream

**症状：**
```
nginx: [emerg] invalid host in upstream "http://backend:8000"
```

**原因：**
upstream 指令中包含了 `http://` 前缀

**解决：**
```nginx
# ❌ 错误
upstream backend {
    server http://backend:8000;
}

# ✅ 正确
upstream backend {
    server backend:8000;
}
```

### 错误：proxy_pass 无法连接

**症状：**
```
connect() failed (111: Connection refused)
```

**原因：**
1. 后端服务未启动
2. 主机名或端口错误
3. Docker 网络问题

**解决：**
```bash
# 检查后端服务
docker-compose ps backend

# 检查网络连接
docker-compose exec nginx ping backend

# 查看日志
docker-compose logs backend
```

## 环境变量配置

### .env 文件

```env
# Docker 部署
BACKEND_URL=http://backend:8000

# 本地部署
BACKEND_URL=http://localhost:8000
```

### 动态替换

**start-nginx.sh：**
```bash
#!/bin/sh
# 去除协议前缀用于 upstream
BACKEND_HOST=$(echo "${BACKEND_URL}" | sed 's|^https\?://||')

# 替换配置文件中的变量
export BACKEND_HOST
envsubst '${BACKEND_HOST}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# 启动 nginx
nginx -g 'daemon off;'
```

## 测试配置

### 测试 nginx 配置语法

```bash
# Docker 容器内
docker-compose exec nginx nginx -t

# 本地
nginx -t -c /path/to/nginx.conf
```

### 重新加载配置

```bash
# Docker
docker-compose restart nginx

# 本地
nginx -s reload
```

### 查看生成的配置

```bash
# 查看实际使用的配置
docker-compose exec nginx cat /etc/nginx/nginx.conf
```

## 最佳实践

1. **使用环境变量**：便于不同环境切换
2. **upstream 用于 Docker**：支持服务发现和负载均衡
3. **直接 proxy_pass 用于本地**：配置简单直观
4. **添加健康检查**：确保后端服务可用
5. **配置超时时间**：避免长时间等待
6. **启用日志**：便于故障排查

## 参考资料

- [Nginx upstream 文档](http://nginx.org/en/docs/http/ngx_http_upstream_module.html)
- [Nginx proxy_pass 文档](http://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass)
- [Docker Compose 网络](https://docs.docker.com/compose/networking/)
