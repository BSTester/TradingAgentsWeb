# TradingAgents Workflow Desk Implementation Plan

**Goal:** Replace every current frontend surface with the Workflow Desk system while preserving routes, contracts and TradingAgents graph semantics.

1. Apply `tokens.css` to `globals.css`/Tailwind and rebuild `AppNavbar` as desktop rail plus labelled mobile switcher. Add visual tests for focus, responsive rail and active route.
2. Rebuild `/`, `/analysis`, `/history/progress` around the real `GraphSetup.setup_graph` stage order. The start form accepts ticker/date/market/depth/**model only**; progress maps to analyst, research-debate, trader, risk-debate and risk-judge stages.
3. Rebuild report/history/scheduled-task routes around evidence, recommendation plan and status; support normal/loading/empty/error variants.
4. Rebuild profile and `/profile/ai-settings`: personal models only. Keep local key handling here; raw/masked keys, providers and endpoints cannot render in launch/report/history.
5. Rebuild `/admin/llm-config` and `/admin/system-default-provider` behind admin access. System model/provider/endpoint policy is private to this surface. Add tests proving a normal user’s analysis selector exposes model names only.

Before merge, run focused component tests, `npm test`, `npm run lint`, `npm run build`, and desktop/mobile browser QA for every route/state in `ui-spec.md`.
