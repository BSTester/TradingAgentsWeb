# story-005 迁移、安全与端到端验收

- Parent Epic: WS-12
- Story file: `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/2f09bcb1/workdir/TradingAgentsWeb/pm/stories/story-005-migration-security-qa.md`
- Priority: medium
- Type: AFK
- Suggested role: backend + qa
- Dependencies: story-002, story-003, story-004

## User Story

作为已有用户和运维团队，我希望旧的 `last_api_key` 配置可以安全兼容并提示用户在前端重新保存 KEY，同时新功能经过安全和端到端验证，以便上线不会泄露 KEY 或破坏现有分析流程。

## What To Build

完成 WS-12 的迁移、安全和验收闭环:

- 定义并实现旧 `UserConfig.last_api_key` 的兼容/重新保存提示策略，不迁移到新的后端用户 KEY 表。
- 确认用户 KEY 不在后端持久化、前端响应、日志、错误消息或分析记录中明文泄露。
- 补充后端和前端回归测试。
- 输出 QA 验收清单。

## Acceptance Criteria

- [ ] 旧用户已有 `last_llm_provider` + `last_backend_url` + `last_api_key` 时，首次进入 AI 设置可以看到清晰的重新保存提示，并把 KEY 保存到当前浏览器 `localStorage`；不得自动迁移为后端用户 KEY。
- [ ] 迁移后，旧的上次分析偏好仍可用于填充 ticker、analysts、research depth、provider/model 等非敏感字段。
- [ ] `/api/user/config` 或新用户 AI 设置 API 不再向前端返回明文已保存 KEY，且新用户 AI 设置 API 不包含 `has_api_key` / `api_key_masked`。
- [ ] 后端日志、异常响应、测试快照不包含完整用户 KEY 或系统默认 KEY。
- [ ] 用户 KEY 不写入后端用户 provider 表、分析记录、定时任务记录或普通用户可见响应。
- [ ] 系统默认 provider 的 KEY 不会被普通用户 API 读取。
- [ ] E2E 验收覆盖: 新用户使用系统默认分析、老用户看到重新保存 KEY 提示后分析、有个人 provider 且当前浏览器保存 KEY 的用户分析、一次性 KEY 分析、删除个人默认 provider 本地 KEY 后分析。
- [ ] QA 输出明确通过/失败结果和阻塞项。

## Backend Notes

- 系统默认 provider KEY 如需后端保存，应优先复用项目既有密钥加密方案；该要求不适用于用户 KEY，因为用户 KEY 不落后端。
- 若保留 `AnalysisRecord.api_key` 或 `ScheduledTask.api_key` 字段，必须确认不写入请求中的用户 KEY 明文，必要时改为非敏感引用或移除。

## QA Notes

- 验收环境需准备:
  - 一个无个人配置的普通用户。
  - 一个有旧 `last_api_key` 的普通用户，用于验证重新保存提示。
  - 一个有两个 provider 配置且当前浏览器保存了本地 KEY 的普通用户。
  - 一个管理员账号。
  - 至少一个可用于连通性验证的测试 provider。

## Test Expectations

- 后端单元/集成测试覆盖安全和解析路径。
- 前端测试或手工记录覆盖 profile 设置、本地 KEY 保存/替换/清除、admin 默认 provider、analysis 表单来源提示。
