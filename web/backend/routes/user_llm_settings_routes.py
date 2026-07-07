#!/usr/bin/env python3
"""
User LLM provider metadata API routes.
"""

from datetime import datetime, timezone
import re
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from web.backend.auth_routes import get_current_active_user
from web.backend.database import get_db
from web.backend.models import LLMProvider, User, UserConfig, UserLLMProviderSetting
from web.backend.schemas import (
    LegacyLLMConfigSummary,
    UserLLMConnectionTestRequest,
    UserLLMConnectionTestResponse,
    UserLLMProviderCreate,
    UserLLMProviderResponse,
    UserLLMProviderUpdate,
    UserLLMSettingsResponse,
)


router = APIRouter(prefix="/api/user/llm-settings", tags=["user-llm-settings"])

SENSITIVE_DETAIL_KEYS = {"authorization", "api_key", "apikey", "token", "secret", "password", "key"}


def error_response(status_code: int, code: str, message: str, details: Optional[Dict[str, Any]] = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details,
                "request_id": None,
            }
        },
    )


def provider_to_response(provider: UserLLMProviderSetting) -> UserLLMProviderResponse:
    return UserLLMProviderResponse(
        id=provider.id,
        provider_name=provider.provider_name,
        provider_type=provider.provider_type,
        catalog_provider_id=provider.catalog_provider_id,
        display_name=provider.display_name,
        base_url=provider.base_url,
        shallow_model=provider.shallow_model,
        deep_model=provider.deep_model,
        is_enabled=provider.is_enabled,
        is_default=provider.is_default,
        last_validated_at=provider.last_validated_at,
        last_validation_status=provider.last_validation_status,
        created_at=provider.created_at,
        updated_at=provider.updated_at,
    )


async def get_user_provider(
    db: AsyncSession,
    user_id: int,
    provider_id: int,
) -> Optional[UserLLMProviderSetting]:
    result = await db.execute(
        select(UserLLMProviderSetting).where(
            UserLLMProviderSetting.id == provider_id,
            UserLLMProviderSetting.user_id == user_id,
        )
    )
    return result.scalars().first()


async def provider_name_exists(db: AsyncSession, user_id: int, provider_name: str, exclude_id: Optional[int] = None) -> bool:
    stmt = select(UserLLMProviderSetting.id).where(
        UserLLMProviderSetting.user_id == user_id,
        UserLLMProviderSetting.provider_name == provider_name,
    )
    if exclude_id is not None:
        stmt = stmt.where(UserLLMProviderSetting.id != exclude_id)
    result = await db.execute(stmt)
    return result.scalars().first() is not None


async def validate_catalog_provider(db: AsyncSession, provider_type: str, catalog_provider_id: Optional[int]):
    if provider_type != "catalog" and catalog_provider_id is None:
        return None
    if provider_type == "catalog" and catalog_provider_id is None:
        return error_response(
            status.HTTP_400_BAD_REQUEST,
            "VALIDATION_ERROR",
            "catalog_provider_id is required for catalog provider profiles.",
        )

    result = await db.execute(select(LLMProvider).where(LLMProvider.id == catalog_provider_id))
    if not result.scalars().first():
        return error_response(
            status.HTTP_404_NOT_FOUND,
            "LLM_PROVIDER_NOT_FOUND",
            "Catalog provider does not exist.",
            {"catalog_provider_id": catalog_provider_id},
        )
    return None


async def make_only_default(db: AsyncSession, user_id: int, provider: UserLLMProviderSetting) -> Optional[JSONResponse]:
    if not provider.is_enabled:
        return error_response(
            status.HTTP_409_CONFLICT,
            "USER_LLM_PROVIDER_DISABLED",
            "A disabled provider profile cannot be set as default.",
        )

    result = await db.execute(
        select(UserLLMProviderSetting).where(
            UserLLMProviderSetting.user_id == user_id,
            UserLLMProviderSetting.id != provider.id,
        )
    )
    for other in result.scalars().all():
        other.is_default = False
    provider.is_default = True
    return None


async def ensure_user_has_default(db: AsyncSession, user_id: int):
    result = await db.execute(
        select(UserLLMProviderSetting)
        .where(UserLLMProviderSetting.user_id == user_id)
        .order_by(UserLLMProviderSetting.id)
    )
    providers = result.scalars().all()

    active_default = next((provider for provider in providers if provider.is_default and provider.is_enabled), None)
    if active_default:
        for provider in providers:
            if provider.id != active_default.id and provider.is_default:
                provider.is_default = False
        return

    selected = next((provider for provider in providers if provider.is_enabled), None)
    for provider in providers:
        provider.is_default = selected is not None and provider.id == selected.id


def redact_secret(value: Any, secret: str) -> Any:
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            lowered = str(key).lower()
            if any(sensitive in lowered for sensitive in SENSITIVE_DETAIL_KEYS):
                continue
            cleaned[key] = redact_secret(item, secret)
        return cleaned
    if isinstance(value, list):
        return [redact_secret(item, secret) for item in value]
    if isinstance(value, str):
        text = value.replace(secret, "[redacted]") if secret else value
        text = re.sub(r"Bearer\s+[A-Za-z0-9._~+/=-]+", "Bearer [redacted]", text)
        return text[:500]
    return value


def sanitized_test_result(raw_result: Dict[str, Any], api_key: str) -> Dict[str, Any]:
    valid = bool(raw_result.get("valid"))
    message = str(raw_result.get("message") or ("Connection test succeeded." if valid else "Connection test failed."))
    details = raw_result.get("details")
    return {
        "valid": valid,
        "message": redact_secret(message, api_key),
        "details": redact_secret(details, api_key) if isinstance(details, (dict, list, str)) else None,
    }


async def validate_user_llm_provider_connection(
    provider_name: str,
    api_key: str,
    base_url: str,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    headers = {"Content-Type": "application/json"}
    if provider_name == "anthropic":
        headers["x-api-key"] = api_key
        headers["anthropic-version"] = "2023-06-01"
    elif provider_name == "google":
        headers["x-goog-api-key"] = api_key
    else:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(f"{base_url.rstrip('/')}/models", headers=headers)
    except httpx.TimeoutException:
        return {"valid": False, "message": "Connection timed out while testing the provider."}
    except httpx.RequestError:
        return {"valid": False, "message": "Could not connect to the provider base URL."}

    if response.status_code in {401, 403}:
        return {"valid": False, "message": "Provider rejected the supplied request-time key."}
    if response.status_code == 404:
        return {"valid": False, "message": "Provider models endpoint was not found; check the base URL."}
    return {"valid": True, "message": "Connection test succeeded."}


@router.get("", response_model=UserLLMSettingsResponse)
async def list_user_llm_settings(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserLLMProviderSetting)
        .where(UserLLMProviderSetting.user_id == current_user.id)
        .order_by(UserLLMProviderSetting.id)
    )
    providers = result.scalars().all()
    default_provider = next((provider for provider in providers if provider.is_default), None)

    config_result = await db.execute(select(UserConfig).where(UserConfig.user_id == current_user.id))
    legacy_config = config_result.scalars().first()
    has_legacy_config = bool(
        legacy_config
        and (
            legacy_config.last_llm_provider
            or legacy_config.last_backend_url
            or legacy_config.last_shallow_thinker
            or legacy_config.last_deep_thinker
        )
    )

    return UserLLMSettingsResponse(
        providers=[provider_to_response(provider) for provider in providers],
        default_provider_id=default_provider.id if default_provider else None,
        has_legacy_config=has_legacy_config,
        legacy_config=LegacyLLMConfigSummary(
            available=has_legacy_config,
            last_llm_provider=legacy_config.last_llm_provider if legacy_config else None,
            last_backend_url=legacy_config.last_backend_url if legacy_config else None,
        )
        if has_legacy_config
        else None,
    )


@router.post("/providers", response_model=UserLLMProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_user_llm_provider(
    provider_data: UserLLMProviderCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if await provider_name_exists(db, current_user.id, provider_data.provider_name):
        return error_response(
            status.HTTP_409_CONFLICT,
            "USER_LLM_PROVIDER_DUPLICATE",
            "A provider profile with this provider_name already exists for this user.",
        )

    catalog_error = await validate_catalog_provider(db, provider_data.provider_type, provider_data.catalog_provider_id)
    if catalog_error:
        return catalog_error

    if provider_data.is_default and not provider_data.is_enabled:
        return error_response(
            status.HTTP_409_CONFLICT,
            "USER_LLM_PROVIDER_DISABLED",
            "A disabled provider profile cannot be set as default.",
        )

    provider = UserLLMProviderSetting(
        user_id=current_user.id,
        provider_name=provider_data.provider_name,
        provider_type=provider_data.provider_type,
        catalog_provider_id=provider_data.catalog_provider_id,
        display_name=provider_data.display_name.strip(),
        base_url=provider_data.base_url,
        shallow_model=provider_data.shallow_model.strip(),
        deep_model=provider_data.deep_model.strip(),
        is_enabled=provider_data.is_enabled,
        is_default=provider_data.is_default,
        last_validation_status="untested",
    )
    db.add(provider)
    await db.flush()

    if provider.is_default:
        default_error = await make_only_default(db, current_user.id, provider)
        if default_error:
            await db.rollback()
            return default_error
    else:
        await ensure_user_has_default(db, current_user.id)

    await db.commit()
    await db.refresh(provider)
    return provider_to_response(provider)


@router.patch("/providers/{provider_id}", response_model=UserLLMProviderResponse)
async def update_user_llm_provider(
    provider_id: int,
    provider_data: UserLLMProviderUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if hasattr(provider_data, "model_dump"):
        update_data = provider_data.model_dump(exclude_unset=True)
    else:
        update_data = provider_data.dict(exclude_unset=True)
    if not update_data:
        return error_response(status.HTTP_400_BAD_REQUEST, "VALIDATION_ERROR", "At least one field must be supplied.")

    provider = await get_user_provider(db, current_user.id, provider_id)
    if not provider:
        return error_response(
            status.HTTP_404_NOT_FOUND,
            "USER_LLM_PROVIDER_NOT_FOUND",
            "Provider profile was not found for this user.",
        )

    if update_data.get("is_default") is True and update_data.get("is_enabled", provider.is_enabled) is False:
        return error_response(
            status.HTTP_409_CONFLICT,
            "USER_LLM_PROVIDER_DISABLED",
            "A disabled provider profile cannot be set as default.",
        )

    for field, value in update_data.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(provider, field, value)

    if provider.is_default and not provider.is_enabled:
        provider.is_default = False
        await ensure_user_has_default(db, current_user.id)
    elif provider.is_default:
        default_error = await make_only_default(db, current_user.id, provider)
        if default_error:
            await db.rollback()
            return default_error
    else:
        await ensure_user_has_default(db, current_user.id)

    await db.commit()
    await db.refresh(provider)
    return provider_to_response(provider)


@router.delete("/providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_llm_provider(
    provider_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    provider = await get_user_provider(db, current_user.id, provider_id)
    if not provider:
        return error_response(
            status.HTTP_404_NOT_FOUND,
            "USER_LLM_PROVIDER_NOT_FOUND",
            "Provider profile was not found for this user.",
        )

    await db.delete(provider)
    await db.flush()
    await ensure_user_has_default(db, current_user.id)
    await db.commit()
    return None


@router.post("/providers/{provider_id}/test", response_model=UserLLMConnectionTestResponse)
async def test_user_llm_provider(
    provider_id: int,
    request: UserLLMConnectionTestRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    provider = await get_user_provider(db, current_user.id, provider_id)
    if not provider:
        return error_response(
            status.HTTP_404_NOT_FOUND,
            "USER_LLM_PROVIDER_NOT_FOUND",
            "Provider profile was not found for this user.",
        )

    base_url = request.base_url or provider.base_url
    raw_result = await validate_user_llm_provider_connection(
        provider.provider_name,
        request.api_key,
        base_url,
        request.model,
    )
    result = sanitized_test_result(raw_result, request.api_key)

    provider.last_validated_at = datetime.now(timezone.utc)
    provider.last_validation_status = "ok" if result["valid"] else "failed"
    await db.commit()
    await db.refresh(provider)

    return UserLLMConnectionTestResponse(
        valid=result["valid"],
        message=result["message"],
        details=result["details"],
        last_validated_at=provider.last_validated_at,
        last_validation_status=provider.last_validation_status,
    )
