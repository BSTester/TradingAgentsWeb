# 自动数据库迁移

## 概述

应用启动时会自动运行待处理的数据库迁移，无需手动执行迁移脚本。

## 工作原理

1. **迁移跟踪**：使用 `migration_history` 表跟踪已应用的迁移
2. **自动检测**：启动时自动检测待处理的迁移
3. **顺序执行**：按预定义顺序执行迁移
4. **幂等性**：已应用的迁移会被跳过

## 迁移列表

迁移按以下顺序执行：

1. `add_user_config` - 创建用户配置表
2. `add_user_role` - 添加用户角色字段
3. `add_api_keys_to_user_config` - 添加API密钥字段
4. `add_last_ticker` - 添加最后使用的股票代码字段
5. `add_market_field` - 添加市场类型字段
6. `fill_market_field` - 填充现有记录的市场类型
7. `add_scheduled_tasks_table` - 创建定时任务表
8. `fix_scheduled_tasks` - 修复定时任务表字段
9. `add_trading_executor_to_scheduled_tasks` - 添加交易执行配置
10. `add_trading_executor_to_analysis` - 添加交易执行配置到分析记录
11. `simplify_api_keys` - 简化API密钥存储

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
✅ 3 migration(s) applied successfully
```

### 手动运行

如果需要手动运行迁移：

```bash
python web/backend/migrations/auto_migrate.py
```

输出示例：
```
============================================================
Auto Migration Manager
============================================================
Database: ./db/tradingagents.db
Applied migrations: 8

[RUN] add_trading_executor_to_analysis
      Add trading executor fields to analysis_records
      [OK] Migration completed successfully

============================================================
Migration Summary
============================================================
[OK] Successful: 1
[FAIL] Failed: 0
[SKIP] Skipped: 10
Total: 11

[SUCCESS] All pending migrations completed successfully!
```

## 添加新迁移

1. **创建迁移脚本**：
   ```python
   # web/backend/migrations/my_new_migration.py
   def run_migration():
       # 迁移逻辑
       pass
   
   if __name__ == "__main__":
       run_migration()
   ```

2. **注册迁移**：
   编辑 `auto_migrate.py`，在 `MIGRATIONS` 列表中添加：
   ```python
   {
       "name": "my_new_migration",
       "file": "my_new_migration.py",
       "description": "Description of what this migration does"
   },
   ```

3. **测试迁移**：
   ```bash
   python web/backend/migrations/my_new_migration.py
   ```

4. **重启应用**：
   迁移会在下次启动时自动运行

## 迁移最佳实践

1. **幂等性**：迁移应该可以安全地多次运行
2. **向后兼容**：避免删除现有字段，使用添加新字段的方式
3. **数据迁移**：如果需要迁移数据，确保处理空值和边界情况
4. **测试**：在开发环境测试迁移后再部署到生产环境
5. **备份**：生产环境运行迁移前备份数据库

## 故障排除

### 迁移失败

如果迁移失败：

1. 查看错误日志
2. 修复迁移脚本
3. 从 `migration_history` 表中删除失败的记录：
   ```sql
   DELETE FROM migration_history WHERE migration_name = 'failed_migration_name';
   ```
4. 重新运行迁移

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

## 相关文件

- `web/backend/migrations/auto_migrate.py` - 自动迁移管理器
- `web/backend/app.py` - 应用启动时调用自动迁移
- `web/backend/migrations/*.py` - 各个迁移脚本
