# TradingAgents Signal Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Signal Field visual system and WS-12 workflows into the existing Next.js frontend without changing the approved backend contract.

**Architecture:** Keep API calls in existing hooks and `lib/api` modules. Compose focused presentational components for the shared application shell, AI settings cards, default-provider command surface, and the analysis configuration source rail. Map `ui-designer/design/tokens.css` into `globals.css`/Tailwind semantic names before touching feature components.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, existing React Query hooks, Vitest.

---

### Task 1: Install the design tokens and application chrome

**Files:**
- Modify: `web/frontend/src/app/globals.css`
- Modify: `web/frontend/tailwind.config.js`
- Modify: `web/frontend/src/components/common/AppNavbar.tsx`
- Test: `web/frontend/src/components/common/AppNavbar.test.tsx`

- [ ] Add the `sf-*` semantic colors, 4px spacing rhythm, focus ring, and reduced-motion reset from `ui-designer/design/tokens.css` without removing existing aliases used by unconverted screens.
- [ ] Write a failing navbar test asserting the active destination is labelled and the Admin menu exposes a labelled `系统默认 Provider` link only for an admin user.
- [ ] Implement the left rail / compact mobile header so the current location has text plus an outline icon; preserve current routes and logout behavior.
- [ ] Run `npm test -- AppNavbar.test.tsx` and verify it passes.

### Task 2: Build the Profile AI control room

**Files:**
- Modify: `web/frontend/src/app/profile/page.tsx`
- Modify: `web/frontend/src/components/profile/AISettingsCard.tsx`
- Create: `web/frontend/src/components/profile/ProviderCard.tsx`
- Create: `web/frontend/src/components/profile/ProviderEditorDialog.tsx`
- Test: `web/frontend/src/components/profile/AISettingsCard.test.tsx`

- [ ] Write failing tests for: a per-provider local-key state is shown without revealing the key; an unavailable local key shows the browser-specific recovery action; clearing a key asks for confirmation.
- [ ] Implement the profile section as a provider ledger: default provider, local-key availability, non-sensitive base URL/models, validation status and row actions.
- [ ] Add the provider editor with visible labels, field-level error slots, system/custom modes, an input that never reads from the server, and save/test pending states.
- [ ] Run `npm test -- AISettingsCard.test.tsx` and verify the focus, empty, warning, success and failure states pass.

### Task 3: Build the administrator default-provider command surface

**Files:**
- Create: `web/frontend/src/app/admin/default-provider/page.tsx`
- Create: `web/frontend/src/components/admin/SystemDefaultProviderForm.tsx`
- Modify: `web/frontend/src/components/common/AppNavbar.tsx`
- Test: `web/frontend/src/components/admin/SystemDefaultProviderForm.test.tsx`

- [ ] Write failing tests that active providers are selectable, inactive providers have an explanatory disabled state, and saving asks for confirmation.
- [ ] Implement the current default summary without a key field; include a clear link to `/admin/llm-config` for directory maintenance.
- [ ] Call only the agreed non-sensitive summary/update endpoints through a small API adapter; surface server rejection near the selector.
- [ ] Run `npm test -- SystemDefaultProviderForm.test.tsx` and verify it passes.

### Task 4: Add source clarity to analysis and scheduled analysis

**Files:**
- Modify: `web/frontend/src/components/analysis/AnalysisConfigForm.tsx`
- Modify: `web/frontend/src/components/analysis/ScheduleConfig.tsx`
- Modify: `web/frontend/src/hooks/useLocalLLMKeys.ts`
- Test: `web/frontend/src/components/analysis/AnalysisConfigForm.test.tsx`

- [ ] Write failing tests for personal-local-key, one-time-key, system-default, and explicit-personal-provider-without-key states.
- [ ] Implement the compact source rail and grouped provider selection. Explicitly selected personal providers with no local key must block submission and offer recovery; they must not silently switch to system default.
- [ ] Keep the save-to-browser checkbox opt-in. Do not serialize keys into route state, logs, history, scheduled-task records, or response UI.
- [ ] Run `npm test -- AnalysisConfigForm.test.tsx` and verify it passes.

### Task 5: Run responsive, accessibility, and contract-boundary QA

**Files:**
- Modify: `web/frontend/src/components/profile/AISettingsCard.test.tsx`
- Modify: `web/frontend/src/components/analysis/AnalysisConfigForm.test.tsx`
- Reference: `ui-designer/ui-spec.md`

- [ ] Add/extend assertions for visible names, keyboard focus, `role=alert` errors and no returned/rendered raw key.
- [ ] Run `npm test`, `npm run lint`, and `npm run build` from `web/frontend`.
- [ ] Verify 375px, 768px, 1024px and 1440px in a browser. Check profile normal/empty/browser-missing/error; admin normal/no-default/rejection; analysis personal/system/missing-key/loading.
- [ ] Record any API contract mismatch in the implementation PR instead of adding frontend-only field guesses.
