# WS-12 用户自定义 AI 提供商/KEY 配置 + 系统默认提供商需求规格

## 1. 背景

- Epic: WS-12
- 日期: 2026-07-07
- 优先级: high
- 仓库: `TradingAgentsWeb`
- 来源: 用户在 WS-11 之后提出的新需求，WS-11 已仅修复 OpenAI `baseUrl` 默认值，本需求为全新特性。

用户原始诉求:

> 前端也需要支持用户自定义配置 AI 提供商和 KEY，后台支持配置一个系统默认提供商。

## 2. 产品目标

1. 普通用户可以在前端持久化管理自己的 AI 提供商配置，并在浏览器 `localStorage` 按 provider 维度保存自己的 API KEY，不再只依赖分析表单里的临时输入或“上次使用”缓存。
2. 管理员可以在后台配置一个系统默认 AI 提供商；当用户未配置自己的 AI 提供商时，分析流程使用该默认值兜底。
3. 分析、定时任务和配置加载路径具备一致的 LLM 配置解析顺序，避免 provider、base URL、model、API KEY 之间错配。
4. 用户 API KEY 不在后端持久化、不由后端回填；分析请求需要由前端从 `localStorage` 取出对应 KEY 并随请求下发。系统默认 provider 的 KEY 仍由后端保存并且不对普通用户外泄。

## 3. 已确认决策与保留建议

以下决策会影响实现范围。用户已确认 1-4 项；第 5 项已按用户追加决策更新。

| 决策点 | 状态 | 方案 | 原因 | 若改选的影响 |
| --- | --- | --- | --- | --- |
| 用户 KEY 模型 | 已确认 | 用户 KEY 存前端 `localStorage`，后端只保存 provider 元数据；支持多 Provider 多 KEY，不沿用单一 `last_api_key` 作为正式模型 | 单 KEY 容易与 provider/base URL 错配；用户已确认 KEY 前端存储，不进入后端持久化链路 | 若只做单 KEY，UI 工作量更小，但无法持久管理多个 provider；若改回后端存 KEY，需要重做安全与 API 契约 |
| 用户配置入口 | 已确认 | 放在 `profile` 页的“AI 设置”模块，可由路由或折叠区承载 | 现有 `profile` 只有账户/密码设置，天然承载用户级配置；无需新导航体系 | 若改为独立“AI 设置”页，需要新增导航入口和路由设计 |
| 系统默认语义 | 已确认 | 仅兜底，不强制覆盖用户配置 | 符合“用户自定义优先”的预期，降低管理员误操作影响 | 若支持强制覆盖，需要额外权限提示、审计和用户侧禁用状态 |
| 管理员入口 | 已确认 | 新建独立的管理员“系统默认 Provider”配置页，在现有 admin 导航下新增入口 | 用户已明确选择独立页面；系统默认是单独运营配置，和 Provider/Model 目录 CRUD 分开可降低误操作 | 若改为集成在 `admin/llm-config`，导航更少但会把目录维护和默认兜底策略混在同一页面 |
| API KEY 回传 | 已确认 | 用户 KEY 不经后端持久化，故无后端回传/脱敏字段问题；系统默认 KEY 仍按后端不外泄、不入普通用户响应处理 | 现有 `/api/user/config` 会返回 `last_api_key` 明文，需避免继续扩大风险；用户 KEY 改由前端保存和下发 | 若后端继续保存用户 KEY，需要重新引入加密存储、脱敏响应和密钥轮换范围 |
| 用户 KEY 前端存储 | 已确认 | 用户 KEY 前端存储，反转 §9 localStorage 限制（用户已确认）；该反转仅适用于用户自己的 KEY，不适用于系统默认 provider KEY | 满足用户追加决策，并将用户 KEY 从后端数据面移出 | 需要前端明确提示“换浏览器/清缓存需重填 KEY”，并防止日志、错误和分析记录泄露请求中的 KEY |

## 4. 现有基础设施梳理

后端:

- `web/backend/models.py`
  - `UserConfig` 当前含 `last_llm_provider`、`last_shallow_thinker`、`last_deep_thinker`、`last_backend_url`、`last_api_key`，定位是上次分析配置缓存。
  - `LLMProvider` / `LLMModel` 是系统级 Provider/Model 目录。
- `web/backend/routes/llm_config_routes.py`
  - 已有管理员级 Provider / Model CRUD 和 `/test-connection` 能力，路由前缀为 `/api/admin/llm`。
- `web/backend/routes/user_config_routes.py`
  - `/api/user/config` 当前读写 `UserConfig`，并返回明文 `last_api_key`。
- `web/backend/routes/config_routes.py`
  - `/api/config` 面向前端返回 active providers 和 models。
  - `/api/validate-key` 已按 provider/base URL 验证 API KEY。
- `web/backend/routes/analysis_routes.py`
  - 分析启动时把请求值写回 `UserConfig`。
  - 当前使用 `request.api_key or user_config.last_api_key` 作为单一 KEY 兜底。
- 迁移/种子:
  - `scripts/init_llm_config.py`
  - `web/backend/migrations/add_llm_providers_models.py`

前端:

- `web/frontend/src/app/admin/llm-config/page.tsx`
  - 管理员 LLM Provider/Model 目录管理页。
- `web/frontend/src/components/analysis/AnalysisConfigForm.tsx`
  - 分析时选择 provider/model/key，并加载 `useUserConfig` 的上次配置。
- `web/frontend/src/hooks/useUserConfig.ts`
  - 服务端用户配置 hook，当前含 `last_api_key`。
- `web/frontend/src/app/profile/page.tsx`
  - 个人页目前只有账户信息和密码设置，没有 LLM 配置入口。

## 5. 范围边界

### In Scope

- 用户可保存、查看、编辑、删除多个 AI provider 配置。
- 每个用户 provider 配置至少包含以下后端元数据和前端 KEY 状态:
  - provider 标识或用户自定义 provider 名称
  - 显示名称
  - base URL
  - 默认 shallow/deep model
  - 是否启用
  - 是否作为该用户默认 provider
  - 最近验证状态/时间
  - 前端按 provider 维度在 `localStorage` 保存/替换/清除用户 KEY，后端不落库
- 用户可基于系统 active provider 建立个人配置，也可创建 OpenAI-compatible 自定义 provider 配置。
- 管理员可将一个 active provider 设置为系统默认 provider。
- 分析表单默认读取“有效 LLM 配置”，并可在单次请求中临时覆盖。
- 分析后端和定时任务创建路径统一使用同一个配置解析规则。
- 明确兼容现有 `UserConfig.last_*` 字段，避免破坏已保存的上次分析偏好。

### Out of Scope

- 不实现多租户组织级默认 provider。
- 不实现管理员强制覆盖普通用户配置。
- 不实现 provider 费用、额度、调用量统计。
- 不实现完整密钥轮换审计系统，只要求基础更新时间、验证状态和错误提示。
- 不改变已有 TradingAgents 分析引擎的核心分析流程。

## 6. 功能模块拆解

### M1. LLM 配置数据模型与迁移

- 新增用户级 LLM provider 配置存储，推荐使用独立表承载 provider 元数据；不得扩展 `UserConfig.last_api_key` 或新增用户 KEY 后端存储列。
- 推荐字段仅包含非密钥元数据:
  - `id`
  - `user_id`
  - `provider_name`
  - `display_name`
  - `base_url`
  - `shallow_model`
  - `deep_model`
  - `is_enabled`
  - `is_default`
  - `last_validated_at`
  - `last_validation_status`
  - `created_at`
  - `updated_at`
- 系统默认 provider 推荐集成到 `LLMProvider`，新增 `is_default` 字段，并保证同一时间最多一个 active provider 为默认。
- 若默认模型也需要显式配置，可在后续补充 `LLMModel.is_default` 或系统设置记录；本期默认 provider 是必须项，默认模型为可选增强。

### M2. 用户 AI 设置 API 与后端解析服务

- 新增用户级 API:
  - `GET /api/user/llm-settings`
  - `POST /api/user/llm-settings/providers`
  - `PATCH /api/user/llm-settings/providers/{id}`
  - `DELETE /api/user/llm-settings/providers/{id}`
  - `POST /api/user/llm-settings/providers/{id}/test`
- 用户 AI 设置 CRUD 仅保存 provider 元数据，不涉及用户 KEY 存储、`has_api_key` 或 `api_key_masked` 字段。
- `POST /api/user/llm-settings/providers/{id}/test` 由前端临时传入 KEY 做连通性验证；后端只返回验证结果和 `last_validated_at` / `last_validation_status`，不得持久化该 KEY。
- 新增后端解析服务，建议命名为 `resolve_llm_config`:
  1. 请求级 KEY（前端从 `localStorage` 或一次性输入下发）+ provider/base URL/model 优先。
  2. 若请求未携带 KEY，使用系统默认 provider 的后端配置兜底。
  3. 若仍无法获得有效 KEY/base URL/provider，返回可操作错误。
- 用户级 KEY 不再从后端读取；若用户显式选择个人 provider 但前端未下发 KEY，不应静默使用系统默认 provider，应提示用户在当前浏览器补充 KEY 或切换到系统默认 provider。

### M3. 用户前端 AI 设置入口

- 在 `profile` 页新增“AI 设置”模块，或由 profile 入口进入独立设置视图。
- 用户可:
  - 查看已保存 provider 配置列表和默认标记。
  - 新增 provider 配置。
  - 编辑 base URL、默认模型等 provider 元数据。
  - 在浏览器本地保存、替换、清除该 provider 的 API KEY。
  - 测试连接。
  - 设置某个配置为默认。
  - 删除配置。
- API KEY 输入后仅写入前端 `localStorage`，按 provider 维度管理；换浏览器、清除站点数据或无痕模式下需要用户重新填写。
- 启动分析时，前端从 `localStorage` 读取当前 provider 的用户 KEY 并随请求下发；后端不持有、不回填用户 KEY。

### M4. 管理员系统默认 Provider

- 新建独立的管理员“系统默认 Provider”配置页，并在现有 admin 导航下新增入口。
- 页面从 active providers 中选择系统默认 provider，展示当前默认 provider 的非敏感摘要，并在保存前进行二次确认。
- 管理员可将一个 active provider 设置为系统默认 provider。
- 如果要设置 inactive provider 为默认，后端应拒绝并返回明确错误。
- `/api/config` 可返回系统默认 provider 的非敏感摘要，供前端默认选中和展示来源。
- 普通用户永远不能读取系统默认 provider 的明文 KEY。

### M5. 分析与定时任务集成

- `AnalysisConfigForm` 加载用户 AI 设置与系统默认摘要，默认选中有效 provider。
- 用户启动分析时，前端必须把当前 provider 的用户 KEY（来自 `localStorage` 或一次性输入）随请求下发；若没有用户 KEY，则后端才使用系统默认 provider 兜底。
- 分析记录、定时任务记录仍可保存执行时使用的 provider/base URL/model 信息；不得保存请求中的用户 KEY 明文，系统默认 KEY 也不得写入普通用户可见记录。
- 旧的 `last_llm_provider`、`last_backend_url`、`last_api_key` 仅作为迁移/兼容来源，不再作为正式优先级模型。

### M6. 安全、兼容与验证

- 用户 KEY 存前端 `localStorage`（用户已确认，反转原安全条目），后端不得为用户 KEY 新增持久化存储；系统默认 KEY 仍必须加密存储或接入项目既有密钥保护机制。
- 增加迁移策略:
  - 若用户只有 `UserConfig.last_api_key` 和 `last_llm_provider`，首次访问 AI 设置时可提示在当前浏览器重新保存 KEY 到 `localStorage`，不得将旧 KEY 迁移到新的后端用户密钥表。
  - 迁移后保留旧字段用于上次分析表单偏好，避免立刻破坏历史逻辑。
- 增加后端单元/集成测试覆盖解析顺序。
- 增加前端交互测试或手工 QA 用例覆盖保存、验证、默认、删除、分析启动。

## 7. 配置优先级

推荐优先级:

1. 请求级 KEY（前端从 `localStorage` 或一次性输入下发）+ provider + base URL + model。
2. 系统默认 provider（后端保存的默认 KEY 和非敏感配置）。
3. 无可用配置时阻止分析并返回可操作错误。

关键约束:

- 用户 KEY 经请求下发，不再作为独立后端优先级层。
- 系统默认只兜底，不覆盖带有请求级 KEY 的用户配置。
- 用户显式选择个人 provider 但前端未下发 KEY 时，不能偷偷切换到系统默认 provider。
- 后端不需要也不应该回填用户 KEY；普通用户也不能读取系统默认 KEY。

## 8. Epic 级验收标准

- [ ] 普通用户可在前端持久化管理至少两个 provider 配置；后端保存独立 base URL 和模型偏好，浏览器 `localStorage` 按 provider 维度保存对应 API KEY。
- [ ] 普通用户可设置自己的默认 provider；刷新页面后仍可看到配置摘要和本浏览器 KEY 状态，换设备/换浏览器登录后需重新填写用户 KEY。
- [ ] 管理员可在独立的管理员“系统默认 Provider”配置页设置一个 active provider 为系统默认 provider。
- [ ] 当用户无自定义配置时，分析表单默认展示系统默认 provider，启动分析时后端使用系统默认 provider 的配置。
- [ ] 当用户已有配置且前端随请求下发对应 KEY 时，分析表单和后端解析均优先使用请求级用户配置，不被系统默认覆盖。
- [ ] 单次分析请求显式传入 KEY 时，仅对本次请求优先；只有用户明确保存时才写入当前浏览器 `localStorage`。
- [ ] 用户 KEY 不通过用户配置 API 保存或回传；用户 AI 设置 API 不包含 `has_api_key`、`api_key_masked` 或明文 KEY 字段。
- [ ] 旧 `UserConfig.last_*` 缓存仍能用于上次分析偏好，且不会与新的 provider KEY 管理产生错配。
- [ ] 后端测试覆盖请求级 KEY、系统默认、无配置错误、显式 provider 缺 KEY 四类解析路径。
- [ ] 前端 QA 覆盖新增、编辑、测试连接、设为默认、删除、本地 KEY 保存/替换/清除、分析启动和无配置兜底。

## 9. 非功能要求

- 安全:
  - 用户 KEY 存前端 `localStorage`（用户已确认，反转原条目）；该 KEY 不得写入后端数据库、日志、错误信息、列表响应或分析记录明文。
  - 系统默认 KEY 仍遵守后端不外泄、不入日志、不对普通用户可见。
  - 普通用户 API 只能读取系统默认 provider 的非敏感摘要。
- 兼容:
  - 不破坏现有 Provider/Model 目录 CRUD。
  - 不破坏当前分析表单的基础使用路径。
- 性能:
  - 用户 AI 设置列表加载目标小于 500ms，不阻塞 profile 其他信息渲染。
  - 分析启动时配置解析应为少量数据库查询，可缓存 provider 目录和非敏感摘要；用户 KEY 只在浏览器本地和单次请求中出现。
- 可维护:
  - LLM 配置解析逻辑集中在一个后端服务函数中，避免分析、定时任务、未来入口各自实现不同优先级。

## 10. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 用户 KEY 明文回传延续旧行为 | 安全风险扩大 | 新用户 AI 设置 API 不接收、不保存、不返回用户 KEY；旧 `/api/user/config` 后续逐步移除明文 `last_api_key` 依赖 |
| provider/model/key 不一致 | 分析失败或调用错误模型 | 统一 `resolve_llm_config`，所有分析入口复用 |
| 系统默认与用户默认语义混淆 | 用户无法理解为什么使用某 provider | 前端展示“来自个人配置/系统默认”的来源摘要 |
| 独立系统默认配置页与 Provider 目录页割裂 | 管理员可能不知道先创建 provider 再设置默认 | 独立页只允许选择 active provider，并提供跳转到 Provider/Model 目录管理的入口 |
| 自定义 provider 模型列表不可知 | 用户无法选择模型 | 允许手动输入模型名，并在连接测试中验证可用性 |
| 用户清除浏览器数据或换设备 | 本地 KEY 丢失导致个人 provider 无法分析 | Profile 和分析表单提示“当前浏览器未保存 KEY”，引导重新填写或使用系统默认 |
| 旧数据迁移不完整 | 老用户首次使用体验异常 | 首次访问 AI 设置时展示重新保存 KEY 提示，并保留旧字段兼容非敏感偏好 |

## 11. 设计与交付说明

- Designer 应基于完整 `pm/requirements.md` 和 `pm/story-map.md` 做整体体验设计，不按 story 拆分设计任务。
- 前后端契约需要由 Leader 触发协调步骤，重点确认:
  - 用户 AI 设置 API 响应结构。
  - 系统默认 provider API 响应结构。
  - 分析启动请求是否继续允许 `api_key` 作为单次覆盖。
  - KEY 本地保存、替换、清除、换浏览器重填的交互文案。
- 工程 story 以垂直切片拆分，见 `pm/story-map.md` 和 `pm/stories/`。
