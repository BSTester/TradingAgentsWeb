# WS-14 Backend Notes

Implemented user-owned LLM provider metadata APIs from `backend/openapi.yaml`:

- `GET /api/user/llm-settings`
- `POST /api/user/llm-settings/providers`
- `PATCH /api/user/llm-settings/providers/{provider_id}`
- `DELETE /api/user/llm-settings/providers/{provider_id}`
- `POST /api/user/llm-settings/providers/{provider_id}/test`

Persistence uses `user_llm_provider_settings` for metadata only. The table has no
user API key, mask, suffix, or key availability columns. Connection testing uses
the request-time key and stores only `last_validated_at` and
`last_validation_status`.
