# 定时任务结束日期功能说明

## 概述

定时任务现在完全支持结束日期功能。当配置了结束日期后,系统会在多个层面确保任务不会在结束日期之后执行。

## 功能特性

### 1. 创建任务时的验证

在创建定时任务时,系统会进行以下检查:

- **过期检查**: 如果结束日期已经过期(早于当前时间),会返回错误,不允许创建
- **首次执行检查**: 如果计算出的首次执行时间晚于结束日期,会返回错误并提示调整时间或结束日期
- **时区处理**: 所有日期时间都使用北京时间(Asia/Shanghai, UTC+8)进行比较

```python
# 示例错误信息
"End date cannot be in the past"
"The first scheduled run time is after the end date. Please adjust your schedule or end date."
```

### 2. 调度器层面的控制

APScheduler 调度器在添加任务时会设置 `end_date` 参数:

- **自动停止**: 调度器会自动在结束日期后停止生成新的执行计划
- **触发器配置**: 所有类型的触发器(CronTrigger, IntervalTrigger)都支持 `end_date` 参数
- **适用范围**: 支持所有执行周期类型:
  - 每天执行 (daily)
  - 每周执行 (weekly)
  - 工作日执行 (workdays)
  - 每N天执行 (every_n_days)

### 3. 执行时的检查

每次任务执行前,系统会检查:

```python
# 检查当前时间是否超过结束日期
if now_beijing > end_date_aware:
    # 标记任务为已完成
    task.status = 'completed'
    task.next_run_time = None
    # 从调度器中移除
    scheduler.remove_scheduled_task(task.scheduler_job_id)
    return  # 不执行任务
```

### 4. 手动启用任务时的检查

用户尝试启用已暂停的任务时,会进行以下检查:

```python
# 1. 检查当前时间是否超过结束日期
if task.end_date and now_beijing > end_date_aware:
    # 标记为已完成,拒绝启用
    task.status = 'completed'
    task.next_run_time = None
    raise HTTPException(
        status_code=400,
        detail="任务已过期,无法启用"
    )

# 2. 重新创建调度器任务,计算最新的下次执行时间
scheduler.remove_scheduled_task(task.scheduler_job_id)  # 移除旧任务
scheduler.add_scheduled_task(...)  # 重新创建,基于当前时间计算
next_run = scheduler.get_next_run_time(task.scheduler_job_id)

# 3. 检查重新计算的下次执行时间是否超过结束日期
if next_run and task.end_date and next_run_aware > end_date_aware:
    # 标记为已完成,拒绝启用
    task.status = 'completed'
    task.next_run_time = None
    scheduler.remove_scheduled_task(task.scheduler_job_id)
    raise HTTPException(
        status_code=400,
        detail="下次执行时间晚于结束日期,无法启用"
    )

# 4. 更新数据库中的下次执行时间
task.next_run_time = next_run
```

**关键点**: 启用任务时会重新创建调度器任务,确保基于当前时间重新计算下次执行时间,而不是使用旧的缓存值。

### 5. 应用启动时的检查

应用启动时加载待执行任务,会进行以下检查:

```python
# 检查当前时间是否超过结束日期
if task.end_date and now_beijing > end_date_aware:
    # 标记为已完成,不加载到调度器
    task.status = 'completed'
    task.next_run_time = None
    continue  # 跳过此任务

# 加载到调度器后,检查下次执行时间
next_run = scheduler.get_next_run_time(task.scheduler_job_id)
if next_run and task.end_date:
    if next_run_aware > end_date_aware:
        # 下次执行超期,标记为已完成
        task.status = 'completed'
        task.next_run_time = None
        scheduler.remove_scheduled_task(task.scheduler_job_id)
        continue  # 跳过此任务
```

### 6. 下次执行时间的计算

任务执行完成后,计算下次执行时间时会检查:

```python
# 获取调度器计算的下次执行时间
next_run = scheduler.get_next_run_time(task.scheduler_job_id)

if next_run and task.end_date:
    # 如果下次执行时间晚于结束日期
    if next_run_aware > end_date_aware:
        # 标记任务为已完成
        task.status = 'completed'
        task.next_run_time = None
        # 从调度器中移除
        scheduler.remove_scheduled_task(task.scheduler_job_id)
```

## 任务生命周期

### 正常流程

1. **创建**: 验证结束日期 → 添加到调度器(带end_date) → 计算首次执行时间
2. **启动加载**: 应用启动时检查所有待执行任务 → 过滤已过期任务 → 只加载有效任务
3. **手动启用**: 用户启用任务时 → 检查是否过期 → 检查下次执行是否超期 → 允许或拒绝启用
4. **执行**: 检查是否过期 → 执行分析 → 计算下次执行时间 → 检查下次是否超期
5. **完成**: 当下次执行时间超过结束日期时,自动标记为 `completed` 并从调度器移除

### 状态转换

```
pending (待执行)
    ↓
    ├─→ 执行中 (每次触发时)
    ↓
    └─→ completed (以下情况之一)
        - 当前时间超过结束日期
        - 下次执行时间超过结束日期
        - 调度器返回 None (无更多执行计划)
```

## 时区处理

所有时间比较都使用北京时间(Asia/Shanghai):

```python
from pytz import timezone as pytz_timezone
beijing_tz = pytz_timezone('Asia/Shanghai')

# 确保时间是时区感知的
if datetime_obj.tzinfo is None:
    datetime_aware = beijing_tz.localize(datetime_obj)
else:
    datetime_aware = datetime_obj.astimezone(beijing_tz)
```

## API 使用示例

### 创建带结束日期的定时任务

```json
POST /api/scheduled-tasks/

{
  "task_name": "每日分析任务",
  "ticker": "AAPL",
  "analysts": ["market", "fundamentals"],
  "research_depth": "deep",
  "llm_provider": "openai",
  "execution_cycle": "daily",
  "execution_time": "09:30",
  "end_date": "2025-12-31"  // 可选,格式: YYYY-MM-DD
}
```

### 响应示例

```json
{
  "id": 1,
  "task_name": "每日分析任务",
  "ticker": "AAPL",
  "status": "pending",
  "execution_cycle": "daily",
  "execution_time": "09:30",
  "end_date": "2025-12-31T23:59:59+08:00",
  "next_run_time": "2025-11-01T09:30:00+08:00",
  "total_executions": 0,
  "is_enabled": true
}
```

## 数据库字段

### ScheduledTask 模型

```python
class ScheduledTask(Base):
    # ... 其他字段
    end_date = Column(DateTime(timezone=True), nullable=True)  # 结束日期
    status = Column(String(20), default='pending')  # pending, completed
    next_run_time = Column(DateTime(timezone=True), nullable=True)  # 下次执行时间
```

## 已完成任务的处理

### 前端显示

- **列表展示**: 已完成的任务会在列表中显示,状态显示为"已完成"(蓝色标签)
- **操作限制**: 已完成的任务不能再次启用或暂停,只能删除
- **统计信息**: 仪表板会统计已完成任务的数量

### 后端限制

```python
# 更新任务时检查状态
if task.status == 'completed':
    raise HTTPException(
        status_code=400,
        detail="Cannot modify a completed task. Completed tasks can only be deleted."
    )

# 启用任务时检查是否过期
if update_data.is_enabled and not old_enabled:
    # 检查当前时间是否超过结束日期
    if task.end_date and now_beijing > end_date_aware:
        task.status = 'completed'
        raise HTTPException(
            status_code=400,
            detail="任务已过期,无法启用。任务已自动标记为已完成。"
        )
    
    # 检查下次执行时间是否超过结束日期
    if next_run and task.end_date and next_run_aware > end_date_aware:
        task.status = 'completed'
        raise HTTPException(
            status_code=400,
            detail="下次执行时间晚于结束日期,无法启用。任务已自动标记为已完成。"
        )
```

### API 行为

- **列表 API**: 默认返回所有任务(pending 和 completed),可通过 `status_filter` 参数过滤
- **更新 API**: 拒绝对已完成任务的修改操作
- **删除 API**: 允许删除已完成的任务

## 注意事项

1. **结束日期格式**: API 接受 `YYYY-MM-DD` 格式,系统会自动设置为当天的 23:59:59
2. **时区一致性**: 所有时间比较都使用北京时间,避免时区混淆
3. **自动清理**: 任务到期后会自动从调度器中移除,不会继续占用资源
4. **状态更新**: 任务状态会及时更新为 `completed`,前端可以据此显示任务已结束
5. **next_run_time 清空**: 任务完成后会将 `next_run_time` 设置为 `None`,表示不再有下次执行
6. **已完成任务**: 已完成的任务在列表中可见但不可修改,只能删除
7. **启动检查**: 应用启动时会自动检查并标记过期任务为已完成

## 相关文件

- `web/backend/routes/scheduled_task_routes.py` - API 路由,创建时验证
- `web/backend/services/scheduler_service.py` - 调度器服务,添加 end_date 支持
- `web/backend/services/task_executor.py` - 任务执行器,执行时检查结束日期
- `web/backend/app.py` - 应用启动,加载任务时检查结束日期
- `web/backend/models.py` - 数据库模型定义

## 测试建议

1. **创建过期任务**: 尝试创建结束日期为过去的任务,应该返回错误
2. **首次执行超期**: 创建一个首次执行时间就超过结束日期的任务,应该返回错误
3. **正常到期**: 创建一个即将到期的任务,观察其在到期后自动完成
4. **跨时区测试**: 确保在不同时区的服务器上运行时,时间比较仍然正确
