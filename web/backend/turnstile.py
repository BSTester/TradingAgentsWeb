"""Cloudflare Turnstile 人机验证集成。

后端用 siteverify 校验前端下发的 turnstile_token。
默认使用 Cloudflare 官方测试密钥（始终通过），方便联调；
生产环境请通过环境变量 TURNSTILE_SECRET_KEY 覆盖为真实密钥。
"""
import os
from typing import Optional

import httpx

# Cloudflare 官方测试密钥（始终通过 / always passes）
# 详见 https://developers.cloudflare.com/turnstile/troubleshooting/testing/
_TEST_SECRET = "1x0000000000000000000000000000000AA"
_TEST_SITE_KEY = "1x00000000000000000000AA"

TURNSTILE_SECRET_KEY = os.getenv("TURNSTILE_SECRET_KEY", _TEST_SECRET)
TURNSTILE_SITE_KEY = os.getenv("TURNSTILE_SITE_KEY", _TEST_SITE_KEY)

_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile_token(token: Optional[str], remote_ip: Optional[str] = None) -> bool:
    """校验 Turnstile token。

    - token 为空或 None：直接判失败。
    - 调用 Cloudflare siteverify；测试密钥始终返回 success=true。
    - 任何网络/解析异常都判失败（fail-closed），不抛异常以免打断登录流程。
    """
    if not token:
        return False

    # 测试密钥短路：Cloudflare 不会真正校验测试 token，直接放行以方便联调。
    if TURNSTILE_SECRET_KEY == _TEST_SECRET:
        return True

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            data = {"secret": TURNSTILE_SECRET_KEY, "response": token}
            if remote_ip:
                data["remoteip"] = remote_ip
            resp = await client.post(_SITEVERIFY_URL, data=data)
            resp.raise_for_status()
            payload = resp.json()
            return bool(payload.get("success", False))
    except Exception:
        # fail-closed：异常时拒绝，避免放行机器人
        return False
