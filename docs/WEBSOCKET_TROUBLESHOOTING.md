# WebSocket连接故障排查指南

## 问题症状

前端显示WebSocket连接错误，控制台输出：
```
Leaderboard WebSocket error: {}
```

## 诊断步骤

### 1. 检查后端服务状态

```powershell
# 检查8000端口是否在监听
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue

# 应该看到 State 为 Listen 的记录
# 如果看到 FinWait2 或 TimeWait，说明服务正在关闭或已关闭
```

### 2. 测试WebSocket连接

使用提供的测试脚本：

```bash
python test_ws_connection.py
```

**预期输出：**
```
🔌 Connecting to ws://localhost:8000/ws/leaderboard...
✅ Connected successfully!
⏳ Waiting for initial data...
📨 Received: initial_data
👥 Users count: 1
  - admin: $941507.406
🏓 Sending ping...
📨 Received: pong
🔄 Requesting data update...
📨 Received: initial_data
✅ All tests passed!
```

### 3. 检查浏览器控制台

打开浏览器开发者工具（F12），查看Console标签页，应该看到：

**成功连接：**
```
🔌 Connecting to WebSocket: ws://localhost:8000/ws/leaderboard
✅ Leaderboard WebSocket connected successfully
📤 Requesting initial leaderboard data...
📊 Received initial data: 1 users
```

**连接失败：**
```
🔌 Connecting to WebSocket: ws://localhost:8000/ws/leaderboard
❌ Leaderboard WebSocket error: {}
📍 WebSocket URL: ws://localhost:8000/ws/leaderboard
📊 WebSocket state: 3 (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)
🔧 API Base URL: http://localhost:8000
```

### 4. 检查Network标签

1. 打开开发者工具的Network标签
2. 筛选WS（WebSocket）
3. 刷新页面
4. 查看WebSocket连接状态

**成功：** 状态码 101 Switching Protocols
**失败：** 状态码 4xx 或 5xx，或者根本没有连接记录

## 常见问题和解决方案

### 问题1: 后端服务未启动

**症状：**
- WebSocket state: 3 (CLOSED)
- 测试脚本无法连接

**解决方案：**
```bash
# 启动后端服务
cd web/backend
python app.py
```

或使用批处理脚本：
```bash
start_backend.bat
```

### 问题2: 端口被占用

**症状：**
- 后端启动失败
- 错误信息：Address already in use

**解决方案：**
```powershell
# 查找占用8000端口的进程
Get-NetTCPConnection -LocalPort 8000 | Select-Object OwningProcess

# 终止进程（替换PID为实际进程ID）
Stop-Process -Id <PID> -Force
```

### 问题3: 环境变量配置错误

**症状：**
- WebSocket URL不正确
- 连接到错误的端口（如3000而不是8000）

**解决方案：**

检查 `web/frontend/.env.local`：
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

确保：
1. URL以`http://`开头（开发环境）
2. 端口是8000（后端端口）
3. 没有尾部斜杠

### 问题4: 代码未应用

**症状：**
- 修改代码后问题依然存在
- 测试脚本成功但浏览器失败

**解决方案：**

1. **重启后端服务**（必须！）
```bash
# 停止现有进程
# 然后重新启动
cd web/backend
python app.py
```

2. **清除浏览器缓存**
- 按 Ctrl+Shift+Delete
- 选择"缓存的图像和文件"
- 清除

3. **硬刷新前端**
- 按 Ctrl+F5 或 Ctrl+Shift+R

### 问题5: CORS问题

**症状：**
- 控制台显示CORS错误
- WebSocket连接被阻止

**解决方案：**

检查后端CORS配置（`web/backend/app.py`）：
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发环境允许所有来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 调试技巧

### 启用详细日志

前端已经添加了详细的日志输出，打开浏览器控制台即可查看：

- 🔌 连接尝试
- ✅ 连接成功
- 📤 发送请求
- 📊 接收数据
- 🔄 数据更新
- ❌ 错误信息
- 🔌 连接关闭

### 使用测试页面

打开 `test_websocket.html` 在浏览器中测试：

```bash
# 在项目根目录
start test_websocket.html
```

### 检查后端日志

后端会输出详细的WebSocket日志：

```
🔌 Leaderboard WebSocket connection attempt received
✅ Leaderboard WebSocket connected successfully to channel: leaderboard_public
📤 Sending initial data with 1 users
```

## 验证修复

修复后，应该看到：

1. **浏览器控制台：**
   - ✅ 连接成功消息
   - 📊 接收到用户数据
   - 无错误信息

2. **Network标签：**
   - WebSocket连接状态：101 Switching Protocols
   - 可以看到消息往来

3. **页面UI：**
   - 状态指示灯显示绿色脉动
   - 排行榜数据正常显示
   - 趋势图正常绘制

4. **测试脚本：**
   - 所有测试通过
   - 无错误输出

## 相关文件

- `web/frontend/src/hooks/useLeaderboardWebSocket.ts` - WebSocket hook
- `web/backend/routes/websocket_routes.py` - WebSocket路由
- `web/backend/app.py` - 主应用
- `test_ws_connection.py` - 测试脚本
- `test_websocket.html` - 浏览器测试页面

## 获取帮助

如果问题仍然存在：

1. 收集以下信息：
   - 浏览器控制台完整日志
   - 后端控制台输出
   - 测试脚本输出
   - Network标签截图

2. 检查：
   - 后端是否正在运行
   - 端口8000是否可访问
   - 防火墙设置
   - 代理设置

3. 尝试：
   - 重启后端服务
   - 清除浏览器缓存
   - 使用不同的浏览器
   - 检查网络连接
