# 快照调度器热修复 - next_run_time 属性访问

## 问题

启动时报错：
```
❌ Database initialization failed: 'apscheduler.job.Job' object has no attribute 'next_run_time'
```

## 原因

APScheduler 的 `Job` 对象在不同版本中，`next_run_time` 属性的访问方式可能不同。直接访问 `job.next_run_time` 在某些情况下会失败。

## 解决方案

使用 `getattr()` 安全访问属性，并添加异常处理：

### 修改前

```python
# 直接访问，可能失败
next_run = job.next_run_time
```

### 修改后

```python
# 安全访问，带异常处理
try:
    next_run = getattr(job, 'next_run_time', None)
    if next_run:
        # 处理时间
        pass
except Exception as e:
    logger.warning(f"Could not get next run time: {e}")
```

## 修改的方法

### 1. `_register_snapshot_job()`

添加 try-except 包装获取下次运行时间的代码。

### 2. `get_next_run_time()`

使用 `getattr()` 安全访问属性。

### 3. `_print_scheduled_jobs()`

为每个任务添加异常处理，确保一个任务失败不影响其他任务的显示。

## 影响

- ✅ 修复启动失败问题
- ✅ 调度器可以正常注册任务
- ✅ 即使无法获取下次运行时间，任务仍会正常执行
- ✅ 提供友好的日志信息

## 测试

启动服务后应该看到：

```
✅ Snapshot scheduler started (daily account snapshots)
📸 Scheduled snapshot jobs (3):
  - Daily US Market Snapshot:
    Next run: 2025-11-14 16:00:00 EST
    Beijing:  2025-11-15 05:00:00 CST
  - Daily HK Market Snapshot:
    Next run: 2025-11-14 16:00:00 HKT
    Beijing:  2025-11-14 16:00:00 CST
  - Daily CN Market Snapshot:
    Next run: 2025-11-14 15:00:00 CST
    Beijing:  2025-11-14 15:00:00 CST
```

或者（如果无法获取时间）：

```
✅ Snapshot scheduler started (daily account snapshots)
📸 Scheduled snapshot jobs (3):
  - Daily US Market Snapshot: Scheduled (next run time not available)
  - Daily HK Market Snapshot: Scheduled (next run time not available)
  - Daily CN Market Snapshot: Scheduled (next run time not available)
```

## 部署

1. 更新代码：`git pull`
2. 重启服务
3. 检查日志确认调度器正常启动

## 相关文件

- `web/backend/services/snapshot_scheduler.py` - 修复的文件
