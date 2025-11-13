# 移除快照日期约束指南

## 概述

为了支持同一天创建多个账户快照（例如每小时执行盯盘任务），需要移除数据库中的日期级别唯一性约束 `uq_user_market_date`。

## 方法 1：使用 Python 脚本（推荐）

这个脚本会自动检测数据库类型并执行相应的 SQL 命令：

```bash
python scripts/remove_snapshot_constraint.py
```

**支持的数据库**：
- SQLite
- MySQL/MariaDB
- PostgreSQL

## 方法 2：手动执行 SQL 命令

### SQLite

```bash
python -c "from web.backend.database import SessionLocal; from sqlalchemy import text; db = SessionLocal(); db.execute(text('DROP INDEX IF EXISTS uq_user_market_date')); db.commit(); print('✅ Constraint removed')"
```

或者直接使用 SQLite 命令：

```bash
sqlite3 db/tradingagents.db "DROP INDEX IF EXISTS uq_user_market_date;"
```

### MySQL/MariaDB

```bash
python -c "from web.backend.database import SessionLocal; from sqlalchemy import text; db = SessionLocal(); db.execute(text('DROP INDEX uq_user_market_date ON account_snapshots')); db.commit(); print('✅ Constraint removed')"
```

或者直接使用 MySQL 命令：

```sql
-- 连接到数据库
mysql -u username -p database_name

-- 删除索引
DROP INDEX uq_user_market_date ON account_snapshots;
```

**注意**：MySQL 的语法是 `DROP INDEX index_name ON table_name`，与 SQLite/PostgreSQL 不同。

### PostgreSQL

```bash
python -c "from web.backend.database import SessionLocal; from sqlalchemy import text; db = SessionLocal(); db.execute(text('DROP INDEX IF EXISTS uq_user_market_date')); db.commit(); print('✅ Constraint removed')"
```

或者直接使用 PostgreSQL 命令：

```sql
-- 连接到数据库
psql -U username -d database_name

-- 删除索引
DROP INDEX IF EXISTS uq_user_market_date;
```

## 验证约束已移除

### SQLite

```bash
sqlite3 db/tradingagents.db "SELECT name FROM sqlite_master WHERE type='index' AND name='uq_user_market_date';"
```

如果没有输出，说明约束已移除。

### MySQL/MariaDB

```sql
SELECT INDEX_NAME 
FROM information_schema.statistics 
WHERE table_schema = DATABASE() 
AND table_name = 'account_snapshots' 
AND index_name = 'uq_user_market_date';
```

如果返回空结果，说明约束已移除。

### PostgreSQL

```sql
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename = 'account_snapshots' 
AND indexname = 'uq_user_market_date';
```

如果返回空结果，说明约束已移除。

## 测试多个快照创建

移除约束后，可以测试同一天创建多个快照：

```bash
# 检查当前快照
python scripts/check_snapshots.py

# 创建测试快照（会在不同时间点创建多个）
python -c "
import asyncio
from web.backend.services.snapshot_scheduler import create_account_snapshot

async def test():
    # 第一个快照
    result1 = await create_account_snapshot(1, 'US', skip_market_check=True)
    print(f'Snapshot 1: {result1}')
    
    # 等待 2 秒
    await asyncio.sleep(2)
    
    # 第二个快照
    result2 = await create_account_snapshot(1, 'US', skip_market_check=True)
    print(f'Snapshot 2: {result2}')

asyncio.run(test())
"

# 再次检查快照
python scripts/check_snapshots.py
```

## 数据库语法差异总结

| 数据库 | 删除索引语法 | 检查索引是否存在 |
|--------|-------------|-----------------|
| SQLite | `DROP INDEX IF EXISTS index_name` | `SELECT name FROM sqlite_master WHERE type='index' AND name='index_name'` |
| MySQL/MariaDB | `DROP INDEX index_name ON table_name` | `SELECT INDEX_NAME FROM information_schema.statistics WHERE table_name='table_name' AND index_name='index_name'` |
| PostgreSQL | `DROP INDEX IF EXISTS index_name` | `SELECT indexname FROM pg_indexes WHERE tablename='table_name' AND indexname='index_name'` |

## 常见问题

### Q: 为什么要移除这个约束？

A: 原来的约束限制每个用户每天每个市场只能有一个快照。这对于每日收盘快照是合理的，但对于日内盯盘任务（可能每小时执行一次）就不够用了。移除约束后，可以在同一天的不同时间点创建多个快照。

### Q: 移除约束后会有重复数据吗？

A: 不会。应用层逻辑会检查是否存在相同时间戳（精确到秒）的快照，如果存在则更新而不是创建新记录。

### Q: 如何回滚这个变更？

A: 如果需要恢复约束，可以运行：

```sql
-- SQLite/PostgreSQL
CREATE UNIQUE INDEX uq_user_market_date 
ON account_snapshots (user_id, market_type, DATE(snapshot_date));

-- MySQL
CREATE UNIQUE INDEX uq_user_market_date 
ON account_snapshots (user_id, market_type, DATE(snapshot_date));
```

**警告**：如果数据库中已经存在同一天的多个快照，创建约束会失败。需要先清理重复数据。

## 相关文档

- [快照功能修复总结](./SNAPSHOT_FIX_SUMMARY.md)
- [账户快照功能文档](./ACCOUNT_SNAPSHOT_FEATURE.md)
- [数据库设置指南](./DATABASE_SETUP.md)
