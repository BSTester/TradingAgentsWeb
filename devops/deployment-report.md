# Deployment Report — TradingAgents Web (WS-4 Stage 6)

**Issue**: WS-4 (`dd0da1e3-a687-480f-8738-97dde85a2295`)
**Stage**: 6 (DevOps)
**QA Gate**: Go-With-Risk (conditional) — see [Known Risks](#known-risks)
**Integrated code**: merge of `ws-4-m5-m6-backend-hardening` (`70d9804`) ⊕ `ws-4-m3-frontend` (`0d588bd`)
**Date**: 2026-07-06

---

## 1. Overview

This report covers Docker packaging for the full TradingAgents Web stack after
the QA Go-With-Risk gate. The stack is:

- **Frontend**: Next.js 15 static export (`output: 'export'`) served by Nginx
  (static files + `/api` and `/ws` reverse proxy to backend).
- **Backend**: FastAPI / uvicorn on port 8000. Scheduler (APScheduler) runs
  in-process inside the backend via FastAPI lifespan — **no separate scheduler
  container needed**.
- **Database**: SQLite by default (file-based, persisted via Docker volume).
  MySQL is supported as an optional profile (uncomment in compose).
- **AI provider**: OneInfinity AI (OpenAI-compatible), model `gpt-5.5`,
  base URL `https://api.oneinfinityai.com/v1`. Configured via env vars; the
  defaults in `tradingagents/default_config.py` already match.

**Old trading/leaderboard services are NOT packaged** — those code paths were
removed in M0. The retired `/intraday-trading` and `/leaderboard` page routes
308-redirect to `/`.

---

## 2. Docker Artifacts

All artifacts are in `devops/` in the repo (on branch `ws-4-devops-stage6`):

| File | Purpose |
|---|---|
| `devops/Dockerfile.backend` | Multi-stage FastAPI/uvicorn image. Non-root (`app` user), healthcheck on `/`, filters out optional `ta-lib` (has pandas fallback). |
| `devops/Dockerfile.frontend` | Multi-stage Next.js static export → Nginx. Reuses existing `nginx.conf.template` + `start.sh` (envsubst). Healthcheck on `/`. |
| `devops/docker-compose.yml` | `backend` + `frontend` services. SQLite default. Volumes for db/eval/results. Optional MySQL profile (commented). |
| `devops/.env.example` | Env template — copy to `.env`, fill in `OPENAI_API_KEY`. |
| `devops/rollback-plan.md` | Rollback procedures (image/git/stop-restore) + data backup. |
| `devops/deployment-report.md` | This file. |

### Design decisions

- **Multi-stage builds**: backend splits builder (gcc/g++ for C extensions) from
  runtime (curl + libstdc++6 only); frontend splits deps → builder → nginx.
- **Non-root**: backend runs as `app` user (UID auto-assigned by `useradd --system`).
  Frontend nginx master runs as root (standard nginx pattern for port 80) —
  workers run as `nginx` user. A future improvement could use
  `nginxinc/nginx-unprivileged` on port 8080.
- **Healthchecks**: backend probes `http://127.0.0.1:8000/` (FastAPI root route,
  returns 200 HTML, no auth). Frontend probes `http://127.0.0.1/`. The existing
  `web/backend/health.py` module defines `/health`, `/health/ready`, `/health/live`
  endpoints but the router is **not mounted** in `app.py` — recommend wiring it
  up as a follow-up for a cleaner health endpoint.
- **`ta-lib` filtered out**: `requirements.txt` lists `ta-lib` (Python wrapper
  for the TA-Lib C library), but `tradingagents/dataflows/akshare_indicator.py:276`
  imports it inside `try/except ImportError` with a pandas fallback. The C library
  is painful to build in a slim image and brings no functional value, so the
  Dockerfile filters it out during `pip install`.
- **No secrets in images**: `OPENAI_API_KEY` is passed via env var at runtime
  (required — compose fails fast if unset). `.env` is gitignored.

---

## 3. Deployment Steps

### Prerequisites

- Docker Engine 24+ with Docker Compose v2+
- Network access to pull base images (`python:3.11-slim`, `node:20-alpine`,
  `nginx:alpine`) — **if Docker Hub is unreachable, configure a registry
  mirror** in `/etc/docker/daemon.json`:
  ```json
  { "registry-mirrors": ["https://docker.m.daocloud.io"] }
  ```
  then `sudo systemctl restart docker`. This deployment was verified with the
  DaoCloud mirror on a Docker Hub-blocked host.
- A valid OneInfinity AI API key (OpenAI-compatible).

### Steps

```bash
# 1. Clone and switch to the integrated branch
git clone https://github.com/BSTester/TradingAgentsWeb.git
cd TradingAgentsWeb
git checkout ws-4-devops-stage6   # or main after PR merge

# 2. Configure environment
cd devops
cp .env.example .env
$EDITOR .env   # set OPENAI_API_KEY=sk-...

# 3. Build and start
docker compose up --build -d

# 4. Wait for health
docker compose ps   # both services should show "healthy"
curl -fsS http://localhost:8080/   # backend direct
curl -fsS http://localhost:8000/   # frontend (nginx)

# 5. Access the app
#    Public URL:  http://localhost:8000   (frontend + /api proxy)
#    Backend API: http://localhost:8080   (direct, for debugging)
```

### Port mapping

| Port | Service | Notes |
|---|---|---|
| 8000 (host) | frontend nginx | Public entry point. Serves static + proxies `/api` and `/ws` to backend. |
| 8080 (host) | backend uvicorn | Direct backend access for debugging. Can be removed in production. |

---

## 4. Part 1 Verification — Docker Build & Service Startup

**Status: PASS ✅** (verified on this host — raspberry pi + restricted network, with DaoCloud mirror)

### Build

| Image | Size | Build time | Notes |
|---|---|---|---|
| `devops-backend` | 1.57 GB | ~28 min | Slow due to pip downloads over restricted network (~250 kB/s). Cached on subsequent builds. |
| `devops-frontend` | 102 MB | ~2 min | Next.js static export + nginx:alpine. |

Both images built successfully via `docker compose build`.

### Service startup

```
$ docker compose ps
NAME               IMAGE             STATUS                        PORTS
tagents-backend    devops-backend    Up (healthy)                  0.0.0.0:8080->8000/tcp
tagents-frontend   devops-frontend   Up (healthy)                  0.0.0.0:8000->80/tcp
```

Backend lifespan completed cleanly: `init_db` → auto-migrations (2 applied) →
scheduler started → task monitor started → `Application startup complete`.

### Endpoint verification (10 checks)

| # | Check | Expected | Actual | Pass |
|---|---|---|---|---|
| 1 | `GET :8000/` (frontend static) | 200 | 200, 6785 bytes | ✅ |
| 2 | Frontend `<title>` | TradingAgentsWeb | `TradingAgentsWeb - 多智能体大语言模型金融交易框架` | ✅ |
| 3 | `GET :8000/api/config` (nginx → backend proxy) | 200 JSON | 200, analysts list returned | ✅ |
| 4 | `GET :8080/api/config` (backend direct) | 200 | 200 | ✅ |
| 5 | `GET :8080/api/skills/health` (auth required) | 401 | 401 | ✅ |
| 6 | `GET :8080/intraday-trading` (retired route) | 308 → `/` | 308 → `/` | ✅ |
| 7 | `GET :8080/leaderboard` (retired route) | 308 → `/` | 308 → `/` | ✅ |
| 8 | `GET :8080/api/intraday/foo` (removed API) | 404 | 404 | ✅ |
| 9 | `GET :8080/api/leaderboard` (removed API) | 404 | 404 | ✅ |
| 10 | `GET :8080/ws/conversation/test` (WS endpoint exists) | non-200 (WS-only) | 404 (HTTP GET not upgraded) | ✅ |

**Healthcheck**: backend probes `http://127.0.0.1:8000/api/config` (200 JSON,
unauthenticated). Frontend probes `http://127.0.0.1/` (200 static).

### New bug found during verification (BUG-007, P2)

The backend's root route `GET /` (`page_routes.py:20`) returns **500 Internal
Server Error** due to a Starlette 1.x compatibility issue:

```python
# page_routes.py:20 — OLD Starlette API, broken on Starlette 1.x
return templates.TemplateResponse("index.html", {"request": request})
```

Starlette 1.x changed `TemplateResponse` signature to
`TemplateResponse(request, name, context=None)`. The old call passes a `dict`
as the second positional arg, which `get_template()` tries to use as a cache
key → `TypeError: unhashable type: 'dict'`.

**Impact**: Does NOT affect the deployed app — nginx serves the Next.js static
export for `/`, and the backend's `/` route is vestigial (old server-rendered
template). All real API endpoints (`/api/*`, `/ws/*`) work correctly.

**Fix** (for backend engineer): change to `templates.TemplateResponse(request, "index.html")`.

This is a non-blocking P2 — flagged here for the backend rework PR.

---

## 5. Part 2 — Full-Chain Verification (QA Release Condition 1)

**Status: BLOCKED on backend BUG-006 fix.**

Per the Dev Lead dispatch, Part 2 (conversation → analysis → `report_ready`
full-chain test with US + CN/HK tickers) must run **after** the backend
engineer's BUG-006 fix (timeout + degradation for Skills data sources) is
merged. The backend rework branch (`ws-4-qa-rework`) is in progress as of this
report.

### Test plan (to execute once BUG-006 fix is merged)

1. Rebuild the integrated branch with the BUG-006 fix merged in.
2. `docker compose up --build -d` from `devops/`.
3. Open `http://localhost:8000`, log in, start a conversation.
4. Send a US ticker prompt (e.g. "分析一下 AAPL") — watch stage events stream
   via `/ws/conversation/{id}`. Expect `stage_start` → `stage_update` →
   `stage_complete` → `report_ready`.
5. Send a CN/HK ticker prompt (e.g. "分析一下 600519 / 00700.HK").
6. Confirm the report card renders (5 sections + rating + grounded_evidence).
7. Confirm MD and JSON exports download correctly.
8. **If analysis hangs at 0% with no events**: BUG-006 reproduced — escalate
   to P0, @ Dev Lead + backend engineer to fix M2 analysis execution path.
9. **If full chain passes**: BUG-006 confirmed environment-specific + mitigated
   by the timeout/degradation fix.

---

## 6. Known Risks

| Risk | Severity | Notes |
|---|---|---|
| **BUG-006 (P1)** | High | Conversation-triggered real-time analysis hung at 0% in QA env (raspberry pi + restricted network). Most likely Skills data source sync calls (yfinance/akshare/news/reddit) hanging without timeout. Backend rework adds timeout + `stage_warning`/`stage_error` degradation. Part 2 of this report verifies the fix. |
| **BUG-007 (P2, new)** | Medium | Backend root route `GET /` returns 500 — `page_routes.py:20` uses old `TemplateResponse(name, context)` API, broken on Starlette 1.x (`TypeError: unhashable type: 'dict'`). Does NOT affect deployed app (nginx serves static frontend, not this route). Fix: `templates.TemplateResponse(request, "index.html")`. Flagged for backend rework. |
| Docker Hub unreachable | Medium | This environment cannot reach `registry-1.docker.io`. DaoCloud mirror (`docker.m.daocloud.io`) configured in `/etc/docker/daemon.json` as a workaround. Production deployments in unrestricted networks don't need this. |
| `health.py` router not mounted | Low | `web/backend/health.py` defines `/health`, `/health/ready`, `/health/live` but `app.py` never calls `app.include_router(health.router)`. Healthcheck uses `/api/config` (200 JSON, unauthenticated) as a workaround. Recommend mounting the router at `/api/health` as a follow-up. |
| PDF export is placeholder (BUG-005) | Low | PDF export returns `"pending M6 implementation"`. MD/JSON exports work. Backend rework will either implement PDF or hide the frontend entry. |
| SQLite concurrent writes | Low | Default DB is SQLite. Under heavy concurrent analysis load, may hit `database is locked`. Switch to MySQL (uncomment `mysql` service in compose) for production. |
| Slow image builds | Low | Backend pip install downloads ~400MB of packages (langchain, chromadb, pandas, etc.). On restricted networks this can take 15-30 min. Builds are cached after first run. |

---

## 7. Story Issue Coverage & Merge Status

Per QA Stage 5 report (`qa-agent/test-report.md`):

| PR | Branch | Scope | Status |
|---|---|---|---|
| #1 | `ws-4-stage4-m0` | M0 de-risk (remove trading/leaderboard, cut order path, unify AI exit, key governance) | OPEN, mergeable |
| #2 | `ws-4-m1-m4` | M1 kernel sync (v0.2.5) + M4 Skills layer (6 skills) | OPEN, mergeable (rebase to main after #1) |
| #3 | `ws-4-m2-conversation-backend` | M2 conversation backend (sessions/messages/WS/report assembly) | OPEN, mergeable (rebase after #2) |
| #4 | `ws-4-m5-m6-backend-hardening` | M5 backend IA + M6 non-functional (middleware, redirects, public reports) | OPEN, mergeable (rebase after #3) |
| #5 | `ws-4-m3-frontend` | M3 frontend (conversation workbench, report cards, stage progress) | OPEN, mergeable (independent of backend chain) |

**Recommended merge order**: #1 → #2 (rebase) → #3 (rebase) → #4 (rebase) → #5.
The DevOps PR (#6, `ws-4-devops-stage6`) adds `devops/` and can merge at any
point after #4 (it only adds new files, no conflicts).

---

## 8. Constraints Compliance

- ✅ No trading/ordering/leaderboard services packaged (code removed in M0,
  routes 308-redirect to `/`).
- ✅ Analysis reports are the only product output.
- ✅ `gpt-5.5` is the default deep+quick thinker model.
- ✅ AI exit: OneInfinity (`https://api.oneinfinityai.com/v1`).
- ✅ No secrets baked into images (API key via env var, `.env` gitignored).
- ✅ Multi-stage builds, non-root backend, healthchecks on both services.
