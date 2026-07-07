# Leader 派发 / 合并日志（WS-12 Epic）

> 维护人：开发组长（Leader）。每条记录一个 issue 的派发 → 分支 → 合并 → 状态。
> 双源真相：issue 状态（board）+ 分支合并（repo）。issue `done` 且分支已并入 main 才算真正完成。

## 合并记录

| Issue | 标题 | 角色 | 分支 | PR | Merge Commit | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| WS-19 | [design] 整体 UI 原型 + ui-spec（旧版，已进入 rework） | designer | `agent/ux/95dabf7a` | [#11](https://github.com/BSTester/TradingAgentsWeb/pull/11) | `2d5d1ac` | ⚠️ merged 2026-07-07，但内容已因 WS-20 过期，见下方 stage 1 rework |
| WS-20 | [rework] WS-12 需求更新：用户 KEY 改为前端存储 | PM | `agent/agent/2f09bcb1` | [#13](https://github.com/BSTester/TradingAgentsWeb/pull/13) | `250f168` | ✅ merged to main 2026-07-07 |
| WS-13 | [story-001] AI 设置契约 — 后端 openapi + tech-spec（rework） | backend | `agent/agent/3b3cd1be` | [#16](https://github.com/BSTester/TradingAgentsWeb/pull/16) | `133fc39` | ✅ merged to main 2026-07-07（旧 PR #12 已关闭，远端分支已删除） |

## Stage 1 契约/设计 rework（WS-20 触发，2026-07-07）

用户追加决策：**用户 KEY 存前端 `localStorage`，不落后端**；系统默认 provider KEY 仍后端。PM 在 WS-20/PR #13（merge `250f168`）更新了 `pm/requirements.md`、`pm/stories/*`、`pm/story-map.md`。原 stage 1 三件均按旧契约（后端存/脱敏用户 KEY）产出，全部过期，需基于更新后的 `pm/` 重做。

| Issue | 角色 | 旧交付 | rework 要点 | 状态 |
| --- | --- | --- | --- | --- |
| WS-13 | 后端 | openapi + backend-tech-spec（PR #12，**未合并，勿合并**） | 去除用户 KEY 后端持久化（`api_key_encrypted`）、`has_api_key`/`api_key_masked`；`/test` 临时收 KEY 不持久化；`resolve_llm_config` = 请求级 KEY > 系统默认 > 报错；系统默认 KEY 仍后端不外泄 | ✅ rework merged — PR [#16](https://github.com/BSTester/TradingAgentsWeb/pull/16)（分支 `agent/agent/3b3cd1be`，merge `133fc39`），Leader 复核通过 2026-07-07 |
| WS-18 | 前端 | api-contract + frontend-tech-spec（PR #10，已并入 main，内容过期） | 镜像后端 openapi：无用户 KEY 类型；KEY 由前端 `localStorage` 按 provider 管理、随请求下发、换浏览器重填；分析表单不回填明文 KEY | ⚠️ rework（PR #14 / `a7653d4`）已合并，但 Leader 在 WS-13 复核中发现**系统默认摘要字段漂移**（详见备注），已重开 issue 并派回前端对齐 |
| WS-19 | 设计 | 原型 + ui-spec（PR #11，已并入 main，内容过期） | KEY 改为本地保存/替换/清除/换浏览器重填交互；来源提示“个人配置（本地 KEY）/系统默认”；空/错误态：本浏览器未存 KEY | ✅ rework merged — PR [#15](https://github.com/BSTester/TradingAgentsWeb/pull/15)（分支 `agent/ux/rework`，merge `6c1ff38`），12 屏高保真 + ui-spec，Leader 复核通过，2026-07-07 |

## 备注

- WS-20（PM rework）由 PM 在 PR #13 交付，Leader 逐条核对 rework 范围（§3/§6/§7/§9 + 5 个 story + story-map）全部落实，`git diff --check` 通过，merge commit `250f168` 已并入 main，远端分支已删除。
- WS-13 的旧 PR #12（`agent/agent/d93c5ee8`）基于过期需求，**不予合并**；后端 rework 时更新或替换该 PR。
- 协调约定不变：以后端 `backend/openapi.yaml` 为权威源，前端镜像；前端可在 openapi 落地前先按更新后的 `pm/requirements.md` 起草，落地后对齐。
- Stage 1 rework 三件完成后，Leader 再复核合并，然后推进 stage 2（WS-14/WS-15）。
- WS-19 rework 复核（2026-07-07）：Leader 依据 rework 验收清单逐项核对 PR #15——原型 12 屏覆盖 profile AI 设置（本地 KEY）/ 独立管理员默认页 / 分析表单三处主流程 + 关键空/错误态（含「本浏览器未存 KEY」），ui-spec 明确本地 KEY 保存/替换/清除/换浏览器重填 + 来源提示 + 二次确认、列表/来源/记录不展示明文 KEY，5 项范围决策（含「用户 KEY 前端存储」）全部落实，旧脱敏尾号文案已移除。merge commit `6c1ff38` 已并入 main，远端分支已删除。
- Stage 1 rework 进度（repo 侧）：WS-18（前端，PR #14 / `a7653d4`）+ WS-19（设计，PR #15 / `6c1ff38`）已并入 main；待 WS-13（后端 openapi + tech-spec）rework 完成并复核合并后，即可推进 stage 2。
- WS-13 后端契约 rework 复核（2026-07-07）：Leader 依据 rework 验收清单逐项核对 PR #16——7 个端点（E1–E5 用户 provider 元数据 CRUD + `/test`、E6/E7 管理员系统默认、`/api/config`、`/api/analyze`）与 requirements M2/M4/M5 对齐；**全文无** `has_api_key`/`api_key_masked`/`api_key_encrypted`（用户 KEY 零后端持久化）；`api_key` 仅在 `/test` 与 `/api/analyze` 以 `writeOnly` 出现、标注「后端不持久化」；`resolve_llm_config` 优先级 = 请求级 KEY > 系统默认 > 结构化错误，且「显式 provider 未随请求带 KEY」返回 `REQUEST_PROVIDER_KEY_REQUIRED` 不静默兜底；系统默认 KEY 仅 `credential_configured` 布尔、不对普通用户/日志/记录外泄；错误码区分 `SYSTEM_DEFAULT_PROVIDER_NOT_SET` / `REQUEST_PROVIDER_KEY_REQUIRED` / `REQUEST_PROVIDER_INVALID` / `INVALID_BASE_URL`；旧 `LegacyLLMConfigSummary` 已剥除 `last_api_key`。openapi YAML parse + 64 `$ref` 解析 OK。merge commit `133fc39` 已并入 main，远端分支 `agent/agent/3b3cd1be` 已删除。**WS-13 置 `done`。**
- WS-18 前端契约漂移处置（2026-07-07）：WS-13 后端 openapi（权威）与 WS-19 设计一致——**系统默认摘要彻底移除 `has_api_key`/`api_key_masked`/脱敏尾号**；但 WS-18 前端 `api-contract.md`（PR #14）在系统默认摘要中仍保留这两个字段（三源中唯一例外，会被 WS-15 管理员默认页实现撞到）。Leader 已重开 WS-18→`in_progress`、指派回前端 `1381815f`，派发**小范围对齐 rework**：公开摘要删 `has_api_key`/`api_key_masked` 只留元数据；管理员摘要改用 `credential_configured`（无明文/无尾号）；E8 `/api/analyze` 请求体按 `AnalysisRequest` 对齐字段名。**Stage 2（WS-14/WS-15）等 WS-18 对齐合并后再推进**，确保 stage 2 从一致的三源契约起步。
