# AGENTS.md — TradingAgentsWeb

本文件描述仓库结构、架构、构建/运行/测试命令与编码约定，供 AI 代理（Copilot、Codex、Claude 等）与人类开发者在本代码库工作时参考。

---

## 仓库概述

**TradingAgentsWeb** 是基于 TradingAgents 多智能体量化分析框架构建的全栈 Web 平台，支持美股（US）、港股（HK）与 A 股（CN）。

- **后端**：FastAPI + SQLAlchemy（async）+ JWT（Python 3.10+，本地开发环境为 3.13）
- **前端**：Next.js 15（App Router）+ React 19 + Tailwind CSS + TanStack Query + Vitest
- **AI 核心**：LangChain / LangGraph 多智能体交易分析图（4 类分析师**并行** → 多空研究员 → 风控辩论 → 交易决策）
- **数据源**：akshare、yfinance、baostock、tushare、alpha_vantage、EODHD、Finnhub（多供应商路由 + 回退 + 文件级 TTL 缓存）
- **数据库**：SQLite（默认，WAL 模式 + busy_timeout + QueuePool）或 MySQL（生产，`DATABASE_URL` 切换）
- **部署**：Docker + docker-compose（Nginx 反代前端 → 后端 `/api`）

### 功能总览

- 多智能体股票分析（配置 → 实时进度 → 结果 → 导出 PDF/Markdown/JSON/图片）
- 分析历史、研究报告页、研究排行榜（`/research`）
- 定时任务（scheduled tasks）、订阅计划与积分（credits）
- 管理后台：用户管理、LLM Provider 管理、系统默认 Provider
- Agent 提示词模板（prompts）与技能（skills）管理
- 用户级 LLM 设置（用户可自带 provider/key）、本地密钥保险箱（浏览器 keyVault）
- WebSocket 实时进度/日志（`/ws/{task_id}`）、Turnstile 人机验证（可选）、SMTP 邮件通知（可选）

---

## 目录结构

```
TradingAgentsWeb/
├── tradingagents/          # AI 核心框架（多智能体图引擎）
│   ├── agents/             # 智能体实现
│   │   ├── analysts/       # 市场/基本面/新闻/舆情 分析师（图中并行分支）
│   │   ├── managers/       # 研究与风控经理
│   │   ├── researchers/    # 多空研究员
│   │   ├── risk_mgmt/      # 保守/中性/激进 风控辩论者
│   │   └── trader/         # 交易决策
│   ├── dataflows/          # 数据源适配层；interface.py 的 route_to_vendor 做供应商路由，
│   │                       # ttl_cache.py 提供文件级 TTL 缓存
│   ├── graph/              # LangGraph 图定义（trading_graph.py、conditional_logic.py 等）
│   └── default_config.py   # 市场/工具/数据供应商优先级配置
│
├── web/
│   ├── backend/            # FastAPI 应用
│   │   ├── app.py          # 主入口（lifespan 自动建表、CORS、日志中间件、TaskManager、19 个路由）
│   │   ├── models.py       # SQLAlchemy ORM 模型（16 张表）
│   │   ├── database.py     # 引擎/会话工厂（SQLite WAL + QueuePool）
│   │   ├── schemas.py      # Pydantic 请求/响应模型
│   │   ├── auth.py / auth_routes.py  # JWT 工具与认证路由
│   │   ├── routes/         # 路由模块（19 个 *_routes.py，见下表）
│   │   ├── services/       # 业务逻辑（analysis_task、llm_config_resolver、report_formatter …）
│   │   ├── migrations/     # 数据库迁移脚本
│   │   ├── assets/fonts/   # PDF 导出内置字体（NotoSansSC 子集，reportlab 直接加载）
│   │   └── tests/          # 后端 pytest 测试
│   │
│   └── frontend/           # Next.js 15 App Router 应用
│       ├── src/app/        # 页面与路由组（analysis、history、reports、research、
│       │                   # scheduled-tasks、subscribe、me、profile、admin、login/register …）
│       ├── src/components/ # React 组件
│       │   ├── analysis/   # 分析流程组件（巨型组件已拆分子目录：
│       │   │               # results/ config/ progress/ history/）
│       │   ├── admin/      # 管理后台组件（用户、LLM Provider、系统默认 Provider）
│       │   └── …           # auth、common、profile、ui 等
│       ├── src/hooks/      # 自定义 hooks（useAuth、useWebSocket 等）
│       ├── src/lib/        # apiClient.ts（规范 API 客户端）、api.ts（兼容门面）、types 等
│       ├── src/test/       # 测试工具（renderWithQuery 等）
│       └── src/types/      # TypeScript 类型定义
│
├── pyproject.toml          # 唯一 Python 依赖来源（PEP 621）；setup.py 为兼容 shim
├── requirements.txt        # pyproject 依赖的镜像（便于 pip install -r）
├── tests/                  # 仓库级测试脚本
├── docs/                   # 仅保留 archive/（历史修复笔记归档）+ 本目录 README
├── db/                     # SQLite 数据库文件
├── devops/                 # CI/CD 与部署脚本
├── .env.example            # 全部环境变量模板（含默认值说明）
├── docker-compose.yml      # 生产编排
└── Makefile                # Docker 管理快捷命令
```

> 仓库根目录下的 `backend/`、`pm/`、`ui-designer/`、`lead-agent/`、`cli/`、`fullstack/`
> 为空目录（历史脚手架残留），不包含代码，请勿在其中新增内容。

---

## 快速开始

### 环境要求

| 工具 | 版本 |
|------|------|
| Python | 3.10+（开发环境 3.13） |
| Node.js | 20+（Next.js 15 要求；开发环境 22） |
| npm / pnpm | 任一 |
| Docker & docker-compose | 容器模式需要 |

### 1. 克隆与配置

```bash
git clone https://github.com/BSTester/TradingAgentsWeb.git
cd TradingAgentsWeb
cp .env.example .env   # 按需填写 API key
```

### 2. 后端

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e .        # 依赖由 pyproject.toml（PEP 621）解析
```

### 3. 前端

```bash
cd web/frontend
npm install
```

### 4. 开发模式

```bash
# 终端 1 — 后端（默认 8000）
python web/backend/app.py
# 终端 2 — 前端（默认 3000）
cd web/frontend && npm run dev
```

### 5. Docker（生产）

```bash
make init     # 复制 .env.example → .env
make build    # docker-compose build
make up       # docker-compose up -d
# 前端: http://localhost:8000；后端 API: http://localhost:8080（反代 8000）
```

---

## 环境变量

完整清单与注释见 `.env.example`。关键变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | SQLite（默认，WAL）或 MySQL 连接串 | `sqlite+aiosqlite:///./db/tradingagents.db` |
| `SECRET_KEY` | JWT 签名密钥 | 必填 |
| `CORS_ORIGINS` | 允许跨域来源（逗号分隔）；留空回退本地开发默认 | 本地 localhost:3000/8000 |
| `LLM_PROVIDER` / `OPENAI_API_KEY` / `OPENAI_BASE_URL` | 默认 LLM 供应商与密钥 | `openai` |
| `DEEP_THINK_LLM` / `QUICK_THINK_LLM` | 深度/快速推理模型 | — |
| `LLM_REQUEST_TIMEOUT` | 单次 LLM 请求超时（秒） | `120` |
| `LLM_MAX_RETRIES` | 单次 LLM 调用失败重试次数 | `2` |
| `TASK_MAX_RUNTIME_SECONDS` | 单任务最大运行时长（超时熔断） | `3600` |
| `DATA_CACHE_TTL_SECONDS` | 数据层 TTL 缓存（≤0 禁用） | `3600` |
| `TASK_MONITOR_LEADER_PORT` | 多进程 leader 选举端口 | `8001` |
| `ALPHA_VANTAGE_API_KEY` / `XUEQIU_TOKEN` | 数据源密钥（可选） | — |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | 人机验证（不配置则跳过） | — |
| `SMTP_*` / `APP_BASE_URL` | 邮件通知（不配置则禁用） | — |

---

## 后端架构要点

### 路由（19 个模块，`web/backend/routes/` + `auth_routes.py`）

| 路由 | 前缀 | 职责 |
|------|------|------|
| `auth_routes` | `/api/auth` | 注册/登录/刷新/JWT |
| `analysis_routes` | `/api` | 发起分析、状态/结果、历史 |
| `config_routes` | `/api` | 可选项配置（分析师/深度/供应商） |
| `task_routes` | `/api` | 任务管理（停止/状态） |
| `conversation_routes` | `/api/conversations` | 分析会话消息 |
| `export_routes` | `/api` | 导出 PDF/Markdown/JSON |
| `report_routes` | `/api/reports` | 研究报告 |
| `home_routes` | `/api/home` | 首页聚合 |
| `user_management_routes` | `/api/admin` | 用户管理 |
| `scheduled_task_routes` | `/api/scheduled-tasks` | 定时任务 |
| `skills_routes` | `/api/skills` | 技能管理 |
| `user_llm_settings_routes` | `/api/user/llm-settings` | 用户级 LLM 设置 |
| `user_config_routes` | `/api/user` | 个人配置 |
| `prompt_routes` | `/api/prompts` | Agent 提示词模板 |
| `websocket_routes` | `/ws/{task_id}` | 实时进度/日志 |
| `llm_config_routes` | `/api/admin/llm` | LLM Provider 管理 |
| `subscription_routes` | `/api/subscription` | 订阅计划与积分 |
| `admin_routes` | `/api/admin` | 管理后台（系统默认 Provider 等） |
| `page_routes` | — | 页面/静态资源路由 |

### 数据模型（16 张表，`models.py`）

`User`、`UserConfig`、`UserLLMProviderSetting`、`ScheduledTask`、`ConversationSession`、
`ConversationMessage`、`AnalysisRecord`、`AnalysisLog`、`ExportRecord`、`AgentTool`、
`AgentPromptTemplate`、`TemplateTools`、`LLMProvider`、`LLMModel`、`SubscriptionPlan`、
`CreditTransaction`

### 任务执行

- `TaskManager`（`app.py`）：线程池 `max_workers=50`、用户级排队、全局队列
- `HeartbeatMonitor`：心跳超时（默认 600s 无日志判定停滞）
- 运行时 watchdog：`TASK_MAX_RUNTIME_SECONDS` 总时长熔断（`analysis_task.py`）
- LLM 调用：`LLM_REQUEST_TIMEOUT` 超时 + `LLM_MAX_RETRIES` 重试（`llm_config_resolver`）
- LLM token 用量：`TokenUsageCollector`（`services/token_usage.py`）注入图 `config["callbacks"]`，
  累计全部 LLM 调用（含并行分析师分支）的输入/输出 token，任务结束后写入一条
  `AnalysisLog`（`agent='usage'`，`step='Token用量'`，token 列同步落库）

### 多智能体图（`tradingagents/graph/`）

- 4 类分析师（市场/基本面/新闻/舆情）在 LangGraph 中以**独立分支并行**执行
  （每分支独立 message 通道 + ToolNode + 消息清理节点）
- 之后串行：多空研究员 → 风控辩论（保守/中性/激进）→ Trader 决策
- 修改图结构时注意：`should_continue_*` 条件函数检查的是**分支** channel；
  `social` 分析师独占 `grounded_evidence`；ToolNode 必须带 `messages_key` 以支持分支循环
- 市场自动识别：6 位代码 → A 股（akshare→baostock,yfinance）；4–5 位或 `.HK` → 港股；
  字母代码 → 美股（供应商优先级见 `default_config.py`）

### 导出

- PDF 由 `services/report_formatter.py` 生成，使用内置字体
  `assets/fonts/NotoSansSC-subset.ttf`（静态实例化 + 子集化，reportlab `TTFont` 直接加载，
  不依赖系统字体）。**不要**把可变字体（VF）放回该目录 —— reportlab 不支持。

---

## 前端架构要点

- **Next.js 15 App Router**；页面见 `src/app/`
- **API 客户端**：`src/lib/apiClient.ts` 是唯一规范客户端（axios 封装、JWT 注入）；
  `src/lib/api.ts` 是兼容门面（委托 apiClient）。新代码一律直接 import `@/lib/apiClient`。
- **状态/请求**：TanStack Query（`@/test/renderWithQuery` 提供测试用渲染器）
- **实时进度**：WebSocket hook（`src/hooks/`），日志滚动 + phase 状态机
  （`components/analysis/progress/phaseReducer.ts`）
- **巨型组件已拆分**（父组件为薄编排层，子组件 props 受控）：
  - `AnalysisResults.tsx` → `components/analysis/results/`（print styles、decision banner、
    phase tabs、report section、actions、export preview modal、types）
  - `AnalysisConfigForm.tsx` → `components/analysis/config/`
  - `AnalysisProgress.tsx` → `components/analysis/progress/`
  - `AnalysisHistory.tsx` → `components/analysis/history/`
- **密钥管理**：用户本地密钥存浏览器 keyVault（`src/lib/keyVault.ts`），不落库

---

## 构建与测试命令

### 前端（`web/frontend/`）

```bash
npm run dev          # 开发服务器（3000）
npm run build        # 生产构建
npm run start        # 生产服务器
npm run lint         # ESLint（门禁：0 error）
npm run typecheck    # tsc --noEmit（门禁：exit 0）
npm run test         # Vitest watch
npm run test:run     # Vitest 单遍（CI 门禁，全绿）
```

### 后端（仓库根目录）

```bash
.venv/bin/python -m pytest web/backend/tests/ -v   # 后端 pytest
python web/backend/app.py                          # 启动后端
```

### 质量门禁（提交前必须全绿）

1. 前端：`npm run typecheck && npm run lint && npm run test:run && npm run build`
2. 后端：`pytest web/backend/tests/`

CI（`.github/workflows/ci.yml`）对 push/PR 执行与上述完全相同的门禁：
frontend job（lint → typecheck → test:run → build）+ backend job
（`pip install -e ".[dev]"` 后 `pytest web/backend/tests/`），两 job 并行。

> 注意：长命令（test:run 约 1 分钟、build 数分钟）请在**前台**执行并给足超时，
> 不要放进后台任务（本会话的后台任务会在轮次边界被终止且输出丢失）。

---

## 编码约定

### Python

- 公共函数一律 Python 3.10+ 类型注解
- 数据库访问使用异步 SQLAlchemy（`AsyncSession`）
- 路由处理放 `web/backend/routes/`，业务逻辑放 `web/backend/services/`
- Pydantic v2 schema 放 `schemas.py`
- 密钥/口令一律走环境变量，禁止写入源码
- 新增依赖：改 `pyproject.toml`（唯一来源），同步 `requirements.txt`

### TypeScript / React

- TypeScript strict：前端改动前必须 `npm run typecheck`
- 尽量用 Server Components；需要交互才加 `"use client"`
- Tailwind 做样式；`AnalysisResults` 系列报告组件为既有例外（内联样式渲染打印布局）
- 中文 UI 文案与现有组件保持一致；抽取子组件时文案/aria/className 必须逐字保留
- 列表端点返回 `{ data: T[], meta: { total, page, … } }`
- API 响应类型集中在 `src/lib/types.ts` / `src/types/`

### Git

- 分支命名：`feature/<ticket>`、`fix/<ticket>`、`agent/<id>`、`perf/<topic>`
- Conventional Commits（`feat:` / `fix:` / `chore:` / `docs:` …）
- PR 保持聚焦，一个功能/修复一个 PR

---

## AI 代理常见任务

- **新增分析师类型**：在 `tradingagents/agents/analysts/` 建文件 → 在
  `tradingagents/graph/trading_graph.py` 注册**并行分支**（独立 message channel +
  ToolNode + 消息清理）→ 通过 `GET /api/config` 暴露开关
- **新增数据供应商**：在 `tradingagents/dataflows/` 实现适配器 → 在
  `default_config.py` 的 `data_vendors` / `market_vendors` 注册
- **新增 API 路由**：在 `web/backend/routes/` 建 `*_routes.py` → 在 `app.py` 注册
  `include_router`
- **新增前端页面**：在 `web/frontend/src/app/` 建目录，遵循 App Router 约定
- **变更 DB schema**：改 `web/backend/models.py` + 在 `web/backend/migrations/` 加迁移脚本
  （应用启动 lifespan 也会自动 `init_db`）
- **更新环境配置**：改 `.env.example` 并同步更新本文件与 `README.md`
- **文档**：一次性修复笔记不再写入 `docs/`（历史笔记已在 `docs/archive/`）；
  架构变更更新根级 README/AGENTS.md