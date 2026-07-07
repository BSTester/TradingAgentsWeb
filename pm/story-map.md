# WS-12 Story Map

## 交付目标

围绕“用户自定义 AI provider/key + 系统默认 provider”交付一组可并行跟踪的工程 story。Designer 不按 story 拆分，统一从 `pm/requirements.md` 和本 story map 获取完整产品范围。

## 推荐交付顺序

1. `story-001` 先完成前后端契约、范围确认和 API 字段冻结。
2. `story-002` 与 `story-003` 在契约确认后可并行推进。
3. `story-004` 依赖用户配置与系统默认能力，统一接入分析和定时任务。
4. `story-005` 在核心能力完成后做迁移、安全回归和端到端验收。

## Story 列表

| Story ID | Issue | 标题 | 类型 | 建议角色 | 优先级 | 依赖 | Story 文件 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| story-001 | WS-13 | AI 设置范围确认与前后端契约 | HITL | backend + frontend contract | high | 无 | `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/2827b647/workdir/TradingAgentsWeb/pm/stories/story-001-ai-settings-contract.md` |
| story-002 | WS-14 | 用户 AI Provider/KEY 持久化管理 | AFK | backend + frontend | high | story-001 / WS-13 | `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/2827b647/workdir/TradingAgentsWeb/pm/stories/story-002-user-ai-provider-settings.md` |
| story-003 | WS-15 | 管理员系统默认 Provider 配置 | AFK | backend + frontend | high | story-001 / WS-13 | `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/2827b647/workdir/TradingAgentsWeb/pm/stories/story-003-admin-system-default-provider.md` |
| story-004 | WS-16 | 分析与定时任务使用有效 LLM 配置 | AFK | backend + frontend | high | story-002 / WS-14, story-003 / WS-15 | `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/2827b647/workdir/TradingAgentsWeb/pm/stories/story-004-effective-llm-resolution.md` |
| story-005 | WS-17 | 迁移、安全与端到端验收 | AFK | backend + qa | medium | story-002 / WS-14, story-003 / WS-15, story-004 / WS-16 | `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/2827b647/workdir/TradingAgentsWeb/pm/stories/story-005-migration-security-qa.md` |

## 依赖图

```text
story-001
  ├─ story-002
  │    └─ story-004
  │          └─ story-005
  └─ story-003
       └─ story-004
             └─ story-005
```

## 模块覆盖

| 模块 | 覆盖 Story |
| --- | --- |
| 数据模型与迁移 | story-002, story-003, story-005 |
| 用户 AI 设置 API | story-001, story-002 |
| 用户 Profile/AI 设置 UI | story-002 |
| 独立管理员默认 Provider API/UI | story-003 |
| 分析和定时任务配置解析 | story-004 |
| KEY 脱敏、迁移、回归 QA | story-005 |

## Designer Handoff

Designer 应一次性阅读:

- `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/2827b647/workdir/TradingAgentsWeb/pm/requirements.md`
- `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/2827b647/workdir/TradingAgentsWeb/pm/story-map.md`

设计重点:

- Profile 中“AI 设置”的信息架构。
- API KEY 已保存/替换/清除的安全交互。
- 分析表单展示“个人配置”与“系统默认”的来源提示。
- 独立管理员“系统默认 Provider”配置页的信息架构与交互。
