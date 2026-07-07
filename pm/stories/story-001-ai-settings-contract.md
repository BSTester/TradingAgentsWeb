# story-001 AI 设置范围确认与前后端契约

- Parent Epic: WS-12
- Story file: `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/2827b647/workdir/TradingAgentsWeb/pm/stories/story-001-ai-settings-contract.md`
- Priority: high
- Type: HITL
- Suggested role: backend + frontend contract
- Dependencies: none

## User Story

作为开发组长和实现团队，我希望先冻结用户 AI 设置、系统默认 provider、分析解析优先级的 API 契约，以便前后端可以并行实现且不会在 KEY 安全语义上返工。

## What To Build

确认并记录 WS-12 的前后端契约，不直接实现完整 UI 或业务逻辑。契约应覆盖:

- 用户 provider 配置对象字段。
- 用户设置列表、新增、编辑、删除、测试连接、设为默认的 API 形状。
- 管理员系统默认 provider 的读取和更新 API 形状。
- 分析启动时请求级覆盖、用户级配置、系统默认 provider 的解析优先级。
- 已保存 API KEY 的脱敏响应、替换 KEY、清除 KEY 语义。

## Acceptance Criteria

- [ ] 明确用户配置模型采用“多 Provider 多 KEY”，并记录用户如选择单 KEY 时的降级范围。
- [ ] 明确用户入口采用 profile 页“AI 设置”模块，或记录用户确认的独立设置页方案。
- [ ] 明确系统默认 provider 是兜底而非强制覆盖。
- [ ] 明确管理员默认 provider 设置集成在现有 `admin/llm-config` 页。
- [ ] 产出 API contract 文档或 OpenAPI 草案，包含请求/响应字段、错误码和脱敏规则。
- [ ] 明确 `api_key` 作为分析请求字段时只代表单次覆盖，不自动覆盖已保存 KEY。
- [ ] 明确普通用户 API 不返回系统默认 provider 的明文 KEY。
- [ ] Leader 可以基于该契约派发 story-002、story-003 和 story-004。

## Notes

范围确认项来自 `pm/requirements.md` 第 3 节。若用户修改任一推荐决策，应同步更新 `pm/requirements.md` 和 `pm/story-map.md`。

