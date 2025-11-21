# Migration System Guide

## 概述

TradingAgents Web Interface 使用自动化的数据库迁移系统，在应用启动时自动应用数据库更改。

## 文件结构

```
web/backend/migrations/
├── auto_migrate.py              # 自动迁移管理器（核心）
├── init_schema.py               # 初始化数据库架构
├── cleanup_migration_history.py # 清理旧迁移记录
├── README.md                    # 技术文档
├── AUTO_MIGRATION.md            # 详细使用文档
└── MIGRATION_GUIDE.md           # 本文件
```

## 快速开始

### 新安装

对于全新安装，迁移会自动运行：

```bash
# 启动应用
python web/backend/app.py

# 或使用 uvicorn
uvicorn web.backend.app:app --reload
```

应用启动时会自动：
1. 创建所有数据库表
2. 应用所有待处理的迁移
3. 记录迁移历史

### 现有安装升级

对于已有数据库的升级：

```bash
# 1. 备份数据库（重要！）
cp db/tradingagents.db db/tradingagents.db.backup

# 2. 启动应用（自动应用迁移）
python web/backend/app.py
```

### 手动运行迁移

如果需要在不启动应用的情况下运行迁移：

```bash
python web/backend/migrations/auto_migrate.py
```

## 当前版本 (v2.0)

### 数据库架构

**6个核心表**：

1. **users** - 用户账户
2. **user_configs** - 用户配置缓存
3. **scheduled_tasks** - 定时任务
4. **analysis_records** - 分析记录
5. **analysis_logs** - 分析日志
6. **export_records** - 导出记录

### 主要特性

- ✅ 用户认证和角色管理
- ✅ 用户配置缓存（替代前端 localStorage）
- ✅ 定时任务调度
- ✅ 交易执行器支持
- ✅ 多市场支持（US/HK/CN）
- ✅ 分析结果导出（PDF/Markdown/JSON）

## 迁移历史清理

如果你从旧版本升级，可以清理旧的迁移记录：

```bash
python web/backend/migrations/cleanup_migration_history.py
```

这会：
- 删除所有旧的迁移记录
- 只保留当前基线迁移 (`init_schema`)
- 不影响数据库数据

## 开发指南

### 添加新迁移

当需要修改数据库架构时：

1. **创建迁移脚本**：

```python
# web/backend/migrations/add_new_feature.py
#!/usr/bin/env python3
"""
Add New Feature Migration
Description of what this migration does
"""

import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine, text
from web.backend.database import DATABASE_URL

SYNC_DATABASE_URL = DATABASE_URL.replace('+aiosqlite', '').replace('+aiomysql', '')

def run_migration():
    """Run the migration"""
    print("=" * 60)
    print("Add New Feature Migration")
    print("=" * 60)
    
    engine = create_engine(SYNC_DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if already applied
        # ... your migration logic here ...
        
        conn.commit()
    
    print("[OK] Migration completed")

if __name__ == "__main__":
    try:
        run_migration()
        sys.exit(0)
    except Exception as e:
        print(f"[ERROR] Migration failed: {e}")
        sys.exit(1)
```

2. **注册迁移**：

编辑 `auto_migrate.py`：

```python
MIGRATIONS = [
    {
        "name": "init_schema",
        "file": "init_schema.py",
        "description": "Initialize database schema (all tables)"
    },
    {
        "name": "add_new_feature",  # 新增
        "file": "add_new_feature.py",
        "description": "Add new feature to the system"
    },
]
```

3. **测试迁移**：

```bash
# 测试迁移脚本
python web/backend/migrations/add_new_feature.py

# 测试自动迁移
python web/backend/migrations/auto_migrate.py
```

4. **提交代码**：

```bash
git add web/backend/migrations/add_new_feature.py
git add web/backend/migrations/auto_migrate.py
git commit -m "feat: add new feature migration"
```

### 迁移最佳实践

1. **幂等性**：
   - 迁移应该可以安全地多次运行
   - 使用 `IF NOT EXISTS` 或检查字段是否存在

2. **向后兼容**：
   - 不要删除现有字段
   - 添加新字段时使用默认值或允许 NULL

3. **数据迁移**：
   - 处理空值和边界情况
   - 考虑大数据量的性能

4. **测试**：
   - 在开发环境测试
   - 在测试数据库上验证
   - 准备回滚方案

5. **文档**：
   - 在迁移脚本中添加详细注释
   - 更新 README.md
   - 记录破坏性更改

## 故障排除

### 迁移失败

如果迁移失败：

```bash
# 1. 查看错误日志
python web/backend/migrations/auto_migrate.py

# 2. 检查迁移历史
sqlite3 db/tradingagents.db "SELECT * FROM migration_history;"

# 3. 删除失败的迁移记录
sqlite3 db/tradingagents.db "DELETE FROM migration_history WHERE migration_name='failed_migration';"

# 4. 修复迁移脚本后重新运行
python web/backend/migrations/auto_migrate.py
```

### 数据库损坏

如果数据库损坏：

```bash
# 1. 恢复备份
cp db/tradingagents.db.backup db/tradingagents.db

# 2. 或重新初始化（会丢失数据！）
rm db/tradingagents.db
python web/backend/migrations/init_schema.py
```

### 迁移冲突

如果多个开发者同时添加迁移：

```bash
# 1. 拉取最新代码
git pull

# 2. 检查迁移顺序
cat web/backend/migrations/auto_migrate.py

# 3. 调整迁移顺序（如果需要）
# 编辑 auto_migrate.py 中的 MIGRATIONS 列表

# 4. 测试迁移
python web/backend/migrations/auto_migrate.py
```

## 生产环境部署

### 部署前检查

```bash
# 1. 备份生产数据库
mysqldump -u user -p tradingagents > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 在测试环境验证迁移
python web/backend/migrations/auto_migrate.py

# 3. 检查迁移历史
python -c "from web.backend.migrations.auto_migrate import MIGRATIONS; print(f'Total migrations: {len(MIGRATIONS)}')"
```

### 部署步骤

```bash
# 1. 停止应用
systemctl stop tradingagents

# 2. 拉取最新代码
git pull

# 3. 启动应用（自动运行迁移）
systemctl start tradingagents

# 4. 检查日志
journalctl -u tradingagents -f
```

### 回滚

如果需要回滚：

```bash
# 1. 停止应用
systemctl stop tradingagents

# 2. 恢复数据库备份
mysql -u user -p tradingagents < backup_YYYYMMDD_HHMMSS.sql

# 3. 回滚代码
git checkout previous_version

# 4. 启动应用
systemctl start tradingagents
```

## 常见问题

### Q: 迁移会自动运行吗？
A: 是的，应用启动时会自动运行所有待处理的迁移。

### Q: 如何跳过某个迁移？
A: 不推荐跳过迁移。如果必须跳过，可以手动在 `migration_history` 表中添加记录。

### Q: 迁移失败会影响应用启动吗？
A: 不会。即使迁移失败，应用也会继续启动，但会在日志中显示警告。

### Q: 如何查看已应用的迁移？
A: 查询 `migration_history` 表或运行 `auto_migrate.py`。

### Q: 可以手动修改数据库吗？
A: 不推荐。应该通过迁移脚本修改数据库架构。

## 相关资源

- [README.md](README.md) - 技术文档
- [AUTO_MIGRATION.md](AUTO_MIGRATION.md) - 详细使用文档
- [web/backend/models.py](../models.py) - 数据库模型定义
- [web/backend/database.py](../database.py) - 数据库配置

## 支持

如有问题，请：
1. 查看本文档和相关文档
2. 检查应用日志
3. 查看 `migration_history` 表
4. 提交 Issue 或联系开发团队
