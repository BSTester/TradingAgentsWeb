# 下线订阅/积分/订单、后台 LLM 配置与定时任务 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 删除订阅/积分/订单、后台 LLM 配置与定时任务三块能力（前后端 + 数据库 + 依赖 + 文档），只保留前端用户自定义 LLM 能力（keyVault + 自定义 Base URL/模型），分析改为"请求即配置"。

**架构：** LLM 配置不再由后端解析（无 Provider 目录、无系统默认、无用户持久化设置），改为 `AnalysisRequest` 自带 `provider/backend_url/shallow_thinker/deep_thinker/api_key` 经轻量校验后直接建图；订阅与定时任务整体下线，数据库删除 6 张表与 `users.credit_balance`（迁移前自动备份）。

**技术栈：** FastAPI + SQLAlchemy(async/sync) + Pydantic v2 + SQLite/MySQL；Next.js 15 + React 19 + TanStack Query + Vitest；pytest。

**规格：** `docs/superpowers/specs/2026-09-11-remove-subscription-llm-config-scheduled-tasks-design.md`

---

## 文件结构

### 后端

| 文件 | 动作 | 职责 |
|------|------|------|
| `web/backend/services/llm_config_resolver.py` | 重写 | 仅校验请求自带的 LLM 配置，返回 `ResolvedLLMConfig` |
| `web/backend/routes/analysis_routes.py` | 修改 | 去掉积分门槛/扣减；改用新的 `resolve_llm_config` 签名 |
| `web/backend/routes/config_routes.py` | 修改 | `/config` 去掉 provider/model 目录；删除 `/validate-key`、`/llm/fetch-models` |
| `web/backend/routes/admin_routes.py` | 修改 | 删除订阅商品与订单端点 |
| `web/backend/routes/{llm_config,user_llm_settings,subscription,scheduled_task}_routes.py` | 删除 | 四个路由模块整体下线 |
| `web/backend/services/{scheduler_service,system_default_provider,task_executor}.py` | 删除 | 定时任务与系统默认 Provider 服务 |
| `web/backend/services/report_formatter.py` | 修改 | 去掉 `scheduled_task` 来源分支 |
| `web/backend/models.py` | 修改 | 删除 6 个模型与 `User.credit_balance` |
| `web/backend/schemas.py` | 修改 | 删除订阅/积分/LLM 配置/定时任务相关模型 |
| `web/backend/app.py` | 修改 | 去掉路由注册与 APScheduler 启停 |
| `web/backend/migrations/007_drop_subscription_llm_scheduled.py` | 创建 | 备份 + DROP 表/列（幂等） |
| `web/backend/migrations/auto_migrate.py` | 修改 | 模型清单去掉已删模型 |
| `web/backend/tests/test_llm_config_resolver.py` | 重写 | 请求配置校验测试 |
| `pyproject.toml` / `requirements.txt` | 修改 | 移除 `apscheduler` |

### 前端

| 文件 | 动作 | 职责 |
|------|------|------|
| `src/lib/apiClient.ts` | 修改 | 删除 `adminLLMAPI`/`adminDefaultProviderAPI`/`llmSettingsAPI`/`scheduledTasksAPI`/`configAPI.validateAPIKey`/`configAPI.getSystemDefault` |
| `src/lib/api.ts` | 修改 | 删除 `scheduledTasksAPI` 与 workspace 再导出中的订阅/管理 API |
| `src/lib/api/workspace.ts` | 修改 | 只保留 `reportsAPI`（订阅/管理 API 删除） |
| `src/lib/types.ts`、`src/types/index.ts` | 修改 | 删除订阅/积分/LLM 配置/定时任务类型，`llm_providers` 改为可选 |
| `src/lib/providers.ts` | 保持 | 前端本地 provider 目录（分析与设置页的目录来源） |
| `src/components/analysis/AnalysisConfigForm.tsx` | 修改 | provider 目录改用本地常量；去掉 `useUserLLMSettings` 依赖 |
| `src/components/analysis/ModelSelector.tsx` | 重写 | 数据源改为本地目录 + keyVault 本地密钥 |
| `src/components/ui/ConfirmDialog.tsx` | 创建（迁移） | 从 `components/admin/llm-config/ConfirmDialog.tsx` 迁出 |
| `src/app/{subscribe,subscription,me/subscription,me/billing,scheduled-tasks,admin/subscription-products,admin/orders,admin/llm-config,admin/system-default-provider,profile/ai-settings}/` | 删除 | 10 个页面 |
| `src/components/{admin/llm-config,admin/system-default-provider,scheduled-tasks,profile/Provider*}`、`src/hooks/{useUserLLMSettings,useScheduledTasks}.ts` | 删除 | 相关组件与 hook |
| 导航/首页/测试/文档 | 修改 | 清理入口与引用 |

---

## 任务 1：删除后台 LLM 配置（路由/服务）并收敛为请求校验

**文件：**
- 删除：`web/backend/routes/llm_config_routes.py`、`web/backend/routes/user_llm_settings_routes.py`、`web/backend/services/system_default_provider.py`
- 重写：`web/backend/services/llm_config_resolver.py`
- 修改：`web/backend/routes/config_routes.py`、`web/backend/routes/analysis_routes.py:83-94`、`web/backend/app.py:80,797,813`
- 测试：`web/backend/tests/test_llm_config_resolver.py`

- [ ] **步骤 0：删除后台 LLM 配置路由与服务**

```bash
git rm web/backend/routes/llm_config_routes.py \
       web/backend/routes/user_llm_settings_routes.py \
       web/backend/services/system_default_provider.py
```

`app.py`：第 80 行 import 去掉 `user_llm_settings_routes`、`llm_config_routes`；删除 `app.include_router(user_llm_settings_routes.router)`（797 行）与 `app.include_router(llm_config_routes.router)`（813 行）。

`config_routes.py`：删除 `@router.post("/validate-key")` 与 `@router.post("/llm/fetch-models")` 两个端点及其专用 import；`/config` 端点删除 LLMProvider/LLMModel 查询与 `llm_providers` / `models` 两个响应键（保留分析师、研究深度、市场等非 LLM 选项）。

- [ ] **步骤 1：编写失败的测试**

```python
"""请求即配置：LLM 配置只来自请求体，缺失时返回结构化 400。"""

import pytest

from web.backend.services.llm_config_resolver import (
    LLMConfigResolutionError,
    resolve_llm_config_from_request,
)


def _ok(**overrides):
    payload = dict(
        llm_provider="openai",
        backend_url="https://api.openai.com/v1",
        shallow_thinker="gpt-4o-mini",
        deep_thinker="gpt-4o",
        api_key="sk-test",
    )
    payload.update(overrides)
    return payload


def test_accepts_complete_request_config():
    resolved = resolve_llm_config_from_request(**_ok())
    assert resolved.llm_provider == "openai"
    assert resolved.backend_url == "https://api.openai.com/v1"
    assert resolved.shallow_thinker == "gpt-4o-mini"
    assert resolved.deep_thinker == "gpt-4o"
    assert resolved.api_key == "sk-test"
    assert resolved.source == "request"


def test_provider_is_normalized_to_lowercase():
    assert resolve_llm_config_from_request(**_ok(llm_provider="OpenAI")).llm_provider == "openai"


@pytest.mark.parametrize(
    ("field", "code"),
    [
        ("api_key", "REQUEST_API_KEY_REQUIRED"),
        ("llm_provider", "REQUEST_CONFIG_INVALID"),
        ("shallow_thinker", "REQUEST_CONFIG_INVALID"),
        ("deep_thinker", "REQUEST_CONFIG_INVALID"),
        ("backend_url", "REQUEST_CONFIG_INVALID"),
    ],
)
def test_rejects_incomplete_request_config(field, code):
    with pytest.raises(LLMConfigResolutionError) as exc_info:
        resolve_llm_config_from_request(**_ok(**{field: None}))
    assert exc_info.value.code == code


@pytest.mark.parametrize("bad_url", ["ftp://x", "not-a-url", "javascript:alert(1)"])
def test_rejects_non_http_backend_url(bad_url):
    with pytest.raises(LLMConfigResolutionError) as exc_info:
        resolve_llm_config_from_request(**_ok(backend_url=bad_url))
    assert exc_info.value.code == "REQUEST_CONFIG_INVALID"
```

- [ ] **步骤 2：运行测试验证失败**

运行：`.venv/bin/python -m pytest web/backend/tests/test_llm_config_resolver.py -q`
预期：ImportError / FAIL（`resolve_llm_config_from_request` 不存在）

- [ ] **步骤 3：重写 `llm_config_resolver.py`**

```python
"""LLM 配置校验（请求即配置）。

本项目不维护任何后端 LLM 配置：没有 Provider/模型目录、没有系统默认 Provider、
没有用户级持久化设置。分析所需的 provider / backend_url / 模型 / api_key 全部由
前端随请求提交（密钥来自浏览器 keyVault），本模块只做校验与错误契约。

错误码：
- REQUEST_API_KEY_REQUIRED：未提供 api_key（提示用户到"设置"页配置本地密钥）
- REQUEST_CONFIG_INVALID：provider / 模型 / backend_url 缺失或非法
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import urlparse

from fastapi import HTTPException
from fastapi.responses import JSONResponse


@dataclass(frozen=True)
class ResolvedLLMConfig:
    llm_provider: str
    backend_url: str
    shallow_thinker: str
    deep_thinker: str
    api_key: str
    source: str


class LLMConfigResolutionError(HTTPException):
    """Structured LLM config error matching the API contract."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        self.code = code
        self.message = message
        self.details = details
        super().__init__(
            status_code=status_code,
            detail={
                "error": {
                    "code": code,
                    "message": message,
                    "details": details,
                    "request_id": None,
                }
            },
        )


def llm_config_error_response(exc: LLMConfigResolutionError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=exc.detail)


def _clean(value: Optional[str]) -> str:
    return (value or "").strip()


def _raise_invalid(message: str, **details: Any) -> None:
    raise LLMConfigResolutionError(
        status_code=400,
        code="REQUEST_CONFIG_INVALID",
        message=message,
        details=details,
    )


def _validate_backend_url(base_url: str) -> None:
    parsed = urlparse(base_url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        _raise_invalid("backend_url 必须是合法的 http(s) 地址", backend_url=base_url)


def resolve_llm_config_from_request(
    *,
    llm_provider: Optional[str],
    backend_url: Optional[str],
    shallow_thinker: Optional[str],
    deep_thinker: Optional[str],
    api_key: Optional[str],
) -> ResolvedLLMConfig:
    """校验并返回请求自带的 LLM 配置（唯一来源）。"""
    provider = _clean(llm_provider).lower()
    key = _clean(api_key)
    base_url = _clean(backend_url)
    shallow = _clean(shallow_thinker)
    deep = _clean(deep_thinker)

    if not key:
        raise LLMConfigResolutionError(
            status_code=400,
            code="REQUEST_API_KEY_REQUIRED",
            message="缺少 API Key：请在「设置」页保存本地密钥后重新发起分析",
        )
    if not provider:
        _raise_invalid("缺少 llm_provider")
    if not shallow or not deep:
        _raise_invalid("缺少 shallow_thinker / deep_thinker 模型名")
    if not base_url:
        _raise_invalid("缺少 backend_url")
    _validate_backend_url(base_url)

    return ResolvedLLMConfig(
        llm_provider=provider,
        backend_url=base_url,
        shallow_thinker=shallow,
        deep_thinker=deep,
        api_key=key,
        source="request",
    )
```

- [ ] **步骤 4：改调用点 `analysis_routes.py`**

```python
    try:
        resolved_llm = resolve_llm_config_from_request(
            llm_provider=requested_provider,
            backend_url=request.backend_url,
            shallow_thinker=request.shallow_thinker,
            deep_thinker=request.deep_thinker,
            api_key=request.api_key,
        )
    except LLMConfigResolutionError as exc:
        return llm_config_error_response(exc)
```

同时把文件顶部的 import 改为 `resolve_llm_config_from_request`（去掉 `resolve_llm_config`）。

- [ ] **步骤 5：运行测试验证通过**

运行：`.venv/bin/python -m pytest web/backend/tests/test_llm_config_resolver.py -q`
预期：PASS（10 passed）

- [ ] **步骤 6：Commit**

```bash
git add -A web/backend
git commit -m "refactor(backend): 下线后台 LLM 配置，分析改为请求即配置"
```

---

## 任务 2：删除订阅 / 积分 / 订单（后端）

**文件：**
- 删除：`web/backend/routes/subscription_routes.py`
- 修改：`web/backend/routes/admin_routes.py`（删 `/subscription-products*` 与 `/orders`）、`web/backend/routes/analysis_routes.py`（删积分门槛与扣减）、`web/backend/routes/user_management_routes.py`（删积分调整）、`web/backend/models.py`、`web/backend/schemas.py`、`web/backend/app.py`（路由注册）、`web/backend/utils/admin_helper.py`

- [ ] **步骤 1：删除路由文件与端点**

```bash
git rm web/backend/routes/subscription_routes.py
```

`admin_routes.py` 中删除以下装饰器及其函数体（保留 `/users/{id}/active`、`/users/{id}/role`、`/public-reports`、`/reports/{id}/public`）：
`@router.get("/subscription-products")`、`@router.post("/subscription-products")`、
`@router.patch("/subscription-products/{plan_id}")`、`@router.delete("/subscription-products/{plan_id}")`、
`@router.get("/orders")`，并同步删除只为这些端点服务的 import（`SubscriptionPlan`、`CreditTransaction`、`AdminSubscriptionPlan*`、`AdminOrderOut`、`UserRoleUpdateIn` 以外的相关符号）。

- [ ] **步骤 2：删除分析积分门槛与扣减**

`analysis_routes.py` 删除以下逻辑（原 149-156 行附近）：

```python
        if (current_user.credit_balance or 0) < 1:
            ...
        new_balance = (user_row.credit_balance or 0) - 1
        user_row.credit_balance = new_balance
```

- [ ] **步骤 3：删除模型与 schema**

`models.py` 删除 `SubscriptionPlan`、`CreditTransaction` 两个类与 `User.credit_balance` 列，并删除 `User.credit_transactions` relationship。
`schemas.py` 删除 `ReportPublicIn`（保留，公开报告仍在用）、`SubscriptionPlanOut`、`AdminSubscriptionPlanOut`、`AdminSubscriptionPlanIn`、`AdminSubscriptionPlanUpdate`、`CreditTransactionOut`、`SubscriptionInfoOut`、`SubscriptionPurchaseIn`、`AdminOrderOut`（保留 `ReportPublicIn`、`UserRoleUpdateIn`）。

- [ ] **步骤 4：清理路由注册与辅助函数**

`app.py` 第 80 行 import 去掉 `subscription_routes`，并删除其 `include_router`。
`utils/admin_helper.py`、`routes/user_management_routes.py` 中积分相关函数/字段删除。

- [ ] **步骤 5：验证后端可导入**

运行：`.venv/bin/python -c "import web.backend.app; print('app import OK')"`
预期：`app import OK`（无 ImportError）

- [ ] **步骤 6：Commit**

```bash
git add -A web/backend
git commit -m "refactor(backend): 下线订阅/积分/订单（路由、模型、扣费逻辑）"
```

---

## 任务 3：删除定时任务（后端 + 依赖）

**文件：**
- 删除：`web/backend/routes/scheduled_task_routes.py`、`web/backend/services/scheduler_service.py`、`web/backend/services/task_executor.py`
- 修改：`web/backend/app.py`（scheduler 启停、路由注册、`load_scheduled_tasks`）、`web/backend/models.py`（`ScheduledTask`）、`web/backend/schemas.py`、`web/backend/services/report_formatter.py`、`pyproject.toml`、`requirements.txt`

- [ ] **步骤 1：删除路由与服务文件**

```bash
git rm web/backend/routes/scheduled_task_routes.py \
       web/backend/services/scheduler_service.py \
       web/backend/services/task_executor.py
```

- [ ] **步骤 2：清理 app.py**

删除：`scheduled_task_routes` 的 import 与 `include_router`；lifespan 中 131-140 行的 scheduler 初始化与 `load_scheduled_tasks` 调用；172-176 行的 shutdown；`async def load_scheduled_tasks(...)` 整个函数。

- [ ] **步骤 3：删除模型与 schema**

`models.py` 删除 `ScheduledTask` 类；`schemas.py` 删除 `ScheduledTask*` 全部模型。
`report_formatter.py` 中 `{"type": "conversation" if source_session_id else "scheduled_task"}` 改为固定 `"conversation"`（`source_session_id` 为空时也为 conversation），并删除对 `ScheduledTask` 的 import。

- [ ] **步骤 4：移除 apscheduler 依赖**

`pyproject.toml` 删除 `"apscheduler>=3.10.0",`；`requirements.txt` 删除对应行；执行
`.venv/bin/pip uninstall -y apscheduler` 后运行 `.venv/bin/python -c "import web.backend.app"` 确认无残留导入。

- [ ] **步骤 5：Commit**

```bash
git add -A
git commit -m "refactor(backend): 下线定时任务（路由/调度器/执行器/依赖）"
```

---

## 任务 4：数据库迁移（删表删列）

**文件：**
- 创建：`web/backend/migrations/007_drop_subscription_llm_scheduled.py`
- 修改：`web/backend/migrations/auto_migrate.py:174`

- [ ] **步骤 1：编写迁移脚本**

```python
#!/usr/bin/env python3
"""迁移 007：删除订阅/积分/后台 LLM 配置/定时任务相关表与列。

幂等：重复执行不会报错；执行前自动备份 SQLite 库文件。
"""

from __future__ import annotations

import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from sqlalchemy import text  # noqa: E402

from web.backend.database import sync_engine  # noqa: E402

DROP_TABLES = [
    "scheduled_tasks",
    "subscription_plans",
    "credit_transactions",
    "llm_providers",
    "llm_models",
    "user_llm_provider_settings",
]
DROP_COLUMNS = [("users", "credit_balance")]


def _backup_sqlite() -> None:
    url = sync_engine.url
    if url.get_backend_name() != "sqlite":
        return
    db_path = url.database
    if not db_path or not os.path.exists(db_path):
        return
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = f"{db_path}.bak-{stamp}"
    shutil.copy2(db_path, backup)
    print(f"🗄️  已备份数据库: {backup}")


def upgrade() -> None:
    _backup_sqlite()
    with sync_engine.begin() as conn:
        for table in DROP_TABLES:
            try:
                conn.execute(text(f"DROP TABLE IF EXISTS {table}"))
                print(f"✅ 已删除表 {table}")
            except Exception as exc:  # noqa: BLE001
                print(f"⚠️  删除表 {table} 失败（继续）: {exc}")
        for table, column in DROP_COLUMNS:
            try:
                conn.execute(text(f"ALTER TABLE {table} DROP COLUMN {column}"))
                print(f"✅ 已删除列 {table}.{column}")
            except Exception as exc:  # noqa: BLE001
                print(f"⚠️  删除列 {table}.{column} 跳过（SQLite < 3.35 或列不存在）: {exc}")


if __name__ == "__main__":
    upgrade()
```

- [ ] **步骤 2：更新 auto_migrate 模型清单**

`auto_migrate.py:174` 改为：

```python
    from web.backend.models import User, UserConfig, AnalysisRecord, AnalysisLog, ExportRecord
```

- [ ] **步骤 3：在本地备份库上实测迁移**

```bash
cp db/tradingagents.db /tmp/tradingagents-pre-migration.db
.venv/bin/python web/backend/migrations/007_drop_subscription_llm_scheduled.py
.venv/bin/python - <<'PY'
import sqlite3
con = sqlite3.connect('db/tradingagents.db')
tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
for t in ["scheduled_tasks", "subscription_plans", "credit_transactions", "llm_providers", "llm_models", "user_llm_provider_settings"]:
    assert t not in tables, f"{t} 仍存在"
cols = {r[1] for r in con.execute("PRAGMA table_info(users)")}
assert 'credit_balance' not in cols, 'users.credit_balance 仍存在'
print('迁移验证通过：6 张表与 users.credit_balance 均已删除')
PY
```

预期：脚本打印已删除的表/列，校验脚本输出"迁移验证通过"

- [ ] **步骤 4：Commit**

```bash
git add web/backend/migrations/007_drop_subscription_llm_scheduled.py web/backend/migrations/auto_migrate.py
git commit -m "chore(db): 迁移 007 删除订阅/积分/LLM 配置/定时任务表与 users.credit_balance"
```

---

## 任务 5：前端 API 与类型层清理

**文件：**
- 修改：`src/lib/apiClient.ts`、`src/lib/api.ts`、`src/lib/api/workspace.ts`、`src/lib/types.ts`、`src/types/index.ts`

- [ ] **步骤 1：删除 API 对象**

`apiClient.ts` 删除 `adminLLMAPI`、`adminDefaultProviderAPI`、`llmSettingsAPI`、`scheduledTasksAPI`、`SetSystemDefaultArg`，以及 `configAPI` 中的 `validateAPIKey`、`getSystemDefault`（保留 `configAPI.getConfig`）。
`api.ts` 删除 `scheduledTasksAPI`、`ScheduledTaskItem`、`ScheduledTaskListResponse`、`ScheduledTaskStats` 与文件尾部的 workspace 再导出中订阅/管理部分。
`lib/api/workspace.ts` 只保留 `reportsAPI`（删除 `subscriptionAPI`、`adminAPI`、`llmAPI` 与相关类型导入）。

- [ ] **步骤 2：清理类型**

`lib/types.ts`、`src/types/index.ts` 删除 `SubscriptionPlan`、`SubscriptionInfo`、`AdminSubscriptionPlan`、`AdminOrder`、`AdminPublicReportItem` 之外的订阅/积分类型、`UserLLMProviderSetting`、`ScheduledTask*`、`LLMProvider`/`LLMModel` 相关类型；配置响应类型中的 `llm_providers` 改为可选（`llm_providers?: LLMProviderOption[]`）。

- [ ] **步骤 3：验证类型**

运行：`npm run typecheck`
预期：仅剩尚未处理页面（订阅/管理/定时任务/ai-settings、ModelSelector、AnalysisConfigForm）的报错，记录清单供后续任务消除

- [ ] **步骤 4：Commit**

```bash
git add src/lib src/types
git commit -m "refactor(frontend): 移除订阅/管理/定时任务 API 与类型"
```

---

## 任务 6：分析与设置改用前端本地目录

**文件：**
- 修改：`src/components/analysis/AnalysisConfigForm.tsx`、`src/components/analysis/ModelSelector.tsx`
- 测试：`src/components/analysis/ModelSelector.test.tsx`

- [ ] **步骤 1：`AnalysisConfigForm` 改用本地常量**

把 `config?.llm_providers?.find(...)`（约 140 行）与 `config?.llm_providers || [...]`（约 247 行）替换为 `src/lib/providers.ts` 的本地目录：

```tsx
import { COMMON_PROVIDERS } from '@/lib/providers';

// provider 的 base_url：优先用户自定义（customModelConfig），否则用本地目录默认值
const providerBaseUrl =
  customModelConfig.getBaseUrl(userId, formData.llm_provider) ||
  COMMON_PROVIDERS.find((p) => p.value === formData.llm_provider)?.defaultBaseUrl ||
  formData.backend_url;
```

同时去掉本地密钥之外的 LLM 配置来源（`useUserLLMSettings` 不得再被引用）。

- [ ] **步骤 2：`ModelSelector` 数据源改为本地**

`ModelSelector.tsx` 删除 `useUserLLMSettings` 依赖，改为：

```tsx
import { COMMON_PROVIDERS } from '@/lib/providers';
import { useLocalLLMKeys } from '@/hooks/useLocalLLMKeys';

// 可选 provider = 本地目录中有密钥的 provider（keyVault）+ 自定义模型配置
const { hasLocalKey } = useLocalLLMKeys();
const personal = COMMON_PROVIDERS.filter((p) => hasLocalKey(p.value));
```

- [ ] **步骤 3：更新测试**

`ModelSelector.test.tsx` 的 mock 从 `useUserLLMSettings` 改为 `useLocalLLMKeys`（mock 返回 `{ hasLocalKey: () => true }`），断言"仅显示已配置本地密钥的 provider"。

- [ ] **步骤 4：验证**

运行：`npm run typecheck && npm run test:run -- src/components/analysis/ModelSelector.test.tsx`
预期：typecheck 无本文件报错；ModelSelector 测试通过

- [ ] **步骤 5：Commit**

```bash
git add src/components/analysis/AnalysisConfigForm.tsx src/components/analysis/ModelSelector.tsx src/components/analysis/ModelSelector.test.tsx
git commit -m "refactor(frontend): 分析配置与模型选择改用本地 provider 目录与 keyVault"
```

---

## 任务 7：删除前端页面、组件与 hook

**文件：**
- 创建：`src/components/ui/ConfirmDialog.tsx`（自 `src/components/admin/llm-config/ConfirmDialog.tsx` 迁移）
- 删除：10 个页面目录、`components/admin/llm-config/`、`components/admin/system-default-provider/`、`components/scheduled-tasks/`、`components/profile/{ProviderList,ProviderFormDrawer,ProviderFormDrawer.test,ProviderItem,AISettingsCard}.tsx`、`hooks/useUserLLMSettings.ts`、`hooks/useScheduledTasks.ts`

- [ ] **步骤 1：迁移 ConfirmDialog**

```bash
git mv src/components/admin/llm-config/ConfirmDialog.tsx src/components/ui/ConfirmDialog.tsx
grep -rl "admin/llm-config/ConfirmDialog" src | xargs sed -i "s#@/components/admin/llm-config/ConfirmDialog#@/components/ui/ConfirmDialog#g"
```

- [ ] **步骤 2：删除页面与组件**

```bash
git rm -r src/app/subscribe src/app/subscription src/app/me/subscription src/app/me/billing \
          src/app/scheduled-tasks src/app/admin/subscription-products src/app/admin/orders \
          src/app/admin/llm-config src/app/admin/system-default-provider src/app/profile/ai-settings \
          src/components/admin/llm-config src/components/admin/system-default-provider \
          src/components/scheduled-tasks src/components/profile/ProviderList.tsx \
          src/components/profile/ProviderFormDrawer.tsx src/components/profile/ProviderFormDrawer.test.tsx \
          src/components/profile/ProviderItem.tsx src/components/profile/AISettingsCard.tsx \
          src/hooks/useUserLLMSettings.ts src/hooks/useScheduledTasks.ts
```

- [ ] **步骤 3：清理 `route-state-coverage.test.ts` 中已删组件条目**

删除测试数组中的 `'src/components/admin/system-default-provider/SystemDefaultForm.tsx'` 等已删文件条目（保留其余页面条目）。

- [ ] **步骤 4：验证**

运行：`npm run typecheck`
预期：仅剩导航/首页引用（任务 8）相关报错

- [ ] **步骤 5：Commit**

```bash
git add -A
git commit -m "refactor(frontend): 删除订阅/定时任务/后台 LLM 配置页面与组件"
```

---

## 任务 8：导航与首页入口清理

**文件：**
- 修改：`src/components/site/SiteHeader.tsx`、`src/components/site/SiteFooter.tsx`、`src/components/site/AccountLayout.tsx`、`src/components/ws133/AccountLayout.tsx`、`src/components/ws133/Shell.tsx`、`src/components/ws133/AdminLayout.tsx`、`src/components/common/AppNavbar.tsx`、`src/app/me/page.tsx`、`src/app/admin/page.tsx`、`src/app/admin/users/page.tsx`

- [ ] **步骤 1：删除导航条目**

各文件中删除指向 `/subscription`、`/subscribe`、`/me/subscription`、`/me/billing`、`/scheduled-tasks`、`/admin/llm-config`、`/admin/system-default-provider`、`/admin/subscription-products`、`/admin/orders` 的条目（含 `SiteHeader` 的 `{ href: '/subscription', label: '订阅' }`、`SiteFooter` 的订阅链接、`AccountLayout` 的 `billing`/`subscription` 项、`Shell` 的"订阅中心"、`AdminLayout` 的"LLM 配置/系统默认 Provider/订阅商品管理"）。

- [ ] **步骤 2：清理首页与用户管理页**

`app/me/page.tsx` 去掉积分余额卡片与订阅明细入口；`app/admin/page.tsx` 去掉订阅商品/订单卡片；`app/admin/users/page.tsx` 去掉积分调整控件与字段。

- [ ] **步骤 3：验证**

运行：`npm run typecheck && npm run lint`
预期：typecheck exit 0；lint 0 error

- [ ] **步骤 4：Commit**

```bash
git add src
git commit -m "refactor(frontend): 清理订阅/定时任务/LLM 配置导航入口"
```

---

## 任务 9：测试调整与全量门禁

**文件：**
- 修改：`web/frontend/src/app/route-state-coverage.test.ts`（如仍有条目）、`web/frontend/src/lib/font-awesome-subset.test.ts`（图标集合随页面删除变化，必要时重跑 `npm run build:fa-subset`）

- [ ] **步骤 1：前端全量门禁**

```bash
npm run typecheck && npm run lint && npm run test:run && npm run build
```

预期：typecheck exit 0；lint 0 error；Vitest 全绿；build 成功
若 `font-awesome-subset` 测试失败（删页面后图标集合变化）：运行 `npm run build:fa-subset` 后重跑

- [ ] **步骤 2：后端全量门禁**

```bash
.venv/bin/python -m pytest web/backend/tests/ -q
```

预期：全绿（`test_llm_config_resolver.py` 新用例 + 既有 token/TTL/CORS/PDF/市场识别用例）

- [ ] **步骤 3：残留扫描**

```bash
grep -rInE "subscription|credit_balance|CreditTransaction|SubscriptionPlan|LLMProvider|LLMModel|UserLLMProviderSetting|scheduled_task|ScheduledTask|apscheduler|system-default|llm-settings" \
  web/backend web/frontend/src tradingagents pyproject.toml requirements.txt \
  --include='*.py' --include='*.ts' --include='*.tsx' --include='*.toml' --include='*.txt' \
  | grep -vE "web/backend/migrations/(00[1-6]|add_|init_)|docs/archive/" || echo "无残留引用"
```

预期：仅历史迁移脚本（白名单）命中，其余 0 命中

- [ ] **步骤 4：Commit（如测试/子集有调整）**

```bash
git add -A
git commit -m "test: 调整测试与图标子集以匹配功能下线"
```

---

## 任务 10：文档与依赖收尾

**文件：**
- 修改：`README.md`、`AGENTS.md`、`.env.example`

- [ ] **步骤 1：README**

删除订阅/积分/订单、定时任务、管理后台 LLM Provider、用户级 LLM 设置相关段落；"LLM 配置"一节改写为"前端本地配置（keyVault + 自定义 Base URL/模型），分析请求即配置"；路由表去掉 `subscription`、`scheduled_task`、`llm_config`、`user_llm_settings`。

- [ ] **步骤 2：AGENTS.md**

同样的路由/表/功能清单更新；"任务执行"去掉 scheduler/watchdog 之外的定时任务描述；环境变量表去掉 `TURNSTILE_*` 之外无须改动（Turnstile 保留）。

- [ ] **步骤 3：.env.example**

删除与定时任务/订阅相关的变量（如有），保留 Turnstile/SMTP/LLM 超时与缓存等。

- [ ] **步骤 4：Commit**

```bash
git add README.md AGENTS.md .env.example
git commit -m "docs: 同步功能下线后的 README/AGENTS/.env.example"
```

---

## 任务 11：提交与推送

- [ ] **步骤 1：确认工作区干净**

```bash
git status --short
```

预期：无输出

- [ ] **步骤 2：推送 GitHub 主干与环境镜像**

```bash
git push git@github.com:BSTester/TradingAgentsWeb.git main
git push origin main
```

预期：两次均为 fast-forward 成功

- [ ] **步骤 3：核验**

```bash
git ls-remote git@github.com:BSTester/TradingAgentsWeb.git refs/heads/main
git rev-parse HEAD
```

预期：两个哈希一致

---

## 完成标准

1. 前端 `typecheck` / `lint`（0 error）/ `test:run` / `build` 全绿
2. 后端 `pytest` 全绿
3. 残留关键词扫描 0 命中（历史迁移白名单除外）
4. 迁移脚本在 SQLite 上实测：6 张表与 `users.credit_balance` 已删除、应用可导入启动
5. 分析与报告链路仍可用：带 `api_key` 的请求正常发起；缺少 `api_key` 返回 400 且不建任务
6. 代码已推送到 GitHub `main` 与环境镜像
