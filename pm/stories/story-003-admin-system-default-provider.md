# story-003 管理员系统默认 Provider 配置

- Parent Epic: WS-12
- Story file: `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/2827b647/workdir/TradingAgentsWeb/pm/stories/story-003-admin-system-default-provider.md`
- Priority: high
- Type: AFK
- Suggested role: backend + frontend
- Dependencies: story-001

## User Story

作为管理员，我希望在后台指定一个系统默认 AI provider，以便没有个人 AI 配置的用户也可以使用系统提供的默认模型能力完成分析。

## What To Build

在现有管理员 LLM 配置体系中增加系统默认 provider 能力:

- 后端支持读取和设置系统默认 provider。
- 后端保证同一时间最多一个 active provider 为默认。
- 前端在 `admin/llm-config` 的 provider 列表展示默认标记和设置动作。
- `/api/config` 或新摘要 API 向前端返回非敏感的系统默认 provider 摘要。

## Acceptance Criteria

- [ ] 管理员可以把一个 active provider 设置为系统默认 provider。
- [ ] 管理员不能把 inactive provider 设置为默认；后端返回明确错误。
- [ ] 当新的 provider 被设为默认时，旧默认 provider 自动取消默认状态。
- [ ] Provider 列表可以清晰展示当前默认 provider。
- [ ] 普通用户可读取默认 provider 的非敏感摘要，例如 provider name、display name、base URL、默认来源，但不能读取 API KEY。
- [ ] 如果系统没有默认 provider，前端和后端都能给出可操作提示。
- [ ] 现有 Provider/Model CRUD 不因默认 provider 字段新增而回归。

## Backend Notes

- 推荐在 `LLMProvider` 增加 `is_default` 字段，配合数据库或服务层约束保证唯一默认。
- 如实现选择默认模型，需明确 shallow/deep model 的默认来源；本 story 的必须范围是默认 provider。

## Frontend Notes

- 优先复用 `web/frontend/src/app/admin/llm-config/page.tsx` 和现有 provider 组件。
- 默认设置动作需要二次确认，避免误把测试 provider 设为系统默认。

## Test Expectations

- 后端覆盖默认唯一性、inactive provider 拒绝、非管理员拒绝。
- 前端覆盖默认标记展示、设置默认成功、设置 inactive provider 失败提示。

