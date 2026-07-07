# Leader 派发 / 合并日志（WS-12 Epic）

> 维护人：开发组长（Leader）。每条记录一个 issue 的派发 → 分支 → 合并 → 状态。
> 双源真相：issue 状态（board）+ 分支合并（repo）。issue `done` 且分支已并入 main 才算真正完成。

## 合并记录

| Issue | 标题 | 角色 | 分支 | PR | Merge Commit | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| WS-19 | [design] 整体 UI 原型 + ui-spec（旧版，已进入 rework） | designer | `agent/ux/95dabf7a` | [#11](https://github.com/BSTester/TradingAgentsWeb/pull/11) | `2d5d1ac` | ⚠️ merged 2026-07-07，但内容已因 WS-20 过期，见下方 stage 1 rework |
| WS-20 | [rework] WS-12 需求更新：用户 KEY 改为前端存储 | PM | `agent/agent/2f09bcb1` | [#13](https://github.com/BSTester/TradingAgentsWeb/pull/13) | `250f168` | ✅ merged to main 2026-07-07 |

## Stage 1 契约/设计 rework（WS-20 触发，2026-07-07）

用户追加决策：**用户 KEY 存前端 `localStorage`，不落后端**；系统默认 provider KEY 仍后端。PM 在 WS-20/PR #13（merge `250f168`）更新了 `pm/requirements.md`、`pm/stories/*`、`pm/story-map.md`。原 stage 1 三件均按旧契约（后端存/脱敏用户 KEY）产出，全部过期，需基于更新后的 `pm/` 重做。

| Issue | 角色 | 旧交付 | rework 要点 | 状态 |
| --- | --- | --- | --- | --- |
| WS-13 | 后端 | openapi + backend-tech-spec（PR #12，**未合并，勿合并**） | 去除用户 KEY 后端持久化（`api_key_encrypted`）、`has_api_key`/`api_key_masked`；`/test` 临时收 KEY 不持久化；`resolve_llm_config` = 请求级 KEY > 系统默认 > 报错；系统默认 KEY 仍后端不外泄 | `in_progress`（已派回后端） |
| WS-18 | 前端 | api-contract + frontend-tech-spec（PR #10，已并入 main，内容过期） | 镜像后端 openapi：无用户 KEY 类型；KEY 由前端 `localStorage` 按 provider 管理、随请求下发、换浏览器重填；分析表单不回填明文 KEY | `in_progress`（已派回前端） |
| WS-19 | 设计 | 原型 + ui-spec（PR #11，已并入 main，内容过期） | KEY 改为本地保存/替换/清除/换浏览器重填交互；来源提示“个人配置（本地 KEY）/系统默认”；空/错误态：本浏览器未存 KEY | `in_progress`（已派回设计师） |

## 备注

- WS-20（PM rework）由 PM 在 PR #13 交付，Leader 逐条核对 rework 范围（§3/§6/§7/§9 + 5 个 story + story-map）全部落实，`git diff --check` 通过，merge commit `250f168` 已并入 main，远端分支已删除。
- WS-13 的旧 PR #12（`agent/agent/d93c5ee8`）基于过期需求，**不予合并**；后端 rework 时更新或替换该 PR。
- 协调约定不变：以后端 `backend/openapi.yaml` 为权威源，前端镜像；前端可在 openapi 落地前先按更新后的 `pm/requirements.md` 起草，落地后对齐。
- Stage 1 rework 三件完成后，Leader 再复核合并，然后推进 stage 2（WS-14/WS-15）。
