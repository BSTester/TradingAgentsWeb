# TradingAgentsWeb

一个基于 TradingAgents 多智能体量化分析框架的现代化 Web 版本，实现了从原版仅支持美股扩展到同时支持美股、港股与 A 股的全栈改造。后端采用 FastAPI，前端采用 Next.js（App Router + Tailwind），支持实时任务管理、WebSocket 推送、用户认证、分析历史与结果导出。

GitHub 仓库：https://github.com/BSTester/TradingAgentsWeb.git

---

## 1. 项目介绍

### 1.1 原版 TradingAgents 项目概述
TradingAgents 是一个“多智能体 + 交易推理图”的金融分析框架，核心思路是将分析任务拆分到不同角色的智能体，由图驱动数据采集、分析推理、风控与交易建议的生成。其核心特征包括：
- 多智能体架构
  - Analysts 团队：市场分析（技术指标/趋势）、社交舆情、新闻情绪、基本面分析
  - Researchers 团队：多轮研究与论证
  - Trader 团队：策略生成与决策建议
  - Risk Management 团队：风险评估与反驳/辩论（保守/中性/激进）
- 图式执行引擎
  - tradingagents/graph/trading_graph.py、signal_processing.py、conditional_logic.py 等组成“推理与传播”图，用于阶段性执行与状态传递
- 数据流模块化
  - tradingagents/dataflows 下集成多数据源：yfinance、alpha_vantage、akshare、baostock、tushare、EODHD、Finnhub 等，提供行情、指标、基本面、新闻/舆情等数据
- 配置与供应商选择
  - default_config.py 中通过 data_vendors、tool_vendors、market_vendors 统一管理供应商优先级与回退策略，便于跨市场与多源融合
- 技术栈
  - Python 3.10+
  - LangChain/LangGraph（智能体与工作流）
  - Pandas/Numpy/Stockstats/Backtrader（数据与技术指标、回测）
  - FastAPI（在 Web 版本中作为后端与 API）
  - SQLAlchemy/Alembic（在 Web 版本中用于持久化）

### 1.2 本项目（Web 版）定位
TradingAgentsWeb 是原版 TradingAgents 的 Web 化改造与扩展：
- 后端：FastAPI + SQLAlchemy + JWT 认证，提供 REST API、WebSocket 推送、任务队列与分析进度监控
- 前端：Next.js 15 + React 19 + Tailwind，提供交互式配置、实时分析进度与结果展示、导出能力
- 市场支持：在原版美股的基础上，统一支持美股（US）、港股（HK）与 A 股（CN），并在默认配置中对不同市场选择合适的数据供应商与回退策略

---

## 2. 改造内容说明

### 2.1 市场扩展的技术实现
在 `tradingagents/default_config.py` 中新增并强化了“市场-供应商偏好”与“工具级别供应商覆盖”：
- 市场级供应商偏好（market_vendors）
  - A_STOCK（A 股）：primary=akshare；fallback=baostock,yfinance
  - HK_STOCK（港股）：primary=akshare；fallback=yfinance
  - US_STOCK（美股）：primary=akshare（遇到失败时优先 yfinance，再回退 alpha_vantage）
- 工具级供应商覆盖（tool_vendors）
  - get_stock_data：akshare
  - get_indicators：yfinance,akshare（先算技术指标，如遇数据缺失回退）
  - get_news / get_global_news：akshare,openai 或 openai,akshare（多源融合）
- 数据流模块适配
  - tradingagents/dataflows 下针对不同供应商提供独立实现（如 akshare_stock.py、baostock_stock.py、y_finance.py、alpha_vantage_stock.py 等）
  - 根据股票代码自动判定市场（示例：A 股一般为 6 位代码，港股可用 4~5 位代码或加 “.HK” 后缀，美股为常见英文代码），随后由 market_vendors 决定供应商与回退链路

该策略使得：
- 不同市场的行情、技术指标、基本面、新闻/舆情均可通过合适的数据源获取
- 当主源不可用或数据缺失时，自动回退到备选供应商以提高鲁棒性

### 2.2 与原版的主要区别与改进
- 架构升级为前后端分离：
  - 原版多为 CLI/脚本驱动；Web 版提供完整的 REST API + WebSocket 推送 + 前端 UI
- 多智能体图并行化：
  - 四类分析师（市场/基本面/新闻/舆情）在 LangGraph 中以独立分支并行执行，显著缩短分析耗时
- 任务调度与实时监控：
  - `web/backend/app.py` 内置线程池与队列（TaskManager，max_workers=50），支持用户级排队、全局并发控制、心跳监控（HeartbeatMonitor，默认 600s）与总时长熔断（`TASK_MAX_RUNTIME_SECONDS`，默认 3600s）及 WebSocket 实时日志
- LLM 调用保护、数据缓存与用量计量：
  - 单次 LLM 请求超时（`LLM_REQUEST_TIMEOUT`，默认 120s）与失败重试（`LLM_MAX_RETRIES`，默认 2 次）
  - 数据层文件级 TTL 缓存（`DATA_CACHE_TTL_SECONDS`，默认 3600s，≤0 禁用），降低对上游数据源的重复请求
  - LLM token 用量计量：`TokenUsageCollector` 注入图 callbacks 累计全部 LLM 调用的输入/输出 token，任务结束后写入一条 `AnalysisLog`（`agent='usage'`），可按任务统计用量
- 用户认证与持久化：
  - 用户注册/登录、JWT 认证、分析记录/日志与导出记录持久化到 SQLite（默认，WAL 模式 + 连接池；也可通过 `DATABASE_URL` 切换 MySQL 等）
  - 首个注册用户自动成为管理员
- 平台运营能力：
  - 订阅计划与积分（credits）体系、定时任务（scheduled tasks）、管理后台（用户管理 / LLM Provider 管理 / 系统默认 Provider）、提示词与模板（prompts / skills）
- 部署与工程化：
  - Dockerfile 与 docker-compose.yml 提供一键构建与编排（前端 Nginx 静态托管并反代后端 `/api`）
  - 环境变量驱动配置：`CORS_ORIGINS` 显式声明跨域来源，`LLM_*` / `TASK_*` / `DATA_CACHE_TTL_SECONDS` 等均有合理默认值
- 市场扩展与配置统一：
  - default_config + dataflows 形成统一的跨市场数据策略，显著提升在港股/A 股场景下的可用性

---

## 3. 安装构建指南

### 3.1 环境要求
- 操作系统：Windows / macOS / Linux
- 后端：
  - Python 3.10+
  - 建议安装虚拟环境（venv 或 conda）
- 前端：
  - Node.js 18+（Next.js 15 推荐）
  - npm 或 pnpm/yarn/bun（任选其一）
- 数据源：
  - 如需使用 Tushare/Finnhub/EODHD 等，需在 `.env` 中配置各自 API Key
- 数据库：
  - 默认 SQLite（无需额外安装），也支持 PostgreSQL 等（通过 `DATABASE_URL` 配置）

### 3.2 克隆代码
```bash
git clone https://github.com/BSTester/TradingAgentsWeb.git
cd TradingAgentsWeb
```

### 3.3 后端安装
```bash
# 创建并激活虚拟环境（示例）
python -m venv .venv
# Windows
.\.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

# 安装依赖（pyproject.toml 为唯一依赖来源，PEP 621；requirements.txt 为其镜像）
pip install -e .
```

### 3.4 前端安装
```bash
cd web/frontend
npm install
# 或 pnpm install / yarn install / bun install
```

### 3.5 环境变量配置
在仓库根目录创建 `.env`（完整清单与注释见 `.env.example`，直接拷贝即可）：
```ini
# 数据库（默认 SQLite；生产推荐 MySQL）
DATABASE_URL=sqlite+aiosqlite:///./db/tradingagents.db

# 跨域来源（逗号分隔）；留空时回退到本地开发默认值
CORS_ORIGINS=

# LLM（按需填写）
LLM_PROVIDER=openai
OPENAI_API_KEY=...
DEEP_THINK_LLM=...
QUICK_THINK_LLM=...

# LLM / 任务执行保护（均有默认值，可按需覆盖）
LLM_REQUEST_TIMEOUT=120
LLM_MAX_RETRIES=2
TASK_MAX_RUNTIME_SECONDS=3600
DATA_CACHE_TTL_SECONDS=3600

# 多进程部署时的 leader 选举端口（单进程无需配置）
TASK_MONITOR_LEADER_PORT=8001
```
说明：
- 使用 SQLite 时会在 `db/` 目录生成 `tradingagents.db`（WAL 模式 + busy_timeout，支持并发读写）
- 更换 MySQL 示例：`DATABASE_URL=mysql+aiomysql://user:pass@host:3306/dbname`
- 数据源密钥（`ALPHA_VANTAGE_API_KEY` / `XUEQIU_TOKEN` 等）、Turnstile 人机验证、SMTP 邮件通知等可选配置全部在 `.env.example` 中说明

### 3.6 初始化数据库（可选）
```bash
# v2 版本会在应用启动生命周期中自动 init_db
# 数据库会自动初始化，第一个注册用户自动成为管理员
```

### 3.7 本地启动（开发模式）
- 启动后端（带认证与数据库集成）：
```bash
# 在仓库根目录
python web/backend/app.py
# 默认监听 8000 端口
```
- 启动前端（开发服务器）：
```bash
cd web/frontend
npm run dev
# 默认监听 3000 端口
```
- 访问：
  - 前端 UI：http://localhost:3000
  - 后端 API：http://localhost:8000

### 3.8 Docker 构建与运行
```bash
# 构建并启动后端与前端（compose）
docker-compose up --build -d
# 前端: http://localhost:8000
# 后端: http://localhost:8080 (反代到 8000)
```
- docker-compose.yml 说明：
  - backend 服务暴露 8080:8000，挂载 SQLite 文件与分析结果目录
  - frontend 服务暴露 8000:80，Nginx 静态托管并反代后端 `/api`

---

## 4. 使用说明

### 4.1 项目启动与运行
- 开发模式：
  - 后端：`python web/backend/app.py`
  - 前端：`npm run dev`（在 web/frontend）
- 生产或容器模式：
  - `docker-compose up -d` 后即可通过浏览器访问前端与接口

### 4.2 主要功能模块
- 前端（web/frontend，Next.js 15 App Router + React 19 + Tailwind）
  - 页面：分析配置 `/analysis`、实时进度 `/history/progress`、结果 `/history/detail`、
    历史 `/history`、研究报告 `/reports/[id]`、研究排行 `/research`、
    定时任务 `/scheduled-tasks`、订阅 `/subscribe`、个人中心 `/me`（设置 / 订阅）、
    个人设置 `/profile`（AI 设置 / 公开主页）、管理后台 `/admin`（用户 / LLM Provider /
    系统默认 Provider）、登录注册
  - 能力：WebSocket 实时进度与日志、Markdown 渲染、结果导出（PDF / Markdown / JSON / 图片）
  - 门禁：`npm run lint | typecheck | test:run | build`
- 后端（web/backend，FastAPI）
  - 应用入口：`app.py`（lifespan 自动建表、env 驱动 CORS、日志中间件、19 个路由模块）
  - 路由模块（`routes/`）：auth、analysis、conversation、config、task、export、report、
    home、user_management、scheduled_task、skills、user_llm_settings、user_config、prompt、
    websocket、llm_config、subscription、admin、page
  - 任务调度：`TaskManager`（线程池 max_workers=50、用户级排队）+ `HeartbeatMonitor`
    （默认 600s 心跳超时）+ 总时长熔断（`TASK_MAX_RUNTIME_SECONDS`）
  - token 计量：`TokenUsageCollector`（注入图 `config["callbacks"]`）累计全部 LLM 调用的
    输入/输出 token，任务结束后写入一条 `AnalysisLog`（`agent='usage'`，`step='Token用量'`）
  - 认证：JWT（access + refresh），首个注册用户自动成为管理员
  - 数据库：16 张表（用户 / 配置 / LLM Provider / 分析记录与日志 / 会话消息 / 导出记录 /
    Agent 提示词模板 / 定时任务 / 订阅计划与积分流水等，见 `models.py`）
  - WebSocket：`/ws/{task_id}` 实时推送分析进度与日志
  - 导出：PDF 由 `services/report_formatter.py` 直接构造（UTF-16BE hex 文本 + 标准 CID 字体 STSong-Light），不打包字体文件、不依赖系统字体
- AI 核心（tradingagents/）
  - LangGraph 多智能体图：4 类分析师（市场 / 基本面 / 新闻 / 舆情）并行 → 多空研究员 →
    风控辩论（保守/中性/激进）→ 交易决策
  - 数据层 `dataflows/`：akshare / yfinance / baostock / tushare / alpha_vantage / EODHD /
    Finnhub 多供应商路由与回退，内置文件级 TTL 缓存
- 质量门禁与 CI
  - 前端：`npm run lint && npm run typecheck && npm run test:run && npm run build`
  - 后端：`python -m pytest web/backend/tests/`（token 计量 / TTL 缓存 / CORS / PDF 字体 / 市场识别）
  - GitHub Actions（`.github/workflows/ci.yml`）：frontend 与 backend 两个并行 job，执行同一门禁

### 4.3 API 与页面
- REST API（按路由前缀分组，完整端点见各 `routes/*_routes.py`）
  - `/api/auth`：register / login / refresh / me
  - `/api`（analysis / config / task / export）：发起分析、状态/结果查询、历史列表、
    可选项配置、导出 PDF/Markdown/JSON
  - `/api/reports`：研究报告查看
  - `/api/conversations`：分析会话消息
  - `/api/scheduled-tasks`：定时任务 CRUD
  - `/api/subscription`：订阅计划与积分
  - `/api/admin`、`/api/admin/llm`：用户管理、LLM Provider 与系统默认 Provider
  - `/api/prompts`、`/api/skills`：Agent 提示词模板与技能
  - `/api/user`、`/api/user/llm-settings`、`/api/home`：个人配置、用户级 LLM 设置、首页聚合
  - `/ws/{task_id}`：WebSocket 实时进度/日志
- 页面（与前端路由一一对应，见 4.2）
  - 配置页：选择标的、日期、分析师团队、研究深度、LLM 与模型
  - 进度页：实时进度条、阶段状态、日志流（WebSocket）
  - 结果页：最终交易建议、分项报告（市场/基本面/舆情/新闻/风险）、一键导出
  - 历史页：按用户维度存储与检索分析历史

### 4.4 配置选项详解
- 标的代码与市场识别
  - 美股：例如 AAPL、MSFT
  - 港股：支持纯数字代码（如 0700）或带后缀 `.HK` 的格式（如 0700.HK）
  - A 股：常见 6 位代码，部分数据源需带交易所后缀（如 603777.SH / 600000.SZ），系统会结合供应商策略做兼容
- 研究深度（默认 1/3/5）
  - 控制多智能体“辩论/讨论”轮次与风控评估深度
- LLM 与模型
  - OpenAI / Anthropic / Google / OpenRouter / Ollama（本地）
  - 前端 `GET /api/config` 会返回模型清单与说明
- 数据源与供应商策略
  - default_config 内置 `data_vendors / tool_vendors / market_vendors`，可在需要时调整优先级与回退链路
- 环境变量（完整清单见 `.env.example`）
  - `DATABASE_URL`：默认 SQLite（WAL），可切换至 MySQL
  - `CORS_ORIGINS`：逗号分隔的允许跨域来源（生产环境必须显式配置）
  - `LLM_REQUEST_TIMEOUT` / `LLM_MAX_RETRIES`：单次 LLM 请求超时（默认 120s）与重试（默认 2 次）
  - `TASK_MAX_RUNTIME_SECONDS`：单个分析任务最大运行时长（默认 3600s，超时熔断）
  - `DATA_CACHE_TTL_SECONDS`：数据层 TTL 缓存（默认 3600s，≤0 禁用）
  - `OPENAI_API_KEY` 等 LLM 密钥：按需设置
  - `TASK_MONITOR_LEADER_PORT`：多进程/多实例时用于 leader 选举，避免重复初始化

### 4.5 常见问题
- 端口占用
  - 后端默认 8000，前端默认 3000；Docker 前端为 8000，后端反代 8080
- 数据源失败或缺失
  - 按供应商策略自动回退；必要时检查网络、API Key 与供应商限额
- 分析卡住
  - `HeartbeatMonitor` 检测心跳超时（默认 600s 无日志即判定停滞并中止）；
    另有总时长熔断（`TASK_MAX_RUNTIME_SECONDS`，默认 3600s）；也可通过任务接口手动停止
- 权限与认证
  - 默认开启 JWT；调用受保护 API 时需附带 `Authorization: Bearer <token>`

---

## 5. 许可证
本项目基于仓库内 LICENSE 文件所述条款发布，请遵循相关许可。

---

## 6. 参考与致谢
- TradingAgents 原版框架与多智能体设计
- FastAPI / SQLAlchemy / Jinja2 / Uvicorn
- Next.js / React / Tailwind
- yfinance / akshare / baostock / tushare / EODHD / Finnhub 等数据源生态

如有问题或建议，欢迎在 GitHub 提交 Issue 或 PR。