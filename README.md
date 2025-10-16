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
- 任务调度与实时监控：
  - `web/backend/app_v2.py` 内置线程池与队列（TaskManager），支持用户级排队、全局并发控制、停滞任务自动中断与 WebSocket 实时日志
- 用户认证与持久化：
  - `web/backend/README_v2.md` 与后端模型 `web/backend/models.py` 支持用户注册/登录、JWT 认证、分析记录/日志与导出记录持久化到 SQLite（默认，也可换成 PostgreSQL）
- 部署与工程化：
  - Dockerfile 与 docker-compose.yml 提供一键构建与编排（前端 Nginx 静态托管并反代后端 `/api`）
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

# 安装依赖
pip install -r requirements.txt

# 可编辑安装项目（方便二次开发）
pip install -e .
```

### 3.4 前端安装
```bash
cd web/frontend
npm install
# 或 pnpm install / yarn install / bun install
```

### 3.5 环境变量配置
在仓库根目录创建 `.env`（可拷贝 `.env.example`）：
```ini
# 数据库（默认 SQLite）
DATABASE_URL=sqlite:///./tradingagents.db

# 可选：LLM 与数据源密钥（按需填写）
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
OPENROUTER_API_KEY=...

# 任务监控 Leader 端口（避免与服务端口冲突）
TASK_MONITOR_LEADER_PORT=8001
```
说明：
- 使用 SQLite 时会在根目录生成 `tradingagents.db`
- 更换 PostgreSQL 示例：`DATABASE_URL=postgresql://user:pass@host:5432/dbname`

### 3.6 初始化数据库（可选）
```bash
# v2 版本会在应用启动生命周期中自动 init_db
# 如果需要预置用户或在启动前初始化，可执行：
python web/backend/init_db.py
```

### 3.7 本地启动（开发模式）
- 启动后端（带认证与数据库集成）：
```bash
# 在仓库根目录
python web/backend/app_v2.py
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
  - 后端：`python web/backend/app_v2.py`
  - 前端：`npm run dev`（在 web/frontend）
- 生产或容器模式：
  - `docker-compose up -d` 后即可通过浏览器访问前端与接口

### 4.2 主要功能模块
- 前端（web/frontend）
  - App Router 页面：分析配置页、进度监控、结果展示、历史记录、用户登录/注册等
  - 组件：UI 表单、WebSocket 实时日志、结果 Markdown 渲染与导出（PDF/Markdown/JSON）
  - 脚本：`npm run dev | build | start | export | lint`
- 后端（web/backend）
  - FastAPI 应用：`app_v2.py`（含 lifespan、CORS、LoggingMiddleware）
  - 路由模块：`routes/analysis_routes.py, config_routes.py, task_routes.py, page_routes.py, websocket_routes.py, export_routes.py`
  - 认证模块：`auth_routes.py`（注册、登录、JWT 刷新）
  - 数据库模块：`database.py, models.py, init_db.py`（SQLite 默认）
  - 任务调度：`TaskManager`（线程池、用户级队列、异常任务中断）
  - WebSocket：实时推送分析进度/日志至前端

### 4.3 API 与页面
- REST API（部分示例，详见后端 routes 与 README）
  - `POST /api/auth/register` 注册
  - `POST /api/auth/login` 登录
  - `POST /api/analyze` 发起分析（受保护，需携带 JWT）
  - `GET /api/analysis/{id}/status` 查询状态
  - `GET /api/analysis/{id}/results` 获取结果
  - `GET /api/analyses` 列出当前用户分析
  - `GET /api/config` 获取可选项（分析师、研究深度、LLM 供应商/模型等）
- 页面
  - 配置页：选择标的、日期、分析师团队、研究深度、LLM 与模型、后端地址等
  - 进度页：实时进度条、阶段状态、日志流（WebSocket）
  - 结果页：最终交易建议、分项报告（市场/基本面/舆情/新闻/风险）、一键导出
  - 历史页：按用户维度存储与检索分析历史

### 4.4 配置选项详解
- 标的代码与市场识别
  - 美股：例如 AAPL、MSFT
  - 港股：支持纯数字代码（如 0700）或带后缀 `.HK` 的格式（如 0700.HK）
  - A 股：常见 6 位代码，部分数据源需带交易所后缀（如 603777.SH / 600000.SS），系统会结合供应商策略做兼容
- 研究深度（默认 1/3/5）
  - 控制多智能体“辩论/讨论”轮次与风控评估深度
- LLM 与模型
  - OpenAI / Anthropic / Google / OpenRouter / Ollama（本地）
  - 前端 `GET /api/config` 会返回模型清单与说明
- 数据源与供应商策略
  - default_config 内置 `data_vendors / tool_vendors / market_vendors`，可在需要时调整优先级与回退链路
- 环境变量
  - `DATABASE_URL`：默认 SQLite，可切换至 PostgreSQL
  - `OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY / OPENROUTER_API_KEY`：按需设置
  - `TASK_MONITOR_LEADER_PORT`：多进程/多实例时用于 leader 选举，避免重复初始化

### 4.5 常见问题
- 端口占用
  - 后端默认 8000，前端默认 3000；Docker 前端为 8000，后端反代 8080
- 数据源失败或缺失
  - 按供应商策略自动回退；必要时检查网络、API Key 与供应商限额
- 分析卡住
  - TaskManager 每 60 秒检查日志停滞，连续 5 次无日志会自动中断；也可通过任务接口手动停止
- 权限与认证
  - v2 版本默认开启 JWT；调用受保护 API 时需附带 Authorization: Bearer <token>

---

## 5. 开发与扩展建议
- 数据源扩展：在 `tradingagents/dataflows` 新增数据源模块并在 `default_config.py` 中配置供应商策略
- 智能体扩展：在 `tradingagents/agents` 下新增角色或细化分析流程，并在 `graph/trading_graph.py` 引入新阶段
- 前端模块：在 `web/frontend/src` 下新增页面/组件，保持 UI/UX 一致性与类型安全（TypeScript + Zod）
- 后端路由：在 `web/backend/routes` 中添加新 API，注意鉴权与分页/筛选

---

## 6. 许可证
本项目基于仓库内 LICENSE 文件所述条款发布，请遵循相关许可。

---

## 7. 参考与致谢
- TradingAgents 原版框架与多智能体设计
- FastAPI / SQLAlchemy / Jinja2 / Uvicorn
- Next.js / React / Tailwind
- yfinance / akshare / baostock / tushare / EODHD / Finnhub 等数据源生态

如有问题或建议，欢迎在 GitHub 提交 Issue 或 PR。