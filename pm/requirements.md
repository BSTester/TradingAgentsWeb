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

1. 普通用户可以在前端持久化管理自己的 AI 提供商配置和 API KEY，不再只依赖分析表单里的临时输入或“上次使用”缓存。
2. 管理员可以在后台配置一个系统默认 AI 提供商；当用户未配置自己的 AI 提供商时，分析流程使用该默认值兜底。
3. 分析、定时任务和配置加载路径具备一致的 LLM 配置解析顺序，避免 provider、base URL、model、API KEY 之间错配。
4. 已保存的 API KEY 不以明文回传给前端，前端只展示脱敏状态，后端负责解析和注入实际密钥。

## 3. 推荐决策与待确认范围

以下决策会影响实现范围。为保证下游团队可以推进，本规格给出推荐方案，并在验收中保留用户确认点。

| 决策点 | 推荐方案 | 原因 | 若用户选择其他方案的影响 |
| --- | --- | --- | --- |
| 用户 KEY 模型 | 支持多 Provider 多 KEY，不沿用单一 `last_api_key` 作为正式模型 | 单 KEY 容易与 provider/base URL 错配，且无法覆盖“用户自定义 AI 提供商和 KEY”的核心诉求 | 若只做单 KEY，后端和 UI 工作量更小，但无法持久管理多个 provider |
| 用户配置入口 | 先放在 `profile` 页的“AI 设置”模块，可由路由或折叠区承载 | 现有 `profile` 只有账户/密码设置，天然承载用户级配置；无需新导航体系 | 若改为独立“AI 设置”页，需要新增导航入口和路由设计 |
| 系统默认语义 | 仅兜底，不强制覆盖用户配置 | 符合“用户自定义优先”的预期，降低管理员误操作影响 | 若支持强制覆盖，需要额外权限提示、审计和用户侧禁用状态 |
| 管理员入口 | 集成到现有 `admin/llm-config` 页，在供应商管理中设置默认提供商 | 现有页面已管理 Provider/Model 目录，默认标记属于该目录的运营属性 | 若新建独立页面，需要额外导航、权限和重复数据加载 |
| API KEY 回传 | 保存后不再向前端返回明文 KEY，只返回 `has_api_key`、脱敏尾号和验证状态 | 现有 `/api/user/config` 会返回 `last_api_key` 明文，需避免扩大风险 | 若继续回传明文，前端改动少，但安全风险高 |

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
- 每个用户 provider 配置至少包含:
  - provider 标识或用户自定义 provider 名称
  - 显示名称
  - base URL
  - API KEY
  - 默认 shallow/deep model
  - 是否启用
  - 是否作为该用户默认 provider
  - 最近验证状态/时间
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

- 新增用户级 LLM provider 配置存储，推荐使用独立表而不是扩展 `UserConfig.last_api_key`。
- 推荐字段:
  - `id`
  - `user_id`
  - `provider_name`
  - `display_name`
  - `base_url`
  - `api_key_encrypted`
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
- 返回给前端的数据必须脱敏:
  - `has_api_key`
  - `api_key_masked`
  - `last_validated_at`
  - 不返回明文 `api_key`。
- 新增后端解析服务，建议命名为 `resolve_llm_config`:
  1. 单次请求显式传入的 provider/base URL/API KEY/model 优先。
  2. 若请求未携带 KEY，使用用户已启用且匹配 provider 的配置；若用户未明确选择 provider，则使用用户默认配置。
  3. 若用户无配置，使用系统默认 provider。
  4. 若仍无法获得有效 KEY/base URL/provider，返回可操作错误。
- 若用户显式选择一个未配置 KEY 的非默认 provider，不应静默使用系统默认 provider；应提示用户补充配置或切换到默认 provider。

### M3. 用户前端 AI 设置入口

- 在 `profile` 页新增“AI 设置”模块，或由 profile 入口进入独立设置视图。
- 用户可:
  - 查看已保存 provider 配置列表和默认标记。
  - 新增 provider 配置。
  - 编辑 base URL、API KEY、默认模型。
  - 测试连接。
  - 设置某个配置为默认。
  - 删除配置。
- API KEY 输入后保存；保存成功后输入框不再显示明文，只展示已保存/脱敏状态，并提供“替换 KEY”和“清除 KEY”动作。

### M4. 管理员系统默认 Provider

- 在现有管理员 LLM 配置页展示默认 provider 标记。
- 管理员可将一个 active provider 设置为系统默认 provider。
- 如果要设置 inactive provider 为默认，后端应拒绝并返回明确错误。
- `/api/config` 可返回系统默认 provider 的非敏感摘要，供前端默认选中和展示来源。
- 普通用户永远不能读取系统默认 provider 的明文 KEY。

### M5. 分析与定时任务集成

- `AnalysisConfigForm` 加载用户 AI 设置与系统默认摘要，默认选中有效 provider。
- 用户启动分析时，不需要把已保存 KEY 回填到表单或请求体；后端根据 user/provider 解析 KEY。
- 分析记录、定时任务记录仍可保存执行时使用的 provider/base URL/model 信息；是否保存明文 KEY 需要由安全实现决定，推荐保存加密引用或加密快照。
- 旧的 `last_llm_provider`、`last_backend_url`、`last_api_key` 仅作为迁移/兼容来源，不再作为正式优先级模型。

### M6. 安全、兼容与验证

- API KEY 必须加密存储或接入项目既有密钥保护机制；不得在列表/详情 API 中明文返回。
- 增加迁移策略:
  - 若用户只有 `UserConfig.last_api_key` 和 `last_llm_provider`，首次访问 AI 设置时可提示迁移为 provider 配置。
  - 迁移后保留旧字段用于上次分析表单偏好，避免立刻破坏历史逻辑。
- 增加后端单元/集成测试覆盖解析顺序。
- 增加前端交互测试或手工 QA 用例覆盖保存、验证、默认、删除、分析启动。

## 7. 配置优先级

推荐优先级:

1. 单次请求显式 KEY + provider + base URL + model。
2. 用户保存的 provider 配置。
3. 用户默认 provider 配置。
4. 系统默认 provider。
5. 无可用配置时阻止分析并返回可操作错误。

关键约束:

- 系统默认只兜底，不覆盖用户配置。
- 用户显式选择未配置的 provider 时，不能偷偷切换到系统默认 provider。
- 前端不需要也不应该拿到已保存 KEY 明文。

## 8. Epic 级验收标准

- [ ] 普通用户可在前端持久化管理至少两个 provider 配置，每个 provider 可保存独立 base URL、API KEY 和模型偏好。
- [ ] 普通用户可设置自己的默认 provider；刷新页面、换设备登录后仍可看到配置摘要。
- [ ] 管理员可在后台设置一个 active provider 为系统默认 provider。
- [ ] 当用户无自定义配置时，分析表单默认展示系统默认 provider，启动分析时后端使用系统默认 provider 的配置。
- [ ] 当用户已有配置时，分析表单和后端解析均优先使用用户配置，不被系统默认覆盖。
- [ ] 单次分析请求显式传入 KEY 时，仅对本次请求优先，不自动覆盖已保存 KEY，除非用户明确保存。
- [ ] 已保存 API KEY 不通过用户配置 API 明文返回前端；前端只显示脱敏状态。
- [ ] 旧 `UserConfig.last_*` 缓存仍能用于上次分析偏好，且不会与新的 provider KEY 管理产生错配。
- [ ] 后端测试覆盖请求级、用户级、系统默认、无配置错误四类解析路径。
- [ ] 前端 QA 覆盖新增、编辑、测试连接、设为默认、删除、分析启动和无配置兜底。

## 9. 非功能要求

- 安全:
  - API KEY 不得写入前端 localStorage。
  - API KEY 不得在日志、错误信息、列表响应中明文出现。
  - 管理员默认 provider 的 KEY 不对普通用户可见。
- 兼容:
  - 不破坏现有 Provider/Model 目录 CRUD。
  - 不破坏当前分析表单的基础使用路径。
- 性能:
  - 用户 AI 设置列表加载目标小于 500ms，不阻塞 profile 其他信息渲染。
  - 分析启动时配置解析应为少量数据库查询，可缓存 provider 目录但不能缓存明文 KEY 到前端。
- 可维护:
  - LLM 配置解析逻辑集中在一个后端服务函数中，避免分析、定时任务、未来入口各自实现不同优先级。

## 10. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| API KEY 明文回传延续旧行为 | 安全风险扩大 | 新 API 只返回脱敏字段；旧 `/api/user/config` 后续逐步移除明文 KEY 依赖 |
| provider/model/key 不一致 | 分析失败或调用错误模型 | 统一 `resolve_llm_config`，所有分析入口复用 |
| 系统默认与用户默认语义混淆 | 用户无法理解为什么使用某 provider | 前端展示“来自个人配置/系统默认”的来源摘要 |
| 自定义 provider 模型列表不可知 | 用户无法选择模型 | 允许手动输入模型名，并在连接测试中验证可用性 |
| 旧数据迁移不完整 | 老用户首次使用体验异常 | 首次访问 AI 设置时展示迁移提示，并保留旧字段兼容 |

## 11. 设计与交付说明

- Designer 应基于完整 `pm/requirements.md` 和 `pm/story-map.md` 做整体体验设计，不按 story 拆分设计任务。
- 前后端契约需要由 Leader 触发协调步骤，重点确认:
  - 用户 AI 设置 API 响应结构。
  - 系统默认 provider API 响应结构。
  - 分析启动请求是否继续允许 `api_key` 作为单次覆盖。
  - KEY 脱敏、替换、清除动作的交互文案。
- 工程 story 以垂直切片拆分，见 `pm/story-map.md` 和 `pm/stories/`。

