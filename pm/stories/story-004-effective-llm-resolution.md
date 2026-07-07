# story-004 分析与定时任务使用有效 LLM 配置

- Parent Epic: WS-12
- Story file: `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/2827b647/workdir/TradingAgentsWeb/pm/stories/story-004-effective-llm-resolution.md`
- Priority: high
- Type: AFK
- Suggested role: backend + frontend
- Dependencies: story-002, story-003

## User Story

作为分析用户，我希望分析表单自动使用我的个人 AI 配置；如果我没有配置，则使用系统默认 provider，以便我可以直接开始分析且不会因为 KEY/provider 错配失败。

## What To Build

统一分析和定时任务中的 LLM 配置解析:

- 后端新增集中式 `resolve_llm_config` 能力。
- `/api/analyze` 和定时任务创建路径使用同一解析规则。
- 前端分析表单读取用户配置和系统默认摘要，展示有效来源。
- 单次请求仍允许用户临时输入 KEY，但不自动覆盖已保存 KEY。

## Acceptance Criteria

- [ ] 当请求显式传入 provider/base URL/model/API KEY 时，本次分析使用请求级配置。
- [ ] 当请求未传入 KEY 但用户有匹配 provider 配置时，后端使用用户配置中的 KEY/base URL/model。
- [ ] 当用户没有任何 provider 配置时，后端使用系统默认 provider。
- [ ] 当用户显式选择一个未配置 KEY 的非默认 provider 时，后端返回可操作错误，不静默切换到系统默认 provider。
- [ ] 分析表单默认选中用户默认 provider；若用户无配置，则默认选中系统默认 provider。
- [ ] 分析表单展示配置来源，例如“个人配置”或“系统默认”，但不展示明文 KEY。
- [ ] 定时任务创建与执行记录使用同一配置解析逻辑，避免和即时分析表现不一致。
- [ ] 旧 `UserConfig.last_api_key` 不再作为正式优先级来源；如需兼容，必须通过 story-005 的迁移路径处理。

## Backend Notes

- 解析逻辑应集中在一个服务函数中，避免 `analysis_routes.py`、scheduled task routes、task executor 各自拼接。
- 错误信息需要区分“没有默认 provider”、“provider 未配置 KEY”、“provider/base URL 无效”。

## Frontend Notes

- `AnalysisConfigForm` 不应再把已保存 KEY 明文加载到 `api_key` 输入框。
- 如果用户在分析页输入一次性 KEY，应明确这是“仅本次使用”还是“保存到我的 AI 设置”。

## Test Expectations

- 后端覆盖请求级、用户级、系统默认、无配置错误、显式 provider 无 KEY 错误。
- 前端覆盖加载个人默认、加载系统默认、一次性 KEY、不显示明文已保存 KEY。

