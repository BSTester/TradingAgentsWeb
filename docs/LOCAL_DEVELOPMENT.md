# 本地开发环境配置指南

## 快速开始

### 1. 环境准备

**必需：**
- Python 3.10+
- Node.js 18+
- Git

**可选（如果要用 MySQL）：**
- MySQL 8.0+
- Docker Desktop

### 2. 克隆项目

```bash
git clone <repository-url>
cd tradingagents
```

### 3. 配置环境变量

**方式一：使用 SQLite（推荐，零配置）**

```bash
# 复制本地开发配置
cp .env.local .env
```

**方式二：使用本地 MySQL**

```bash
# 复制示例配置
cp .env.example .env

# 编辑 .env，修改数据库配置
DATABASE_URL=mysql+aiomysql://root:your_password@localhost:3306/tradingagents?charset=utf8mb4
```

### 4. 安装依赖

**后端依赖：**
```bash
pip install -r requirements.txt
```

**前端依赖：**
```bash
cd web/frontend
npm install
cd ../..
```

### 5. 初始化数据库

**SQLite（自动创建）：**
```bash
# 创建数据库目录
mkdir -p db

# 运行后端会自动创建表
python web/backend/app_v2.py
```

**MySQL（需要手动创建数据库）：**
```bash
# 登录 MySQL
mysql -u root -p

# 创建数据库
CREATE DATABASE tradingagents CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 退出
exit

# 运行后端会自动创建表
python web/backend/app_v2.py
```

### 6. 启动服务

**启动后端：**
```bash
# 方式一：直接运行
python web/backend/app_v2.py

# 方式二：使用 uvicorn（支持热重载）
uvicorn web.backend.app_v2:app --reload --host 0.0.0.0 --port 8000
```

**启动前端：**
```bash
cd web/frontend
npm run dev
```

### 7. 访问应用

- 前端：http://localhost:3000
- 后端 API：http://localhost:8000
- API 文档：http://localhost:8000/docs

## 数据库配置详解

### SQLite（推荐用于本地开发）

**优点：**
- ✅ 零配置，开箱即用
- ✅ 无需安装额外软件
- ✅ 数据文件便于备份和迁移
- ✅ 适合单用户开发

**配置：**
```bash
DATABASE_URL=sqlite+aiosqlite:///./db/tradingagents.db
```

**数据文件位置：**
```
项目根目录/db/tradingagents.db
```

**重置数据库：**
```bash
# 删除数据库文件
rm db/tradingagents.db

# 重启后端，会自动重新创建
python web/backend/app_v2.py
```

### MySQL（可选）

**优点：**
- ✅ 更接近生产环境
- ✅ 支持多用户并发
- ✅ 更好的性能和扩展性

**配置：**

1. **安装 MySQL**
   ```bash
   # macOS
   brew install mysql
   brew services start mysql
   
   # Ubuntu/Debian
   sudo apt install mysql-server
   sudo systemctl start mysql
   
   # Windows
   # 下载安装包：https://dev.mysql.com/downloads/mysql/
   ```

2. **创建数据库**
   ```bash
   mysql -u root -p
   ```
   ```sql
   CREATE DATABASE tradingagents CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'tradingagents'@'localhost' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON tradingagents.* TO 'tradingagents'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

3. **配置连接**
   ```bash
   # .env 文件
   DATABASE_URL=mysql+aiomysql://tradingagents:your_password@localhost:3306/tradingagents?charset=utf8mb4
   ```

### 使用 Docker MySQL（推荐）

**最简单的 MySQL 方式：**

```bash
# 启动 MySQL 容器
docker run -d \
  --name tradingagents-mysql \
  -e MYSQL_ROOT_PASSWORD=tradingagents123 \
  -e MYSQL_DATABASE=tradingagents \
  -e MYSQL_USER=tradingagents \
  -e MYSQL_PASSWORD=tradingagents123 \
  -p 3306:3306 \
  mysql:8.0

# 配置连接
DATABASE_URL=mysql+aiomysql://tradingagents:tradingagents123@localhost:3306/tradingagents?charset=utf8mb4
```

## 开发工作流

### 日常开发

```bash
# 1. 启动后端（终端1）
python web/backend/app_v2.py

# 2. 启动前端（终端2）
cd web/frontend
npm run dev

# 3. 开始开发
# 修改代码后，后端需要手动重启，前端会自动热重载
```

### 使用热重载

```bash
# 后端热重载
uvicorn web.backend.app_v2:app --reload --host 0.0.0.0 --port 8000

# 前端热重载（默认开启）
cd web/frontend
npm run dev
```

### 数据库迁移

```bash
# 如果修改了模型，需要重新创建表
# SQLite：删除数据库文件
rm db/tradingagents.db

# MySQL：删除并重新创建数据库
mysql -u root -p -e "DROP DATABASE tradingagents; CREATE DATABASE tradingagents CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 重启后端，会自动创建表
python web/backend/app_v2.py
```

## 常见问题

### Q: 后端启动失败，提示数据库连接错误

**SQLite：**
```bash
# 确保 db 目录存在
mkdir -p db

# 检查配置
cat .env | grep DATABASE_URL
# 应该是：DATABASE_URL=sqlite+aiosqlite:///./db/tradingagents.db
```

**MySQL：**
```bash
# 检查 MySQL 是否运行
mysql -u root -p -e "SELECT 1"

# 检查数据库是否存在
mysql -u root -p -e "SHOW DATABASES LIKE 'tradingagents'"

# 检查用户权限
mysql -u tradingagents -p -e "SELECT 1"
```

### Q: 缺少依赖包

```bash
# 重新安装所有依赖
pip install -r requirements.txt

# 如果使用虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Q: 前端无法连接后端

```bash
# 检查后端是否运行
curl http://localhost:8000/health

# 检查 .env 配置
cat .env | grep NEXT_PUBLIC_API_BASE_URL
# 应该是：NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# 重启前端
cd web/frontend
npm run dev
```

### Q: 如何切换数据库？

```bash
# 编辑 .env 文件
# 注释掉当前的 DATABASE_URL
# 取消注释想要使用的 DATABASE_URL

# 重启后端
python web/backend/app_v2.py
```

### Q: 如何查看数据库内容？

**SQLite：**
```bash
# 使用 sqlite3 命令行
sqlite3 db/tradingagents.db

# 查看所有表
.tables

# 查看用户表
SELECT * FROM users;

# 退出
.quit
```

**MySQL：**
```bash
mysql -u tradingagents -p tradingagents

# 查看所有表
SHOW TABLES;

# 查看用户表
SELECT * FROM users;

# 退出
EXIT;
```

## 性能优化建议

### 开发环境

- ✅ 使用 SQLite（简单快速）
- ✅ 关闭 SQL 日志（`echo=False`）
- ✅ 使用热重载提高开发效率

### 测试环境

- ✅ 使用 Docker MySQL（接近生产环境）
- ✅ 开启 SQL 日志（`echo=True`）用于调试
- ✅ 使用独立的测试数据库

## 下一步

- 📖 阅读 [DATABASE_CONFIG.md](./DATABASE_CONFIG.md) 了解数据库架构
- 🚀 阅读 [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) 了解生产部署
- 📝 查看 API 文档：http://localhost:8000/docs
