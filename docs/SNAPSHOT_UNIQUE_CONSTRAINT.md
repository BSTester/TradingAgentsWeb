# 资产快照唯一性约束

## 概述

为确保数据一致性，系统实施了严格的唯一性约束：**每个用户每个市场每天只能有一条快照记录**。

## 约束规则

### 唯一性维度

快照记录的唯一性由以下三个维度决定：

1. **用户 ID** (`user_id`)
2. **市场类型** (`market_type`): US, HK, CN
3. **快照日期** (`DATE(snapshot_date)`): 按日期（不含时分秒）

### 约束示例

```
✅ 允许：
- User 1, US market, 2025-11-13
- User 1, HK market, 2025-11-13
- User 1, US market, 2025-11-14
- User 2, US market, 2025-11-13

❌ 不允许（违反唯一性）：
- User 1, US market, 2025-11-13 04:00:00
- User 1, US market, 2025-11-13 16:00:00  ← 重复！同一天同一市场
```

## 实现机制

### 1. 数据库层约束

**唯一索引**：`uq_user_market_date`

```sql
CREATE UNIQUE INDEX uq_user_market_date 
ON account_snapshots (user_id, market_type, DATE(snapshot_date))
```

**特点**：
- 在数据库层面强制执行
- 任何违反约束的插入操作都会失败
- 最可靠的防护机制

**支持的数据库**：
- MySQL/MariaDB
- PostgreSQL
- SQLite

### 2. 应用层检查

**位置**：`snapshot_scheduler.py` 中的 `_create_snapshots_for_market` 方法

```python
# 使用市场本地日期检查
market_tz = pytz.timezone(market_tz_name)
market_now = datetime.now(market_tz)
market_today = market_now.date()

# 查询是否已存在当天的快照
existing = await db.execute(
    select(AccountSnapshot)
    .where(
        AccountSnapshot.user_id == user.id,
        AccountSnapshot.market_type == market_type,
        AccountSnapshot.snapshot_date >= market_day_start,
        AccountSnapshot.snapshot_date <= market_day_end
    )
)

if existing.scalar_one_or_none():
    logger.info(f"Snapshot already exists for user {user.id} on {market_today}")
    continue  # 跳过，不创建重复快照
```

**特点**：
- 在插入前检查，避免不必要的数据库操作
- 使用市场本地日期，确保准确性
- 提供友好的日志信息

### 3. 双重保护

系统采用**双重保护机制**：

```
应用层检查 (第一道防线)
    ↓
    如果已存在 → 跳过，记录日志
    ↓
    如果不存在 → 尝试插入
    ↓
数据库约束 (第二道防线)
    ↓
    如果违反约束 → 插入失败，回滚
    ↓
    如果符合约束 → 插入成功
```

## 市场本地日期

### 为什么使用市场本地日期？

不同市场的交易日可能不同：

**示例**：美股收盘时间

```
美东时间: 2025-11-13 16:00 (周三)
北京时间: 2025-11-14 05:00 (周四)  ← 已经是第二天！
```

如果使用北京时间的日期（11-14），会导致：
- 快照记录在错误的日期
- 无法正确对应交易日
- 趋势分析出现偏差

**正确做法**：使用市场本地日期（11-13）

### 时区转换

```python
# 获取市场时区
market_tz = pytz.timezone('America/New_York')  # 美东时区

# 获取市场当前时间
market_now = datetime.now(market_tz)

# 提取日期（不含时分秒）
market_today = market_now.date()  # 2025-11-13

# 转换为日期范围（用于查询）
market_day_start = market_tz.localize(datetime.combine(market_today, time.min))
market_day_end = market_tz.localize(datetime.combine(market_today, time.max))
```

## 数据库迁移

### 运行迁移

```bash
cd web/backend
python migrations/add_snapshot_unique_constraint.py
```

### 迁移输出

```
============================================================
Migration: Add unique constraint for account snapshots
============================================================
Creating unique constraint for SQLite...
✅ Unique constraint created successfully (SQLite)

✅ Migration completed successfully

Unique constraint added:
  - Table: account_snapshots
  - Constraint: (user_id, market_type, DATE(snapshot_date))
  - Effect: Each user can only have one snapshot per market per day
============================================================
```

### 迁移安全性

- **幂等性**：可以多次运行，不会重复创建
- **检查机制**：运行前检查约束是否已存在
- **错误处理**：失败不会影响应用启动
- **回滚支持**：提供 `downgrade()` 方法

### 处理现有重复数据

如果数据库中已有重复数据，迁移会失败。需要先清理：

```sql
-- 查找重复记录
SELECT 
    user_id, 
    market_type, 
    DATE(snapshot_date) as snapshot_day,
    COUNT(*) as count
FROM account_snapshots
GROUP BY user_id, market_type, DATE(snapshot_date)
HAVING COUNT(*) > 1;

-- 保留最新的记录，删除旧的
DELETE FROM account_snapshots
WHERE id NOT IN (
    SELECT MAX(id)
    FROM account_snapshots
    GROUP BY user_id, market_type, DATE(snapshot_date)
);
```

## 错误处理

### 应用层重复检测

```python
if existing.scalar_one_or_none():
    logger.info(
        f"Snapshot already exists for user {user.id} in {market_type} market "
        f"on {market_today} (market local date)"
    )
    continue  # 跳过此用户，继续处理下一个
```

**行为**：
- 记录信息日志
- 跳过重复创建
- 继续处理其他用户
- 不影响整体任务执行

### 数据库约束违反

```python
try:
    db.add(snapshot)
    await db.commit()
except IntegrityError as e:
    await db.rollback()
    logger.error(f"Duplicate snapshot detected: {e}")
    # 继续处理下一个用户
```

**行为**：
- 捕获 `IntegrityError` 异常
- 回滚事务
- 记录错误日志
- 继续处理其他用户

## 验证唯一性

### 方法1：查询数据库

```sql
-- 检查是否有重复记录
SELECT 
    user_id, 
    market_type, 
    DATE(snapshot_date) as snapshot_day,
    COUNT(*) as count
FROM account_snapshots
GROUP BY user_id, market_type, DATE(snapshot_date)
HAVING COUNT(*) > 1;

-- 应该返回空结果（无重复）
```

### 方法2：检查索引

```sql
-- MySQL/MariaDB
SHOW INDEX FROM account_snapshots WHERE Key_name = 'uq_user_market_date';

-- PostgreSQL
SELECT * FROM pg_indexes 
WHERE tablename = 'account_snapshots' 
AND indexname = 'uq_user_market_date';

-- SQLite
SELECT * FROM sqlite_master 
WHERE type = 'index' 
AND name = 'uq_user_market_date';
```

### 方法3：测试插入

```python
from web.backend.database import AsyncSessionLocal
from web.backend.models import AccountSnapshot
from datetime import datetime

async def test_duplicate():
    async with AsyncSessionLocal() as db:
        # 创建第一条快照
        snapshot1 = AccountSnapshot(
            user_id=1,
            market_type='US',
            snapshot_date=datetime(2025, 11, 13, 16, 0, 0),
            total_assets=10000.0,
            cash=5000.0,
            market_value=5000.0
        )
        db.add(snapshot1)
        await db.commit()
        print("✅ First snapshot created")
        
        # 尝试创建重复快照（同一天，不同时间）
        snapshot2 = AccountSnapshot(
            user_id=1,
            market_type='US',
            snapshot_date=datetime(2025, 11, 13, 20, 0, 0),  # 同一天
            total_assets=11000.0,
            cash=5500.0,
            market_value=5500.0
        )
        db.add(snapshot2)
        
        try:
            await db.commit()
            print("❌ Duplicate snapshot created (constraint not working!)")
        except Exception as e:
            await db.rollback()
            print(f"✅ Duplicate prevented: {e}")
```

## 日志示例

### 正常创建

```
INFO: Creating US market snapshots...
INFO: Created snapshot for user 1 (john_doe) in US market: $50000.00
INFO: Created snapshot for user 2 (jane_smith) in US market: $75000.00
INFO: ✅ US market snapshot job completed: 2 created, 0 errors
```

### 检测到重复

```
INFO: Creating US market snapshots...
INFO: Snapshot already exists for user 1 in US market on 2025-11-13 (market local date)
INFO: Created snapshot for user 2 (jane_smith) in US market: $75000.00
INFO: ✅ US market snapshot job completed: 1 created, 0 errors
```

### 约束违反（不应该发生）

```
INFO: Creating US market snapshots...
ERROR: Duplicate snapshot detected: (IntegrityError) UNIQUE constraint failed: account_snapshots.user_id, account_snapshots.market_type, DATE(account_snapshots.snapshot_date)
INFO: ✅ US market snapshot job completed: 0 created, 1 errors
```

## 最佳实践

### 1. 定时任务调度

确保定时任务在市场收盘后只运行一次：

```python
# 使用 CronTrigger，每天只触发一次
trigger = CronTrigger(
    hour=16,
    minute=0,
    timezone='America/New_York'
)
```

### 2. 手动创建快照（已移除）

手动快照功能已移除，避免用户在盘中创建快照导致混乱。

### 3. 数据修复

如果需要修复错误的快照：

```sql
-- 删除特定日期的快照
DELETE FROM account_snapshots
WHERE user_id = 1
AND market_type = 'US'
AND DATE(snapshot_date) = '2025-11-13';

-- 然后重新运行定时任务或手动创建
```

### 4. 监控重复

定期检查是否有重复记录：

```sql
-- 每周运行一次
SELECT 
    user_id, 
    market_type, 
    DATE(snapshot_date) as snapshot_day,
    COUNT(*) as count
FROM account_snapshots
GROUP BY user_id, market_type, DATE(snapshot_date)
HAVING COUNT(*) > 1;
```

## 常见问题

### Q1: 为什么使用 DATE(snapshot_date) 而不是完整的 datetime？

A: 因为快照是按**交易日**统计的，不是按具体时间。同一交易日的不同时间点应该只有一条记录。

### Q2: 如果定时任务失败后重试，会创建重复快照吗？

A: 不会。应用层会先检查是否已存在，数据库约束也会阻止重复插入。

### Q3: 跨时区的快照如何处理？

A: 使用市场本地日期。例如美股 11-13 收盘时，虽然北京已经是 11-14，但快照记录的是 11-13（美东日期）。

### Q4: 如果我想在同一天创建多个快照怎么办？

A: 不支持。快照设计为每日一次的收盘快照。如需更高频率的数据，应该使用实时账户查询。

### Q5: 迁移失败怎么办？

A: 检查是否有重复数据，先清理重复记录，然后重新运行迁移。

## 相关文件

- `web/backend/models.py` - AccountSnapshot 模型定义
- `web/backend/services/snapshot_scheduler.py` - 快照创建逻辑
- `web/backend/migrations/add_snapshot_unique_constraint.py` - 数据库迁移脚本

## 总结

通过**应用层检查 + 数据库约束**的双重保护机制，系统确保：

1. ✅ 每个用户每个市场每天只有一条快照
2. ✅ 使用市场本地日期，确保准确性
3. ✅ 防止重复创建，保证数据一致性
4. ✅ 友好的错误处理，不影响其他用户
5. ✅ 详细的日志记录，便于监控和调试

这种设计确保了快照数据的完整性和可靠性，为趋势分析和历史追踪提供了坚实的基础。
