#!/usr/bin/env python3
"""
System default LLM provider service.

Keeps the default-provider invariant and non-sensitive summaries out of route
handlers so admin and public config endpoints use the same redaction rules.
"""

from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from web.backend.models import LLMModel, LLMProvider


def _http_error(status_code: int, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail=message)


def provider_has_credential(provider: LLMProvider) -> bool:
    return bool(str(provider.api_key or "").strip())


def provider_has_base_url(provider: LLMProvider) -> bool:
    return bool(str(provider.base_url or "").strip())


def mask_api_key(api_key: Optional[str]) -> Optional[str]:
    key = str(api_key or "").strip()
    if not key:
        return None
    if len(key) <= 4:
        return "***"

    prefix, separator, _ = key.partition("-")
    if separator and prefix:
        return f"{prefix}-***{key[-4:]}"
    return f"***{key[-4:]}"


async def _get_model_hints(db: AsyncSession, provider_id: int) -> dict[str, Optional[str]]:
    result = await db.execute(
        select(LLMModel)
        .where(
            LLMModel.provider_id == provider_id,
            LLMModel.is_active == True,
        )
        .order_by(LLMModel.id)
    )
    hints: dict[str, Optional[str]] = {
        "shallow_model": None,
        "deep_model": None,
    }

    for model in result.scalars().all():
        if model.model_type == "shallow_thinker" and hints["shallow_model"] is None:
            hints["shallow_model"] = model.model_name
        elif model.model_type == "deep_thinker" and hints["deep_model"] is None:
            hints["deep_model"] = model.model_name

    return hints


async def get_system_default_provider(db: AsyncSession) -> Optional[LLMProvider]:
    result = await db.execute(
        select(LLMProvider)
        .where(LLMProvider.is_default == True)
        .order_by(LLMProvider.id)
    )
    return result.scalars().first()


async def _admin_summary(db: AsyncSession, provider: LLMProvider) -> dict[str, Any]:
    has_api_key = provider_has_credential(provider)
    return {
        "provider_id": provider.id,
        "provider_name": provider.provider_name,
        "display_name": provider.display_name,
        "base_url": provider.base_url,
        "is_active": provider.is_active,
        "credential_configured": has_api_key,
        "has_api_key": has_api_key,
        "api_key_masked": mask_api_key(provider.api_key),
        **await _get_model_hints(db, provider.id),
        "updated_at": provider.updated_at,
    }


async def _public_summary(db: AsyncSession, provider: LLMProvider) -> dict[str, Any]:
    has_api_key = provider_has_credential(provider)
    return {
        "provider_id": provider.id,
        "provider_name": provider.provider_name,
        "display_name": provider.display_name,
        "base_url": provider.base_url,
        "has_api_key": has_api_key,
        "api_key_masked": mask_api_key(provider.api_key),
        **await _get_model_hints(db, provider.id),
    }


async def get_admin_system_default_provider(db: AsyncSession) -> Optional[dict[str, Any]]:
    provider = await get_system_default_provider(db)
    if provider is None:
        return None
    return await _admin_summary(db, provider)


async def get_public_system_default_provider(db: AsyncSession) -> Optional[dict[str, Any]]:
    provider = await get_system_default_provider(db)
    if provider is None:
        return None
    return await _public_summary(db, provider)


async def set_system_default_provider(db: AsyncSession, provider_id: int) -> dict[str, Any]:
    result = await db.execute(select(LLMProvider).where(LLMProvider.id == provider_id))
    provider = result.scalars().first()

    if provider is None:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            "Provider does not exist.",
        )

    if not provider.is_active:
        raise _http_error(
            status.HTTP_400_BAD_REQUEST,
            "cannot set inactive provider as system default",
        )

    if not provider_has_credential(provider):
        raise _http_error(
            status.HTTP_409_CONFLICT,
            "The selected provider has no backend-managed credential.",
        )

    if not provider_has_base_url(provider):
        raise _http_error(
            status.HTTP_409_CONFLICT,
            "The selected provider has no base URL configured.",
        )

    await db.execute(update(LLMProvider).values(is_default=False))
    provider.is_default = True
    await db.commit()
    await db.refresh(provider)

    return await _admin_summary(db, provider)
