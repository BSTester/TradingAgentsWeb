# TradingAgents Workflow Desk · full-product UI specification

> Revised after Penn’s product review. Interactive prototype: `ui-designer/prototype/index.html`.

## Product rule set

1. The Web product is a UI for the real TradingAgents graph, not a generic equity dashboard.
2. The normal user starts analysis by selecting **a model**, not a provider, endpoint, key state, or system-default provenance.
3. Personal models are managed only in **我的模型**. System models, provider metadata and backend credentials are managed only in **管理员 / 系统模型**. A normal user cannot see or edit the system configuration.
4. Every key product route has normal, loading, empty and recoverable-error design treatment in the prototype.

## Graph truth the UI follows

The design follows `tradingagents/graph/setup.py`, rather than inventing a simplified pipeline:

```text
Market Analyst → Social Analyst → News Analyst → Fundamentals Analyst
  → Bull Researcher ↔ Bear Researcher → Research Manager
  → Trader (recommendation only; no order execution)
  → Risky Analyst → Safe Analyst → Neutral Analyst ↔ … → Risk Judge
  → final trade decision
```

- Each analyst may loop through its tools before handing the result to the next analyst.
- Research debate count is governed by `max_debate_rounds`; risk debate count is governed by `max_risk_discuss_rounds`.
- The UI calls the Trader output a **trading plan/recommendation**, never an order-placement action.

## Information architecture

```text
Unauthenticated
└── 登录 / 注册

Research workspace
├── 发起分析
├── 实时工作流
├── 分析报告
├── 分析历史
└── 定期任务

Account
├── 个人中心
└── 我的模型 (personal models only)

Admin only
└── 系统模型 (system model/provider/credential configuration)
```

The desktop shell is a permanent research rail, a thin status bar and one content column. On tablet/mobile the rail becomes labelled horizontal navigation; controls do not rely on hover.

## Page inventory

| Page | Primary job | Required states demonstrated |
| --- | --- | --- |
| 登录 / 注册 | Authenticate and set expectation of role-based configuration | Normal form, validation slot, loading button, login failure slot |
| 发起分析 | Select ticker, date, market, research depth and model; launch the graph | Normal form, no-model recovery message, submit/loading, ticker/config error |
| 实时工作流 | Explain exact graph stage, tool/agent work and handoff | Active stage, queued stages, paused stream, failed-node/retry state |
| 分析报告 | Present final decision with traceable research, debate, plan and risk sections | Completed, report-loading skeleton, data error, export busy state |
| 分析历史 | Retrieve records and open report/progress | Populated table, empty filter, loading rows, retry error |
| 定期任务 | Schedule a repeatable research run | Enabled/paused tasks, running stage, empty list, data-source error |
| 个人中心 | Account, research preferences, notification/security entry points | Normal profile, account load/error states |
| 我的模型 | Add/edit/enable personal model metadata and browser-local key only | Normal model list, missing local key, validation failure, empty list |
| 系统模型 (admin) | Choose/enable system model; inspect provider policy privately | Current system model, confirm-save, inactive/no-default, reject/error |

## Analysis-start experience

The start form is intentionally quiet about configuration:

- Visible: ticker, date, auto-detected market, selected analyst coverage, research depth and **模型** selector.
- Not visible: provider name, base URL, API key state, local storage status, system-default status, backend credential source.
- The selector shows model display names only. The implementation may resolve its list through existing user settings and non-sensitive config APIs, but the UI must not expose that source.
- If no usable model exists, show one actionable message: `当前没有可用模型。请在“我的模型”添加个人模型，或联系管理员。` Do not disclose whether the system has a disabled/default provider.

## Model ownership and security UX

| Surface | What is shown | What is forbidden |
| --- | --- | --- |
| 我的模型 | User’s model display name, enabled state, model validation state, browser-local-key action | System model list, system provider details, raw/masked key in normal view |
| 发起分析 / 定期任务 | Model display name only | Provider, endpoint, personal-key state, system-default badge, raw/masked key |
| 管理员 / 系统模型 | System model, provider and endpoint policy; backend key remains non-visible | Raw system key in UI, logs, error message or normal-user response |
| Report / history | Model-agnostic workflow and research evidence | Provider/key metadata and secrets |

## Workflow interaction model

The progress view is a five-band stage rail plus a node list. Selecting a band changes the visible stage explanation and current handoff without falsifying execution order.

| Band | Node content | User sees |
| --- | --- | --- |
| Research | Market → Social → News → Fundamentals | Tool/data collection and each analyst’s report handoff |
| Research debate | Bull ↔ Bear → Research Manager | Alternating views, round count and manager synthesis |
| Trading plan | Trader (+ tools if needed) | A recommendation plan, never a live order |
| Risk review | Risky → Safe → Neutral (repeat) | Three perspectives and current risk round |
| Final | Risk Judge | Final recommendation, risk boundary and report link |

## Visual system

**Direction:** Workflow Desk — a precise research instrument, closer to a structured analyst notebook than an exchange terminal. Deep blue-black surfaces, mint for the one decisive action/current execution, sky blue for structural flow, amber/red for warning/error. `Instrument Serif` carries research statements; `DM Mono` carries tickers, stage IDs, dates and system metadata; `Noto Sans SC` is the readable Chinese UI face.

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#0a0d12` | Application background |
| `--rail` | `#111720` | Navigation rail |
| `--surface` | `#171f2b` | Panels |
| `--line` | `#304154` | Structural boundary |
| `--mint` | `#9bffbe` | Primary action/current stage/success |
| `--blue` | `#8acbff` | Flow/node identity |
| `--amber` / `--red` | `#ffc66c` / `#ff8c9a` | Recoverable warning/error |

Controls retain a 42–44px target, visible focus ring, semantic labels and 160–220ms opacity/transform feedback. All meaningful status colours have a text label. `prefers-reduced-motion` removes entrance/pulse transitions.

## Responsive rules

- **1440px:** fixed 248px rail; split launch/report views.
- **1024px:** labelled horizontal switcher replaces the rail; workflow is still a two-column trace.
- **≤700px:** one content column; stage rail scrolls horizontally; forms stack; list rows retain identity/status/action and hide secondary columns; primary actions become full-width.
- No nested scroll trap, fixed-width data table or hover-only action is allowed.

## Implementation handoff

- Preserve existing routes in `web/frontend/src/app/`: `/`, `/analysis`, `/history`, `/history/detail`, `/history/progress`, `/scheduled-tasks`, `/profile`, `/profile/ai-settings`, `/admin/llm-config`, `/admin/system-default-provider`, `/login`, `/register` and `/auth`.
- Do not change backend or OpenAPI contracts. Compose the model selector from existing non-sensitive models/settings hooks.
- Keep model/key handling within the existing local-key and user-settings boundaries. Never pass presentation-only provider metadata to the start form, logs, report or history.
- Translate the workflow UI directly from `GraphSetup.setup_graph` and `ConditionalLogic`; avoid a separate, hand-maintained fake stage model.

## Story coverage matrix

| Issue | UI coverage |
| --- | --- |
| WS-13 / story-001 | Contract-boundary UI: model-only selector and no-secret presentation rules. |
| WS-14 / story-002 | 我的模型 normal/add/edit/key-missing/validation states. |
| WS-15 / story-003 | Admin-only 系统模型 configuration states; normal users have no system-settings surface. |
| WS-16 / story-004 | Launch model selector, model-unavailable recovery and scheduled-run model reuse. |
| WS-17 / story-005 | Browser-local-key security copy, no-secret report/history/log surfaces and error states. |

All story keys in `pm/story-map.md` have UI coverage. The engine-only portions of WS-17 do not require a separate page.
