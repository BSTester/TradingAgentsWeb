# 项目清理总结 - 2024年11月18日

## 清理内容

### 1. 删除测试脚本 ✅

从项目根目录删除了以下测试脚本：

- `test_leaderboard_data.py` - 排行榜数据测试脚本
- `test_websocket.html` - WebSocket HTML测试页面
- `test_ws_connection.py` - WebSocket连接测试脚本

**原因**：这些测试脚本是开发调试时使用的临时文件，不应该保留在项目根目录。正式的测试应该放在 `tests/` 目录下。

### 2. 移动文档到docs文件夹 ✅

将以下文档从项目根目录移动到 `docs/` 文件夹：

- `DIAGNOSE_LEADERBOARD_DATA.md` → `docs/DIAGNOSE_LEADERBOARD_DATA.md`
- `QUICK_FIX_WEBSOCKET.md` → `docs/QUICK_FIX_WEBSOCKET.md`
- `RESTART_SERVICES.md` → `docs/RESTART_SERVICES.md`

**原因**：保持项目根目录整洁，所有文档统一放在 `docs/` 文件夹中便于管理和查找。

## 项目根目录结构

清理后的根目录保留的主要文件：

### 配置文件
- `.env`, `.env.example`, `.env.local` - 环境配置
- `.gitignore` - Git忽略规则
- `.dockerignore` - Docker忽略规则
- `.python-version` - Python版本

### Docker相关
- `docker-compose.yml` - 主要Docker编排文件
- `docker-compose.simple.yml` - 简化版Docker编排
- `docker-compose.static.yml` - 静态部署版本
- `Dockerfile` - Docker镜像构建文件
- `nginx.conf` - Nginx配置

### Python项目文件
- `pyproject.toml` - Python项目配置
- `setup.py` - Python安装脚本
- `requirements.txt` - Python依赖
- `uv.lock` - UV包管理器锁文件

### 启动脚本
- `main.py` - 主程序入口
- `start.sh` - Linux/Mac启动脚本
- `start.bat` - Windows启动脚本
- `start_backend.bat` - 后端启动脚本
- `restart_backend.ps1` - 后端重启脚本（PowerShell）

### 其他
- `README.md` - 项目说明文档
- `LICENSE` - 许可证
- `Makefile` - Make构建脚本

## 目录结构

```
TradingAgentsWeb/
├── docs/                    # 📚 所有文档（已整理）
├── web/                     # 🌐 Web应用
│   ├── backend/            # FastAPI后端
│   └── frontend/           # Next.js前端
├── tradingagents/          # 🤖 核心交易代理
├── cli/                    # 💻 命令行工具
├── tests/                  # 🧪 测试文件
├── scripts/                # 📜 工具脚本
├── db/                     # 💾 数据库文件
└── [配置文件]              # ⚙️ 各种配置
```

## 建议

### 1. 测试文件管理
- 所有测试脚本应放在 `tests/` 目录下
- 使用 pytest 框架组织测试
- 临时测试脚本应在完成后及时删除

### 2. 文档管理
- 所有文档统一放在 `docs/` 目录
- 使用清晰的命名规范
- 定期整理和归档过时文档

### 3. 根目录整洁
- 只保留必要的配置文件和启动脚本
- 避免临时文件堆积
- 定期清理不需要的文件

## 影响

- ✅ 项目结构更清晰
- ✅ 文档更易查找
- ✅ 减少根目录混乱
- ✅ 提升项目专业度

## 相关文档

- `docs/CLEANUP_SUMMARY.md` - 之前的清理总结
- `docs/README.md` - 文档索引
