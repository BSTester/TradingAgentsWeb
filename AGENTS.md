# AGENTS.md — TradingAgentsWeb

This file describes the repository structure, architecture, build/run commands, coding conventions, and guidelines for AI agents (Copilot, Codex, etc.) working in this codebase.

---

## Repository Overview

**TradingAgentsWeb** is a full-stack web application that wraps the TradingAgents multi-agent quantitative analysis framework. It extends the original CLI-only framework into a modern web platform supporting US, Hong Kong, and A-share markets.

- **Backend**: FastAPI + SQLAlchemy + JWT authentication (Python 3.10+)
- **Frontend**: Next.js 15 (App Router) + React 19 + Tailwind CSS
- **AI Core**: LangChain / LangGraph multi-agent trading analysis graph
- **Data Sources**: akshare, yfinance, baostock, tushare, alpha_vantage, EODHD, Finnhub
- **Database**: SQLite (default) or MySQL/PostgreSQL (production)
- **Deployment**: Docker + docker-compose (Nginx reverse proxy for frontend → backend `/api`)

---

## Directory Structure

```
TradingAgentsWeb/
├── tradingagents/          # Core AI framework (multi-agent graph engine)
│   ├── agents/             # Agent implementations
│   │   ├── analysts/       # Market, fundamentals, news, social media analysts
│   │   ├── managers/       # Research & risk managers
│   │   ├── researchers/    # Bull & bear researchers
│   │   ├── risk_mgmt/      # Conservative / neutral / aggressive debaters
│   │   └── trader/         # Trader agent
│   ├── dataflows/          # Data source adapters (akshare, yfinance, etc.)
│   ├── graph/              # LangGraph trading graph (trading_graph.py, etc.)
│   └── default_config.py   # Market/tool/data vendor priority config
│
├── web/
│   ├── backend/            # FastAPI application
│   │   ├── app.py          # Main entrypoint (lifespan, CORS, middleware, routes)
│   │   ├── models.py       # SQLAlchemy ORM models
│   │   ├── database.py     # DB session / init_db
│   │   ├── schemas.py      # Pydantic request/response schemas
│   │   ├── auth.py / auth_routes.py  # JWT auth helpers and routes
│   │   ├── routes/         # Route modules (analysis, config, task, websocket, export, …)
│   │   ├── services/       # Business logic (task_executor, llm_config_resolver, …)
│   │   ├── migrations/     # DB migration scripts
│   │   └── tests/          # Backend integration tests
│   │
│   └── frontend/           # Next.js 15 App Router application
│       ├── src/app/        # Pages & route groups (analysis, auth, history, profile, …)
│       ├── src/components/ # React components (analysis, auth, common, profile, ui, …)
│       ├── src/hooks/      # Custom React hooks
│       ├── src/lib/        # API client, type definitions, utilities
│       └── src/types/      # TypeScript type definitions
│
├── tests/                  # Root-level test scripts (integration / demo / verify)
├── docs/                   # Documentation and supplementary guides
├── db/                     # Database files (SQLite, migrations)
├── devops/                 # CI/CD, deployment scripts
├── .env.example            # Environment variable template
├── docker-compose.yml      # Production compose file
├── Makefile                # Docker management shortcuts
├── pyproject.toml          # Python project metadata and dependencies
└── requirements.txt        # Python package list
```

---

## Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.10+ |
| Node.js | 18+ |
| npm / pnpm / yarn | any |
| Docker & docker-compose | optional, for container mode |

### 1. Clone & configure

```bash
git clone https://github.com/BSTester/TradingAgentsWeb.git
cd TradingAgentsWeb
cp .env.example .env
# Edit .env and fill in API keys as needed
```

### 2. Backend setup

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .\.venv\Scripts\activate
pip install -r requirements.txt
pip install -e .
```

### 3. Frontend setup

```bash
cd web/frontend
npm install
```

### 4. Run in development mode

```bash
# Terminal 1 — backend (port 8000)
python web/backend/app.py

# Terminal 2 — frontend (port 3000)
cd web/frontend && npm run dev
```

### 5. Docker (production)

```bash
make init          # copies .env.example → .env
make build         # docker-compose build
make up            # docker-compose up -d
# Frontend: http://localhost:8000
# Backend API: http://localhost:8080
```

---

## Environment Variables

Key variables from `.env.example`:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite or MySQL connection string | `sqlite+aiosqlite:///./db/tradingagents.db` |
| `SECRET_KEY` | JWT signing key | *(required)* |
| `LLM_PROVIDER` | Default LLM provider (`openai`, `anthropic`, etc.) | `openai` |
| `OPENAI_API_KEY` | OpenAI API key | — |
| `OPENAI_BASE_URL` | OpenAI-compatible base URL | `https://api.openai.com/v1` |
| `DEEP_THINK_LLM` | Model for deep reasoning agents | — |
| `QUICK_THINK_LLM` | Model for fast/utility agents | — |
| `ALPHA_VANTAGE_API_KEY` | Alpha Vantage market data key | — |
| `XUEQIU_TOKEN` | Xueqiu cookie token (A/HK/US stock data) | — |
| `SMTP_HOST` / `SMTP_*` | Email notification settings | — |
| `TASK_MONITOR_LEADER_PORT` | Leader-election port for multi-process mode | `8001` |

---

## Build & Test Commands

### Backend (Python)

```bash
# Run all backend tests
cd tests && python -m pytest .

# Run a specific test file
python tests/test_llm_config_resolver.py

# Type-check (optional)
mypy web/backend/
```

### Frontend (Next.js)

```bash
cd web/frontend

npm run dev          # Development server (port 3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run typecheck    # TypeScript type-check (tsc --noEmit)
npm run test         # Run Vitest tests (watch mode)
npm run test:run     # Run Vitest tests (CI mode, single pass)
```

---

## Architecture Notes

### Multi-Agent Graph (`tradingagents/`)

The AI core is a **LangGraph-based directed graph** that orchestrates agents in sequence:

1. **Analysts**: Market, Fundamentals, News, Social Media analysts collect and process data
2. **Researchers**: Bull and Bear researchers form opposing hypotheses
3. **Risk Management**: Conservative / Neutral / Aggressive debaters assess risk
4. **Trader**: Synthesizes recommendations into a final trading decision

Market detection is automatic from the ticker symbol:
- 6-digit codes → A-share (CN) — primary: akshare, fallback: baostock, yfinance
- 4–5 digit codes / `.HK` suffix → HK stock — primary: akshare, fallback: yfinance
- Letter codes (e.g. `AAPL`) → US stock — primary: akshare, fallback: yfinance, alpha_vantage

### Backend (`web/backend/`)

- `app.py` — FastAPI app with lifespan hooks, CORS, logging middleware, and route registration
- `TaskManager` — thread-pool task queue with per-user queuing, stall detection (60 s), and WebSocket real-time log streaming
- Authentication — JWT (access + refresh tokens); first registered user becomes admin
- Routes registered under `/api/*`; WebSocket at `/ws/{task_id}`
- Database initializes automatically on startup (`init_db()` in lifespan)

### Frontend (`web/frontend/`)

- **Next.js 15 App Router** with route groups: `(auth)`, `analysis`, `history`, `profile`, `admin`, `scheduled-tasks`
- API calls go through `src/lib/api.ts` which wraps `fetch` with JWT token injection
- Real-time progress uses a WebSocket hook in `src/hooks/`
- Result export supports PDF, Markdown, and JSON

---

## Coding Conventions

### Python

- Python 3.10+ type hints on all public functions
- Async SQLAlchemy sessions (`AsyncSession`) for database access
- Route handlers in `web/backend/routes/`, business logic in `web/backend/services/`
- Pydantic v2 schemas in `schemas.py` for request/response validation
- Do not store secrets or keys in source code; use environment variables

### TypeScript / React

- Strict TypeScript — always run `npm run typecheck` before committing frontend changes
- React Server Components where possible; use `"use client"` only when interactivity is required
- Tailwind CSS for all styling; avoid inline styles
- API response types defined in `src/lib/types.ts` and `src/types/`
- List endpoints that return paginated data follow the `{ data: T[], meta: { total, page, … } }` shape

### Git

- Branch naming: `feature/<ticket>`, `fix/<ticket>`, `agent/<id>`, `perf/<topic>`
- Commit messages: follow Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, etc.)
- Keep PRs focused; one feature or fix per PR

---

## Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login (returns JWT) |
| GET | `/api/auth/me` | Current user info |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/analyze` | Start a new analysis (protected) |
| GET | `/api/analysis/{id}/status` | Poll analysis status |
| GET | `/api/analysis/{id}/results` | Fetch analysis results |
| GET | `/api/analyses` | List current user's analyses |
| GET | `/api/config` | Available models, analysts, depths |
| WS | `/ws/{task_id}` | Real-time log/progress stream |
| GET | `/api/export/{id}/{format}` | Export results (pdf/md/json) |

---

## Common Tasks for AI Agents

- **Add a new analyst type**: Create a new file in `tradingagents/agents/analysts/`, register it in `tradingagents/graph/trading_graph.py`, and expose a toggle via `GET /api/config`.
- **Add a new data vendor**: Implement the adapter in `tradingagents/dataflows/`, register it in `tradingagents/default_config.py` under `data_vendors` / `market_vendors`.
- **Add a new API route**: Create a route file in `web/backend/routes/`, import and register it in `app.py`.
- **Add a new frontend page**: Create a folder under `web/frontend/src/app/`, following the Next.js App Router convention.
- **Change the DB schema**: Add a new model or field in `web/backend/models.py`, then add a migration script in `web/backend/migrations/`.
- **Update environment config**: Edit `.env.example` and document the new variable in this file and in `README.md`.
