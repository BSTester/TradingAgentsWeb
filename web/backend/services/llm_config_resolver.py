"""LLM 配置校验（请求即配置）。

本项目不维护任何后端 LLM 配置：没有 Provider/模型目录、没有系统默认 Provider、
没有用户级持久化设置。分析所需的 provider / backend_url / 模型 / api_key 全部由
前端随请求提交（密钥来自浏览器 keyVault），本模块只做校验与错误契约。

错误码：
- ``REQUEST_API_KEY_REQUIRED``：未提供 api_key（提示用户到「设置」页配置本地密钥）
- ``REQUEST_CONFIG_INVALID``：provider / 模型 / backend_url 缺失或非法
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import urlparse

from fastapi import HTTPException
from fastapi.responses import JSONResponse


@dataclass(frozen=True)
class ResolvedLLMConfig:
    llm_provider: str
    backend_url: str
    shallow_thinker: str
    deep_thinker: str
    api_key: str
    source: str


class LLMConfigResolutionError(HTTPException):
    """Structured LLM config error matching the API contract."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        self.code = code
        self.message = message
        self.details = details
        super().__init__(
            status_code=status_code,
            detail={
                "error": {
                    "code": code,
                    "message": message,
                    "details": details,
                    "request_id": None,
                }
            },
        )


def llm_config_error_response(exc: LLMConfigResolutionError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=exc.detail)


def _clean(value: Optional[str]) -> str:
    return str(value or "").strip()


def _raise_invalid(message: str, **details: Any) -> None:
    raise LLMConfigResolutionError(
        status_code=400,
        code="REQUEST_CONFIG_INVALID",
        message=message,
        details=details or None,
    )


def _validate_backend_url(base_url: str) -> None:
    parsed = urlparse(base_url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        _raise_invalid("backend_url 必须是合法的 http(s) 地址", backend_url=base_url)


def resolve_llm_config_from_request(
    *,
    llm_provider: Optional[str],
    backend_url: Optional[str],
    shallow_thinker: Optional[str],
    deep_thinker: Optional[str],
    api_key: Optional[str],
) -> ResolvedLLMConfig:
    """校验并返回请求自带的 LLM 配置（唯一来源）。

    Raises:
        LLMConfigResolutionError: api_key 缺失或配置非法。
    """
    provider = _clean(llm_provider).lower()
    key = _clean(api_key)
    base_url = _clean(backend_url)
    shallow = _clean(shallow_thinker)
    deep = _clean(deep_thinker)

    if not key:
        raise LLMConfigResolutionError(
            status_code=400,
            code="REQUEST_API_KEY_REQUIRED",
            message="缺少 API Key：请在「设置」页保存本地密钥后重新发起分析",
        )
    if not provider:
        _raise_invalid("缺少 llm_provider")
    if not shallow or not deep:
        _raise_invalid("缺少 shallow_thinker / deep_thinker 模型名")
    if not base_url:
        _raise_invalid("缺少 backend_url")
    _validate_backend_url(base_url)

    return ResolvedLLMConfig(
        llm_provider=provider,
        backend_url=base_url,
        shallow_thinker=shallow,
        deep_thinker=deep,
        api_key=key,
        source="request",
    )
