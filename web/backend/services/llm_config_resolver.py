#!/usr/bin/env python3
"""Central LLM configuration resolution for analysis entrypoints."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import urlparse

from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from web.backend.models import LLMModel, LLMProvider, UserLLMProviderSetting


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


def _raise_error(
    status_code: int,
    code: str,
    message: str,
    details: Optional[dict[str, Any]] = None,
) -> None:
    raise LLMConfigResolutionError(status_code, code, message, details)


def _clean(value: Optional[str]) -> str:
    return str(value or "").strip()


def _validate_base_url(base_url: str) -> None:
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        _raise_error(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_BASE_URL",
            "provider/base URL 无效：base URL 必须是有效的 HTTP(S) 地址。",
        )


def _validate_request_config(
    llm_provider: str,
    backend_url: str,
    shallow_thinker: str,
    deep_thinker: str,
) -> None:
    if not llm_provider:
        _raise_error(
            status.HTTP_400_BAD_REQUEST,
            "REQUEST_PROVIDER_INVALID",
            "请求级 provider 无效：缺少 provider。",
        )
    if not backend_url:
        _raise_error(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_BASE_URL",
            "provider/base URL 无效：缺少 base URL。",
        )
    _validate_base_url(backend_url)
    if not shallow_thinker or not deep_thinker:
        _raise_error(
            status.HTTP_400_BAD_REQUEST,
            "LLM_CONFIG_UNRESOLVED",
            "provider/base URL 无效：缺少模型配置。",
        )


async def _get_user_provider(
    db: AsyncSession,
    user_id: int,
    provider_name: str,
) -> Optional[UserLLMProviderSetting]:
    if not provider_name:
        return None
    result = await db.execute(
        select(UserLLMProviderSetting).where(
            UserLLMProviderSetting.user_id == user_id,
            UserLLMProviderSetting.provider_name == provider_name,
            UserLLMProviderSetting.is_enabled == True,
        )
    )
    return result.scalars().first()


def _get_user_provider_sync(
    db: Session,
    user_id: int,
    provider_name: str,
) -> Optional[UserLLMProviderSetting]:
    if not provider_name:
        return None
    return db.execute(
        select(UserLLMProviderSetting).where(
            UserLLMProviderSetting.user_id == user_id,
            UserLLMProviderSetting.provider_name == provider_name,
            UserLLMProviderSetting.is_enabled == True,
        )
    ).scalars().first()


async def _get_catalog_provider(
    db: AsyncSession,
    provider_name: str,
) -> Optional[LLMProvider]:
    if not provider_name:
        return None
    result = await db.execute(
        select(LLMProvider)
        .where(
            LLMProvider.provider_name == provider_name,
            LLMProvider.is_active == True,
        )
        .order_by(LLMProvider.id)
    )
    return result.scalars().first()


def _get_catalog_provider_sync(
    db: Session,
    provider_name: str,
) -> Optional[LLMProvider]:
    if not provider_name:
        return None
    return db.execute(
        select(LLMProvider)
        .where(
            LLMProvider.provider_name == provider_name,
            LLMProvider.is_active == True,
        )
        .order_by(LLMProvider.id)
    ).scalars().first()


async def _get_system_default(db: AsyncSession) -> Optional[LLMProvider]:
    result = await db.execute(
        select(LLMProvider)
        .where(LLMProvider.is_default == True, LLMProvider.is_active == True)
        .order_by(LLMProvider.id)
    )
    return result.scalars().first()


def _get_system_default_sync(db: Session) -> Optional[LLMProvider]:
    return db.execute(
        select(LLMProvider)
        .where(LLMProvider.is_default == True, LLMProvider.is_active == True)
        .order_by(LLMProvider.id)
    ).scalars().first()


def select_system_models(
    models: list[Any],
    requested_shallow: Optional[str],
    requested_deep: Optional[str],
) -> tuple[Optional[str], Optional[str]]:
    """Use the caller's active catalog selection, with first-model fallback only when absent."""
    shallow_models = [model.model_name for model in models if model.model_type == "shallow_thinker"]
    deep_models = [model.model_name for model in models if model.model_type == "deep_thinker"]
    shallow_request = _clean(requested_shallow)
    deep_request = _clean(requested_deep)

    if shallow_request and shallow_request not in shallow_models:
        _raise_error(
            status.HTTP_400_BAD_REQUEST,
            "REQUEST_MODEL_INVALID",
            "所选快速模型不属于当前系统默认 provider 的可用模型目录。",
        )
    if deep_request and deep_request not in deep_models:
        _raise_error(
            status.HTTP_400_BAD_REQUEST,
            "REQUEST_MODEL_INVALID",
            "所选深度模型不属于当前系统默认 provider 的可用模型目录。",
        )

    return (
        shallow_request or (shallow_models[0] if shallow_models else None),
        deep_request or (deep_models[0] if deep_models else None),
    )


async def _model_hints(
    db: AsyncSession,
    provider_id: int,
    requested_shallow: Optional[str] = None,
    requested_deep: Optional[str] = None,
) -> tuple[Optional[str], Optional[str]]:
    result = await db.execute(
        select(LLMModel)
        .where(LLMModel.provider_id == provider_id, LLMModel.is_active == True)
        .order_by(LLMModel.id)
    )
    return select_system_models(result.scalars().all(), requested_shallow, requested_deep)


def _model_hints_sync(
    db: Session,
    provider_id: int,
    requested_shallow: Optional[str] = None,
    requested_deep: Optional[str] = None,
) -> tuple[Optional[str], Optional[str]]:
    models = db.execute(
        select(LLMModel)
        .where(LLMModel.provider_id == provider_id, LLMModel.is_active == True)
        .order_by(LLMModel.id)
    ).scalars().all()
    return select_system_models(models, requested_shallow, requested_deep)


def _resolve_with_system_default(
    provider: Optional[LLMProvider],
    model_hints: tuple[Optional[str], Optional[str]],
) -> ResolvedLLMConfig:
    if provider is None:
        _raise_error(
            status.HTTP_409_CONFLICT,
            "SYSTEM_DEFAULT_PROVIDER_NOT_SET",
            "没有可用的系统默认 provider。请在 AI 设置中提供本次 KEY，或联系管理员配置系统默认 provider。",
        )

    api_key = _clean(provider.api_key)
    if not api_key:
        _raise_error(
            status.HTTP_409_CONFLICT,
            "SYSTEM_DEFAULT_PROVIDER_CREDENTIAL_MISSING",
            "系统默认 provider 未配置 KEY。请联系管理员补充系统默认 provider 的后端 KEY。",
        )

    backend_url = _clean(provider.base_url)
    if not backend_url:
        _raise_error(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_BASE_URL",
            "系统默认 provider/base URL 无效：缺少 base URL。",
        )
    _validate_base_url(backend_url)

    shallow, deep = model_hints
    if not shallow or not deep:
        _raise_error(
            status.HTTP_409_CONFLICT,
            "LLM_CONFIG_UNRESOLVED",
            "系统默认 provider 缺少模型配置。请联系管理员配置默认模型。",
        )

    return ResolvedLLMConfig(
        llm_provider=provider.provider_name,
        backend_url=backend_url,
        shallow_thinker=shallow,
        deep_thinker=deep,
        api_key=api_key,
        source="system_default",
    )


def _is_same_provider(left: Optional[LLMProvider], right: Optional[LLMProvider]) -> bool:
    return bool(left is not None and right is not None and left.id == right.id)


def _request_provider_invalid(provider_name: str) -> None:
    _raise_error(
        status.HTTP_400_BAD_REQUEST,
        "REQUEST_PROVIDER_INVALID",
        f"请求级 provider 无效或未启用：{provider_name}。",
    )


def _request_provider_key_required(provider_name: str, display_name: Optional[str] = None) -> None:
    provider_label = display_name or provider_name
    _raise_error(
        status.HTTP_409_CONFLICT,
        "REQUEST_PROVIDER_KEY_REQUIRED",
        (
            f"所选 provider「{provider_label}」当前请求未提供 KEY。"
            "请在分析页补充 KEY，保存到当前浏览器，或切换到系统默认 provider。"
        ),
    )


async def resolve_llm_config(
    db: AsyncSession,
    *,
    user_id: int,
    llm_provider: Optional[str],
    backend_url: Optional[str],
    shallow_thinker: Optional[str],
    deep_thinker: Optional[str],
    api_key: Optional[str],
) -> ResolvedLLMConfig:
    """Resolve request, user-profile, and system-default LLM settings.

    User provider metadata never supplies a KEY. If the selected provider belongs
    to the user and no request KEY is present, return an actionable error instead
    of silently switching to the system default.
    """
    provider_name = _clean(llm_provider).lower()
    request_key = _clean(api_key)
    explicit_provider = bool(provider_name)
    user_provider = await _get_user_provider(db, user_id, provider_name) if explicit_provider else None
    catalog_provider = await _get_catalog_provider(db, provider_name) if explicit_provider else None

    if explicit_provider and user_provider is None and catalog_provider is None:
        _request_provider_invalid(provider_name)

    if request_key:
        request_backend_url = _clean(backend_url)
        request_shallow = _clean(shallow_thinker)
        request_deep = _clean(deep_thinker)
        _validate_request_config(provider_name, request_backend_url, request_shallow, request_deep)
        return ResolvedLLMConfig(
            llm_provider=provider_name,
            backend_url=request_backend_url,
            shallow_thinker=request_shallow,
            deep_thinker=request_deep,
            api_key=request_key,
            source="request",
        )

    if user_provider is not None:
        _request_provider_key_required(provider_name, user_provider.display_name)

    system_default = await _get_system_default(db)
    if explicit_provider and catalog_provider is not None and not _is_same_provider(catalog_provider, system_default):
        _request_provider_key_required(provider_name, catalog_provider.display_name)

    hints = (
        await _model_hints(db, system_default.id, shallow_thinker, deep_thinker)
        if system_default
        else (None, None)
    )
    return _resolve_with_system_default(system_default, hints)


def resolve_llm_config_sync(
    db: Session,
    *,
    user_id: int,
    llm_provider: Optional[str],
    backend_url: Optional[str],
    shallow_thinker: Optional[str],
    deep_thinker: Optional[str],
    api_key: Optional[str],
) -> ResolvedLLMConfig:
    provider_name = _clean(llm_provider).lower()
    request_key = _clean(api_key)
    explicit_provider = bool(provider_name)
    user_provider = _get_user_provider_sync(db, user_id, provider_name) if explicit_provider else None
    catalog_provider = _get_catalog_provider_sync(db, provider_name) if explicit_provider else None

    if explicit_provider and user_provider is None and catalog_provider is None:
        _request_provider_invalid(provider_name)

    if request_key:
        request_backend_url = _clean(backend_url)
        request_shallow = _clean(shallow_thinker)
        request_deep = _clean(deep_thinker)
        _validate_request_config(provider_name, request_backend_url, request_shallow, request_deep)
        return ResolvedLLMConfig(
            llm_provider=provider_name,
            backend_url=request_backend_url,
            shallow_thinker=request_shallow,
            deep_thinker=request_deep,
            api_key=request_key,
            source="request",
        )

    if user_provider is not None:
        _request_provider_key_required(provider_name, user_provider.display_name)

    system_default = _get_system_default_sync(db)
    if explicit_provider and catalog_provider is not None and not _is_same_provider(catalog_provider, system_default):
        _request_provider_key_required(provider_name, catalog_provider.display_name)

    hints = (
        _model_hints_sync(db, system_default.id, shallow_thinker, deep_thinker)
        if system_default
        else (None, None)
    )
    return _resolve_with_system_default(system_default, hints)
