# TradingAgents Signal Field UI specification

> Full-scope design handoff for WS-12. Interactive reference: `ui-designer/prototype/index.html`.

## Product direction

**Signal Field** turns configuration into an accountable part of a quantitative workflow: a dark, editorial command surface with lime as the single decisive action color, cyan for information, and explicit provenance for every AI configuration. It deliberately avoids a generic glass-card dashboard. The memorable motif is the **source rail**: a compact visual record of where the active model can obtain credentials, so the user sees a local-key gap before submitting an expensive analysis.

The visual language is a high-density research terminal, not a consumer trading app. `Fraunces` is used only for large research context headings; `IBM Plex Mono` carries tickers, URLs, models and provenance; `Noto Sans SC` is the UI/body fallback. Inline SVG icons use a 1.75px rounded outline, never emoji or a mixed icon library.

## IA and route map

```
Global shell
├── Workbench (/): new analysis, source rail, run state, report/history access
├── Profile (/profile)
│   ├── Account (existing)
│   ├── AI control room
│   │   ├── provider ledger
│   │   ├── add / edit provider dialog
│   │   ├── local-key save, replace, clear and test actions
│   │   └── no-provider / browser-missing-key / failed-test recovery
│   └── Password (existing)
└── Admin (admin only)
    ├── Provider & model directory (/admin/llm-config)
    └── System default provider (/admin/default-provider)
        ├── current default summary
        ├── eligible active-provider selector
        ├── confirmation dialog
        └── no-default / inactive rejection state
```

The large-screen shell has a 236px left rail, a 56px utility strip, and one reading column. At `<= 1023px`, the rail becomes a compact header with labelled menu access; at `<= 719px`, high-priority actions stay in view and secondary provenance moves beneath the form. No route relies on hover alone.

## Key flows

### 1. Personal provider with a browser-local key

1. The profile ledger displays provider metadata from the API and separately reads a client-only local-key state.
2. The user saves/replaces a complete key locally, then optionally tests it. Save and test show progress and keep the raw value out of the surrounding UI.
3. In the workbench, the source rail says `个人配置 · 本浏览器密钥` and lists the selected provider/model. The outgoing request receives the key only at submit time.
4. Analysis records show source type and provider/model, never a key or a key suffix.

### 2. Personal provider exists but this browser has no key

1. The ledger shows `此浏览器未保存` and a specific recovery action, not a false “connected” badge.
2. If explicitly selected in the workbench, submit is blocked with an alert: add a browser-local key or intentionally select system default.
3. The UI never auto-falls back from an explicitly chosen personal provider.

### 3. System default provider

1. A user without a selected personal key sees `系统默认 · 后端托管` on the source rail.
2. Admins choose from active providers only; the selected candidate is summarized without a key field.
3. The confirmation names the effect: it is a fallback for users without a personal request-level key, not an override.

### 4. One-time key

1. A user can type a key for the next analysis only.
2. The adjacent unchecked `保存至此浏览器` control is an explicit local save, never implicit persistence.
3. On submit the provenance becomes `本次输入`; the text is cleared after dispatch.

## Page inventory and state coverage

| Surface | Normal | Empty / no data | Loading | Error / recovery |
| --- | --- | --- | --- | --- |
| Workbench | Task form, source rail, market context | No system default: configuration CTA | Skeleton lines + `正在校验配置` | Explicit provider lacks local key; retry/change source actions |
| Profile AI control room | Provider ledger and inline actions | No provider configured | Ledger skeleton; action buttons disabled with text | Browser key missing, validation failure, stale legacy-key re-save notice |
| Provider editor | System/custom provider modes | N/A | Save/test button busy with status | Field error, unreachable base URL, test failure without raw key |
| Admin system default | Current summary and eligible selector | No default set | Summary/selector skeleton | Inactive candidate rejected; link to directory management |
| Confirmation dialog | Candidate + fallback scope | N/A | Confirm button busy | Server rejection remains in dialog with retry |

The prototype represents all of these, including normal, no-key, empty, loading and error states.

## Component library

| Component | Variants / behavior | Accessibility and engineering notes |
| --- | --- | --- |
| `AppShell` | rail, compact header, admin-only destinations | Current page has text + `aria-current=page`; skip link lands on main content. |
| `SourceRail` | personal local, one-time, system default, blocked | Use icon + label + descriptive text, not color alone. Surface reads from client state and non-sensitive API metadata. |
| `ProviderLedgerRow` | default, verified, unverified, missing-local-key, disabled | 44px minimum actions; a row never reveals the key or a suffix. |
| `ProviderEditorDialog` | add system / add custom / edit | Native labels, help text and field-level alerts. Password field starts empty; no server round-trip fills it. |
| `KeySlot` | absent, local-saved, replace, clear-confirm | Save/replacement requires a complete fresh entry. Clear and delete are separate confirmations. |
| `StatusMark` | neutral, positive, warning, danger, loading | Copy accompanies color; loading uses a nonessential pulse, frozen under reduced motion. |
| `DefaultProviderForm` | current, no-default, candidate selected, rejected | Inactive options stay visible but disabled with reason. |
| `ConfirmDialog` | clear local key, delete provider, set system default | `role=dialog`, focus trap, escape/cancel route, destructive focus not preselected. |
| `ActionButton` | primary lime, secondary, quiet, danger, busy/disabled | 44px target, visible `:focus-visible`, 160–220ms transform/opacity transitions. |

## Design tokens and chart language

Source tokens: `ui-designer/design/tokens.css`.

| Token role | Use |
| --- | --- |
| `--sf-ink`, `--sf-rail`, `--sf-panel` | Three-layer depth without translucent glass |
| `--sf-lime` | One primary decision/action per view, selected navigation, positive actionable focus |
| `--sf-cyan` | Informational connection/model context; never a second primary CTA |
| `--sf-positive`, `--sf-negative`, `--sf-warning` | Status with explicit text/icon treatment |
| `--sf-line`, `--sf-line-strong` | Dividers and selected structural boundaries |
| 4px spacing scale | Dense terminal rhythm; panel padding 20/24px, route gaps 24/32px |
| 8/14/22px radii | Controls, compact rows, panels respectively |

Trend charts use a high-contrast line plus a numeric summary and labelled time scale. Agent consensus uses labelled text/table fallback; color is never the sole carrier. In the implementation, expose charts as keyboard-reachable summaries and provide a data table/export where values matter.

## Responsive and motion behavior

| Width | Layout behavior |
| --- | --- |
| 1440px+ | Fixed left rail, 12-column main grid, max 1440px workspace; status rail stays beside analysis fields. |
| 1024–1439px | Same information hierarchy; long provider URLs wrap within the ledger rather than causing horizontal overflow. |
| 720–1023px | Rail becomes compact header; ledger actions move to a second line; source rail sits above submit. |
| 375–719px | Single column; action buttons are full-width where needed; modal becomes a bottom sheet; labels remain 16px+; no hover-only affordance. |

Motion is intentionally sparse: opacity/transform only, 160ms press state and 220ms screen transition. `prefers-reduced-motion: reduce` removes ambient pulse and screen transforms. Loading indicators retain text and never block focus without an explanation.

## Security and copy rules

- UI calls the browser key state “此浏览器本地保存”; never say “server saved”, show a masked suffix, or imply cross-device sync.
- Never place a user key in URLs, route state, history, analytics, toasts, errors, visible reports or task/schedule cards.
- System default cards show only name, endpoint summary, models and fallback semantics. Their key has no user-facing representation.
- A legacy user gets: `检测到旧分析偏好。请在此浏览器重新保存 API KEY；系统不会自动迁移密钥。`
- Explicit personal selection with a missing key gets: `此浏览器没有该配置的 API KEY。请补充密钥，或明确切换至系统默认。`
- No available configuration gets: `尚无可用 AI 来源。请添加个人 Provider 或请管理员配置系统默认 Provider。`

## Story coverage matrix

| Story issue | UI verdict | Covered surface / handoff |
| --- | --- | --- |
| WS-13 / story-001 | UI impact: contract-boundary copy and states | `SourceRail`, `KeySlot`, labels document request-only/local-only semantics; engineering must use the frozen contract before coding. |
| WS-14 / story-002 | UI impact: primary | Profile AI control room, provider editor, key slot, ledger normal/empty/missing/error states. |
| WS-15 / story-003 | UI impact: primary | Admin system-default route, directory link, inactive treatment and confirm dialog. |
| WS-16 / story-004 | UI impact: primary | Workbench source rail, grouped provider choices, one-time key, explicit missing-key block and loading state. |
| WS-17 / story-005 | UI impact: supporting | Legacy re-save notice, no-secret display rules, QA state matrix. Backend migration/security verification has no additional standalone page. |

Every story in `pm/story-map.md` has an explicit UI coverage verdict. There are no undocumented UI gaps.

## Engineering handoff constraints

- Preserve existing routes and service hooks; do not invent API fields or modify backend/OpenAPI contracts.
- Map tokens into Tailwind aliases first, then convert component families. Avoid a broad unrelated frontend refactor.
- Keep raw keys exclusively in the existing browser-local key hook and transient submit payloads.
- Tests must cover normal/empty/loading/error states, default uniqueness feedback, explicit missing-key blocking, and raw-key non-rendering.
- Execute the ordered, file-specific plan in `ui-designer/design/implementation-plan.md` after API contract confirmation.
