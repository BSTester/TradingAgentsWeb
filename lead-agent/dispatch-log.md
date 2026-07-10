# Leader 派发 / 合并日志（WS-12 Epic）

> 维护人：开发组长（Leader）。每条记录一个 issue 的派发 → 分支 → 合并 → 状态。
> 双源真相：issue 状态（board）+ 分支合并（repo）。issue `done` 且分支已并入 main 才算真正完成。

## 合并记录

| Issue | 标题 | 角色 | 分支 | PR | Merge Commit | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| WS-19 | [design] 整体 UI 原型 + ui-spec（旧版，已进入 rework） | designer | `agent/ux/95dabf7a` | [#11](https://github.com/BSTester/TradingAgentsWeb/pull/11) | `2d5d1ac` | ⚠️ merged 2026-07-07，但内容已因 WS-20 过期，见下方 stage 1 rework |
| WS-20 | [rework] WS-12 需求更新：用户 KEY 改为前端存储 | PM | `agent/agent/2f09bcb1` | [#13](https://github.com/BSTester/TradingAgentsWeb/pull/13) | `250f168` | ✅ merged to main 2026-07-07 |
| WS-13 | [story-001] AI 设置契约 — 后端 openapi + tech-spec（rework） | backend | `agent/agent/3b3cd1be` | [#16](https://github.com/BSTester/TradingAgentsWeb/pull/16) | `133fc39` | ✅ merged to main 2026-07-07（旧 PR #12 已关闭，远端分支已删除） |
| WS-15 | [story-003·后端] 系统默认 Provider API（rework：契约对齐 B1/B2/B3） | backend | `agent/agent/dfdcd22a` | [#22](https://github.com/BSTester/TradingAgentsWeb/pull/22) | `d9ae341` | ✅ rework merged to main 2026-07-08（旧 PR #18 `c74706a` 有契约缺陷，由 WS-31 联调 QA 发现）；分支已并入、远端已删、PR 标 MERGED；WS-31 复测通过 2026-07-08（QA pass：B1/B2/B3 验证修复），WS-15 置 `done` |
| WS-31 | [story-003·前端] 管理员系统默认 Provider 配置页 | frontend | `agent/agent/20356240` | [#20](https://github.com/BSTester/TradingAgentsWeb/pull/20) | `9240c18` | ✅ merged to main 2026-07-08（独立页 `/admin/system-default-provider`：脱敏摘要/active 选择+inactive 置灰/二次确认/失败提示/空态/目录入口；非管理员重定向无写控件；E6/E7 契约落地）。`--no-ff` 合并，无冲突；远端分支已删、PR 标 MERGED。QA 复测 pass（10/10 前端 + build + 6/6 后端契约，B1/B2/B3 验证修复）；BUG-WS31-002 裁归 WS-16；1 个非阻塞 lint warning（`page.test.tsx` 未用 import）。残余风险：本轮未做浏览器 E2E（插件不可用），结论基于单测/构建/契约测试+源码归因 |

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
- WS-15 后端系统默认 Provider rework 合并（2026-07-08）：WS-31 联调 QA 报告 main 上 WS-15（旧 PR #18，commit `c74706a`）与 WS-13 权威契约三处背离，Leader 重开 WS-15 派回后端 rework。后端在 PR [#22](https://github.com/BSTester/TradingAgentsWeb/pull/22)（分支 `agent/agent/dfdcd22a`，commit `cd5c004`）修复：**B1** inactive-as-default 状态码 409→**400** + 文案 `cannot set inactive provider as system default`；**B2** 系统默认业务错误 `detail` 由嵌套对象 `{error:{...}}` 改为**字符串**（消除前端 `[object Object]`，回归仓库既有 string-`detail` 约定）；**B3** 管理员/公开摘要补齐 `has_api_key`/`api_key_masked`（`mask_api_key` 仅暴露前缀+尾 4，明文 KEY 始终不返回）。`backend/openapi.yaml` 同步对齐：PUT inactive→400 / not-found→404 / credential·base_url 缺失→409，均字符串 `detail`；管理员 + 公开两份摘要 schema 补 `has_api_key`/`api_key_masked`。
- Leader 独立复核（2026-07-08）：checkout main，逐项核 diff（service/schemas/openapi/tests）+ 新建 `.venv` 装最小依赖跑 `tests/test_system_default_provider.py` → **6 tests OK**（inactive 400+字符串、credential 缺失字符串 detail、admin/public 摘要含 `has_api_key`/`api_key_masked` 且无明文 `api_key`、`/api/config` 公开摘要、默认唯一切换不泄密）。`git merge --no-ff` → merge commit `d9ae341` 已并入 main，远端分支 `agent/agent/dfdcd22a` 已删除，PR #22 GitHub 标记 MERGED。
- **B3 契约裁决（Leader，2026-07-08）**：公开摘要暴露 `api_key_masked`（系统默认 KEY 的掩码尾号）**可接受并追认**——系统默认 KEY 为后端共享资源（非用户私有密钥），掩码仅前缀+尾 4（行业惯例），明文永不外泄，满足「系统默认 KEY 不外泄」核心不变量；前端 `SystemDefaultProviderSummary`（WS-31）亦期望该字段以渲染「当前默认」卡片/来源提示。后端 dev 已同步改 openapi，Leader 追认此契约变更。（注：此条与上方 WS-18 备注的「系统默认摘要移除尾号」取向不同——WS-18 是**用户侧**公开摘要，WS-15 此处是**系统默认 provider** 摘要且 KEY 存后端，二者模型不同，不冲突。）
- WS-15 现状：分支已并入 main，issue 置 `in_review` 待 QA 复测。已解除 WS-31 `blocked`，重新派 QA 基于修复后的 main 复测 story-003 前后端联调；WS-15 待 WS-31 复测通过后置 `done`。WS-14（story-002 后端，PR #19）仍 `in_review` 待处理，本 run 未触及其范围。
- WS-31 合并 + story-003 收口（2026-07-08）：QA 复测 **pass**（基线 main `1f321da` + 前端分支 `agent/agent/20356240`；`npm run test:run` 10/10、`npm run build` 通过、`pytest tests/test_system_default_provider.py` 6/6；B1 inactive 设默认→400+字符串、B2 错误 `detail`→字符串、B3 摘要补 `has_api_key`/`api_key_masked` 且无明文 KEY，均验证修复）。裁决：BUG-WS31-002（普通用户分析表单未展示系统默认来源）归 **WS-16 / story-004**，不阻塞 WS-31；lint 3 errors 均非 WS-31 引入，WS-31 仅引入 1 个非阻塞 warning（`page.test.tsx` 未用 import）。Leader checkout main → `git merge --no-ff origin/agent/agent/20356240`（merge commit `9240c18`，无冲突，14 文件 +4051/-459）→ `push HEAD:main` → 删远端分支 → PR [#20](https://github.com/BSTester/TradingAgentsWeb/pull/20) 标 MERGED。**WS-31、WS-15 置 `done`。** 残余风险：本轮未做浏览器 E2E（插件不可用），结论基于单测 + 生产构建 + 后端契约测试 + 源码归因。story-003 前后端闭环完成。

## WS-32 仓库分支清理 + prompt_loader 测试对齐（2026-07-07 ~ 2026-07-08）

| Issue | 标题 | 角色 | 分支 | Merge Commit | 状态 |
| --- | --- | --- | --- | --- | --- |
| WS-32 | 清理仓库多余分支：删已合并 + 合并 WS-4/WS-15 未整合线 | 运维（清理）+ 后端（整合） | WS-4 `agent/agent/83516268` 权威终态 + WS-15 `agent/agent/73f3fcfd` 等 → 直推 | `0b92016` | ✅ merged to main 2026-07-07（WS-4 内核升级/conversation agent/skills/Docker + WS-15 system-default provider；解冲突保留 WS-11 OpenAI base URL 默认值 + WS-15 provider 字段；无 force-push；冗余远端分支 `d93c5ee8`/`73f3fcfd` 已删；origin 仅剩 `main` + 3 条不在范围的 story 分支） |
| WS-32 | 对齐 prompt_loader stale 测试到现行 API | 后端 | `agent/agent/f4473be2`（commit `a1193e1`） | `09bb055` | ✅ merged to main 2026-07-08（test-only，生产 API 未动；pytest 29 passed/0 failed；远端分支已删） |

- WS-32 收口（2026-07-08）：① 运维清理已合并分支 + 后端将未整合的 WS-4/WS-15 并入 main（`0b92016`），Leader checkout 复核 + 派 QA 在 `0b92016` 实跑 pytest；② QA 报 5 个失败，Leader 独立比对 `24edec0..0b92016` 确认这 5 个为 prompt/tool API 演进后的历史 stale 测试、非本次集成引入（`test_system_prompt_parameter.py`/`test_tool_documentation.py` 及 `prompt_loader.py` 合入前后未改）；③ 应用户「对齐一下」指示，派后端在 `f4473be2` 把 `tests/` 旧调用对齐到现行 `load_user_prompt_template(user_id, agent_type)->str`、`generate_tool_documentation()->str`（docstring 明示为有意重构：prompt 仅返核心策略、工具文档运行时注入）；④ Leader 独立复核——diff 仅 `tests/`（生产零风险）+ 合并后 main 实跑 `pytest tests` **29 passed/0 failed**，直推合并 `09bb055`、远端分支删除。WS-32 全部目标达成并验证，待用户确认后置 `done`。

## WS-44 / WS-45 / WS-46 · story-002（用户自定义 LLM provider / 本地 KEY 管理）合并（2026-07-10）

| Issue | 标题 | 角色 | 分支 | Merge Commit | 状态 |
| --- | --- | --- | --- | --- | --- |
| WS-45 | [story-002] rebase 前后端两分支到最新 main 并跑测试 | 全栈 | 后端 `agent/agent/a291727a-backend`@`f451069` + 前端 `agent/agent/a291727a-1783675413`@`bfad2de` | — | ✅ rebase done（Leader 复核） |
| WS-46 | [WS-44/QA] story-002 端到端验收 | QA | rebase 后两分支 + `qa/ws46-story002-combined` 集成装配 | — | ✅ conditional pass，无阻塞缺陷 |
| WS-44 | TradingAgentsWeb：评估处理两个未合并功能分支 | Leader | 后端 `a291727a-backend` + 前端 `a291727a-1783675413` → `--no-ff` 并入 main | `c1f456f`(后端) + `c214e1c`(前端) | ✅ merged to main 2026-07-10（fast-forward 推送 `e6cc967..c214e1c`，无 force） |

- 评估结论（WS-44）：两分支是 story-002 实现、功能仍需，**保留 + rebase 合并**（非删除）。原分支 `agent/agent/1fecec46`（前端 WS-30）+ `agent/agent/323e9974`（后端 WS-14）基于旧 main（落后 190 提交），经 WS-45 rebase 到最新 main、冲突按加性并集解决、未改 main 权威契约、保留 BUG-001 与 key-persistence fix，推送 rebase 后新分支 `a291727a-backend`/`a291727a-1783675413`；原分支留作备份。
- QA（WS-46）：后端 scoped `pytest` 7 passed、前端 `vitest` 33 passed + `npm run build` 通过、Chromium UI harness 通过（provider 列表 / 本地 KEY save·replace·clear / `/test` 临时 KEY / `provider_type=custom` 无 `api_key` / set-default PATCH / 删本地 KEY 清理）。裁决 **conditional pass**，无 story-002 阻塞缺陷；final release 须等 Leader 合并两分支 + main smoke 通过。
- Leader 合并 + main smoke（2026-07-10）：checkout main，两分支均含 main 为祖先（rebase 干净）→ `git merge --no-ff` 先后端后前端，**无冲突**（13 + 21 文件，文件集基本不相交：`backend/` + `tests/` vs `web/frontend/`）→ push `lead/ws44-story002-merge:main`（fast-forward `e6cc967..c214e1c`，无 force）。main smoke：① 合并树静态校验——工作树干净、新模块 `py_compile` OK、`backend/openapi.yaml` 合法 YAML 且含 E1–E5（`/api/user/llm-settings` CRUD + `/providers/{id}/test`）、前端 story-002 文件齐全；② 后端 scoped `pytest tests/test_user_llm_settings_routes.py tests/test_analysis_key_persistence.py` 在最小 venv 实跑 **7 passed**（与 dev/QA 一致；中途 pytz/email-validator 缺失为本机 venv 环境问题、补装即过，非代码缺陷）；③ 前端树 == QA 已验收 tip `bfad2de`（合并未改前端字节），重跑需完整 Next.js 工具链（本 ARM 主机不便），沿用 QA 的 33 vitest + build + UI harness pass。
- 分支清理：rebase 分支 `a291727a-backend`/`a291727a-1783675413` 已并入 main；**删除属破坏性操作**，原分支与 rebase 分支的删/留按 WS-44 约定待 Penn 确认后再处理（本轮不删）。
- **WS-44、WS-45、WS-46 置 `done`。** story-002 前后端闭环并入 main；story-004（WS-16）/ story-005（WS-17）的前置依赖 story-002 就绪。
