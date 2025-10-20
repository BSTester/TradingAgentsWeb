# 数据库设置说明

## 概述

TradingAgents 使用 SQLAlchemy ORM 管理数据库，支持 SQLite 和 MySQL。数据库表结构会根据 `models.py` 中的定义自动创建。

## 数据库表结构

### 主要表

1. **users** - 用户表
   - 用户认证和管理
   - 角色权限控制

2. **analysis_records** - 分析记录表
   - 存储所有分析请求和结果
   - **包含 `company_name` 字段**（用于存储中文公司名称）
   - 包含 `market` 字段（US/HK/CN）

3. **analysis_logs** - 分析日志表
   - 实时分析日志

4. **export_records** - 导出记录表
   - 导出历史记录

## 初始化新数据库

### 自动初始化（推荐）

启动 FastAPI 应用时会自动初始化数据库：

```bash
cd web/backend
uvicorn app_v2:app --host 0.0.0.0 --port 8000
```

应用启动时会：
1. 自动调用 `init_db()` 创建所有表（**包括带有 `company_name` 字段的 analysis_records 表**）
2. 确保第一个注册用户自动成为管理员
3. 清理遗留的运行中任务

**注意**：在多进程部署时（如使用 Gunicorn），只有 leader 进程会执行初始化，避免重复操作。

## 更新现有数据库

如果你已经有一个运行中的数据库，需要添加 `company_name` 字段：

### 方法1：使用迁移脚本（推荐）

```bash
cd web/backend/migrations
python apply_migration.py
```

### 方法2：手动执行 SQL

```bash
# SQLite
sqlite3 tradingagents.db < web/backend/migrations/add_company_name.sql

# MySQL
mysql -u username -p database_name < web/backend/migrations/add_company_name.sql

# PostgreSQL
psql -U username -d database_name -f web/backend/migrations/add_company_name.sql
```

### 方法3：在 Python 中执行

```python
from web.backend.database import sync_engine
from sqlalchemy import text

with sync_engine.connect() as conn:
    with open('web/backend/migrations/add_company_name.sql', 'r') as f:
        sql = f.read()
    conn.execute(text(sql))
    conn.commit()
```

## 验证数据库结构

### SQLite

```bash
sqlite3 tradingagents.db
.schema analysis_records
```

应该看到 `company_name` 字段：

```sql
CREATE TABLE analysis_records (
    ...
    company_name VARCHAR(100),
    ...
);
```

### MySQL

```sql
DESCRIBE analysis_records;
```

应该看到：

```
+------------------+--------------+------+-----+---------+-------+
| Field            | Type         | Null | Key | Default | Extra |
+------------------+--------------+------+-----+---------+-------+
| ...              | ...          | ...  | ... | ...     | ...   |
| company_name     | varchar(100) | YES  | MUL | NULL    |       |
| ...              | ...          | ...  | ... | ...     | ...   |
+------------------+--------------+------+-----+---------+-------+
```

## 数据库配置

### 环境变量

在 `.env` 文件中配置数据库连接：

```bash
# SQLite (默认)
DATABASE_URL=sqlite+aiosqlite:///./tradingagents.db

# MySQL
DATABASE_URL=mysql+aiomysql://username:password@localhost/tradingagents_db

# PostgreSQL
DATABASE_URL=postgresql+asyncpg://username:password@localhost/tradingagents_db
```

## 常见问题

### Q1: 数据库已存在，如何添加新字段？

**A**: 使用迁移脚本：

```bash
cd web/backend/migrations
python apply_migration.py
```

### Q2: 如何重置数据库？

**A**: 删除数据库文件后重启应用：

```bash
# SQLite
rm tradingagents.db
uvicorn web.backend.app_v2:app --reload

# MySQL - 手动删除数据库
mysql -u username -p -e "DROP DATABASE tradingagents_db; CREATE DATABASE tradingagents_db;"
uvicorn web.backend.app_v2:app --reload
```

**警告**：这会删除所有现有数据！

### Q3: Docker 环境如何初始化数据库？

**A**: 直接启动容器即可，应用会自动初始化：

```bash
docker-compose up -d
```

数据库会在应用启动时自动创建。

## 数据库架构变更历史

### v1.1.0 (2025-01-XX)
- ✅ 添加 `company_name` 字段到 `analysis_records` 表
- ✅ 添加 `company_name` 索引以提升查询性能
- 用途：存储从股票代码提取的中文公司名称

### v1.0.0 (初始版本)
- 创建基础表结构
- 用户认证系统
- 分析记录管理
- 日志和导出功能

## 备份和恢复

### SQLite 备份

```bash
# 备份
cp tradingagents.db tradingagents.db.backup

# 恢复
cp tradingagents.db.backup tradingagents.db
```

### MySQL 备份

```bash
# 备份
mysqldump -u username -p tradingagents_db > backup.sql

# 恢复
mysql -u username -p tradingagents_db < backup.sql
```

## 性能优化

### 索引

系统已自动创建以下索引：

- `analysis_records.ticker` - 股票代码查询
- `analysis_records.market` - 市场类别查询
- `analysis_records.company_name` - 公司名称查询
- `analysis_records.status` - 状态查询
- `analysis_records.is_public` - 公开状态查询

### 连接池配置

在 `database.py` 中可以调整连接池大小：

```python
async_engine = create_async_engine(
    DATABASE_URL,
    pool_size=10,      # 连接池大小
    max_overflow=20,   # 最大溢出连接数
)
```

## 开发建议

1. **开发环境**：使用 SQLite，快速启动
2. **生产环境**：使用 MySQL 或 PostgreSQL，更好的并发性能
3. **定期备份**：设置自动备份任务
4. **监控性能**：使用 `echo=True` 查看 SQL 查询（仅开发环境）

## 相关文件

- `web/backend/database.py` - 数据库配置和会话管理
- `web/backend/models.py` - 数据模型定义
- `web/backend/app_v2.py` - 应用启动和数据库初始化
- `web/backend/migrations/` - 数据库迁移脚本
