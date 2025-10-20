# 数据库初始化方式说明

## 统一使用应用启动时的异步初始化

### ✅ 当前方式（推荐）

数据库在应用启动时自动初始化，无需手动操作。

```bash
cd web/backend
uvicorn app_v2:app --host 0.0.0.0 --port 8000
```

**启动时自动执行：**
1. ✅ 调用 `init_db()` 创建所有表（包括 `company_name` 字段）
2. ✅ 确保第一个注册用户自动成为管理员
3. ✅ 清理遗留的运行中任务
4. ✅ 启动任务监控器（仅 leader 进程）

### 📋 实现位置

**文件**：`web/backend/app_v2.py`

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown"""
    # Startup
    try:
        # Leader election
        if app.state.is_leader:
            # Initialize database tables (leader only)
            await init_db()
            print("✅ Database tables initialized successfully")
            
            # Ensure first user is admin
            await ensure_first_user_is_admin_async(db)
            
            # Cleanup running tasks
            await cleanup_running_tasks()
            print("✅ Running tasks cleaned up")
```

### 🔧 数据库函数

**文件**：`web/backend/database.py`

```python
async def init_db():
    """
    Initialize database tables (async operation)
    """
    # Import all models to ensure they are registered with Base
    from web.backend.models import User, AnalysisRecord, AnalysisLog, ExportRecord
    
    # Create all tables using async engine
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("✅ Database tables created successfully")
```

### 🎯 优势

1. **自动化**：无需手动运行初始化脚本
2. **异步**：使用异步方式，性能更好
3. **统一**：所有环境使用相同的初始化方式
4. **安全**：Leader 选举机制避免多进程重复初始化
5. **完整**：自动创建包含最新字段的表结构

### 📊 多进程部署

在使用 Gunicorn 等多进程部署时：

```bash
gunicorn web.backend.app_v2:app -w 4 -k uvicorn.workers.UvicornWorker
```

- ✅ 只有 leader 进程执行初始化
- ✅ 其他进程跳过初始化任务
- ✅ 通过本地 TCP 端口实现 leader 选举

### 🔄 现有数据库升级

如果已有运行中的数据库，需要添加新字段：

```bash
cd web/backend/migrations
python apply_migration.py
```

然后重启应用即可。

### ❌ 已删除的方式

~~独立初始化脚本 `web/backend/init_db.py`~~（已删除）

**原因**：
- 需要手动执行，容易遗忘
- 同步方式，性能较差
- 与应用启动逻辑分离，维护困难
- 在容器化部署中不够优雅

### 📝 相关文件

- `web/backend/app_v2.py` - 应用启动和数据库初始化
- `web/backend/database.py` - 数据库配置和 `init_db()` 函数
- `web/backend/models.py` - 数据模型定义（包含 `company_name` 字段）
- `web/backend/migrations/` - 数据库迁移脚本（用于现有数据库升级）

### 🚀 快速开始

#### 新安装
```bash
# 1. 配置环境变量
cp .env.example .env

# 2. 启动应用（自动初始化数据库）
cd web/backend
uvicorn app_v2:app --host 0.0.0.0 --port 8000

# 3. 注册第一个用户（自动成为管理员）
# 访问 http://localhost:8000/register
```

#### 现有数据库升级
```bash
# 1. 应用迁移
cd web/backend/migrations
python apply_migration.py

# 2. 重启应用
cd web/backend
uvicorn app_v2:app --host 0.0.0.0 --port 8000
```

### ✅ 验证

启动应用后，检查日志应该看到：

```
✅ Database tables initialized successfully
✅ Running tasks cleaned up
✅ Task monitor started (leader)
```

检查数据库表结构：

```bash
# SQLite
sqlite3 tradingagents.db ".schema analysis_records" | grep company_name

# MySQL
mysql -u username -p -e "DESCRIBE tradingagents_db.analysis_records" | grep company_name
```

应该看到：
```
company_name VARCHAR(100)
```

### 📚 更多信息

- 详细设置指南：`DATABASE_SETUP.md`
- 功能说明：`COMPANY_NAME_FEATURE.md`
- 部署检查清单：`DEPLOYMENT_CHECKLIST.md`
