# 短线交易Scheduler自动恢复功能

## 功能概述

当服务意外终止或重启时，系统会自动恢复之前正在运行的短线交易agent任务。这确保了交易策略的连续性，避免因服务重启导致的交易中断。

## 工作原理

### 1. 状态持久化

系统在`user_configs`表中新增了`intraday_scheduler_auto_start`字段，用于记录scheduler的运行状态：

- **True**: Scheduler是用户手动启动的，服务重启后应自动恢复
- **False**: Scheduler是用户手动停止的，服务重启后不应恢复

### 2. 状态更新时机

#### 启动Scheduler时
```python
# 用户通过API启动scheduler
POST /api/intraday-trading/scheduler/control
{
  "action": "start"
}

# 系统会设置：
user_config.intraday_scheduler_enabled = True
user_config.intraday_scheduler_auto_start = True  # 标记为自动恢复
```

#### 停止Scheduler时
```python
# 用户通过API停止scheduler
POST /api/intraday-trading/scheduler/control
{
  "action": "stop"
}

# 系统会设置：
user_config.intraday_scheduler_enabled = False
user_config.intraday_scheduler_auto_start = False  # 清除自动恢复标记
```

### 3. 服务启动时恢复

服务启动时，系统会：

1. 查询所有`intraday_scheduler_auto_start = True`的用户配置
2. 对每个用户：
   - 读取配置（interval_minutes, market_type, futu_api_url等）
   - 创建scheduler实例
   - 启动scheduler
   - 保持`auto_start`标记为True（用于下次重启）

```python
# 在 app.py 的 lifespan 启动阶段
from web.backend.services.user_intraday_scheduler import get_manager as get_intraday_manager
intraday_manager = get_intraday_manager()
await intraday_manager.restore_schedulers_from_db()
```

### 4. 服务关闭时处理

服务正常关闭时：

1. 停止所有运行中的scheduler
2. **保留**`auto_start`标记（不修改数据库）
3. 这样下次启动时可以恢复

```python
# 在 app.py 的 lifespan 关闭阶段
intraday_manager = get_intraday_manager()
await intraday_manager.stop_all_schedulers()
# 注意：不修改 auto_start 标记
```

## 使用场景

### 场景1：服务意外崩溃
```
1. 用户启动scheduler -> auto_start = True
2. 服务运行中...
3. 服务意外崩溃
4. 管理员重启服务
5. 系统自动恢复scheduler ✅
```

### 场景2：服务正常重启（维护）
```
1. 用户启动scheduler -> auto_start = True
2. 服务运行中...
3. 管理员正常关闭服务（维护）
4. 管理员重启服务
5. 系统自动恢复scheduler ✅
```

### 场景3：用户手动停止
```
1. 用户启动scheduler -> auto_start = True
2. 服务运行中...
3. 用户手动停止scheduler -> auto_start = False
4. 服务重启
5. 系统不恢复scheduler ✅（符合用户意图）
```

### 场景4：配置缺失
```
1. 用户启动scheduler -> auto_start = True
2. 用户删除Futu API配置
3. 服务重启
4. 系统尝试恢复但失败（缺少API配置）
5. 系统自动清除auto_start标记 ✅
```

## 数据库迁移

新字段已通过迁移脚本添加：

```bash
# 迁移脚本位置
web/backend/migrations/add_intraday_auto_start.py

# 服务启动时会自动运行迁移
# 或手动运行：
python web/backend/migrations/add_intraday_auto_start.py
```

## 日志监控

系统会记录详细的恢复日志：

```
✅ Intraday trading scheduler manager ready (user schedulers created on-demand)
Found 2 scheduler(s) to restore
Restoring scheduler for user 1...
✅ Restored scheduler for user 1
Restoring scheduler for user 5...
✅ Restored scheduler for user 5
Scheduler restoration complete. Active: 2
✅ Intraday trading schedulers restored from database
```

## 错误处理

### 恢复失败的情况

如果恢复失败（如配置缺失、API不可用等），系统会：

1. 记录错误日志
2. 自动清除该用户的`auto_start`标记
3. 继续恢复其他用户的scheduler
4. 不影响服务启动

### 用户通知

- 恢复成功：通过WebSocket发送`scheduler_started`消息
- 恢复失败：用户下次登录时会看到scheduler未运行状态

## API变更

### 启动Scheduler
```http
POST /api/intraday-trading/scheduler/control
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "start"
}

Response:
{
  "status": "success",
  "message": "Scheduler started"
}
```

**副作用**: 设置`auto_start = True`

### 停止Scheduler
```http
POST /api/intraday-trading/scheduler/control
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "stop"
}

Response:
{
  "status": "success",
  "message": "Scheduler stopped"
}
```

**副作用**: 设置`auto_start = False`

## 配置要求

要使scheduler能够自动恢复，用户必须配置：

1. **Futu API URL**: `intraday_futu_api_url` 或 `futu_api_base_url`
2. **Market Type**: `intraday_market_type` (默认: "US,HK,CN")
3. **Interval**: `intraday_interval_minutes` (默认: 5分钟)

如果缺少必要配置，恢复会失败并清除`auto_start`标记。

## 测试建议

### 测试1：正常恢复
```bash
1. 启动服务
2. 通过API启动scheduler
3. 重启服务（Ctrl+C 然后重新启动）
4. 验证scheduler自动恢复
```

### 测试2：手动停止后不恢复
```bash
1. 启动服务
2. 通过API启动scheduler
3. 通过API停止scheduler
4. 重启服务
5. 验证scheduler未恢复
```

### 测试3：配置缺失
```bash
1. 启动服务
2. 通过API启动scheduler
3. 删除数据库中的futu_api_url
4. 重启服务
5. 验证恢复失败，auto_start被清除
```

## 注意事项

1. **多worker环境**: 只有leader worker会执行恢复逻辑
2. **数据库一致性**: 使用同步数据库会话进行恢复，避免启动时的异步问题
3. **错误隔离**: 单个用户恢复失败不影响其他用户和服务启动
4. **WebSocket通知**: 恢复成功后会通过WebSocket通知前端更新状态

## 相关文件

- `web/backend/models.py`: 数据模型定义
- `web/backend/services/user_intraday_scheduler.py`: Scheduler管理器
- `web/backend/routes/intraday_trading_routes.py`: API路由
- `web/backend/app.py`: 服务启动/关闭逻辑
- `web/backend/migrations/add_intraday_auto_start.py`: 数据库迁移
