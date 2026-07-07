# story-001 AI 设置范围确认与前后端契约

- Parent Epic: WS-12
- Story file: `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/2f09bcb1/workdir/TradingAgentsWeb/pm/stories/story-001-ai-settings-contract.md`
- Priority: high
- Type: HITL
- Suggested role: backend + frontend contract
- Dependencies: none

## User Story

作为开发组长和实现团队，我希望先冻结用户 AI 设置、系统默认 provider、分析解析优先级的 API 契约，以便前后端可以并行实现且不会在 KEY 安全语义上返工。

## What To Build

确认并记录 WS-12 的前后端契约，不直接实现完整 UI 或业务逻辑。契约应覆盖:

- 用户 provider 配置对象字段，且字段仅包含非密钥元数据。
- 用户设置列表、新增、编辑、删除、测试连接、设为默认的 API 形状。
- 管理员系统默认 provider 的读取和更新 API 形状。
- 分析启动时请求级 KEY、系统默认 provider、无可用配置的解析优先级。
- 用户 KEY 前端 `localStorage` 保存、替换、清除、随请求下发语义；后端不保存、不回填用户 KEY。

## Acceptance Criteria

- [ ] 明确用户配置模型采用“多 Provider 多 KEY”，用户 KEY 按 provider 维度存在浏览器 `localStorage`，后端只保存 provider 元数据。
- [ ] 明确用户入口采用 profile 页“AI 设置”模块，或记录用户确认的独立设置页方案。
- [ ] 明确系统默认 provider 是兜底而非强制覆盖。
- [ ] 明确管理员默认 provider 使用独立“系统默认 Provider”配置页，并在现有 admin 导航下新增入口。
- [ ] 产出 API contract 文档或 OpenAPI 草案，包含请求/响应字段、错误码，并明确用户 AI 设置 API 无 `has_api_key` / `api_key_masked` / 明文 KEY 字段。
- [ ] 明确 `api_key` 作为分析请求字段时来自前端 `localStorage` 或一次性输入；仅用户明确保存时才写入当前浏览器 `localStorage`。
- [ ] 明确测试连接接口临时接收 KEY 并返回验证结果，但后端不持久化 KEY。
- [ ] 明确普通用户 API 不返回系统默认 provider 的明文 KEY。
- [ ] Leader 可以基于该契约派发 story-002、story-003 和 story-004。

## Notes

范围确认项来自 `pm/requirements.md` 第 3 节。若用户修改任一推荐决策，应同步更新 `pm/requirements.md` 和 `pm/story-map.md`。
