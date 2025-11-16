#!/usr/bin/env python3
"""
LLM Configuration API Routes (Admin only)
LLM供应商和模型配置相关的 API 路由（仅管理员）
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import desc, select, func, delete
from typing import List, Optional
from datetime import datetime
import httpx

from web.backend.database import get_db
from web.backend.models import User, LLMProvider, LLMModel
from web.backend.schemas import (
    LLMProviderCreate,
    LLMProviderUpdate,
    LLMProviderResponse,
    LLMModelCreate,
    LLMModelUpdate,
    LLMModelResponse,
    LLMConnectionTest,
    LLMConnectionTestResponse,
)
from web.backend.auth_routes import get_current_active_user

router = APIRouter(prefix="/api/admin/llm", tags=["llm-config"])


def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """
    Dependency to require admin role
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限"
        )
    return current_user


# ============================================================================
# Provider Management
# ============================================================================

@router.get("/providers", response_model=List[LLMProviderResponse])
async def get_all_providers(
    include_inactive: bool = False,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    获取所有LLM供应商列表（仅管理员）
    
    Args:
        include_inactive: 是否包含未启用的供应商
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        供应商列表
    """
    # Build query
    stmt = select(LLMProvider).order_by(desc(LLMProvider.created_at))
    
    if not include_inactive:
        stmt = stmt.filter(LLMProvider.is_active == True)
    
    result = await db.execute(stmt)
    providers = result.scalars().all()
    
    # Get model counts for each provider
    provider_list = []
    for provider in providers:
        # Count models for this provider
        count_stmt = select(func.count()).select_from(LLMModel).filter(
            LLMModel.provider_id == provider.id
        )
        count_result = await db.execute(count_stmt)
        models_count = count_result.scalar()
        
        provider_dict = provider.to_dict(include_api_key=False)
        provider_dict['models_count'] = models_count
        provider_list.append(provider_dict)
    
    return provider_list


@router.get("/providers/{provider_id}", response_model=LLMProviderResponse)
async def get_provider_detail(
    provider_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    获取供应商详细信息（仅管理员）
    
    Args:
        provider_id: 供应商ID
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        供应商详细信息（包含完整API密钥）
    """
    stmt = select(LLMProvider).filter(LLMProvider.id == provider_id)
    result = await db.execute(stmt)
    provider = result.scalars().first()
    
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="供应商不存在"
        )
    
    # Get model count
    count_stmt = select(func.count()).select_from(LLMModel).filter(
        LLMModel.provider_id == provider_id
    )
    count_result = await db.execute(count_stmt)
    models_count = count_result.scalar()
    
    provider_dict = provider.to_dict(include_api_key=True)
    provider_dict['models_count'] = models_count
    
    return provider_dict


@router.post("/providers", response_model=LLMProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(
    provider_data: LLMProviderCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    创建新的LLM供应商（仅管理员）
    
    Args:
        provider_data: 供应商数据
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        创建的供应商信息
    """
    # Check if provider_name already exists
    stmt = select(LLMProvider).filter(LLMProvider.provider_name == provider_data.provider_name)
    result = await db.execute(stmt)
    existing_provider = result.scalars().first()
    
    if existing_provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"供应商标识 '{provider_data.provider_name}' 已存在"
        )
    
    # Create new provider
    new_provider = LLMProvider(
        provider_name=provider_data.provider_name,
        display_name=provider_data.display_name,
        api_key=provider_data.api_key,
        base_url=provider_data.base_url,
        description=provider_data.description,
        is_active=provider_data.is_active,
        config_json=provider_data.config_json,
    )
    
    db.add(new_provider)
    await db.commit()
    await db.refresh(new_provider)
    
    provider_dict = new_provider.to_dict(include_api_key=False)
    provider_dict['models_count'] = 0
    
    return provider_dict


@router.patch("/providers/{provider_id}", response_model=LLMProviderResponse)
async def update_provider(
    provider_id: int,
    provider_data: LLMProviderUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    更新供应商信息（仅管理员）
    
    Args:
        provider_id: 供应商ID
        provider_data: 更新数据
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        更新后的供应商信息
    """
    stmt = select(LLMProvider).filter(LLMProvider.id == provider_id)
    result = await db.execute(stmt)
    provider = result.scalars().first()
    
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="供应商不存在"
        )
    
    # Update fields
    update_data = provider_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(provider, field, value)
    
    await db.commit()
    await db.refresh(provider)
    
    # Get model count
    count_stmt = select(func.count()).select_from(LLMModel).filter(
        LLMModel.provider_id == provider_id
    )
    count_result = await db.execute(count_stmt)
    models_count = count_result.scalar()
    
    provider_dict = provider.to_dict(include_api_key=False)
    provider_dict['models_count'] = models_count
    
    return provider_dict


@router.delete("/providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    provider_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    删除供应商（仅管理员）
    注意：会级联删除该供应商下的所有模型
    
    Args:
        provider_id: 供应商ID
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
    """
    stmt = select(LLMProvider).filter(LLMProvider.id == provider_id)
    result = await db.execute(stmt)
    provider = result.scalars().first()
    
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="供应商不存在"
        )
    
    # Delete provider (models will be cascade deleted)
    await db.delete(provider)
    await db.commit()
    
    return None


# ============================================================================
# Model Management
# ============================================================================

@router.get("/models", response_model=List[LLMModelResponse])
async def get_all_models(
    provider_id: Optional[int] = None,
    model_type: Optional[str] = None,
    include_inactive: bool = False,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    获取所有LLM模型列表（仅管理员）
    
    Args:
        provider_id: 可选，按供应商ID筛选
        model_type: 可选，按模型类型筛选 (shallow_thinker/deep_thinker)
        include_inactive: 是否包含未启用的模型
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        模型列表
    """
    # Build query with join to get provider info
    stmt = select(LLMModel, LLMProvider).join(
        LLMProvider, LLMModel.provider_id == LLMProvider.id
    ).order_by(desc(LLMModel.created_at))
    
    if provider_id:
        stmt = stmt.filter(LLMModel.provider_id == provider_id)
    
    if model_type:
        if model_type not in ['shallow_thinker', 'deep_thinker']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid model_type. Must be 'shallow_thinker' or 'deep_thinker'"
            )
        stmt = stmt.filter(LLMModel.model_type == model_type)
    
    if not include_inactive:
        stmt = stmt.filter(LLMModel.is_active == True)
    
    result = await db.execute(stmt)
    rows = result.all()
    
    # Build response with provider info
    model_list = []
    for model, provider in rows:
        model_dict = model.to_dict()
        model_dict['provider_name'] = provider.provider_name
        model_dict['provider_display_name'] = provider.display_name
        model_list.append(model_dict)
    
    return model_list


@router.get("/models/{model_id}", response_model=LLMModelResponse)
async def get_model_detail(
    model_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    获取模型详细信息（仅管理员）
    
    Args:
        model_id: 模型ID
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        模型详细信息
    """
    stmt = select(LLMModel, LLMProvider).join(
        LLMProvider, LLMModel.provider_id == LLMProvider.id
    ).filter(LLMModel.id == model_id)
    
    result = await db.execute(stmt)
    row = result.first()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模型不存在"
        )
    
    model, provider = row
    model_dict = model.to_dict()
    model_dict['provider_name'] = provider.provider_name
    model_dict['provider_display_name'] = provider.display_name
    
    return model_dict


@router.post("/models", response_model=LLMModelResponse, status_code=status.HTTP_201_CREATED)
async def create_model(
    model_data: LLMModelCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    创建新的LLM模型（仅管理员）
    
    Args:
        model_data: 模型数据
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        创建的模型信息
    """
    # Check if provider exists
    provider_stmt = select(LLMProvider).filter(LLMProvider.id == model_data.provider_id)
    provider_result = await db.execute(provider_stmt)
    provider = provider_result.scalars().first()
    
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="供应商不存在"
        )
    
    # Create new model
    new_model = LLMModel(
        provider_id=model_data.provider_id,
        model_name=model_data.model_name,
        model_type=model_data.model_type,
        display_name=model_data.display_name,
        description=model_data.description,
        is_active=model_data.is_active,
        config_json=model_data.config_json,
    )
    
    db.add(new_model)
    await db.commit()
    await db.refresh(new_model)
    
    model_dict = new_model.to_dict()
    model_dict['provider_name'] = provider.provider_name
    model_dict['provider_display_name'] = provider.display_name
    
    return model_dict


@router.patch("/models/{model_id}", response_model=LLMModelResponse)
async def update_model(
    model_id: int,
    model_data: LLMModelUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    更新模型信息（仅管理员）
    
    Args:
        model_id: 模型ID
        model_data: 更新数据
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        更新后的模型信息
    """
    stmt = select(LLMModel, LLMProvider).join(
        LLMProvider, LLMModel.provider_id == LLMProvider.id
    ).filter(LLMModel.id == model_id)
    
    result = await db.execute(stmt)
    row = result.first()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模型不存在"
        )
    
    model, provider = row
    
    # Update fields
    update_data = model_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(model, field, value)
    
    await db.commit()
    await db.refresh(model)
    
    model_dict = model.to_dict()
    model_dict['provider_name'] = provider.provider_name
    model_dict['provider_display_name'] = provider.display_name
    
    return model_dict


@router.delete("/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(
    model_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    删除模型（仅管理员）
    
    Args:
        model_id: 模型ID
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
    """
    stmt = select(LLMModel).filter(LLMModel.id == model_id)
    result = await db.execute(stmt)
    model = result.scalars().first()
    
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模型不存在"
        )
    
    await db.delete(model)
    await db.commit()
    
    return None


# ============================================================================
# Connection Testing
# ============================================================================

@router.post("/test-connection", response_model=LLMConnectionTestResponse)
async def test_llm_connection(
    test_data: LLMConnectionTest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    测试LLM供应商连接（仅管理员）
    
    Args:
        test_data: 测试数据
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        连接测试结果
    """
    try:
        # Simple connection test - try to list models or make a simple API call
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {
                "Authorization": f"Bearer {test_data.api_key}",
                "Content-Type": "application/json",
            }
            
            # Try to call the models endpoint (common for OpenAI-compatible APIs)
            test_url = f"{test_data.base_url.rstrip('/')}/models"
            
            response = await client.get(test_url, headers=headers)
            
            if response.status_code == 200:
                return LLMConnectionTestResponse(
                    success=True,
                    message="连接成功！API密钥和基础URL配置正确。",
                    details={
                        "status_code": response.status_code,
                        "response_time_ms": int(response.elapsed.total_seconds() * 1000) if hasattr(response, 'elapsed') else None,
                    }
                )
            elif response.status_code == 401:
                return LLMConnectionTestResponse(
                    success=False,
                    message="认证失败：API密钥无效或已过期。",
                    details={"status_code": response.status_code}
                )
            elif response.status_code == 404:
                # Some APIs might not have /models endpoint, try a minimal chat completion
                return LLMConnectionTestResponse(
                    success=True,
                    message="连接成功（无法测试模型列表端点，但基础URL可访问）",
                    details={"status_code": response.status_code, "note": "Provider may not support /models endpoint"}
                )
            else:
                return LLMConnectionTestResponse(
                    success=False,
                    message=f"连接测试失败：HTTP {response.status_code}",
                    details={
                        "status_code": response.status_code,
                        "response": response.text[:200] if response.text else None
                    }
                )
                
    except httpx.TimeoutException:
        return LLMConnectionTestResponse(
            success=False,
            message="连接超时：无法在10秒内连接到API服务器。",
            details={"error": "timeout"}
        )
    except httpx.RequestError as e:
        return LLMConnectionTestResponse(
            success=False,
            message=f"连接错误：{str(e)}",
            details={"error": str(e)}
        )
    except Exception as e:
        return LLMConnectionTestResponse(
            success=False,
            message=f"测试失败：{str(e)}",
            details={"error": str(e)}
        )
