# 排行榜定时更新模型信息修复

## 问题描述

排行榜有两个数据源：
1. **初始连接**：WebSocket连接时发送初始数据（包含模型信息 ✅）
2. **定时更新**：每分钟广播更新数据（缺少模型信息 ❌）

导致用户刷新页面后能看到模型名称，但1分钟后定时更新会覆盖数据，模型名称消失。

## 问题原因

### 数据流程对比

#### 初始连接（正确）✅

```
WebSocket连接
  ↓
/ws/leaderboard endpoint
  ↓
查询用户 + 查询配置 + 查询快照
  ↓
返回数据（包含 model_name）
```

#### 定时更新（错误）❌

```
定时任务（每分钟）
  ↓
leaderboard_update_task()
  ↓
查询用户 + 查询快照（缺少配置查询）
  ↓
广播数据（缺少 model_name）
```

### 代码对比

**WebSocket初始连接**（正确）：
```python
# 查询用户配置
config_query = select(UserConfig).where(UserConfig.user_id.in_(user_ids))
configs = {config.user_id: config for config in config_result.scalars().all()}

# 获取模型名称
model_name = config.intraday_llm_model if config.intraday_llm_model else None

# 返回数据
users_list.append({
    'user_id': user.id,
    'username': user.username,
    'model_name': model_name  # ✅ 包含
})
```

**定时更新任务**（错误）：
```python
# ❌ 没有查询用户配置
# ❌ 没有获取模型名称

# 返回数据
users_list.append({
    'user_id': user.id,
    'username': user.username,
    # ❌ 缺少 model_name
})
```

## 解决方案

### 修改定时更新任务

**文件**：`web/backend/app.py`

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
    'model_name': model_name  # ✅ 添加
})
```

## 完整的数据流程

### 1. 初始连接

```
用户打开排行榜页面
  ↓
WebSocket连接建立
  ↓
发送初始数据（包含 model_name）
  ↓
前端显示模型名称 ✅
```

### 2. 定时更新（每分钟）

```
定时任务触发
  ↓
查询最新数据（包含 model_name）
  ↓
广播更新给所有客户端
  ↓
前端更新显示（保持 model_name）✅
```

### 3. 数据一致性

现在两个数据源返回相同的数据结构：

```json
{
  "user_id": 1,
  "username": "trader123",
  "market_type": "US",
  "total_assets": 105000.50,
  "latest_snapshot_date": "2024-11-17",
  "model_name": "gpt-4-turbo"  // ✅ 始终存在
}
```

## 时间线对比

### 修复前 ❌

```
00:00 - 用户打开页面
        ↓ 初始连接
        显示：trader123 (gpt-4-turbo) ✅

01:00 - 定时更新触发
        ↓ 广播更新（无 model_name）
        显示：trader123 (无模型) ❌

02:00 - 定时更新触发
        ↓ 广播更新（无 model_name）
        显示：trader123 (无模型) ❌
```

### 修复后 ✅

```
00:00 - 用户打开页面
        ↓ 初始连接
        显示：trader123 (gpt-4-turbo) ✅

01:00 - 定时更新触发
        ↓ 广播更新（包含 model_name）
        显示：trader123 (gpt-4-turbo) ✅

02:00 - 定时更新触发
        ↓ 广播更新（包含 model_name）
        显示：trader123 (gpt-4-turbo) ✅
```

## 性能影响

### 额外查询

每分钟增加1次UserConfig查询：

```python
# 批量查询，性能影响小
config_query = select(UserConfig).where(UserConfig.user_id.in_(user_ids))
```

### 性能数据

- **用户数量**：通常 < 100
- **查询时间**：< 10ms
- **更新频率**：每分钟1次
- **总体影响**：可忽略

### 优化措施

使用批量查询（`IN`）而不是循环查询：

```python
# ✅ 好的做法：1次查询
configs = select(UserConfig).where(UserConfig.user_id.in_(user_ids))

# ❌ 坏的做法：N次查询
for user in users:
    config = select(UserConfig).where(UserConfig.user_id == user.id)
```

## 测试步骤

### 1. 重启后端服务

```bash
python web/backend/app_v2.py
```

### 2. 打开排行榜页面

访问：`http://localhost:3000/leaderboard`

### 3. 检查初始显示

应该看到模型名称：
```
trader123
2024-11-17
           $105,000
           gpt-4-turbo  ✅
```

### 4. 等待1分钟

观察定时更新后模型名称是否保持显示

### 5. 检查后端日志

应该看到：
```
📡 Broadcasting leaderboard update to X clients
📤 Leaderboard update broadcasted with Y users
```

### 6. 检查浏览器控制台

WebSocket消息应该包含 `model_name`：
```javascript
{
  type: "leaderboard_update",
  data: {
    users: [
      {
        user_id: 1,
        username: "trader123",
        model_name: "gpt-4-turbo"  // ✅ 检查这个字段
      }
    ]
  }
}
```

## 相关代码位置

### 修改的文件

- `web/backend/app.py` - 定时更新任务

### 相关文件

- `web/backend/routes/websocket_routes.py` - WebSocket初始连接
- `web/backend/routes/public_leaderboard_routes.py` - REST API
- `web/frontend/src/hooks/useLeaderboardWebSocket.ts` - 前端WebSocket hook

## 数据一致性保证

现在三个数据源都返回相同的数据结构：

1. **WebSocket初始连接** ✅
   - `/ws/leaderboard`
   - 包含 `model_name`

2. **WebSocket定时更新** ✅
   - `leaderboard_update_task()`
   - 包含 `model_name`

3. **REST API** ✅
   - `/api/public/leaderboard/users`
   - 包含 `model_name`

## 故障排查

### 问题：定时更新后模型名称消失

**检查步骤**：

1. **检查后端日志**
   ```
   📤 Leaderboard update broadcasted with X users
   ```

2. **检查WebSocket消息**
   在浏览器控制台查看消息是否包含 `model_name`

3. **检查前端处理**
   确认前端正确处理更新消息：
   ```typescript
   case 'leaderboard_update':
     if (message.data?.users) {
       setUsers(message.data.users)  // 应该包含 model_name
     }
     break
   ```

### 问题：模型名称不更新

**原因**：
- 用户修改了智能盯盘配置
- 但定时更新还在使用旧数据

**解决方案**：
- 等待下一次定时更新（最多1分钟）
- 或刷新页面获取最新数据

## 相关文档

- `docs/LEADERBOARD_WEBSOCKET_MODEL_FIX.md` - WebSocket初始连接修复
- `docs/LEADERBOARD_MODEL_POSITION_FINAL.md` - 模型显示位置
- `docs/LEADERBOARD_MODEL_NAME_DISPLAY.md` - 模型显示功能
