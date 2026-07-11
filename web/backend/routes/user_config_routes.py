#!/usr/bin/env python3
"""
User Configuration API Routes
用户配置相关的 API 路由
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from web.backend.database import get_db
from web.backend.models import User, UserConfig
from web.backend.schemas import UserConfigUpdate, UserConfigResponse
from web.backend.auth_routes import get_current_active_user

router = APIRouter(prefix="/api/user", tags=["user-config"])


@router.get("/config", response_model=UserConfigResponse)
async def get_user_config(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user configuration - returns all cached analysis settings (requires authentication)"""
    stmt = select(UserConfig).filter(UserConfig.user_id == current_user.id)
    result = await db.execute(stmt)
    config = result.scalars().first()
    
    if not config:
        # Create default config if not exists
        config = UserConfig(user_id=current_user.id)
        db.add(config)
        await db.commit()
        await db.refresh(config)
    
    return UserConfigResponse(
        last_ticker=config.last_ticker,  # 返回最后的股票代码
        last_analysts=config.last_analysts,
        last_research_depth=config.last_research_depth,
        last_llm_provider=config.last_llm_provider,
        last_shallow_thinker=config.last_shallow_thinker,
        last_deep_thinker=config.last_deep_thinker,
        last_backend_url=config.last_backend_url,
    )


@router.put("/config", response_model=UserConfigResponse)
async def update_user_config(
    config_update: UserConfigUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user configuration - saves all analysis settings to server (requires authentication)"""
    stmt = select(UserConfig).filter(UserConfig.user_id == current_user.id)
    result = await db.execute(stmt)
    config = result.scalars().first()
    
    if not config:
        # Create new config if not exists
        config = UserConfig(user_id=current_user.id)
        db.add(config)
    
    # Update analysis configuration fields if provided
    if config_update.last_ticker is not None:
        config.last_ticker = config_update.last_ticker
    if config_update.last_analysts is not None:
        config.last_analysts = config_update.last_analysts
    if config_update.last_research_depth is not None:
        config.last_research_depth = config_update.last_research_depth
    if config_update.last_llm_provider is not None:
        config.last_llm_provider = config_update.last_llm_provider
    if config_update.last_shallow_thinker is not None:
        config.last_shallow_thinker = config_update.last_shallow_thinker
    if config_update.last_deep_thinker is not None:
        config.last_deep_thinker = config_update.last_deep_thinker
    if config_update.last_backend_url is not None:
        config.last_backend_url = config_update.last_backend_url
    
    await db.commit()
    await db.refresh(config)
    
    # Invalidate cache after update
    from web.backend.services.user_config_cache import invalidate_user_config_cache
    invalidate_user_config_cache(current_user.id)
    
    return UserConfigResponse(
        last_ticker=config.last_ticker,
        last_analysts=config.last_analysts,
        last_research_depth=config.last_research_depth,
        last_llm_provider=config.last_llm_provider,
        last_shallow_thinker=config.last_shallow_thinker,
        last_deep_thinker=config.last_deep_thinker,
        last_backend_url=config.last_backend_url,
    )
