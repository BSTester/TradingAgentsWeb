# WebSocket连接快速修复指南

## 问题症状

前端显示WebSocket连接错误：
```
❌ Leaderboard WebSocket error: {}
```

## 快速修复步骤

### 1. 检查后端服务

```bash
# 测试WebSocket连接
python test_ws_connection.py
```

**预期输出：**
```
✅ Connected successfully!
📨 Received: initial_data
👥 Users count: 3
✅ All tests passed!
```

如果测试失败，重启后端：
```bash
cd web/backend
python app.py
```

### 2. 清除浏览器缓存

**Chrome/Edge:**
1. 按 `Ctrl + Shift + Delete`
2. 选择"缓存的图像和文件"
3. 点击"清除数据"

**或者硬刷新:**
- 按 `Ctrl + F5` 或 `Ctrl + Shift + R`

### 3. 重启前端开发服务器

```bash
# 停止当前服务器 (Ctrl+C)
# 然后重新启动
cd web/frontend
npm run dev
```

### 4. 检查环境变量

确保 `web/frontend/.env.local` 存在且配置正确：

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### 5. 检查端口

确保没有端口冲突：

```powershell
# 检查8000端口（后端）
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue

# 检查3000端口（前端）
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
```

### 6. 查看浏览器控制台

打开浏览器开发者工具（F12），查看Console标签：

**应该看到：**
```
🔌 Connecting to WebSocket: ws://localhost:8000/ws/leaderboard
✅ Leaderboard WebSocket connected successfully
📤 Requesting initial leaderboard data...
📊 Received initial data: 3 users
```

**如果看到错误：**
```
❌ Leaderboard WebSocket error: {}
📍 WebSocket URL: ws://localhost:8000/ws/leaderboard
📊 WebSocket state: 3 (CLOSED)
```

检查：
- URL是否正确（应该是`ws://localhost:8000`）
- 后端是否在运行
- 防火墙是否阻止连接

### 7. 检查Network标签

在开发者工具中：
1. 切换到 Network 标签
2. 筛选 WS（WebSocket）
3. 刷新页面
4. 查看WebSocket连接状态

**成功：** 状态码 101 Switching Protocols
**失败：** 状态码 4xx 或 5xx，或者没有连接记录

## 常见问题

### 问题1: URL错误

**症状：** WebSocket URL显示为 `ws://localhost:3000/ws/leaderboard`

**原因：** 环境变量未正确加载

**解决：**
1. 检查 `.env.local` 文件
2. 重启前端开发服务器
3. 硬刷新浏览器

### 问题2: 后端未运行

**症状：** 测试脚本连接失败

**解决：**
```bash
cd web/backend
python app.py
```

### 问题3: 端口被占用

**症状：** 后端启动失败，提示端口已被使用

**解决：**
```powershell
# 查找占用8000端口的进程
Get-NetTCPConnection -LocalPort 8000 | Select-Object OwningProcess

# 终止进程（替换PID）
Stop-Process -Id <PID> -Force
```

### 问题4: CORS错误

**症状：** 控制台显示CORS错误

**解决：** 检查后端CORS配置（`web/backend/app.py`）：
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 问题5: 代码未更新

**症状：** 修改代码后问题依然存在

**解决：**
1. 重启后端服务（必须！）
2. 重启前端开发服务器
3. 清除浏览器缓存
4. 硬刷新页面

## 验证修复

修复后，应该看到：

### 浏览器控制台
```
🔌 Connecting to WebSocket: ws://localhost:8000/ws/leaderboard
✅ Leaderboard WebSocket connected successfully
📤 Requesting initial leaderboard data...
📊 Received initial data: 3 users
```

### 页面UI
- 状态指示灯显示绿色脉动
- 排行榜数据正常显示
- 可以切换市场
- 趋势图正常绘制

### Network标签
- WebSocket连接状态：101 Switching Protocols
- 可以看到消息往来（initial_data, ping, pong）

## 仍然无法解决？

### 收集诊断信息

1. **后端日志：**
   - 查看后端控制台输出
   - 是否有错误信息

2. **浏览器控制台：**
   - 完整的错误堆栈
   - WebSocket URL
   - WebSocket state

3. **Network标签：**
   - WebSocket连接状态
   - 请求/响应头
   - 错误代码

4. **环境信息：**
   - 操作系统
   - 浏览器版本
   - Node.js版本
   - Python版本

### 终极解决方案

如果以上都不行，尝试完全重启：

```bash
# 1. 停止所有服务
# 按 Ctrl+C 停止前端和后端

# 2. 清理
cd web/frontend
rm -rf .next
npm run build

# 3. 重启后端
cd ../backend
python app.py

# 4. 重启前端（新终端）
cd ../frontend
npm run dev

# 5. 清除浏览器缓存并刷新
```

## 预防措施

1. **定期重启服务** - 修改代码后重启
2. **使用硬刷新** - 避免缓存问题
3. **检查日志** - 及时发现问题
4. **保持更新** - 确保依赖是最新的

## 相关文档

- `docs/WEBSOCKET_TROUBLESHOOTING.md` - 详细故障排查
- `docs/WEBSOCKET_FIX_SUMMARY.md` - WebSocket修复总结
- `test_ws_connection.py` - 测试脚本
- `test_leaderboard_data.py` - 数据测试脚本
