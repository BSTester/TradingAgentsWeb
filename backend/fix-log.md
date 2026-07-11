# Backend Fix Log

## WS-17

- Stopped `/api/user/config` from returning or accepting legacy `last_api_key` values.
- Removed legacy `last_api_key` from the user-config cache payload.
- Updated conversation-triggered analysis to use the central LLM resolver and keep analysis records free of user key material.
- Added regression tests for user config key redaction and conversation analysis key persistence.
