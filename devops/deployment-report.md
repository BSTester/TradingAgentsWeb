# Deployment Report — TradingAgents Web (WS-4 Stage 6)

**Issue**: WS-4 (`dd0da1e3-a687-480f-8738-97dde85a2295`)
**Stage**: 6 (DevOps)
**QA Gate**: Go-With-Risk (conditional) — see [Known Risks](#known-risks)
**Integrated code**: `ws-4-devops-stage6` = `ws-4-m5-m6-backend-hardening` ⊕ `ws-4-m3-frontend` ⊕ `devops/`, **plus** `ws-4-qa-rework` (`1e40081`) — BUG-005 PDF + BUG-006 skill-timeout/degradation + BUG-006 dispatch-race fix + BUG-007 template signature
**Date**: 2026-07-06 (Part 1, Part 2, final verification)

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

**Status: COMPLETED.** Merged `ws-4-qa-rework` (BUG-005/006/007 fixes) into
the integrated branch, rebuilt the backend, and drove the conversation→analysis
flow end-to-end over `/ws/conversation/{id}` for a US ticker and an HK ticker.

### 5.1 Reproduced BUG-006 → root cause ≠ skill layer (P0)

With the BUG-006 skill-timeout fix in place, the conversation-triggered analysis
**still hung at progress 0.0% with zero stage events** for 540 s (US run). Per
the Dev Lead's dispatch, a confirmed 0% hang is a P0. Deep investigation
(thread dump + DB + logs) pinpointed the real root cause — **it is not the
Skills data-source layer the BUG-006 fix targeted**:

- `conversation_routes.create_message()` calls `_trigger_analysis()` →
  `task_manager.submit_task()` which immediately starts `run_analysis_task`
  on a worker thread, **and only then** runs `await db.commit()`
  (`conversation_routes.py:325` submit, `:326` commit).
- `run_analysis_task` opens a **separate** `SessionLocal()`
  (`analysis_task.py:277`) and queries the `AnalysisRecord` immediately
  (`:298`). Because the creating transaction has not committed yet, the row
  is invisible → the worker logs `❌ 分析记录未找到: <id>` and aborts.
- Result: the record stays `status=running, progress=0.0, started_at=NULL`
  forever; no `stage_*` event is ever emitted; the conversation hangs silently.
- py-spy confirmed the `ThreadPoolExecutor` worker was **idle** (task already
  exited, not stuck mid-stage) — so the skill-timeout fix could not help.

**Fix (verified locally by DevOps):** commit the `AnalysisRecord` **before**
dispatching the task. One-line change in `_trigger_analysis`, after the
`await db.flush()` at `conversation_routes.py:184`:

```diff
     await db.flush()
+    # Commit BEFORE submit: run_analysis_task uses a separate SessionLocal()
+    # and queries this record immediately; dispatch-before-commit makes the
+    # row invisible -> "分析记录未找到" -> task aborts -> 0% hang (BUG-006).
+    await db.commit()

     request_data = { ... }
```

This fix is **backend M2 code** and is NOT committed to the DevOps branch — it
belongs on `ws-4-qa-rework`. After applying it locally and rebuilding, the
silent hang was resolved (see 5.2). **Action: backend engineer to land this
one-line commit on `ws-4-qa-rework`.**

### 5.2 Full-chain result with the verified fix (US + HK)

After the fix, the conversation→analysis flow runs and streams events — no
silent 0% hang. Both markets verified:

| Ticker | Market | Skill data fetch | LLM step | Terminal event | `report_ready` |
|---|---|---|---|---|---|
| `AAPL` | US | `get_stock_data` → AKShare `stock_us_daily` returned data ✅; `get_realtime_quote`/`get_indicators` degraded gracefully | "AI 深度思考" ~3 min | `stage_error` + `error` (network) | ❌ (LLM blocked — see 5.3) |
| `00700.HK` | HK | `get_stock_data` → AKShare `stock_hk_` returned data ✅; per-skill errors degraded | "AI 深度思考" ~3 min | `stage_error` + `error` (network) | ❌ (LLM blocked) |

**What this proves:**
- The dispatch race was the real BUG-006; the fix resolves the silent hang. ✅
- The BUG-006 resilience pattern works at the task level: failed analyses now
  terminate with `stage_error`/`error` and record `status=failed` (visible in
  `/api/reports`, retryable), **not** stuck at `running`/0%. QA gate 2
  ("消除 running 0% 无事件的静默挂起") is satisfied. ✅
- Skills execute and the project's headline 美股/港股/A股 data coverage works
  at the data layer (AKShare returns both US and HK series). ✅

### 5.3 New blocker — LLM endpoint unreachable from this egress (environment, not code)

A live `report_ready` could **not** be reached because the LLM endpoint
`https://api.oneinfinityai.com/v1/chat/completions` (model `gpt-5.5`) returns
**HTTP 403 / Cloudflare error 1010** ("the owner of this website has banned
your access based on your browser's signature") from this deployment's egress
(verified directly from the backend container: `/models` → 403,
`/chat/completions` → `403 error code: 1010` in <1 s). The "AI 深度思考" stage
then fails with `stage_error: 网络连接失败`, which is the correct graceful
behavior — but it caps the chain short of a finished report.

This is **environment/network-specific, not a code defect**: the app behaves
correctly (graceful degradation + `stage_error`). Required follow-ups:
1. Verify `api.oneinfinityai.com` reachability **from the production egress**
   (this Raspberry-Pi/datacenter IP appears Cloudflare-flagged).
2. If 403/1010 reproduces in production, OneInfinity is blocking server-side
   (non-browser) callers — the user must supply a server-accessible
   OpenAI-compatible endpoint/key, or whitelist the deploy egress.

### 5.4 Report export verification (BUG-005)

Exports were verified on a synthetic completed `AnalysisRecord` (the LLM block
prevents a real one; this exercises the export code paths BUG-005 changed):

| Format | Endpoint | HTTP | Content-Type | Body | Pass |
|---|---|---|---|---|---|
| MD | `/api/reports/{id}/export?format=md` | 200 | `text/markdown; charset=utf-8` | valid markdown (评级 3/5, sections) | ✅ |
| JSON | `/api/reports/{id}/export?format=json` | 200 | `application/json` | full structured keys (sections, stage_log, reflection, conclusion) | ✅ |
| PDF | `/api/reports/{id}/export?format=pdf` | 200 | `application/pdf` | `%PDF-1.4`, 1692 B, **no "pending M6" placeholder** | ✅ |

**BUG-005 is fixed**: PDF export now returns a real `application/pdf` binary
(was a placeholder JSON). Report-card detail (`/api/reports/{id}`) renders with
sections / stage_log / reflection.

### 5.5 Final verification on official dispatch-fix build (`ws-4-qa-rework` `1e40081`)

Backend landed the dispatch race fix as commit `1e40081`
(`flush → commit → submit_task`, with AST test
`tests/test_conversation_dispatch_commit.py`). Re-merged into
`ws-4-devops-stage6`, rebuilt backend, and re-ran the full chain on the
**official** fix (not the DevOps local patch):

| Ticker | Market | Stage events | Progress reached | Terminal | `report_ready` |
|---|---|---|---|---|---|
| `AAPL` | US | full chain (task start → graph init → `stage_start` → market → skills) | **10%** (market data stage) | `stage_error` (LLM network) | ❌ env only |
| `00700.HK` | HK | full chain (HK market detected, skills executed) | **10%** | `stage_error` (LLM network) | ❌ env only |

**No 0% silent hang.** DB confirms the before/after contrast directly:

| Run | Build | `status` | `progress` |
|---|---|---|---|
| pre-fix (`conv_...142705_AAPL`) | no dispatch fix | `interrupted` | **0.0%** |
| post-fix (4 runs, US + HK) | `1e40081` | `error` | **10.0%** |

Post-fix, the analysis **actually executes** (reaches the market-data stage at
10%, streams the full event chain) and **terminates gracefully** with
`status=error` when the LLM call fails — exactly the resilient behavior QA gate 2
requires. The skill-timeout/degradation (original BUG-006 scope) and the dispatch
race (BUG-006 root cause) are both fixed and verified.

Exports re-verified on the final build: PDF `%PDF-1.4` (200), MD (200), JSON
(200). BUG-007 `GET /` → 200.

**BUG-006 is closed at the code level.** The sole reason `report_ready` is not
reached is the LLM endpoint (`api.oneinfinityai.com`) returning 403 / Cloudflare
1010 from **this deployment's egress** (confirmed again this run, <2 s). Per Dev
Lead + user: the endpoint is a standard OpenAI-compatible base URL, the code
calls it correctly, and a production server with normal egress should reach it —
so this is an **environment limitation, not a code blocker**.

---

## 6. Known Risks

| Risk | Severity | Notes |
|---|---|---|
| **BUG-006 (P1) — CLOSED at code level** | Resolved | Root cause (dispatch race: `submit_task` before `db.commit`) fixed in `ws-4-qa-rework` `1e40081`; skill-timeout/degradation in `683d35f`. **Verified on official build (§5.5):** no 0% hang — analysis runs to 10% (market stage), streams full event chain, terminates gracefully `status=error` on LLM failure. Pre-fix run stayed `0.0%/interrupted`; post-fix runs reach `10.0%/error`. Both fix layers confirmed working. |
| **LLM endpoint blocked from this egress (environment)** | High (this env only) | `api.oneinfinityai.com` returns 403 / Cloudflare 1010 from this deployment's egress, so `report_ready` is not reached here. Per Dev Lead + user: endpoint is a standard OpenAI-compatible base URL, code calls it correctly, production egress should reach it. **Environment limitation, not a code blocker.** |
| **BUG-007 (P2) — FIXED** | Resolved | `page_routes.py:20/:26` Starlette 1.x `TemplateResponse` signature. Fixed on `ws-4-qa-rework` (`c80d9de`); backend `GET /` now returns 200 (was 500). Verified live in the rebuilt container. |
| **BUG-005 PDF — FIXED** | Resolved | PDF export now returns a real `%PDF-1.4` (was placeholder JSON). Verified: `/api/reports/{id}/export?format=pdf` → 200 `application/pdf`. |
| Docker Hub unreachable | Medium | This environment cannot reach `registry-1.docker.io`. DaoCloud mirror (`docker.m.daocloud.io`) configured in `/etc/docker/daemon.json` as a workaround. Production deployments in unrestricted networks don't need this. |
| `health.py` router not mounted | Low | `web/backend/health.py` defines `/health`, `/health/ready`, `/health/live` but `app.py` never calls `app.include_router(health.router)`. Healthcheck uses `/api/config` (200 JSON, unauthenticated) as a workaround. Recommend mounting the router at `/api/health` as a follow-up. |
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
