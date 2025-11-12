# 资产快照每日唯一性更新

## 更新日期
2025-11-13

## 更新目标

确保每个用户每个市场每天只有一条快照记录，防止重复数据。

## 问题背景

### 潜在问题

1. **定时任务重复执行**：如果服务重启或任务失败重试，可能创建重复快照
2. **时区混淆**：使用服务器时间而非市场本地时间判断日期
3. **并发创建**：多个进程同时创建快照
4. **数据不一致**：同一天有多条记录，影响趋势分析

### 影响

- 趋势图显示异常
- 统计数据不准确
- 存储空间浪费
- 查询性能下降

## 解决方案

### 1. 应用层检查优化 ✅

**文件**：`web/backend/services/snapshot_scheduler.py`

**改进前**：
```python
# 使用服务器当前日期
today = datetime.now().date()
existing = await db.execute(
    select(AccountSnapshot)
    .where(
        AccountSnapshot.user_id == user.id,
        AccountSnapshot.market_type == market_type,
        AccountSnapshot.snapshot_date >= datetime.combine(today, time.min),
        AccountSnapshot.snapshot_date < datetime.combine(today, time.max)
    )
)
```

**问题**：
- 使用服务器时间，可能与市场本地时间不一致
- 美股收盘时北京已经是第二天

**改进后**：
```python
# 使用市场本地日期
market_tz_name = self.MARKET_CLOSE_TIMES[market_type]['timezone']
market_tz = pytz.timezone(market_tz_name)
market_now = datetime.now(market_tz)
market_today = market_now.date()

# 转换为日期范围（UTC）
market_day_start = market_tz.localize(datetime.combine(market_today, time.min))
market_day_end = market_tz.localize(datetime.combine(market_today, time.max))

# 查询当天是否已有快照
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
    logger.info(
        f"Snapshot already exists for user {user.id} in {market_type} market "
        f"on {market_today} (market local date)"
    )
    continue
```

**优势**：
- 使用市场本地日期，准确判断是否为同一交易日
- 详细的日志信息，包含市场本地日期
- 跳过重复创建，继续处理其他用户

### 2. 数据库唯一约束 ✅

**文件**：`web/backend/migrations/add_snapshot_unique_constraint.py`

**创建唯一索引**：
```sql
CREATE UNIQUE INDEX uq_user_market_date 
ON account_snapshots (user_id, market_type, DATE(snapshot_date))
```

**特点**：
- 在数据库层面强制执行
- 支持 MySQL、PostgreSQL、SQLite
- 任何违反约束的插入都会失败
- 最可靠的防护机制

**运行迁移**：
```bash
cd web/backend
python migrations/add_snapshot_unique_constraint.py
```

### 3. 模型文档更新 ✅

**文件**：`web/backend/models.py`

**添加注释**：
```python
class AccountSnapshot(Base):
    """
    Account snapshot model to track daily account balance and positions
    
    Unique Constraint: Each user can only have ONE snapshot per market per day
    - Enforced by database index: uq_user_market_date
    - Prevents duplicate snapshots for the same trading day
    """
    __tablename__ = "account_snapshots"
    
    # ... 字段定义
    
    # Note: Unique constraint on (user_id, market_type, DATE(snapshot_date))
    # This ensures only one snapshot per user per market per day
```

## 双重保护机制

```
┌─────────────────────────────────────────────────────────┐
│                   定时任务触发                           │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              第一道防线：应用层检查                      │
│  - 使用市场本地日期                                     │
│  - 查询数据库是否已存在                                 │
│  - 如果存在 → 跳过，记录日志                            │
│  - 如果不存在 → 继续                                    │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              第二道防线：数据库约束                      │
│  - 唯一索引：uq_user_market_date                        │
│  - 如果违反约束 → 插入失败，回滚                        │
│  - 如果符合约束 → 插入成功                              │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   快照创建成功                           │
└─────────────────────────────────────────────────────────┘
```

## 市场本地日期示例

### 美股市场

```
场景：美股收盘时间
美东时间: 2025-11-13 16:00 (周三)
北京时间: 2025-11-14 05:00 (周四)

使用服务器时间（北京）:
  - 判断日期: 2025-11-14 ❌ 错误！
  - 快照记录在 11-14

使用市场本地时间（美东）:
  - 判断日期: 2025-11-13 ✅ 正确！
  - 快照记录在 11-13（实际交易日）
```

### 港股市场

```
场景：港股收盘时间
香港时间: 2025-11-13 16:00
北京时间: 2025-11-13 16:00

使用任何时间:
  - 判断日期: 2025-11-13 ✅ 一致
  - 无时区问题
```

## 部署步骤

### 1. 更新代码

```bash
git pull
```

### 2. 运行数据库迁移

```bash
cd web/backend
python migrations/add_snapshot_unique_constraint.py
```

预期输出：
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

### 3. 检查现有重复数据

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
```

如果有重复，清理旧数据：
```sql
-- 保留最新的记录，删除旧的
DELETE FROM account_snapshots
WHERE id NOT IN (
    SELECT MAX(id)
    FROM account_snapshots
    GROUP BY user_id, market_type, DATE(snapshot_date)
);
```

### 4. 重启服务

```bash
# 停止服务
# 启动服务
python web/backend/app.py
```

### 5. 验证

查看启动日志，确认快照调度器正常运行：
```
✅ Snapshot scheduler started (daily account snapshots)
📸 Scheduled snapshot jobs (3):
  - Daily US Market Snapshot:
    Next run: 2025-11-14 16:00:00 EST
    Beijing:  2025-11-15 05:00:00 CST
```

## 测试验证

### 1. 测试重复检测

```python
# 手动触发快照创建两次
from web.backend.services.snapshot_scheduler import get_snapshot_scheduler

scheduler = get_snapshot_scheduler()

# 第一次创建
await scheduler._create_snapshots_for_market('US')
# 输出: Created snapshot for user 1 in US market: $50000.00

# 第二次创建（应该跳过）
await scheduler._create_snapshots_for_market('US')
# 输出: Snapshot already exists for user 1 in US market on 2025-11-13
```

### 2. 测试数据库约束

```python
from web.backend.database import AsyncSessionLocal
from web.backend.models import AccountSnapshot
from datetime import datetime

async def test_constraint():
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
        
        # 尝试创建重复快照（同一天）
        snapshot2 = AccountSnapshot(
            user_id=1,
            market_type='US',
            snapshot_date=datetime(2025, 11, 13, 20, 0, 0),
            total_assets=11000.0,
            cash=5500.0,
            market_value=5500.0
        )
        db.add(snapshot2)
        
        try:
            await db.commit()
            print("❌ Constraint not working!")
        except Exception as e:
            await db.rollback()
            print(f"✅ Duplicate prevented: {e}")
```

### 3. 验证唯一索引

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

## 监控建议

### 1. 定期检查重复

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

-- 应该返回空结果
```

### 2. 监控日志

关注以下日志：
```
# 正常
INFO: Created snapshot for user X in Y market: $Z

# 检测到重复（正常）
INFO: Snapshot already exists for user X in Y market on YYYY-MM-DD

# 约束违反（不应该出现）
ERROR: Duplicate snapshot detected: IntegrityError
```

### 3. 统计快照数量

```sql
-- 每个市场每天的快照数量
SELECT 
    market_type,
    DATE(snapshot_date) as snapshot_day,
    COUNT(*) as snapshot_count,
    COUNT(DISTINCT user_id) as user_count
FROM account_snapshots
WHERE snapshot_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY market_type, DATE(snapshot_date)
ORDER BY snapshot_day DESC, market_type;
```

## 回滚方案

如果需要回滚：

### 1. 移除数据库约束

```bash
cd web/backend
python migrations/add_snapshot_unique_constraint.py
# 在脚本中调用 downgrade() 方法
```

或手动执行：
```sql
DROP INDEX uq_user_market_date ON account_snapshots;
```

### 2. 恢复代码

```bash
git checkout <previous-commit>
```

### 3. 重启服务

## 相关文档

- `docs/SNAPSHOT_UNIQUE_CONSTRAINT.md` - 详细的唯一性约束说明
- `docs/SNAPSHOT_TIMEZONE_HANDLING.md` - 时区处理说明
- `docs/ASSET_SNAPSHOT_FEATURE.md` - 功能文档

## 常见问题

### Q1: 为什么要使用市场本地日期？

A: 因为不同市场的交易日可能不同。美股收盘时北京已经是第二天，如果使用北京日期会导致快照记录在错误的日期。

### Q2: 如果定时任务失败后重试会怎样？

A: 应用层会检查是否已存在快照，如果存在则跳过。即使检查失败，数据库约束也会阻止重复插入。

### Q3: 可以在同一天手动创建多个快照吗？

A: 不可以。系统设计为每天只有一条快照，这是收盘快照的本质。

### Q4: 如果我需要更高频率的数据怎么办？

A: 使用实时账户查询API，而不是快照。快照用于历史趋势分析，不适合实时监控。

## 总结

通过本次更新，系统实现了：

1. ✅ 应用层使用市场本地日期检查重复
2. ✅ 数据库层唯一索引强制约束
3. ✅ 双重保护机制确保数据唯一性
4. ✅ 详细的日志记录便于监控
5. ✅ 完善的文档和测试方法

**核心保证**：每个用户每个市场每天只有一条快照记录，确保数据一致性和准确性。
