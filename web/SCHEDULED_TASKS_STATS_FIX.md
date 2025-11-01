# 定时报告统计数据修复

## 问题描述

在添加分页功能后，定时报告页面的统计卡片（启用中、已暂停、已完成）只统计了当前页的数据，而不是所有任务的总数。

### 问题示例

假设用户有以下任务：
- 第1页：5个启用任务，3个暂停任务，2个完成任务
- 第2页：3个启用任务，2个暂停任务，5个完成任务

**错误行为（修复前）：**
- 在第1页显示：启用中 5，已暂停 3，已完成 2
- 在第2页显示：启用中 3，已暂停 2，已完成 5

**正确行为（修复后）：**
- 在任何页面都显示：启用中 8，已暂停 5，已完成 7

## 解决方案

### 后端修改

#### 1. 更新响应模型（`web/backend/schemas.py`）

添加 `stats` 字段到 `ScheduledTaskListResponse`：

```python
class ScheduledTaskListResponse(BaseModel):
    """Schema for paginated scheduled task list"""
    items: List[ScheduledTaskResponse]
    total: int
    page: int
    limit: int
    has_next: bool
    has_prev: bool
    # Statistics for all tasks (not just current page)
    stats: Optional[dict] = None  # {"enabled": int, "paused": int, "completed": int}
```

#### 2. 更新路由逻辑（`web/backend/routes/scheduled_task_routes.py`）

在 `list_scheduled_tasks` 函数中添加统计查询：

```python
# Get statistics for all tasks (not filtered by status_filter)
all_tasks_filter = [ScheduledTask.user_id == current_user.id]

# Count enabled tasks (pending + enabled)
enabled_stmt = select(func.count(ScheduledTask.id)).filter(
    *all_tasks_filter,
    ScheduledTask.status == 'pending',
    ScheduledTask.is_enabled == True
)
result = await db.execute(enabled_stmt)
enabled_count = result.scalar()

# Count paused tasks (pending + not enabled)
paused_stmt = select(func.count(ScheduledTask.id)).filter(
    *all_tasks_filter,
    ScheduledTask.status == 'pending',
    ScheduledTask.is_enabled == False
)
result = await db.execute(paused_stmt)
paused_count = result.scalar()

# Count completed tasks
completed_stmt = select(func.count(ScheduledTask.id)).filter(
    *all_tasks_filter,
    ScheduledTask.status == 'completed'
)
result = await db.execute(completed_stmt)
completed_count = result.scalar()

# Return with stats
return ScheduledTaskListResponse(
    items=tasks,
    total=total,
    page=page,
    limit=limit,
    has_next=(page * limit) < total,
    has_prev=page > 1,
    stats={
        "enabled": enabled_count,
        "paused": paused_count,
        "completed": completed_count
    }
)
```

**关键点：**
- 统计查询使用 `all_tasks_filter`，只过滤用户ID，不受 `status_filter` 参数影响
- 分别统计三种状态的任务数量
- 统计数据在所有页面保持一致

### 前端修改

#### 更新统计卡片（`web/frontend/src/app/scheduled-tasks/page.tsx`）

从后端返回的 `stats` 对象中获取统计数据：

```typescript
{/* 修改前：只统计当前页 */}
<p className="text-2xl font-bold text-gray-900">
  {data?.items.filter(t => t.status === 'pending' && t.is_enabled).length || 0}
</p>

{/* 修改后：使用后端返回的总统计 */}
<p className="text-2xl font-bold text-gray-900">
  {data?.stats?.enabled || 0}
</p>
```

**三个统计卡片的修改：**

1. **启用中**：`data?.stats?.enabled`
2. **已暂停**：`data?.stats?.paused`
3. **已完成**：`data?.stats?.completed`

## 技术细节

### 统计逻辑

```
启用中 = status='pending' AND is_enabled=true
已暂停 = status='pending' AND is_enabled=false
已完成 = status='completed'
总任务数 = 启用中 + 已暂停 + 已完成
```

### 数据库查询优化

使用 `func.count()` 进行高效的计数查询，而不是获取所有记录后在应用层计数：

```python
# ✅ 高效：数据库层面计数
count_stmt = select(func.count(ScheduledTask.id)).filter(...)
result = await db.execute(count_stmt)
count = result.scalar()

# ❌ 低效：获取所有记录后计数
all_tasks = await db.execute(select(ScheduledTask).filter(...))
count = len(all_tasks.scalars().all())
```

### API 响应示例

```json
{
  "items": [
    {
      "id": 1,
      "task_name": "AAPL 每日分析",
      "status": "pending",
      "is_enabled": true,
      ...
    },
    ...
  ],
  "total": 25,
  "page": 1,
  "limit": 10,
  "has_next": true,
  "has_prev": false,
  "stats": {
    "enabled": 15,
    "paused": 5,
    "completed": 5
  }
}
```

## 向后兼容性

- `stats` 字段是可选的（`Optional[dict]`），不会破坏现有的 API 调用
- 前端使用可选链操作符（`?.`）和默认值（`|| 0`），确保在 `stats` 不存在时也能正常显示

## 测试场景

### 1. 基本统计

**数据：**
- 10个启用任务
- 5个暂停任务
- 3个完成任务

**验证：**
- 在第1页显示：启用中 10，已暂停 5，已完成 3
- 在第2页显示：启用中 10，已暂停 5，已完成 3
- 统计数字在所有页面保持一致

### 2. 切换任务状态

**操作：**
1. 在第1页将一个启用任务暂停
2. 切换到第2页

**验证：**
- 启用中减1，已暂停加1
- 统计在所有页面同步更新

### 3. 删除任务

**操作：**
1. 删除一个启用任务
2. 切换页面

**验证：**
- 总任务数减1
- 启用中减1
- 统计在所有页面同步更新

### 4. 空状态

**数据：**
- 没有任何任务

**验证：**
- 所有统计显示为 0
- 不会出现错误或 undefined

## 性能考虑

### 查询次数

每次列表请求需要执行以下查询：
1. 总数查询（1次）
2. 启用任务统计（1次）
3. 暂停任务统计（1次）
4. 完成任务统计（1次）
5. 分页数据查询（1次）

**总计：5次数据库查询**

### 优化建议

如果任务数量非常大（>10000），可以考虑：

1. **缓存统计数据**：使用 Redis 缓存统计结果，设置较短的过期时间（如30秒）
2. **异步更新**：在任务状态变更时异步更新缓存的统计数据
3. **数据库索引**：确保 `user_id`、`status`、`is_enabled` 字段有合适的索引

```python
# 示例：添加复合索引
Index('idx_user_status_enabled', 
      ScheduledTask.user_id, 
      ScheduledTask.status, 
      ScheduledTask.is_enabled)
```

## 相关文件

- `web/backend/schemas.py` - 响应模型定义
- `web/backend/routes/scheduled_task_routes.py` - API 路由实现
- `web/frontend/src/app/scheduled-tasks/page.tsx` - 前端页面
- `web/backend/models.py` - 数据库模型（ScheduledTask）

## 总结

通过在后端添加统计查询并在响应中返回统计数据，解决了分页后统计不准确的问题。现在统计卡片显示的是所有任务的总数，而不仅仅是当前页的数据，为用户提供了准确的全局视图。
