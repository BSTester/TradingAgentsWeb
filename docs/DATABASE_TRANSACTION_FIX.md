# 数据库事务管理修复

## 问题描述

在定时任务执行时,出现以下错误:
```
sqlite3.OperationalError: cannot commit - no transaction is active
```

## 根本原因

1. **多线程环境**: 定时任务在后台线程中执行,使用同步的 `SessionLocal()` 创建数据库会话
2. **SQLite 限制**: SQLite 在多线程环境下对事务管理有严格要求
3. **事务状态不一致**: 某些情况下事务可能已经结束或回滚,但代码仍尝试 commit
4. **缺少错误处理**: 原代码没有检查事务状态就直接 commit

## 解决方案

### 1. 添加安全提交函数

创建了 `safe_commit()` 辅助函数来安全地提交数据库更改:

```python
def safe_commit(db, operation_name="operation"):
    """
    Safely commit database changes with proper error handling
    
    Args:
        db: Database session
        operation_name: Name of the operation for logging
    """
    try:
        # Ensure we're in a transaction
        if not db.in_transaction():
            db.begin()
        db.commit()
    except Exception as e:
        print(f"⚠️  Failed to commit {operation_name}: {e}")
        try:
            db.rollback()
        except Exception:
            pass
        # Re-raise to let caller handle
        raise
```

**关键特性**:
- 检查是否在事务中,如果不在则开始新事务
- 捕获 commit 异常并尝试回滚
- 提供操作名称用于日志记录
- 重新抛出异常让调用者处理

### 2. 替换所有 db.commit() 调用

将所有直接的 `db.commit()` 调用替换为 `safe_commit(db, "description")`:

```python
# 旧代码
analysis_record.status = "initializing"
db.commit()

# 新代码
analysis_record.status = "initializing"
safe_commit(db, "update analysis status to initializing")
```

### 3. 改进错误处理

在异常处理中也使用 `safe_commit()`:

```python
# 旧代码
try:
    db.commit()
except Exception:
    try:
        db.rollback()
    except Exception:
        pass

# 新代码
try:
    safe_commit(db, "save error message")
except Exception as commit_error:
    print(f"⚠️  Failed to save error message: {commit_error}")
```

## 修改的文件

### web/backend/analysis_task.py
- 添加了 `safe_commit()` 函数
- 替换了所有 `db.commit()` 调用(共5处)
- 改进了异常处理中的提交逻辑

### web/backend/services/task_executor.py
- 在异常处理中添加了 `db.rollback()`
- 在更新执行计数时使用 `db.begin()` 开始新事务
- 改进了 finally 块中的会话关闭

## 测试建议

### 1. 定时任务执行测试
```bash
# 创建一个定时任务
# 等待任务自动执行
# 检查日志中是否有事务错误
```

### 2. 并发测试
```bash
# 同时创建多个定时任务
# 让它们在相近的时间执行
# 验证没有事务冲突
```

### 3. 错误场景测试
```bash
# 创建一个会失败的任务(例如无效的 ticker)
# 验证错误信息正确保存到数据库
# 检查没有事务错误
```

## 最佳实践

### 1. 使用 safe_commit() 而不是直接 commit()
```python
# ✅ 推荐
safe_commit(db, "update user profile")

# ❌ 不推荐
db.commit()
```

### 2. 在后台线程中使用同步会话
```python
# ✅ 正确
db = SessionLocal()  # 同步会话
try:
    # 执行操作
    safe_commit(db, "operation")
finally:
    db.close()
```

### 3. 异常处理中的事务管理
```python
try:
    # 正常操作
    safe_commit(db, "normal operation")
except Exception as e:
    # 错误处理
    try:
        safe_commit(db, "save error")
    except Exception:
        # 如果保存错误也失败,记录日志但不中断
        print(f"Failed to save error: {e}")
```

## 相关问题

### Q: 为什么不使用异步会话?
A: 定时任务在后台线程中运行,不在 asyncio 事件循环中,因此必须使用同步会话。

### Q: 为什么 SQLite 会有这个问题?
A: SQLite 的默认配置对多线程访问有限制。虽然可以配置为支持多线程,但仍需要小心管理事务状态。

### Q: 生产环境应该使用什么数据库?
A: 建议使用 PostgreSQL 或 MySQL,它们对并发和多线程的支持更好。

## 监控建议

在生产环境中,监控以下指标:
1. 数据库事务错误率
2. 定时任务执行成功率
3. 数据库连接池状态
4. 事务持续时间

## 更新日期

最后更新: 2025-10-31
