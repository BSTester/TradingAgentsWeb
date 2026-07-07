# WS-12 Backend Tech Spec: User AI Settings and System Default Provider

## Scope

This story freezes the backend contract and implementation plan for WS-12. It
does not change runtime application code. `backend/openapi.yaml` is the
authoritative API contract for the next implementation stories.

Confirmed product decisions:

- User settings use a multi-provider, multi-key model. A single-key model is
  only acceptable as a degraded request-level override path and does not satisfy
  the persistent settings requirement.
- The user entry point is the profile page AI settings module.
- The system default provider is a fallback only. It must never force override a
  matching user configuration.
- The backend exposes system-default operations as a separate admin operation
  under the existing `/api/admin/llm` namespace. PM requirements currently say
  the frontend should use an independent admin page, while the original story
  checkbox mentions existing `admin/llm-config`; this spec keeps the API stable
  for either frontend placement.
- `api_key` in analysis and scheduled-task requests is a one-time override only.
  It must not create, replace, or clear a saved user provider key.
- Ordinary user and public APIs never return the system default provider key in
  plaintext.

## Current Backend Context

Relevant current files:

- `web/backend/models.py`
  - `UserConfig` stores `last_llm_provider`, `last_shallow_thinker`,
    `last_deep_thinker`, `last_backend_url`, and plaintext `last_api_key` as a
    legacy analysis form cache.
  - `LLMProvider` / `LLMModel` are system catalog tables.
- `web/backend/routes/user_config_routes.py`
  - `/api/user/config` currently returns `last_api_key` plaintext.
- `web/backend/routes/llm_config_routes.py`
  - Existing admin Provider/Model CRUD is mounted at `/api/admin/llm`.
  - `GET /providers/{provider_id}` can currently return an unmasked admin key.
- `web/backend/routes/config_routes.py`
  - `/api/config` returns public provider/model bootstrap data.
  - `/api/validate-key` validates one supplied key for one provider.
- `web/backend/routes/analysis_routes.py`
  - `/api/analyze` currently writes a provided `api_key` back to
    `UserConfig.last_api_key` and falls back to that single legacy key.
- `web/backend/routes/scheduled_task_routes.py`, `web/backend/app.py`, and
  `web/backend/services/task_executor.py`
  - Scheduled analysis paths also fall back to the legacy single key.

## Data Model

### `user_llm_provider_settings`

Create a new user-owned table instead of extending `UserConfig`.

Fields:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK | Internal profile ID. |
| `user_id` | FK `users.id` | Required, indexed, cascade delete. |
| `provider_name` | varchar(100) | Lowercase slug used by analysis requests. |
| `provider_type` | varchar(20) | `catalog` or `custom`. |
| `catalog_provider_id` | nullable FK `llm_providers.id` | Set for catalog-backed profiles. |
| `display_name` | varchar(200) | User-facing label. |
| `base_url` | varchar(500) | Absolute provider base URL. |
| `api_key_encrypted` | varchar/text nullable | Encrypted saved key. Never plaintext. |
| `shallow_model` | varchar(200) | Default quick model for this profile. |
| `deep_model` | varchar(200) | Default deep model for this profile. |
| `is_enabled` | boolean | Disabled profiles are never selected by resolver. |
| `is_default` | boolean | At most one default per user. |
| `last_validated_at` | datetime nullable | Last connection test timestamp. |
| `last_validation_status` | varchar(20) | `untested`, `ok`, `failed`, or null before any test. |
| `created_at` / `updated_at` | datetime | Server timestamps. |

Constraints and indexes:

- Unique `(user_id, provider_name)` to prevent duplicate profiles for one user.
- Index `(user_id, is_enabled)`.
- Index `(user_id, is_default)`.
- Enforce "one user default" in the update transaction by unsetting all other
  defaults before setting the selected row. Add a partial unique index where the
  dialect supports it.
- For SQLite/MySQL environments without portable partial unique indexes, keep
  the application-level transaction invariant and add regression tests.

### `llm_providers`

Add `is_default boolean not null default false` to the system catalog provider
table.

Rules:

- At most one active provider may be system default.
- `PUT /api/admin/llm/system-default` rejects inactive providers.
- A provider without required connection material must not become the system
  default.
- The existing `api_key` column should be treated as encrypted ciphertext after
  migration. If a future migration renames it, use `api_key_encrypted`, but do
  not require a destructive rename for this milestone.

## Key Encryption

Add a small backend service, for example
`web/backend/services/api_key_crypto.py`.

Minimal scheme:

- Use `cryptography.fernet.Fernet`.
- Introduce `LLM_API_KEY_ENCRYPTION_KEY`, a Fernet key generated outside the
  app and provided through environment configuration.
- In development only, allow deriving a deterministic Fernet-compatible key from
  `SECRET_KEY` so local setups do not break. In production, fail startup if
  `LLM_API_KEY_ENCRYPTION_KEY` is missing.
- Store only encrypted ciphertext in `user_llm_provider_settings.api_key_encrypted`
  and system provider key storage.
- Decrypt only inside resolver and connection-test service boundaries. Do not
  put decrypted keys on Pydantic response models, logs, exceptions, or long-lived
  caches.
- Key rotation is out of scope for WS-12; leave a versioned envelope format
  (`v1:<fernet-token>`) so a later migration can rotate safely.

Masking rule:

- `has_api_key = bool(ciphertext)`.
- `api_key_masked` should reveal only a stable short suffix after decrypting in
  memory, for example `sk-...abcd`, and should be `null` when no key exists.
- `/api/config` must not include `api_key_masked` for the system default
  summary. Public callers receive `has_api_key` only, so ordinary users never
  see even the masked system key suffix.

## API Implementation Units

Future implementation should add or update these files:

- `web/backend/models.py`
  - Add `UserLLMProviderSetting`.
  - Add `User.llm_provider_settings` relationship.
  - Add `LLMProvider.is_default`.
- `web/backend/schemas.py`
  - Add request/response schemas from `backend/openapi.yaml`.
  - Mark key input fields write-only by convention in schema docs and never use
    them on response schemas.
- `web/backend/routes/user_llm_settings_routes.py`
  - Implement `/api/user/llm-settings` and nested provider CRUD/test endpoints.
- `web/backend/routes/llm_config_routes.py`
  - Add `/api/admin/llm/system-default` GET/PUT.
  - Keep default-provider behavior separate from Provider/Model directory CRUD.
- `web/backend/routes/config_routes.py`
  - Add non-sensitive `system_default` to `/api/config`.
- `web/backend/services/llm_connection.py`
  - Centralize connection testing for admin and user provider tests.
- `web/backend/services/llm_resolution.py`
  - Centralize `resolve_llm_config`.
- `web/backend/routes/analysis_routes.py`
  - Stop saving request `api_key` into `UserConfig.last_api_key`.
  - Call `resolve_llm_config` before creating `AnalysisRecord`.
- `web/backend/routes/scheduled_task_routes.py`,
  `web/backend/services/task_executor.py`, and `web/backend/app.py`
  - Use the same resolver for scheduled analysis creation/execution.

## Resolver Contract

Implement `resolve_llm_config(db, user, request_config)` as the only backend
entry point for deciding effective provider/key/model/base URL.

Return a value object with:

- `source`: `request_override`, `user_provider`, `user_default`, or
  `system_default`.
- `provider_name`
- `base_url`
- `shallow_model`
- `deep_model`
- `api_key`
- `user_provider_id` nullable
- `system_provider_id` nullable

Priority:

1. Request-level explicit provider/base URL/API key/model. This is one-time and
   is not persisted into user settings.
2. If a provider is explicitly selected and no request key is supplied, use the
   enabled user profile matching that provider.
3. If no provider is selected, use the user's enabled default profile.
4. If the user has no applicable enabled profile, use the active system default
   provider.
5. If no valid provider/key/base URL can be resolved, return a structured error.

Important edge cases:

- If the user explicitly selects a provider that has a saved profile but no key,
  return `USER_LLM_PROVIDER_KEY_MISSING`; do not silently fall back to system
  default.
- If the user has enabled profiles but no default and the request does not
  select a provider, return `USER_LLM_DEFAULT_NOT_SET`.
- If no system default is configured, return `SYSTEM_DEFAULT_PROVIDER_NOT_SET`.
- If the selected system default is missing a key, return
  `SYSTEM_DEFAULT_PROVIDER_KEY_MISSING`.
- Validate base URLs before using them. In production, reject loopback,
  link-local, and private network URLs unless an explicit deployment allowlist
  enables private LLM endpoints.

## Error Format

New WS-12 endpoints should use the structured error body defined in
`backend/openapi.yaml`:

```json
{
  "error": {
    "code": "USER_LLM_PROVIDER_KEY_MISSING",
    "message": "The selected provider has no saved API key.",
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
- `USER_LLM_PROVIDER_KEY_MISSING`
- `USER_LLM_DEFAULT_NOT_SET`
- `LLM_PROVIDER_NOT_FOUND`
- `LLM_PROVIDER_INACTIVE`
- `SYSTEM_DEFAULT_PROVIDER_NOT_SET`
- `SYSTEM_DEFAULT_PROVIDER_KEY_MISSING`
- `INVALID_BASE_URL`
- `CONNECTION_TEST_FAILED`
- `LLM_CONFIG_UNRESOLVED`

## Migration Strategy

1. Add `UserLLMProviderSetting` table and `LLMProvider.is_default`.
2. Add encryption helper and migrate current system provider keys in place:
   plaintext `llm_providers.api_key` values become `v1:<ciphertext>`.
3. Do not automatically migrate every user's `UserConfig.last_api_key` into a
   provider profile without explicit user action. It may be ambiguous and can
   mismatch provider/base URL/model.
4. `GET /api/user/llm-settings` returns `has_legacy_config = true` when
   `UserConfig.last_llm_provider` and `last_api_key` exist. It may also include
   optional `legacy_migration` detail for copy and prefill. The UI can offer a
   confirm-and-save flow that creates a proper provider profile.
5. Keep `UserConfig.last_*` as analysis form preference cache during the WS-12
   rollout, but remove it from the formal key-resolution priority.
6. After story-004 lands, plan a follow-up to stop returning plaintext
   `last_api_key` from `/api/user/config` or replace it with masked metadata.

## Security and Permissions

- User settings endpoints must require authentication and always filter by
  `user_id = current_user.id`.
- Admin system-default endpoints must require `current_user.role == "admin"`.
- Public `/api/config` may expose system default provider name, display name,
  base URL, models, and `has_api_key`, but no plaintext key and no masked key
  suffix.
- User provider list responses expose only key metadata:
  `has_api_key`, `api_key_masked`, `last_validated_at`,
  `last_validation_status`.
- Connection-test responses must sanitize upstream error bodies. Truncate
  diagnostics and redact bearer tokens or key-like strings before returning or
  logging.
- Do not write API keys to frontend localStorage, backend logs, task logs,
  exception messages, or websocket progress messages.

## Observability

Log these fields around resolver and connection-test operations:

- user ID
- provider source
- provider name
- user provider ID or system provider ID
- validation status
- structured error code

Never log:

- API key plaintext
- encrypted key ciphertext
- authorization headers
- upstream response bodies before redaction

## Test Expectations for Implementation Stories

Backend tests should cover:

- Creating two provider profiles for one user, each with independent key state.
- Replacing a key via `api_key` without returning plaintext.
- Clearing a key via `api_key: null`.
- Setting one user default unsets the previous default.
- Rejecting inactive system default provider selection.
- `/api/config` includes a non-sensitive system default summary.
- `resolve_llm_config` priority:
  - request-level explicit key wins and is not persisted;
  - explicit provider uses matching user profile;
  - no explicit provider uses user default;
  - no user config uses system default;
  - missing key/default errors are structured and do not fall through silently.
- Scheduled task creation/execution uses the same resolver as immediate
  analysis.

## Handoff Notes

- `backend/openapi.yaml` is ready for frontend mirroring as
  `frontend/api-contract.md`.
- Story-002 should implement user provider persistence and profile-page API
  integration.
- Story-003 should implement admin default provider API/UI against the same
  `/api/admin/llm/system-default` contract.
- Story-004 should replace analysis and scheduled-task key selection with
  `resolve_llm_config`.
