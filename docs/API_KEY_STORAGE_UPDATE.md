# API 密钥存储策略更新

## 更新时间
2024-01-15

## 更新说明

### 设计原则

**核心原则：** 所有配置跟随任务保存，用户配置作为兜底

**原因：**
- 每个用户的 API 渠道和密钥可能不同
- 任务创建时的配置应该保持不变
- 用户配置用于缓存和快速填充表单
- 保证任务执行的一致性和独立性

## 数据库模型变更

### 1. AnalysisRecord 模型

**新增字段：**
```python
api_key = Column(String(255), nullable=True)  # LLM API key for this specific task
```

**位置：** 在 `backend_url` 字段之后

**说明：** 每个分析任务保存自己的 API 密钥

### 2. ScheduledTask 模型

**新增字段：**
```python
api_key = Column(String(255), nullable=True)  # LLM API key for this scheduled task
```

**位置：** 在 `backend_url` 字段之后

**说明：** 每个定时任务保存自己的 API 密钥

## 代码变更

### 1. 创建分析任务

**文件：** `web/backend/routes/analysis_routes.py`

**变更：**
```python
# 获取 API 密钥（优先请求，兜底用户配置）
api_key = request.api_key or user_config.last_api_key

# 保存到分析记录
analysis_record = AnalysisRecord(
    ...
    api_key=api_key,  # 保存 API 密钥
    ...
)
```

### 2. 创建定时任务

**文件：** `web/backend/routes/scheduled_task_routes.py`

**变更：**
```python
# 获取 API 密钥（优先请求，兜底用户配置）
api_key = request.api_key or (user_config.last_api_key if user_config else '')

# 保存到定时任务
scheduled_task = ScheduledTask(
    ...
    api_key=api_key,  # 保存 API 密钥
    ...
)
```

### 3. 执行定时任务

**文件：** `web/backend/services/task_executor.py`

**变更：**
```python
# 创建分析记录时复制 API 密钥
analysis_record = AnalysisRecord(
    ...
    api_key=task.api_key,  # 从定时任务复制
    ...
)

# 准备请求数据时使用任务的 API 密钥
api_key = task.api_key or (user_config.last_api_key if user_config else '')

request_data = {
    ...
    'api_key': api_key,  # 优先任务配置，兜底用户配置
    ...
}
```

### 4. 恢复排队任务

**文件：** `web/backend/app.py`

**变更：**
```python
# 优先使用任务中保存的 API 密钥
api_key = task.api_key

if not api_key:
    # 兜底：从用户配置中读取
    user_config = db.query(UserConfig).filter(...).first()
    api_key = user_config.last_api_key if user_config else ''

request_data = {
    ...
    'api_key': api_key,  # 优先任务配置，兜底用户配置
    ...
}
```

## 配置优先级

### 优先级规则

```
1. 任务保存的配置（最高优先级）
   ├─ AnalysisRecord.api_key
   └─ ScheduledTask.api_key
   
2. 用户配置（兜底）
   └─ UserConfig.last_api_key
   
3. 环境变量（最后兜底）
   └─ OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY
```

### 使用场景

#### 场景 1：创建新任务

```
用户提交任务
    ├─ 提供了 API 密钥 → 使用提供的密钥
    └─ 未提供 API 密钥 → 使用用户配置中的密钥
    ↓
保存到任务记录
```

#### 场景 2：执行任务

```
执行任务
    ├─ 任务有 API 密钥 → 使用任务的密钥
    └─ 任务无 API 密钥 → 使用用户配置的密钥
    ↓
传递给分析引擎
```

#### 场景 3：恢复排队任务

```
服务重启
    ↓
恢复排队任务
    ├─ 任务有 API 密钥 → 使用任务的密钥
    └─ 任务无 API 密钥 → 使用用户配置的密钥
    ↓
重新提交执行
```

## 数据库迁移

### 迁移脚本

**文件：** `web/backend/migrations/add_api_key_to_tasks.py`

**执行：**
```bash
python web/backend/migrations/add_api_key_to_tasks.py
```

**操作：**
1. 检查 `analysis_records` 表是否有 `api_key` 字段
2. 如果没有，添加 `api_key VARCHAR(255)` 字段
3. 检查 `scheduled_tasks` 表是否有 `api_key` 字段
4. 如果没有，添加 `api_key VARCHAR(255)` 字段

### 自动迁移

迁移脚本已集成到应用启动流程中，会自动执行。

## 安全考虑

### 1. 数据库加密

**当前状态：** API 密钥以明文存储

**生产环境建议：**
```python
# 使用加密存储
from cryptography.fernet import Fernet

# 加密
encrypted_key = encrypt(api_key)
task.api_key = encrypted_key

# 解密
api_key = decrypt(task.api_key)
```

### 2. 访问控制

**规则：**
- 用户只能访问自己的任务
- API 密钥不在 API 响应中返回
- 日志中不记录完整的 API 密钥

### 3. 密钥轮换

**建议：**
- 定期提醒用户更新 API 密钥
- 支持密钥过期检测
- 提供密钥更新接口

## 向后兼容

### 旧任务处理

**问题：** 旧的任务记录没有 `api_key` 字段

**解决方案：**
```python
# 代码中已实现兜底逻辑
api_key = task.api_key or user_config.last_api_key or ''
```

**说明：**
- 旧任务的 `api_key` 为 `NULL`
- 自动使用用户配置中的密钥
- 不影响现有功能

### 数据迁移

**不需要数据迁移：**
- 新字段允许 `NULL`
- 旧记录保持不变
- 新任务自动填充

## 测试验证

### 测试场景 1：创建任务时保存密钥

```python
# 提交任务时提供密钥
POST /api/analysis
{
    "ticker": "AAPL",
    "api_key": "sk-test123",
    ...
}

# 验证：数据库中保存了密钥
assert analysis_record.api_key == "sk-test123"
```

### 测试场景 2：执行任务时使用任务密钥

```python
# 任务有密钥
task.api_key = "sk-task-key"
user_config.last_api_key = "sk-user-key"

# 执行任务
execute_task(task)

# 验证：使用任务密钥
assert request_data['api_key'] == "sk-task-key"
```

### 测试场景 3：兜底使用用户配置

```python
# 任务无密钥
task.api_key = None
user_config.last_api_key = "sk-user-key"

# 执行任务
execute_task(task)

# 验证：使用用户配置密钥
assert request_data['api_key'] == "sk-user-key"
```

### 测试场景 4：恢复排队任务

```python
# 服务重启前创建任务
task.api_key = "sk-queued-task"
task.status = "queued"

# 服务重启
restart_service()

# 验证：任务恢复时使用保存的密钥
assert restored_task_data['api_key'] == "sk-queued-task"
```

## 影响范围

### 受影响的功能

1. ✅ 创建分析任务
2. ✅ 创建定时任务
3. ✅ 执行定时任务
4. ✅ 恢复排队任务
5. ✅ 任务执行

### 不受影响的功能

- ❌ 查看历史记录（API 密钥不返回）
- ❌ 导出报告
- ❌ WebSocket 连接
- ❌ 用户认证

## 监控建议

### 关键指标

1. **密钥使用率**
   - 有密钥的任务数 / 总任务数
   - 目标：> 90%

2. **兜底使用率**
   - 使用用户配置密钥的任务数 / 总任务数
   - 目标：< 10%

3. **密钥有效性**
   - API 调用成功率
   - 识别无效密钥

### 告警规则

建议设置以下告警：

1. 兜底使用率 > 20%（可能有问题）
2. API 调用失败率 > 5%（密钥可能无效）
3. 大量任务无密钥（配置问题）

## 相关文件

### 模型
- `web/backend/models.py` - 数据库模型定义

### 路由
- `web/backend/routes/analysis_routes.py` - 分析任务创建
- `web/backend/routes/scheduled_task_routes.py` - 定时任务创建

### 服务
- `web/backend/services/task_executor.py` - 定时任务执行
- `web/backend/app.py` - 任务恢复

### 迁移
- `web/backend/migrations/add_api_key_to_tasks.py` - 数据库迁移脚本

## 更新日志

| 日期 | 版本 | 更新内容 | 更新人 |
|------|------|---------|--------|
| 2024-01-15 | v1.0 | 添加任务级别 API 密钥存储 | Kiro AI |

---

**更新状态：** ✅ 已完成  
**测试状态：** ⏳ 待验证  
**数据库迁移：** ⏳ 需要执行  
**向后兼容：** ✅ 是
