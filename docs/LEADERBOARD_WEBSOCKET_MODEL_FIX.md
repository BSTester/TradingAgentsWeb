# 排行榜WebSocket模型信息修复

## 问题描述

排行榜页面使用WebSocket获取用户数据，但WebSocket端点没有返回模型信息（`model_name`），导致前端无法显示用户使用的模型。

## 问题原因

### 数据流程

```
前端 (leaderboard/page.tsx)
  ↓
useLeaderboardWebSocket hook
  ↓
WebSocket: /ws/leaderboard
  ↓
websocket_routes.py: leaderboard_websocket_endpoint()
  ↓
返回用户数据（缺少 model_name）
```

### 原有代码

```python
users_list.append({
    'user_id': user.id,
    'username': user.username,
    'market_type': market,
    'total_assets': float(snapshot.total_assets),
    'latest_snapshot_date': snapshot.snapshot_date.strftime('%Y-%m-%d')
    # ❌ 缺少 model_name
})
```

## 解决方案

### 修改WebSocket端点

**文件**：`web/backend/routes/websocket_routes.py`

**修改内容**：

1. **导入UserConfig模型**
```python
from web.backend.models import User, AccountSnapshot, UserConfig
```

2. **批量查询用户配置**
```python
# Get user configs for model information
user_ids = [user.id for user in participating_users]
configs = {}
if user_ids:
    config_query = select(UserConfig).where(UserConfig.user_id.in_(user_ids))
    config_result = await db.execute(config_query)
    configs = {config.user_id: config for config in config_result.scalars().all()}
```

3. **为每个用户获取模型名称**
```python
for user in participating_users:
    # Get model name from config
    model_name = None
    if user.id in configs:
        config = configs[user.id]
        model_name = config.intraday_llm_model if config.intraday_llm_model else None
```

4. **在返回数据中包含模型名称**
```python
users_list.append({
    'user_id': user.id,
    'username': user.username,
    'market_type': market,
    'total_assets': float(snapshot.total_assets),
    'latest_snapshot_date': snapshot.snapshot_date.strftime('%Y-%m-%d'),
    'model_name': model_name  # ✅ 添加模型名称
})
```

## 完整的数据流程

### 1. WebSocket连接建立

```
前端 → WebSocket连接 → /ws/leaderboard
```

### 2. 获取初始数据

```python
# 1. 查询参与排名的用户
users = select(User).where(User.participate_in_leaderboard == True)

# 2. 查询用户配置（批量）
configs = select(UserConfig).where(UserConfig.user_id.in_(user_ids))

# 3. 查询账户快照
snapshots = select(AccountSnapshot).where(AccountSnapshot.user_id == user.id)

# 4. 组装数据
for user in users:
    model_name = configs[user.id].intraday_llm_model if user.id in configs else None
    for market, snapshot in market_snapshots.items():
        users_list.append({
            'user_id': user.id,
            'username': user.username,
            'market_type': market,
            'total_assets': snapshot.total_assets,
            'latest_snapshot_date': snapshot.snapshot_date,
            'model_name': model_name  # 包含模型信息
        })
```

### 3. 发送给前端

```python
await websocket.send_text(json.dumps({
    'type': 'initial_data',
    'timestamp': datetime.now().isoformat(),
    'data': {
        'users': users_list  # 包含 model_name
    }
}))
```

### 4. 前端接收和显示

```typescript
// useLeaderboardWebSocket.ts
case 'initial_data':
  if (message.data?.users) {
    setUsers(message.data.users)  // users 包含 model_name
  }
  break

// LeaderboardTrendChart.tsx
{user.model_name && (
  <span className="text-xs px-1.5 py-0.5 bg-accent-primary/10 text-accent-primary rounded">
    {user.model_name}
  </span>
)}
```

## 返回数据格式

### WebSocket消息

```json
{
  "type": "initial_data",
  "timestamp": "2024-11-17T14:30:00",
  "data": {
    "users": [
      {
        "user_id": 1,
        "username": "trader123",
        "market_type": "US",
        "total_assets": 105000.50,
        "latest_snapshot_date": "2024-11-17",
        "model_name": "gpt-4-turbo"
      },
      {
        "user_id": 2,
        "username": "investor456",
        "market_type": "US",
        "total_assets": 102500.00,
        "latest_snapshot_date": "2024-11-17",
        "model_name": "claude-3-opus"
      },
      {
        "user_id": 3,
        "username": "quant789",
        "market_type": "US",
        "total_assets": 98750.00,
        "latest_snapshot_date": "2024-11-17",
        "model_name": null
      }
    ]
  }
}
```

## 性能优化

### 批量查询

使用 `IN` 查询一次性获取所有用户配置，避免N+1问题：

```python
# ✅ 好的做法：批量查询
config_query = select(UserConfig).where(UserConfig.user_id.in_(user_ids))
configs = {config.user_id: config for config in config_result.scalars().all()}

# ❌ 坏的做法：循环查询
for user in users:
    config = db.query(UserConfig).filter(UserConfig.user_id == user.id).first()
```

### 查询性能

- **用户数量**：通常 < 100
- **额外查询**：1次（批量查询UserConfig）
- **性能影响**：< 10ms
- **总体影响**：可忽略

## 调试日志

添加了调试日志来追踪数据：

```python
print(f"📊 Found {len(participating_users)} users participating in leaderboard")
print(f"📊 Found {len(configs)} user configs")
```

查看后端日志可以确认：
1. 找到了多少参与排名的用户
2. 找到了多少用户配置
3. 每个用户的模型配置情况

## 测试步骤

### 1. 重启后端服务

```bash
# 停止当前服务
# 重新启动
python web/backend/app_v2.py
```

### 2. 打开排行榜页面

访问：`http://localhost:3000/leaderboard`

### 3. 检查浏览器控制台

应该看到WebSocket连接成功的日志：
```
✅ Leaderboard WebSocket connected successfully
📊 Received initial data: X users
```

### 4. 检查后端日志

应该看到：
```
📊 Found X users participating in leaderboard
📊 Found Y user configs
📤 Sending initial data with X users
✅ Initial data sent successfully
```

### 5. 检查前端显示

排名列表中应该显示模型标签：
```
1  trader123  gpt-4-turbo
   2024-11-17
                    $105,000
```

## 相关修改

### 同时修改的文件

1. **websocket_routes.py** - WebSocket端点（主要修改）
2. **public_leaderboard_routes.py** - REST API端点（添加调试日志）

### 保持一致性

两个端点现在都返回相同的数据结构：
- WebSocket: `/ws/leaderboard`
- REST API: `/api/public/leaderboard/users`

## 故障排查

### 问题：模型名称仍然不显示

**检查步骤**：

1. **检查后端日志**
   ```
   📊 Found X user configs
   ```
   如果X=0，说明没有用户配置

2. **检查数据库**
   ```sql
   SELECT user_id, intraday_llm_model FROM user_configs;
   ```
   确认用户是否配置了智能盯盘模型

3. **检查WebSocket消息**
   在浏览器控制台查看WebSocket消息：
   ```javascript
   // 应该包含 model_name 字段
   {
     user_id: 1,
     username: "trader123",
     model_name: "gpt-4-turbo"  // 检查这个字段
   }
   ```

4. **检查前端代码**
   确认前端正确接收和显示：
   ```typescript
   {user.model_name && (
     <span>{user.model_name}</span>
   )}
   ```

### 问题：只有部分用户显示模型

**原因**：
- 只有配置了智能盯盘模型的用户才会显示
- 没有配置的用户 `model_name` 为 `null`

**解决方案**：
- 这是正常行为
- 用户需要在智能盯盘设置中配置模型

## 相关文档

- `docs/LEADERBOARD_MODEL_NAME_DISPLAY.md` - 原始实现文档
- `docs/LEADERBOARD_MODEL_DISPLAY_UPDATE.md` - 显示位置更新
- `docs/LEADERBOARD_WEBSOCKET_FIX.md` - WebSocket连接修复
