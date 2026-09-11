# WebSocket连接问题修复总结

## 问题描述

排行榜页面的WebSocket连接失败，错误代码1012 (service restart)。

## 根本原因分析

### 1. 重复Accept问题
在`leaderboard_websocket_endpoint`中，代码先调用了`websocket.accept()`，然后又调用了`manager.connect()`，而`manager.connect()`内部也会调用`websocket.accept()`，导致重复accept。

### 2. 错误的数据库会话使用
在WebSocket端点和后台任务中使用了`async for db in get_db()`，这是不正确的。`get_db()`是FastAPI依赖注入使用的生成器，不应该在WebSocket端点中直接使用。

### 3. WebSocket URL构建问题
前端使用`window.location.host`构建WebSocket URL，在开发环境中会连接到错误的端口（3000而不是8000）。

## 修复方案

### 后端修复

#### 1. 修复重复Accept (`web/backend/routes/websocket_routes.py`)

**修改前：**
```python
@router.websocket("/ws/leaderboard")
async def leaderboard_websocket_endpoint(websocket: WebSocket):
    print("🔌 Leaderboard WebSocket connection attempt received")
    try:
        await websocket.accept()  # ❌ 第一次accept
        print(f"🔌 Leaderboard WebSocket connected successfully")
        
        channel_id = "leaderboard_public"
        await manager.connect(websocket, channel_id)  # ❌ 第二次accept
```

**修改后：**
```python
@router.websocket("/ws/leaderboard")
async def leaderboard_websocket_endpoint(websocket: WebSocket):
    print("🔌 Leaderboard WebSocket connection attempt received")
    
    channel_id = "leaderboard_public"
    
    try:
        # Connect to leaderboard channel (this will accept the connection)
        await manager.connect(websocket, channel_id)  # ✅ 只accept一次
        print(f"✅ Leaderboard WebSocket connected successfully to channel: {channel_id}")
```

#### 2. 修复数据库会话使用 (`web/backend/routes/websocket_routes.py`)

**修改前：**
```python
from web.backend.database import get_db
async for db in get_db():  # ❌ 错误用法
    # 查询数据库
```

**修改后：**
```python
from web.backend.database import AsyncSessionLocal
async with AsyncSessionLocal() as db:  # ✅ 正确用法
    # 查询数据库
```

#### 3. 修复后台任务中的数据库会话 (`web/backend/app.py`)

在`leaderboard_update_task`函数中应用同样的修复：

**修改前：**
```python
async for db in get_db():
    # 查询数据库
```

**修改后：**
```python
async with AsyncSessionLocal() as db:
    # 查询数据库
```

### 前端修复

#### 修复WebSocket URL构建 (`web/frontend/src/hooks/useLeaderboardWebSocket.ts`)

**修改前：**
```typescript
const getWebSocketUrl = (endpoint: string): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host  // ❌ 在开发环境中是localhost:3000
  return `${protocol}//${host}${endpoint}`
}
```

**修改后：**
```typescript
const getWebSocketUrl = (endpoint: string): string => {
  // Use the API base URL from environment or window location
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  const protocol = apiBaseUrl.startsWith('https') ? 'wss:' : 'ws:'
  const host = apiBaseUrl.replace(/^https?:\/\//, '')  // ✅ 使用正确的API地址
  return `${protocol}//${host}${endpoint}`
}
```

### 其他改进

#### 1. 移除HTTP轮询Fallback
完全依赖WebSocket连接，移除了HTTP轮询作为备用方案，简化了代码逻辑。

#### 2. 改为每5分钟更新
- WebSocket连接建立后立即获取初始数据
- 每5分钟自动请求一次数据更新
- 每30秒发送心跳保持连接活跃

#### 3. 统一缓存策略
所有相关的HTTP请求（趋势图、持仓、决策历史）都改为5分钟缓存和自动刷新。

## 测试验证

### 1. 创建测试脚本

创建了`test_ws_connection.py`用于测试WebSocket连接：

```python
#!/usr/bin/env python3
import asyncio
import websockets
import json

async def test_leaderboard_ws():
    uri = "ws://localhost:8000/ws/leaderboard"
    async with websockets.connect(uri) as websocket:
        # 接收初始数据
        response = await websocket.recv()
        data = json.loads(response)
        print(f"Received: {data.get('type')}")
        
        # 发送ping
        await websocket.send(json.dumps({'type': 'ping'}))
        
        # 接收pong
        response = await websocket.recv()
        print(f"Received: {data.get('type')}")

asyncio.run(test_leaderboard_ws())
```

### 2. 重启后端服务

**重要：** 修改后必须重启后端服务才能生效！

```bash
# 方法1: 使用批处理脚本
start_backend.bat

# 方法2: 手动启动
cd web/backend
python app.py
```

### 3. 验证连接

1. 打开浏览器开发者工具的Network标签
2. 筛选WS（WebSocket）连接
3. 访问排行榜页面
4. 检查WebSocket连接状态应该显示"101 Switching Protocols"
5. 查看消息面板，应该能看到initial_data消息

## 预期结果

修复后，排行榜页面应该：

1. ✅ WebSocket成功连接到`ws://localhost:8000/ws/leaderboard`
2. ✅ 立即接收初始数据
3. ✅ 每5分钟自动更新数据
4. ✅ 心跳保持连接活跃
5. ✅ 连接状态显示"WebSocket已连接"
6. ✅ 趋势图、持仓、决策历史数据正常加载

## 注意事项

1. **必须重启后端服务** - 代码修改后必须重启才能生效
2. **检查端口** - 确保后端运行在8000端口
3. **环境变量** - 确保`.env.local`中配置了正确的`NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
4. **浏览器缓存** - 如果问题持续，清除浏览器缓存并刷新页面

## 相关文件

### 后端
- `web/backend/routes/websocket_routes.py` - WebSocket路由
- `web/backend/app.py` - 主应用和后台任务
- `web/backend/database.py` - 数据库会话管理

### 前端
- `web/frontend/src/hooks/useLeaderboardWebSocket.ts` - WebSocket hook
- `web/frontend/src/app/leaderboard/page.tsx` - 排行榜页面
- `web/frontend/src/components/leaderboard/LeaderboardTrendChart.tsx` - 趋势图组件
- `web/frontend/src/components/leaderboard/UserDetailPanel.tsx` - 用户详情面板

### 测试
- `test_ws_connection.py` - WebSocket连接测试脚本
- `test_websocket.html` - 浏览器WebSocket测试页面
- `start_backend.bat` - 后端启动脚本

## 总结

通过修复重复accept、错误的数据库会话使用和WebSocket URL构建问题，排行榜的WebSocket连接现在应该能够正常工作。系统完全依赖WebSocket进行实时数据更新，每5分钟自动刷新一次数据，提供了更好的用户体验。
