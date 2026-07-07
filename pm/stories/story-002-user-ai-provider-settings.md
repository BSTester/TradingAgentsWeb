# story-002 用户 AI Provider 元数据与前端 KEY 管理

- Parent Epic: WS-12
- Story file: `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/2f09bcb1/workdir/TradingAgentsWeb/pm/stories/story-002-user-ai-provider-settings.md`
- Priority: high
- Type: AFK
- Suggested role: backend + frontend
- Dependencies: story-001

## User Story

作为普通用户，我希望在个人中心持久化管理自己的 AI provider、base URL 和默认模型，并在当前浏览器保存各 provider 的 API KEY，以便常用浏览器里不需要重复输入 KEY，同时后端不保存我的用户 KEY。

## What To Build

实现用户级 AI 设置的端到端路径:

- 后端新增用户 provider 元数据存储和迁移，不新增用户 KEY 存储列。
- 后端新增用户 AI 设置 CRUD API，仅管理 provider 元数据。
- 前端在 profile 页新增“AI 设置”模块。
- 用户可以新增、编辑、删除、测试连接、设为默认。
- 前端用 `localStorage` 按 provider 维度保存、替换、清除 KEY，并在分析请求中下发当前 provider 的 KEY。

## Acceptance Criteria

- [ ] 用户可以保存至少两个 provider 配置；后端每个配置有独立 base URL、shallow model、deep model 等非密钥元数据。
- [ ] 用户可以在当前浏览器为每个 provider 保存独立 API KEY；KEY 只进入 `localStorage`，不写入后端数据库。
- [ ] 用户可以把其中一个 provider 设为个人默认；同一用户最多一个默认 provider。
- [ ] 用户删除默认 provider 后，系统有明确行为: 自动选择另一个 enabled provider 或提示用户重新设置默认。
- [ ] 保存/替换 KEY 时必须重新输入完整 KEY；保存成功后只保存在当前浏览器本地。
- [ ] 用户可以清除某个 provider 的本地 KEY；清除后该 provider 不再可用于个人 KEY 分析，除非再次在当前浏览器设置 KEY 或改用系统默认 provider。
- [ ] 换浏览器、清除站点数据或无痕模式下，前端能提示该 provider 当前浏览器未保存 KEY，需要重新填写。
- [ ] 测试连接复用或扩展现有 provider 验证能力，由前端临时传入 KEY，后端展示成功/失败消息并记录验证状态但不持久化 KEY。
- [ ] 用户 A 不能读取、编辑、删除用户 B 的 provider 配置。
- [ ] 旧 `UserConfig.last_llm_provider`、`last_backend_url` 等上次分析偏好不被误删。

## Backend Notes

- 推荐新增独立表承载用户 provider 元数据，避免继续把 `UserConfig.last_api_key` 作为正式模型。
- API 响应不得包含用户 KEY、`has_api_key` 或 `api_key_masked`；只返回 provider 元数据、`last_validated_at` 和 `last_validation_status`。
- 对自定义 OpenAI-compatible provider，至少支持用户输入 display name、provider slug、base URL 和模型名。

## Frontend Notes

- 入口优先放在 `web/frontend/src/app/profile/page.tsx`。
- 可以新增可复用组件承载 provider 配置表单和列表。
- 表单应区分“选择系统 provider 并填写个人 KEY”和“自定义 OpenAI-compatible provider”。
- KEY 的 `localStorage` key 应按用户和 provider 隔离，避免不同用户或 provider 之间串用。
- 分析启动时从本地读取当前 provider 的 KEY 并随请求下发；后端不负责回填用户 KEY。

## Test Expectations

- 后端覆盖 CRUD 权限、默认唯一性、无用户 KEY 字段响应、测试连接不持久化 KEY。
- 前端覆盖新增、编辑、删除、设为默认、测试连接、本地保存/替换/清除 KEY、换浏览器/无 KEY 提示的主要交互。
