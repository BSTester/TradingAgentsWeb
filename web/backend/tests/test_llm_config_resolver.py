"""请求即配置：LLM 配置只来自请求体，缺失或非法时返回结构化 400。

背景：项目不再维护任何后端 LLM 配置（无 Provider 目录、无系统默认、无用户级
持久化设置），分析所需的 provider / backend_url / 模型 / api_key 全部由前端随
请求提交，密钥来自浏览器 keyVault。
"""

import pytest

from web.backend.services.llm_config_resolver import (
    LLMConfigResolutionError,
    resolve_llm_config_from_request,
)


def _ok(**overrides):
    payload = dict(
        llm_provider="openai",
        backend_url="https://api.openai.com/v1",
        shallow_thinker="gpt-4o-mini",
        deep_thinker="gpt-4o",
        api_key="sk-test",
    )
    payload.update(overrides)
    return payload


def test_accepts_complete_request_config():
    resolved = resolve_llm_config_from_request(**_ok())
    assert resolved.llm_provider == "openai"
    assert resolved.backend_url == "https://api.openai.com/v1"
    assert resolved.shallow_thinker == "gpt-4o-mini"
    assert resolved.deep_thinker == "gpt-4o"
    assert resolved.api_key == "sk-test"
    assert resolved.source == "request"


def test_provider_is_normalized_to_lowercase():
    assert (
        resolve_llm_config_from_request(**_ok(llm_provider="OpenAI")).llm_provider
        == "openai"
    )


@pytest.mark.parametrize(
    ("field", "code"),
    [
        ("api_key", "REQUEST_API_KEY_REQUIRED"),
        ("llm_provider", "REQUEST_CONFIG_INVALID"),
        ("shallow_thinker", "REQUEST_CONFIG_INVALID"),
        ("deep_thinker", "REQUEST_CONFIG_INVALID"),
        ("backend_url", "REQUEST_CONFIG_INVALID"),
    ],
)
def test_rejects_incomplete_request_config(field, code):
    with pytest.raises(LLMConfigResolutionError) as exc_info:
        resolve_llm_config_from_request(**_ok(**{field: None}))
    assert exc_info.value.code == code


@pytest.mark.parametrize("bad_url", ["ftp://x", "not-a-url", "javascript:alert(1)"])
def test_rejects_non_http_backend_url(bad_url):
    with pytest.raises(LLMConfigResolutionError) as exc_info:
        resolve_llm_config_from_request(**_ok(backend_url=bad_url))
    assert exc_info.value.code == "REQUEST_CONFIG_INVALID"


def test_error_detail_matches_api_contract():
    with pytest.raises(LLMConfigResolutionError) as exc_info:
        resolve_llm_config_from_request(**_ok(api_key=" "))

    detail = exc_info.value.detail
    assert detail["error"]["code"] == "REQUEST_API_KEY_REQUIRED"
    assert detail["error"]["request_id"] is None
    assert "设置" in detail["error"]["message"]
