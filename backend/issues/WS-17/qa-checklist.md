# WS-17 Migration, Security, and QA Checklist

## Automated Security Regression

Status: PASS

- `/api/user/config` no longer returns `last_api_key` or plaintext legacy user keys.
- `/api/user/config` ignores incoming `last_api_key` writes, preserving legacy data only as historical compatibility state.
- User LLM settings responses continue to reject/omit `api_key`, `has_api_key`, and `api_key_masked`.
- Immediate analysis and scheduled task creation continue to keep `AnalysisRecord.api_key` and `ScheduledTask.api_key` null for request-level user keys.
- Conversation-triggered analysis now uses `resolve_llm_config` and does not copy `UserConfig.last_api_key` into the analysis record or worker payload.
- User-config cache no longer stores legacy `last_api_key`.

Commands run:

```bash
.venv/bin/python -m pytest tests/test_llm_config_resolver.py tests/test_user_llm_settings_routes.py tests/test_system_default_provider.py tests/test_analysis_key_persistence.py tests/test_conversation_dispatch_commit.py tests/test_user_config_security.py tests/test_conversation_key_persistence.py -q
```

Result: `26 passed`.

## Frontend Regression Tests

Status: PASS

Command run:

```bash
npm run test:run -- --run
```

Result: `33 passed` across profile provider settings, local key handling, system default provider UI, and navigation tests.

## Frontend Static Check

Status: FAIL, pre-existing unrelated type errors

Command run:

```bash
npm run typecheck
```

Result: failed in existing files unrelated to WS-17 key handling:

- `src/app/scheduled-tasks/page.tsx`
- `src/components/PromptEditor.tsx`
- `src/components/admin/llm-config/ModelForm.tsx`
- `src/components/auth/LoginForm.tsx`
- `src/components/auth/RegisterForm.tsx`
- `src/lib/auth.tsx`
- `src/utils/marketTime.ts`

No reported error references `useUserConfig`, `last_api_key`, or the WS-17 edits.

## Manual E2E Checklist

Status: NOT RUN in this branch environment

Required environment:

- Ordinary user with no personal provider metadata.
- Ordinary user with legacy `UserConfig.last_llm_provider`, `last_backend_url`, and `last_api_key`.
- Ordinary user with two provider metadata records and a browser-local key for at least one provider.
- Admin account.
- Active system default provider with a testable backend-managed key.

Scenarios to execute before release:

- New user starts analysis through system default provider; no user key is displayed or persisted.
- Legacy user opens Profile > AI Settings and sees the resave prompt, then saves a key to current-browser localStorage and starts analysis.
- User with a personal provider and current-browser key starts analysis; the request carries the key and backend records keep key fields null.
- User enters a one-time key on the analysis form; backend records keep key fields null and the key is saved to localStorage only if the user checks the browser-save option.
- User deletes the personal default provider; local browser key is cleared and subsequent analysis falls back to system default or shows a clear missing-key error.

## Release Blockers

- Manual E2E was not executed because this branch does not include prepared test accounts or a live test provider credential.
- Frontend typecheck has unrelated existing failures listed above.
