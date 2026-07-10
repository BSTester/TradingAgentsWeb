# WS-16 API Contract: Effective LLM Resolution

## Scope

WS-16 centralizes LLM configuration resolution for immediate analysis and scheduled analysis tasks.

## Resolution Rules

1. If the request includes `api_key`, use the request-level `llm_provider`, `backend_url`, `shallow_thinker`, `deep_thinker`, and `api_key` for this run.
2. If the request does not include `api_key` and the selected `llm_provider` matches an enabled user provider profile, return `400` with an actionable message. The backend must not silently fall back to the system default for an explicit personal provider without a browser-supplied key.
3. If the request does not include `api_key` and no enabled user provider profile matches, use the active system default provider and its backend-managed key.
4. If the system default provider is missing, lacks a key, lacks a base URL, or lacks model hints, return `400` with an actionable message.
5. `UserConfig.last_api_key` is not a source in this resolution chain.

## Request Fields

Both `POST /api/analyze` and `POST /api/scheduled-tasks` use the same LLM input fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `llm_provider` | string | yes | Provider identifier selected by the client. |
| `backend_url` | string | yes when `api_key` is present | Must be an absolute HTTP(S) URL for request-level keys. |
| `shallow_thinker` | string | yes when `api_key` is present | Request-level shallow model. |
| `deep_thinker` | string | yes when `api_key` is present | Request-level deep model. |
| `api_key` | string | no | Request-scoped key from localStorage or one-time input. Never persisted to `UserConfig.last_api_key`. |

## Effective Runtime Payload

Backend task runners receive:

```json
{
  "llm_provider": "openai",
  "backend_url": "https://api.openai.com/v1",
  "shallow_thinker": "gpt-4o-mini",
  "deep_thinker": "gpt-4o",
  "api_key": "runtime-only-secret"
}
```

Analysis records persist provider/base URL/model metadata, but not the runtime key.

## Error Shape

Errors use FastAPI's existing shape:

```json
{
  "detail": "个人 provider「My DeepSeek」当前浏览器未随请求提供 KEY。请在分析页补充 KEY，保存到当前浏览器，或切换到系统默认 provider。"
}
```

## Frontend Contract

`AnalysisConfigForm`:

- Loads user provider metadata from `/api/user/llm-settings`.
- Loads system default summary from `/api/config.system_default`.
- Defaults to the user's default provider when configured.
- Defaults to the system default provider when the user has no provider metadata.
- Does not display or load saved backend user keys.
- Reads user keys only from browser `localStorage` via `useLocalLLMKeys`.
- Shows source labels: `个人配置（本浏览器 KEY）`, `个人配置，当前浏览器未保存 KEY`, `系统默认 Provider`, or `本次一次性输入`.
- Only saves a typed key to browser localStorage when the user explicitly checks the save option.
