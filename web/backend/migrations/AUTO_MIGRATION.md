# 自动数据库迁移

## 概述

应用启动时会自动运行待处理的数据库迁移并同步数据库架构，无需手动执行迁移脚本。系统会自动对比模型定义与数据库架构，添加缺失的字段。

## 核心功能

1. **文件迁移**：传统的迁移文件用于复杂的架构变更
2. **自动架构同步**：对比模型定义与数据库架构，自动添加缺失的字段
3. **迁移跟踪**：使用 `migration_history` 表跟踪已应用的迁移
4. **数据库驱动一致性**：使用与 `DATABASE_URL` 配置相同的数据库驱动
5. **多数据库支持**：支持 SQLite 和 MySQL/MariaDB

## 工作原理

### 1. 迁移历史跟踪
使用 `migration_history` 表跟踪已应用的迁移。

### 2. 文件迁移
按 `auto_migrate.py` 中定义的顺序执行迁移，已应用的迁移会被跳过。

### 3. 架构同步
运行文件迁移后，系统会：
- 检查当前数据库架构
- 与 SQLAlchemy 模型定义对比
- 自动添加缺失的字段，包含适当的类型和约束

### 4. 自动执行
通过 `app.py` 中的 lifespan 事件处理器在每次应用启动时运行。

## 架构同步详情

架构同步功能：

- **对比表结构**：检查每个模型表与数据库的对应关系
- **检测缺失字段**：识别模型中定义但数据库中缺失的字段
- **生成 ALTER TABLE**：为数据库方言（SQLite/MySQL）创建适当的 SQL
- **处理类型**：将 SQLAlchemy 类型转换为数据库特定的 SQL 类型
- **保留约束**：维护 NULL/NOT NULL、DEFAULT 值和其他约束
- **安全操作**：仅添加字段，不删除或修改现有字段

### 支持的字段类型

- VARCHAR/String（带长度）
- TEXT
- INTEGER
- FLOAT
- BOOLEAN（MySQL 使用 TINYINT(1)）
- DATETIME
- JSON（MySQL 使用原生 JSON，SQLite 使用 TEXT）

## 迁移列表

迁移按以下顺序执行：

1. `init_schema` - 初始化数据库架构（所有表）

未来的迁移将添加到此列表中。

## 使用方法

### 自动运行（推荐）

应用启动时自动运行：

```bash
python web/backend/app.py
# 或
uvicorn web.backend.app:app --reload
```

启动日志会显示迁移状态：
```
✅ Database tables initialized successfully
🔄 Running auto migrations...
✅ 2 migration(s) applied successfully
```

### 手动运行

如果需要手动运行迁移：

```bash
# 运行所有迁移和架构同步
python web/backend/migrations/auto_migrate.py

# 测试架构同步
python web/backend/migrations/test_schema_sync.py
```

输出示例：
```
============================================================
Auto Migration Manager
============================================================
Database: tradingagents.db
Driver: sqlite
Applied migrations: 1

[SKIP] init_schema (already applied)

[SCHEMA SYNC] Comparing database schema with models...
   [ADD] users.new_column (VARCHAR(255))
   [ADD] analysis_records.another_field (TEXT)
   ✅ Added 2 missing column(s)

============================================================
Migration Summary
============================================================
[OK] Successful: 0
[OK] Columns added: 2
[FAIL] Failed: 0
[SKIP] Skipped: 1
Total migrations: 1

[SUCCESS] All pending migrations completed successfully!
```

## 添加新迁移

### 简单字段添加
无需操作！只需在模型中添加字段并重启应用，架构同步会自动添加。

### 复杂变更（索引、约束、数据迁移）
1. 创建新的迁移文件（例如 `add_new_feature.py`）
2. 将迁移添加到 `auto_migrate.py` 的 `MIGRATIONS` 列表
3. 下次启动时迁移会自动运行

## 迁移文件模板

```python
#!/usr/bin/env python3
"""
Migration: [描述]
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from web.backend.database import sync_engine
from sqlalchemy import text

def migrate():
    """Run migration"""
    with sync_engine.begin() as conn:
        # 迁移 SQL
        conn.execute(text("""
            ALTER TABLE users ADD COLUMN new_field VARCHAR(255);
        """))
    
    print("✅ Migration completed")

if __name__ == "__main__":
    migrate()
```

## 最佳实践

1. **简单字段添加**：直接添加到模型，让架构同步处理
2. **复杂变更**：创建迁移文件
3. **本地测试**：始终在开发数据库上测试迁移
4. **幂等迁移**：使迁移可以安全地多次运行
5. **描述性名称**：使用清晰的名称和描述
6. **小而专注**：保持迁移小而单一目的
7. **不修改已应用的迁移**：不要更改已应用的迁移文件

## 数据库配置

系统使用 `DATABASE_URL` 环境变量：

```bash
# SQLite（默认）
DATABASE_URL=sqlite+aiosqlite:///./db/tradingagents.db

# MySQL
DATABASE_URL=mysql+aiomysql://user:password@localhost/tradingagents
```

迁移系统会自动：
- 将异步 URL 转换为同步（`+aiosqlite` → ``，`+aiomysql` → `+pymysql`）
- 使用适当的数据库驱动
- 处理方言特定的 SQL 生成

## 故障排除

### 迁移失败

如果迁移失败：

1. 查看控制台中的错误消息
2. 验证迁移 SQL 对您的数据库是否正确
3. 检查数据库权限
4. 如需要手动修复数据库
5. 重新运行迁移

### 架构同步问题

1. 检查模型是否在 `auto_migrate.py` 中正确导入
2. 验证字段类型是否受支持
3. 检查 ALTER TABLE 的数据库权限
4. 查看详细输出中生成的 SQL

### 字段类型不匹配

系统为每个数据库生成适当的 SQL 类型：
- SQLite：更宽松的类型系统
- MySQL：严格的类型要求（例如 BOOLEAN 使用 TINYINT(1)）

### 跳过迁移

如果需要跳过某个迁移（不推荐）：

```sql
INSERT INTO migration_history (migration_name, applied_at, description)
VALUES ('migration_to_skip', datetime('now'), 'Manually skipped');
```

### 重置迁移历史

**警告**：这会导致所有迁移重新运行！

```sql
DROP TABLE migration_history;
```

## 技术细节

- **迁移跟踪表**：`migration_history`
  - `migration_name` (主键): 迁移名称
  - `applied_at`: 应用时间
  - `description`: 迁移描述

- **执行方式**：每个迁移作为独立的子进程运行
- **超时时间**：60秒
- **数据库引擎**：自动检测并使用同步引擎
- **架构检查**：使用 SQLAlchemy Inspector API

## 数据库支持

- **SQLite**：默认，基于文件的数据库
- **MySQL/MariaDB**：生产就绪，带连接池
- **PostgreSQL**：可以通过最小更改添加

迁移系统自动处理 SQL 生成的方言差异。

## 相关文件

- `web/backend/migrations/auto_migrate.py` - 自动迁移管理器（带架构同步）
- `web/backend/migrations/test_schema_sync.py` - 架构同步测试脚本
- `web/backend/app.py` - 应用启动时调用自动迁移
- `web/backend/database.py` - 数据库配置
- `web/backend/models.py` - SQLAlchemy 模型定义
- `web/backend/migrations/*.py` - 各个迁移脚本
