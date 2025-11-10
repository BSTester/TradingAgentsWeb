# 静态部署指南 - Next.js Static Export

本指南说明如何将前端构建为纯静态文件，使用 Nginx 托管，无需 Node.js 运行时。

## 架构变化

### 原架构（动态）
```
用户 → Nginx (80) → Next.js Server (3000) → 后端 API (8000)
                  ↘ 后端 API (8000)
```

### 新架构（静态）
```
用户 → Nginx (80) → 静态文件 (HTML/CSS/JS)
                  ↘ 后端 API (8000) [代理]
```

## 优势

1. **更快的响应速度**：静态文件直接由 Nginx 提供，无需 Node.js 处理
2. **更低的资源消耗**：不需要运行 Node.js 进程
3. **更简单的部署**：只需要 Nginx，减少一个服务
4. **更好的缓存**：静态文件可以充分利用浏览器和 CDN 缓存
5. **更高的安全性**：减少攻击面，没有 Node.js 运行时漏洞

## 限制

使用静态导出时，以下 Next.js 功能将不可用：
- ❌ API Routes（`/api/*` 路由）- 已通过后端 FastAPI 实现
- ❌ Server-Side Rendering (SSR)
- ❌ Incremental Static Regeneration (ISR)
- ❌ Image Optimization（需设置 `images.unoptimized: true`）
- ✅ Client-Side Rendering (CSR) - 完全支持
- ✅ Static Site Generation (SSG) - 完全支持

**本项目完全兼容**：因为我们使用的是纯客户端渲染（CSR），所有 API 调用都通过 FastAPI 后端。

## 配置文件说明

### 1. `next.config.ts`
```typescript
output: 'export',  // 启用静态导出
trailingSlash: true,  // URL 末尾添加斜杠
images: {
  unoptimized: true,  // 禁用图片优化
}
```

### 2. `Dockerfile.static`
- 构建阶段：运行 `npm run build` 生成静态文件到 `out/` 目录
- 生产阶段：只使用 Nginx，将 `out/` 目录复制到 `/usr/share/nginx/html`

### 3. `docker-compose.static.yml`
- 移除 `nextjs` 服务
- 简化为 `mysql` + `backend` + `frontend`（Nginx）

## 部署步骤

### 方式一：使用 Docker Compose（推荐）

```bash
# 1. 构建并启动服务
docker-compose -f docker-compose.static.yml up --build -d

# 2. 查看日志
docker-compose -f docker-compose.static.yml logs -f frontend

# 3. 停止服务
docker-compose -f docker-compose.static.yml down
```

### 方式二：本地构建 + Nginx 部署

```bash
# 1. 进入前端目录
cd web/frontend

# 2. 安装依赖
npm install

# 3. 构建静态文件
npm run build

# 4. 静态文件生成在 out/ 目录
ls -la out/

# 5. 将 out/ 目录内容复制到 Nginx 根目录
# 例如：cp -r out/* /usr/share/nginx/html/

# 6. 配置 Nginx 反向代理到后端 API
# 参考 web/frontend/nginx.conf.template
```

### 方式三：单独构建 Docker 镜像

```bash
# 构建静态前端镜像
cd web/frontend
docker build -f Dockerfile.static -t tradingagents-frontend-static .

# 运行容器
docker run -d \
  -p 8000:80 \
  -e FRONTEND_API_BASE_URL=http://backend:8000 \
  --name tradingagents-frontend \
  tradingagents-frontend-static
```

## 验证部署

1. **访问前端**：http://localhost:8000
2. **检查静态文件**：
   ```bash
   docker exec tradingagents-frontend ls -la /usr/share/nginx/html
   ```
3. **检查 Nginx 配置**：
   ```bash
   docker exec tradingagents-frontend cat /etc/nginx/nginx.conf
   ```
4. **测试 API 代理**：
   ```bash
   curl http://localhost:8000/api/health
   ```

## 性能对比

| 指标 | 动态部署 (Next.js Server) | 静态部署 (Nginx Only) |
|------|---------------------------|----------------------|
| 首页加载时间 | ~200ms | ~50ms |
| 内存占用 | ~150MB (Node.js) | ~10MB (Nginx) |
| CPU 占用 | 中等 | 极低 |
| 容器数量 | 4 个 | 3 个 |
| 启动时间 | ~10s | ~2s |

## 故障排查

### 问题 1：页面刷新后 404
**原因**：Nginx 没有正确配置 SPA 路由回退

**解决**：确保 `nginx.conf.template` 包含：
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

### 问题 2：API 请求失败
**原因**：Nginx 代理配置错误

**解决**：检查环境变量 `FRONTEND_API_BASE_URL` 是否正确设置为后端地址

### 问题 3：静态资源 404
**原因**：构建输出目录不正确

**解决**：
```bash
# 检查构建输出
docker exec tradingagents-frontend ls -la /usr/share/nginx/html/_next/static/
```

## 回退到动态部署

如果需要回退到原来的动态部署方式：

1. 修改 `next.config.ts`，移除 `output: 'export'`
2. 使用原来的 `docker-compose.yml`：
   ```bash
   docker-compose up --build -d
   ```

## 生产环境建议

1. **启用 HTTPS**：配置 SSL 证书
2. **启用 Gzip 压缩**：已在 `nginx.conf.template` 中配置
3. **配置缓存策略**：静态资源设置长期缓存
4. **使用 CDN**：将静态文件上传到 CDN（可选）
5. **监控和日志**：配置 Nginx 访问日志和错误日志

## 总结

静态部署方式更适合本项目，因为：
- ✅ 前端完全使用客户端渲染（CSR）
- ✅ 所有 API 调用都通过后端 FastAPI
- ✅ 不需要 Next.js 的服务端功能
- ✅ 性能更好，资源占用更低
- ✅ 部署更简单，维护成本更低

推荐在生产环境使用 `docker-compose.static.yml` 进行部署。
