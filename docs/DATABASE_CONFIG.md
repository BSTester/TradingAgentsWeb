# 数据库配置说明

## 混合异步/同步架构

本项目采用混合数据库架构，以获得最佳性能和兼容性：

- **API 路由（FastAPI）**：使用异步数据库操作，提供高性能非阻塞 I/O
- **后台任务（线程池）**：使用同步数据库操作，代码简单可靠

## 配置方式

### 只需配置一个连接字符串

在 `.env` 文件中配置 `DATABASE_URL`，使用**异步驱动**格式：

```bash
# MySQL（推荐用于生产环境）
DATABASE_URL=mysql+aiomysql://用户名:密码@主机:端口/数据库名?charset=utf8mb4

# SQLite（开发环境）
DATABASE_URL=sqlite+aiosqlite:///./db/tradingagents.db
```

### 自动转换机制

代码会自动处理驱动转换：

| 配置的异步驱动 | API 路由使用 | 后台任务使用 |
|--------------|------------|------------|
| `mysql+aiomysql` | `mysql+aiomysql` | `mysql+pymysql` |
| `sqlite+aiosqlite` | `sqlite+aiosqlite` | `sqlite` |

## MySQL 完整配置示例

### 1. 在 `.env` 中配置

```bash
# MySQL 容器配置
MYSQL_ROOT_PASSWORD=tradingagents123
MYSQL_DATABASE=tradingagents
MYSQL_USER=tradingagents
MYSQL_PASSWORD=tradingagents123

# 数据库连接 URL（使用异步驱动）
DATABASE_URL=mysql+aiomysql://tradingagents:tradingagents123@mysql:3306/tradingagents?charset=utf8mb4
```

### 2. 启动服务

```bash
docker-compose up -d
```

### 3. 验证连接

查看后端日志：
```bash
docker-compose logs -f backend
```

应该看到：
```
✅ Database tables created successfully
✅ Running tasks cleaned up
```

## SQLite 配置示例（开发环境）

```bash
# 使用异步 SQLite
DATABASE_URL=sqlite+aiosqlite:///./db/tradingagents.db
```

## 技术细节

### 依赖包

```
sqlalchemy[asyncio]>=2.0.0  # 异步 ORM 支持
aiomysql>=0.2.0             # MySQL 异步驱动
pymysql>=1.0.0              # MySQL 同步驱动
aiosqlite>=0.19.0           # SQLite 异步驱动
```

### 代码使用

**API 路由（异步）：**
```python
from web.backend.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

@router.get("/users")
async def get_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return users
```

**后台任务（同步）：**
```python
from web.backend.database import SessionLocal

def background_task():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        # 处理数据...
        db.commit()
    finally:
        db.close()
```

## 常见问题

### Q: 为什么不全部使用异步？
A: 后台任务在线程池中运行，使用同步代码更简单可靠，避免事件循环冲突。

### Q: 两种方式会冲突吗？
A: 不会，它们连接同一个数据库，数据完全一致。

### Q: 性能如何？
A: API 路由获得异步性能优势，后台任务不受影响。这是生产环境的最佳实践。

### Q: 如何切换数据库？
A: 只需修改 `.env` 中的 `DATABASE_URL`，重启服务即可。

## 故障排查

### 错误：greenlet_spawn has not been called

**原因**：使用了异步驱动但代码是同步的

**解决**：确保 `DATABASE_URL` 使用正确的驱动格式（`mysql+aiomysql`）

### 错误：No module named 'aiomysql'

**原因**：缺少依赖包

**解决**：
```bash
pip install aiomysql pymysql
# 或重新构建 Docker 镜像
docker-compose build
```

### 连接超时

**原因**：MySQL 容器未就绪

**解决**：等待 MySQL 健康检查通过，或查看日志：
```bash
docker-compose logs mysql
```
