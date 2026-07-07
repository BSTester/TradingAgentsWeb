# WS-12 Backend Tech Spec: AI Settings After WS-20 Rework

## Scope

This document replaces the obsolete WS-13 backend contract that assumed the
backend would store user API keys. WS-20 changed the product decision: user keys
belong to the browser and are sent only with the request that needs them. The
backend stores user provider metadata only.

`backend/openapi.yaml` is the authoritative backend API contract for frontend
mirroring and downstream story implementation.

Confirmed decisions from the updated PM documents:

- User provider settings are multi-provider metadata records.
- User API keys are kept in frontend `localStorage` by user and provider scope.
- The backend must not store, return, log, or copy user-supplied request keys.
- The profile page contains the user AI settings entry.
- The administrator system-default provider is an independent admin page under
  existing admin navigation.
- The system default provider is a fallback only. It does not override a request
  that includes a user-supplied key.
- System default provider credentials remain backend-managed, encrypted, and
  unavailable to ordinary users.

## Current Backend Context

Relevant current code paths:

- `web/backend/models.py`
  - `UserConfig.last_api_key` exists as legacy analysis cache and must stop
    being a formal source for LLM resolution.
  - `AnalysisRecord.api_key` and `ScheduledTask.api_key` currently allow task
    records to hold request keys; WS-12 implementation must stop writing user
    keys there.
  - `LLMProvider.api_key` exists for system/admin provider configuration and can
    remain the backend-managed credential storage location after encryption is
    applied.
- `web/backend/routes/analysis_routes.py`
  - Currently writes `request.api_key` into `UserConfig.last_api_key`, then
    falls back to it. This must be removed.
- `web/backend/routes/scheduled_task_routes.py`,
  `web/backend/services/task_executor.py`, and `web/backend/app.py`
  - Currently read task or legacy user key fields. These paths must call the
    same resolver as immediate analysis and must not persist user request keys.
- `web/backend/routes/config_routes.py`
  - Existing `/api/config` is the right place to add the non-sensitive system
    default provider summary.
- `web/backend/routes/llm_config_routes.py`
  - Existing `/api/admin/llm` namespace is the right API namespace for the
    system-default provider operation.

## User Provider Metadata Model

Create a new user-owned table such as `user_llm_provider_settings`. It stores
only non-secret metadata.

Fields:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK | Internal metadata ID. |
| `user_id` | FK `users.id` | Required, indexed, cascade delete. |
| `provider_name` | varchar(100) | Lowercase slug used by requests. |
| `provider_type` | varchar(20) | `catalog` or `custom`. |
| `catalog_provider_id` | nullable FK `llm_providers.id` | Present for catalog-backed records. |
| `display_name` | varchar(200) | User-facing name. |
| `base_url` | varchar(500) | Absolute HTTP(S) base URL. |
| `shallow_model` | varchar(200) | User's quick model preference. |
| `deep_model` | varchar(200) | User's deep model preference. |
| `is_enabled` | boolean | Disabled records are not offered as active choices. |
| `is_default` | boolean | At most one default per user. |
| `last_validated_at` | datetime nullable | Last test timestamp. |
| `last_validation_status` | varchar(20) nullable | `untested`, `ok`, or `failed`. |
| `created_at` / `updated_at` | datetime | Server timestamps. |

Forbidden for this table:

- Any user key column.
- Any encrypted, masked, suffix, fingerprint, or availability field derived from
  a user key.
- Any attempt to migrate legacy `UserConfig.last_api_key` into this table.

Constraints and indexes:

- Unique `(user_id, provider_name)` so a user cannot create duplicate metadata
  records for the same provider slug.
- Index `(user_id, is_enabled)`.
- Index `(user_id, is_default)`.
- Enforce one default per user in the same transaction that sets a new default.
  Use a partial unique index where supported, and keep an application-level
  transaction invariant for SQLite/MySQL portability.

## User AI Settings API

Implement the routes from `backend/openapi.yaml`:

- `GET /api/user/llm-settings`
- `POST /api/user/llm-settings/providers`
- `PATCH /api/user/llm-settings/providers/{provider_id}`
- `DELETE /api/user/llm-settings/providers/{provider_id}`
- `POST /api/user/llm-settings/providers/{provider_id}/test`

Rules:

- CRUD endpoints accept and return provider metadata only.
- Create/update/delete must always filter by `current_user.id`.
- Create/update request schemas must not contain a user key field.
- List/detail responses return `last_validated_at` and
  `last_validation_status`, but no user-key state.
- Delete removes backend metadata only. The frontend is responsible for clearing
  its matching browser-local key.
- The test endpoint requires a request-time `api_key`. It uses that value
  for the connection test, records only validation status/time, and discards the
  key before returning.
- Test diagnostics must be sanitized and must not echo request headers, bearer
  tokens, key-like strings, or full upstream error bodies.

## System Default Provider

Add `is_default boolean not null default false` to `LLMProvider`.

Routes:

- `GET /api/admin/llm/system-default`
- `PUT /api/admin/llm/system-default`

Rules:

- Admin-only: require `current_user.role == "admin"`.
- Only active providers can be set as default.
- A provider cannot be set as default unless backend-managed credentials and
  base URL are configured.
- At most one provider can be the system default.
- Admin responses may include a boolean such as `credential_configured`, but
  never plaintext credentials.
- Public `/api/config` returns only non-sensitive summary fields: provider ID,
  provider name, display name, base URL, and default model hints.
- Ordinary users must not be able to retrieve the system default credential,
  credential suffix, encrypted value, or any other reversible material.

System default credentials:

- Keep them backend-side. The existing `LLMProvider.api_key` column can remain
  the storage location if it is encrypted before production use.
- Add a small crypto service such as `web/backend/services/api_key_crypto.py`
  for system provider credentials only.
- Use `cryptography.fernet.Fernet` with `LLM_API_KEY_ENCRYPTION_KEY` in deployed
  environments. Development may derive a key from `SECRET_KEY`; production must
  fail fast if the encryption key is missing.
- Do not log ciphertext or plaintext.

## Central Resolver

Implement `resolve_llm_config(db, user, request_config)` and require immediate
analysis, scheduled task creation, and scheduled task execution to use it.

Inputs:

- Request-level `api_key` from frontend localStorage or one-time input.
- Request-level provider, base URL, shallow model, deep model.
- Optional `use_system_default` flag for a user choosing fallback explicitly.
- Current user.

Return:

- `source`: `request_key` or `system_default`.
- `provider_name`
- `base_url`
- `shallow_model`
- `deep_model`
- `secret_value` for runtime use only.
- `user_provider_id` nullable.
- `system_provider_id` nullable.

Priority:

1. If the request supplies `api_key`, use the request provider/base
   URL/model values. Validate provider slug and base URL before starting work.
2. If no request key is supplied and the user did not explicitly select a
   personal provider, use the backend-managed system default provider.
3. Return a structured, actionable error if neither path can produce a valid
   provider, base URL, model, and key.

Critical edge cases:

- If a user explicitly selects a personal provider but the request omits
  `api_key`, return `REQUEST_PROVIDER_KEY_REQUIRED`. Do not silently fall
  back to system default.
- If there is no configured system default, return
  `SYSTEM_DEFAULT_PROVIDER_NOT_SET`.
- If the system default is inactive or missing backend-managed credentials,
  return `SYSTEM_DEFAULT_PROVIDER_CREDENTIAL_MISSING` or
  `SYSTEM_DEFAULT_PROVIDER_INACTIVE`.
- If the request provider slug does not match an active catalog provider or a
  user-owned enabled metadata record, return `REQUEST_PROVIDER_INVALID`.
- If a base URL is malformed or not allowed, return `INVALID_BASE_URL`.

Do not read these as key sources:

- `UserConfig.last_api_key`
- `AnalysisRecord.api_key`
- `ScheduledTask.api_key`
- The new user provider metadata table

## Analysis and Scheduled Task Records

Analysis and scheduled task records may keep non-sensitive execution metadata:

- provider name
- base URL
- shallow/deep model names
- resolver source
- user provider metadata ID or system provider ID

They must not save user-supplied request keys. The existing key columns should
be deprecated for user-key use and left null for WS-12 flows. If a queued or
scheduled run requires a user key, the frontend must either:

- submit the key at run creation and execute immediately without persisting it,
  or
- require the user to re-authorize/re-submit before a later run.

For scheduled tasks, prefer system-default execution when no request key is
available. If a task is configured for a personal provider but no key is present
at execution time, fail with an actionable error rather than reading legacy
fields.

## Error Format

New WS-12 endpoints should use the structured error body from
`backend/openapi.yaml`:

```json
{
  "error": {
    "code": "REQUEST_PROVIDER_KEY_REQUIRED",
    "message": "The selected provider requires a key in this request.",
    "details": {
      "provider_name": "openai"
    },
    "request_id": "optional"
  }
}
```

Required stable codes:

- `AUTH_REQUIRED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `USER_LLM_PROVIDER_NOT_FOUND`
- `USER_LLM_PROVIDER_DUPLICATE`
- `USER_LLM_PROVIDER_DISABLED`
- `LLM_PROVIDER_NOT_FOUND`
- `SYSTEM_DEFAULT_PROVIDER_NOT_SET`
- `SYSTEM_DEFAULT_PROVIDER_INACTIVE`
- `SYSTEM_DEFAULT_PROVIDER_CREDENTIAL_MISSING`
- `REQUEST_PROVIDER_KEY_REQUIRED`
- `REQUEST_PROVIDER_INVALID`
- `INVALID_BASE_URL`
- `CONNECTION_TEST_FAILED`
- `LLM_CONFIG_UNRESOLVED`

## Migration Strategy

1. Add the user provider metadata table and `LLMProvider.is_default`.
2. Leave legacy `UserConfig.last_*` columns in place for non-sensitive analysis
   preference compatibility.
3. Stop writing request keys to `UserConfig.last_api_key`.
4. Stop returning `last_api_key` from new AI settings APIs. A later cleanup can
   remove or redact the legacy `/api/user/config` field.
5. Do not migrate legacy user keys into a backend table. The frontend may show a
   migration prompt asking the user to re-save a key in the current browser.
6. Encrypt existing system provider credentials before allowing system-default
   fallback in production.
7. Update analysis and scheduled-task paths so user request keys are used only in
   memory during the current call.

## Security and Observability

Security rules:

- User request keys are secrets in transit. Do not include them in logs,
  exceptions, websocket progress messages, task records, or analytics.
- Redact upstream provider responses before returning connection-test details.
- Ordinary user APIs expose only system default metadata needed for UI display.
- Admin APIs expose credential presence only, not credential values.
- Base URL validation should reject malformed URLs and, in production, block
  loopback/link-local/private network targets unless an explicit allowlist is
  configured for private LLM endpoints.

Useful log fields:

- user ID
- provider source (`request_key` or `system_default`)
- provider name
- user provider metadata ID or system provider ID
- validation status
- structured error code

Never log:

- request-time user keys
- system default credentials
- authorization headers
- full upstream response bodies

## Test Expectations

Backend tests should cover:

- User provider CRUD returns metadata only.
- A user cannot read or mutate another user's provider metadata.
- Setting a user default unsets the previous user default.
- The test endpoint accepts request-time key input, records validation status,
  and does not persist the key.
- Admin system-default set rejects inactive providers.
- `/api/config` includes a non-sensitive system default summary only.
- `resolve_llm_config`:
  - uses request-level key first;
  - falls back to system default only when no personal provider was explicitly
    selected;
  - rejects explicit provider without request key;
  - rejects missing system default;
  - rejects invalid provider/base URL.
- Immediate analysis and scheduled-task paths do not save user request keys to
  analysis or task records.

## Handoff Notes

- Story-002 should implement user provider metadata and frontend local key
  management against this contract.
- Story-003 should implement the admin system-default provider API/UI.
- Story-004 should replace analysis and scheduled-task key selection with
  `resolve_llm_config`.
- Existing frontend/design documents on main were produced before WS-20 and
  should be re-mirrored from `backend/openapi.yaml`.
