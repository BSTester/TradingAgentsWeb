# story-004 分析与定时任务使用有效 LLM 配置

- Parent Epic: WS-12
- Story file: `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/2f09bcb1/workdir/TradingAgentsWeb/pm/stories/story-004-effective-llm-resolution.md`
- Priority: high
- Type: AFK
- Suggested role: backend + frontend
- Dependencies: story-002, story-003

## User Story

作为分析用户，我希望分析表单自动使用我的个人 AI provider 元数据和当前浏览器保存的 KEY；如果没有可用用户 KEY，则使用系统默认 provider，以便我可以直接开始分析且不会因为 KEY/provider 错配失败。

## What To Build

统一分析和定时任务中的 LLM 配置解析:

- 后端新增集中式 `resolve_llm_config` 能力。
- `/api/analyze` 和定时任务创建路径使用同一解析规则。
- 前端分析表单读取用户 provider 元数据、浏览器本地 KEY 状态和系统默认摘要，展示有效来源。
- 单次请求仍允许用户临时输入 KEY；只有用户明确保存时才写入当前浏览器 `localStorage`。

## Acceptance Criteria

- [ ] 当请求显式传入 provider/base URL/model/API KEY 时，本次分析使用请求级配置；该 KEY 可来自前端 `localStorage` 或一次性输入。
- [ ] 当请求未传入 KEY 且用户未显式选择个人 provider 时，后端使用系统默认 provider。
- [ ] 当系统没有默认 provider 且请求未传入 KEY 时，后端返回可操作错误。
- [ ] 当用户显式选择一个当前浏览器未保存 KEY 的个人 provider 时，后端返回可操作错误，不静默切换到系统默认 provider。
- [ ] 分析表单默认选中用户默认 provider；若当前浏览器没有该 provider 的 KEY，则提示补充 KEY 或切换到系统默认 provider。
- [ ] 分析表单展示配置来源，例如“个人配置（本地 KEY）”或“系统默认”，但不展示明文 KEY。
- [ ] 定时任务创建与执行记录使用同一配置解析逻辑，避免和即时分析表现不一致。
- [ ] 旧 `UserConfig.last_api_key` 不再作为正式优先级来源；如需兼容，必须通过 story-005 的迁移路径处理。

## Backend Notes

- 解析逻辑应集中在一个服务函数中，避免 `analysis_routes.py`、scheduled task routes、task executor 各自拼接。
- 解析优先级为: 请求级 KEY（前端下发）> 系统默认 provider（后端 KEY）> 可操作错误。
- 错误信息需要区分“没有默认 provider”、“显式 provider 未随请求携带 KEY”、“provider/base URL 无效”。
- 后端不得从用户设置表或 `UserConfig.last_api_key` 读取用户 KEY 作为正式来源。

## Frontend Notes

- `AnalysisConfigForm` 不应从后端加载用户 KEY；只可从当前浏览器 `localStorage` 读取本地 KEY 状态。
- 如果用户在分析页输入一次性 KEY，应明确这是“仅本次使用”还是“保存到当前浏览器”。
- 保存到当前浏览器后，后续分析请求由前端自动随请求下发对应 provider 的 KEY。

## Test Expectations

- 后端覆盖请求级 KEY、系统默认、无配置错误、显式 provider 缺 KEY 错误。
- 前端覆盖加载个人默认、本地 KEY 缺失提示、加载系统默认、一次性 KEY、本地保存 KEY 和不展示明文 KEY。
