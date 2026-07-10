#!/usr/bin/env python3
"""Central LLM configuration resolution for analysis entrypoints."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse

from fastapi import HTTPException, status
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


def _clean(value: Optional[str]) -> str:
    return str(value or "").strip()


def _validate_base_url(base_url: str) -> None:
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="provider/base URL 无效：base URL 必须是有效的 HTTP(S) 地址。",
        )


def _validate_request_config(
    llm_provider: str,
    backend_url: str,
    shallow_thinker: str,
    deep_thinker: str,
) -> None:
    if not llm_provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="provider/base URL 无效：缺少 provider。",
        )
    if not backend_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="provider/base URL 无效：缺少 base URL。",
        )
    _validate_base_url(backend_url)
    if not shallow_thinker or not deep_thinker:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="provider/base URL 无效：缺少模型配置。",
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


async def _model_hints(db: AsyncSession, provider_id: int) -> tuple[Optional[str], Optional[str]]:
    result = await db.execute(
        select(LLMModel)
        .where(LLMModel.provider_id == provider_id, LLMModel.is_active == True)
        .order_by(LLMModel.id)
    )
    shallow = None
    deep = None
    for model in result.scalars().all():
        if model.model_type == "shallow_thinker" and shallow is None:
            shallow = model.model_name
        elif model.model_type == "deep_thinker" and deep is None:
            deep = model.model_name
    return shallow, deep


def _model_hints_sync(db: Session, provider_id: int) -> tuple[Optional[str], Optional[str]]:
    models = db.execute(
        select(LLMModel)
        .where(LLMModel.provider_id == provider_id, LLMModel.is_active == True)
        .order_by(LLMModel.id)
    ).scalars().all()
    shallow = None
    deep = None
    for model in models:
        if model.model_type == "shallow_thinker" and shallow is None:
            shallow = model.model_name
        elif model.model_type == "deep_thinker" and deep is None:
            deep = model.model_name
    return shallow, deep


def _resolve_with_system_default(
    provider: Optional[LLMProvider],
    model_hints: tuple[Optional[str], Optional[str]],
) -> ResolvedLLMConfig:
    if provider is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="没有可用的系统默认 provider。请在 AI 设置中提供本次 KEY，或联系管理员配置系统默认 provider。",
        )

    api_key = _clean(provider.api_key)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="系统默认 provider 未配置 KEY。请联系管理员补充系统默认 provider 的后端 KEY。",
        )

    backend_url = _clean(provider.base_url)
    if not backend_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="系统默认 provider/base URL 无效：缺少 base URL。",
        )
    _validate_base_url(backend_url)

    shallow, deep = model_hints
    if not shallow or not deep:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="系统默认 provider 缺少模型配置。请联系管理员配置默认模型。",
        )

    return ResolvedLLMConfig(
        llm_provider=provider.provider_name,
        backend_url=backend_url,
        shallow_thinker=shallow,
        deep_thinker=deep,
        api_key=api_key,
        source="system_default",
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

    user_provider = await _get_user_provider(db, user_id, provider_name)
    if user_provider is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"个人 provider「{user_provider.display_name}」当前浏览器未随请求提供 KEY。"
                "请在分析页补充 KEY，保存到当前浏览器，或切换到系统默认 provider。"
            ),
        )

    system_default = await _get_system_default(db)
    hints = await _model_hints(db, system_default.id) if system_default else (None, None)
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

    user_provider = _get_user_provider_sync(db, user_id, provider_name)
    if user_provider is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"个人 provider「{user_provider.display_name}」当前浏览器未随请求提供 KEY。"
                "请在分析页补充 KEY，保存到当前浏览器，或切换到系统默认 provider。"
            ),
        )

    system_default = _get_system_default_sync(db)
    hints = _model_hints_sync(db, system_default.id) if system_default else (None, None)
    return _resolve_with_system_default(system_default, hints)
