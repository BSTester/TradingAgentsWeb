# Rollback Plan — TradingAgents Web Docker Deployment

## Scope

This plan covers rollback for the Docker-based deployment defined in `devops/docker-compose.yml`.
It assumes a single-host `docker compose up` deployment (no orchestrator).

## Rollback Strategies (in order of preference)

### 1. Image-level rollback (fastest, no code change)

Pre-built images are tagged. To roll back to a prior known-good image:

```bash
cd devops/
# Pin to previous image tag (example: v0.1.0 -> v0.0.9)
export BACKEND_TAG=v0.0.9
export FRONTEND_TAG=v0.0.9
docker compose up -d   # re-creates containers with the pinned images
```

If images are built locally (not pushed to a registry), keep at least the
previous image around:

```bash
docker images tagents-backend          # note the old IMAGE ID
docker images tagents-frontend
```

### 2. Git-level rollback (rollback code + rebuild)

```bash
# From the repo root
git log --oneline -20                       # find the last known-good commit
git checkout <known-good-commit>
cd devops/
docker compose build --no-cache
docker compose up -d
```

### 3. Stop-and-restore (full outage, safest)

If the new deployment is actively harmful (e.g. corrupting data):

```bash
cd devops/
docker compose down                 # stop containers, KEEP named volumes
# Restore the SQLite db from backup (see below)
docker compose up -d --build        # rebuild from a known-good commit
```

## Data Backup

The backend uses SQLite by default. The database file lives in the `db_data`
named volume (mounted at `/app/db/tradingagents.db` inside the container).

### Before any deployment

```bash
# Back up the SQLite database
docker run --rm -v devops_db_data:/data -v "$(pwd)":/backup alpine \
  cp /data/tradingagents.db /backup/tradingagents.db.$(date +%Y%m%d%H%M%S).bak

# Also back up eval_results and results volumes if they contain valuable history
docker run --rm -v devops_eval_results:/data -v "$(pwd)":/backup alpine \
  tar czf /backup/eval_results.tar.gz -C /data .
```

### Restore

```bash
docker compose down
# Restore SQLite
docker run --rm -v devops_db_data:/data -v "$(pwd)":/backup alpine \
  cp /backup/tradingagents.db.<timestamp>.bak /data/tradingagents.db
docker compose up -d
```

## Health Verification After Rollback

```bash
# Backend health (root route returns 200)
curl -fsS http://localhost:8080/ && echo "backend OK"

# Frontend health
curl -fsS http://localhost:8000/ && echo "frontend OK"

# API proxy through nginx
curl -fsS http://localhost:8000/api/config && echo "api proxy OK"
```

## Known Failure Modes

| Symptom | Likely Cause | Action |
|---|---|---|
| Backend container exits immediately | Missing `OPENAI_API_KEY` in `.env` | Ensure `.env` exists in `devops/` with a valid key |
| Frontend `502 Bad Gateway` | Backend not healthy / not started | `docker compose logs backend`, wait for `start_period` (30s) |
| Analysis hangs at 0% (BUG-006) | Skills data source timeout (restricted network) | This is the known P1 — backend rework adds timeout+degradation. Rollback won't fix; needs BUG-006 fix merged. |
| `pull access denied` on build | Docker Hub unreachable, mirror down | Configure `registry-mirrors` in `/etc/docker/daemon.json` (this deployment verified with `https://docker.m.daocloud.io`) |
| SQLite `database is locked` | Concurrent writes from threaded tasks | Switch to MySQL (uncomment `mysql` service in compose, set `DATABASE_URL`) |

## Rollback Validation Checklist

- [ ] `docker compose ps` shows both services `healthy`
- [ ] `curl http://localhost:8080/` returns 200
- [ ] `curl http://localhost:8000/` returns 200 (frontend)
- [ ] Login page loads at `/`
- [ ] A test conversation can be created (POST `/api/conversations`)
- [ ] Scheduled tasks list loads (GET `/api/scheduled-tasks`)
- [ ] No `trading` / `leaderboard` / `intraday` routes respond (should 308 or 404)
