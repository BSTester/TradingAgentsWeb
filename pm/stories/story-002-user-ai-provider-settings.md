# story-002 用户 AI Provider/KEY 持久化管理

- Parent Epic: WS-12
- Story file: `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/2827b647/workdir/TradingAgentsWeb/pm/stories/story-002-user-ai-provider-settings.md`
- Priority: high
- Type: AFK
- Suggested role: backend + frontend
- Dependencies: story-001

## User Story

作为普通用户，我希望在个人中心持久化管理自己的 AI provider、base URL、API KEY 和默认模型，以便每次分析时不需要重复输入 KEY，并且可以为不同 provider 保存不同配置。

## What To Build

实现用户级 AI 设置的端到端路径:

- 后端新增用户 provider 配置存储和迁移。
- 后端新增用户 AI 设置 CRUD API。
- 前端在 profile 页新增“AI 设置”模块。
- 用户可以新增、编辑、删除、测试连接、设为默认。
- 已保存 KEY 只展示脱敏状态，不明文回填。

## Acceptance Criteria

- [ ] 用户可以保存至少两个 provider 配置，每个配置有独立 base URL、API KEY、shallow model、deep model。
- [ ] 用户可以把其中一个 provider 设为个人默认；同一用户最多一个默认 provider。
- [ ] 用户删除默认 provider 后，系统有明确行为: 自动选择另一个 enabled provider 或提示用户重新设置默认。
- [ ] 保存成功后前端不显示明文 API KEY，只显示已保存状态和脱敏尾号。
- [ ] 用户可以替换已保存 KEY；替换时必须重新输入完整 KEY。
- [ ] 用户可以清除某个 provider 的 KEY；清除后该 provider 不再可用于分析，除非再次设置 KEY。
- [ ] 测试连接复用或扩展现有 provider 验证能力，并展示成功/失败消息。
- [ ] 用户 A 不能读取、编辑、删除用户 B 的 provider 配置。
- [ ] 旧 `UserConfig.last_llm_provider`、`last_backend_url` 等上次分析偏好不被误删。

## Backend Notes

- 推荐新增独立表承载用户 provider 配置，避免继续把 `UserConfig.last_api_key` 作为正式模型。
- API 响应使用 `has_api_key`、`api_key_masked`、`last_validated_at`，不得返回明文 KEY。
- 对自定义 OpenAI-compatible provider，至少支持用户输入 display name、provider slug、base URL 和模型名。

## Frontend Notes

- 入口优先放在 `web/frontend/src/app/profile/page.tsx`。
- 可以新增可复用组件承载 provider 配置表单和列表。
- 表单应区分“选择系统 provider 并填写个人 KEY”和“自定义 OpenAI-compatible provider”。

## Test Expectations

- 后端覆盖 CRUD 权限、默认唯一性、KEY 脱敏响应。
- 前端覆盖新增、编辑、删除、设为默认、测试连接、替换 KEY 的主要交互。

