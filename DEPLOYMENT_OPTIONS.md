# 部署方式选择指南

TradingAgentsWeb 提供两种部署方式，您可以根据需求选择：

## 📊 对比表格

| 特性 | 静态部署 (推荐) | 动态部署 |
|------|----------------|---------|
| **性能** | ⭐⭐⭐⭐⭐ 极快 | ⭐⭐⭐⭐ 快 |
| **资源占用** | ⭐⭐⭐⭐⭐ 极低 (~10MB) | ⭐⭐⭐ 中等 (~150MB) |
| **部署复杂度** | ⭐⭐⭐⭐⭐ 简单 | ⭐⭐⭐ 中等 |
| **启动速度** | ⭐⭐⭐⭐⭐ 2秒 | ⭐⭐⭐ 10秒 |
| **容器数量** | 3 个 | 4 个 |
| **SSR 支持** | ❌ 不支持 | ✅ 支持 |
| **适用场景** | 纯客户端渲染 | 需要服务端渲染 |

## 🎯 方式一：静态部署（推荐）

### 适用场景
- ✅ 纯客户端渲染（CSR）应用
- ✅ 所有 API 调用通过后端
- ✅ 追求极致性能和低资源占用
- ✅ 简化部署和维护

### 快速开始

**Linux/Mac:**
```bash
chmod +x deploy-static.sh
./deploy-static.sh
```

**Windows:**
```cmd
deploy-static.bat
```

**手动部署:**
```bash
docker-compose -f docker-compose.static.yml up --build -d
```

### 架构
```
用户请求
  ↓
Nginx (80端口)
  ├─→ 静态文件 (HTML/CSS/JS)
  └─→ /api/* → 后端 FastAPI (8000)
      └─→ /ws/* → WebSocket
```

### 详细文档
查看 [STATIC_DEPLOYMENT.md](./STATIC_DEPLOYMENT.md)

---

## 🔄 方式二：动态部署

### 适用场景
- ✅ 需要服务端渲染（SSR）
- ✅ 需要 Next.js API Routes
- ✅ 需要 ISR（增量静态再生成）
- ✅ 需要动态路由预渲染

### 快速开始

```bash
docker-compose up --build -d
```

### 架构
```
用户请求
  ↓
Nginx (80端口)
  ├─→ Next.js Server (3000)
  │     └─→ React 渲染
  └─→ /api/* → 后端 FastAPI (8000)
      └─→ /ws/* → WebSocket
```

---

## 🤔 如何选择？

### 选择静态部署，如果：
- ✅ 你的应用是纯客户端渲染（本项目就是）
- ✅ 你想要最佳性能和最低资源占用
- ✅ 你想简化部署流程
- ✅ 你不需要 SSR 或 Next.js API Routes

### 选择动态部署，如果：
- ✅ 你需要服务端渲染（SEO 优化）
- ✅ 你需要在 Next.js 中使用 API Routes
- ✅ 你需要动态生成页面
- ✅ 你需要 ISR 功能

---

## 📝 本项目推荐

**推荐使用静态部署**，原因：

1. ✅ 本项目是纯客户端渲染（CSR）
2. ✅ 所有 API 都通过 FastAPI 后端实现
3. ✅ 不需要 SSR（后台管理系统，无 SEO 需求）
4. ✅ 性能更好，资源占用更低
5. ✅ 部署更简单，维护成本更低

---

## 🔧 切换部署方式

### 从动态切换到静态

1. 停止当前服务：
   ```bash
   docker-compose down
   ```

2. 使用静态部署：
   ```bash
   ./deploy-static.sh
   # 或
   docker-compose -f docker-compose.static.yml up --build -d
   ```

### 从静态切换到动态

1. 修改 `web/frontend/next.config.ts`，移除或注释：
   ```typescript
   // output: 'export',  // 注释掉这行
   ```

2. 停止当前服务：
   ```bash
   docker-compose -f docker-compose.static.yml down
   ```

3. 使用动态部署：
   ```bash
   docker-compose up --build -d
   ```

---

## 📚 相关文档

- [静态部署详细指南](./STATIC_DEPLOYMENT.md)
- [Docker 部署指南](./docs/DOCKER_DEPLOYMENT.md)
- [本地开发指南](./docs/LOCAL_DEVELOPMENT.md)

---

## ❓ 常见问题

### Q: 静态部署会影响功能吗？
A: 不会。本项目所有功能都是客户端实现，静态部署完全兼容。

### Q: 静态部署后如何更新？
A: 重新构建并部署即可：
```bash
docker-compose -f docker-compose.static.yml up --build -d
```

### Q: 可以使用 CDN 吗？
A: 可以！静态文件可以上传到 CDN，进一步提升性能。

### Q: 性能提升有多少？
A: 首页加载时间从 ~200ms 降至 ~50ms，内存占用从 ~150MB 降至 ~10MB。

---

## 💡 生产环境建议

无论选择哪种方式，生产环境都建议：

1. ✅ 启用 HTTPS（SSL/TLS）
2. ✅ 配置域名和 DNS
3. ✅ 启用 Gzip/Brotli 压缩
4. ✅ 配置适当的缓存策略
5. ✅ 设置监控和日志
6. ✅ 定期备份数据库
7. ✅ 使用环境变量管理敏感信息

---

**推荐：生产环境使用静态部署 + CDN + HTTPS**
