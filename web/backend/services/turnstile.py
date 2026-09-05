#!/usr/bin/env python3
"""Cloudflare Turnstile verification (WS-133 redesign).

The redesign replaces the graphic captcha with Cloudflare Turnstile.
Keys come from env vars:
  - TURNSTILE_SITE_KEY   (public, served to frontend via /api/config)
  - TURNSTILE_SECRET_KEY (server-side verify)

When TURNSTILE_SECRET_KEY is not configured, verification is bypassed so the
app works in local/dev/test mode without keys (backward compatible).
"""

import os
import httpx

_TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def turnstile_enabled() -> bool:
    """True when a server-side secret key is configured."""
    return bool(os.getenv("TURNSTILE_SECRET_KEY", "").strip())


def turnstile_site_key() -> str:
    """The public site key (may be empty when not configured)."""
    return os.getenv("TURNSTILE_SITE_KEY", "").strip()


async def verify_turnstile(token: str | None) -> bool:
    """Verify a Turnstile token.

    Returns True when no secret key is configured (test mode bypass),
    or when the token is valid. Returns False for an invalid/empty token
    when a secret key IS configured.
    """
    secret = os.getenv("TURNSTILE_SECRET_KEY", "").strip()
    if not secret:
        return True  # Turnstile disabled — allow (dev/test mode)

    if not token:
        return False

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                _TURNSTILE_VERIFY_URL,
                data={"secret": secret, "response": token},
            )
            resp.raise_for_status()
            data = resp.json()
            return bool(data.get("success"))
    except Exception:
        # Network/verification errors: fail closed only when Turnstile enabled.
        return False
