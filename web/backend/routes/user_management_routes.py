#!/usr/bin/env python3
"""
User Management API Routes (Admin only)
用户管理相关的 API 路由（仅管理员）
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import desc, select, func
from typing import List
from datetime import datetime

from web.backend.database import get_db
from web.backend.models import User
from web.backend.schemas import UserStatusUpdate
from web.backend.auth_routes import get_current_active_user

router = APIRouter(prefix="/api/admin", tags=["user-management"])


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


@router.get("/users")
async def get_all_users(
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    获取所有用户列表（仅管理员）
    
    Args:
        page: 页码（从1开始）
        limit: 每页数量
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        用户列表和分页信息
    """
    # 计算偏移量
    offset = (page - 1) * limit
    
    # 查询总数
    count_stmt = select(func.count()).select_from(User)
    total_result = await db.execute(count_stmt)
    total = total_result.scalar()
    
    # 查询用户列表
    stmt = select(User).order_by(desc(User.created_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    users = result.scalars().all()
    
    # 转换为字典列表
    user_list = []
    for user in users:
        user_list.append({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        })
    
    # 计算分页信息
    total_pages = (total + limit - 1) // limit
    
    return {
        "users": user_list,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1
    }


@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    获取用户详细信息（仅管理员）
    
    Args:
        user_id: 用户ID
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        用户详细信息
    """
    stmt = select(User).filter(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 获取用户的分析记录统计
    from web.backend.models import AnalysisRecord
    
    total_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.user_id == user_id
    )
    total_result = await db.execute(total_stmt)
    total_analyses = total_result.scalar()
    
    completed_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.user_id == user_id,
        AnalysisRecord.status == "completed"
    )
    completed_result = await db.execute(completed_stmt)
    completed_analyses = completed_result.scalar()
    
    running_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.user_id == user_id,
        AnalysisRecord.status.in_(["initializing", "running"])
    )
    running_result = await db.execute(running_stmt)
    running_analyses = running_result.scalar()
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "statistics": {
            "total_analyses": total_analyses,
            "completed_analyses": completed_analyses,
            "running_analyses": running_analyses
        }
    }


@router.get("/stats")
async def get_system_stats(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    获取系统统计信息（仅管理员）
    
    Args:
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        系统统计信息
    """
    from web.backend.models import AnalysisRecord
    
    # 用户统计
    total_users_stmt = select(func.count()).select_from(User)
    total_users_result = await db.execute(total_users_stmt)
    total_users = total_users_result.scalar()
    
    active_users_stmt = select(func.count()).select_from(User).filter(User.is_active == True)
    active_users_result = await db.execute(active_users_stmt)
    active_users = active_users_result.scalar()
    
    admin_users_stmt = select(func.count()).select_from(User).filter(User.role == "admin")
    admin_users_result = await db.execute(admin_users_stmt)
    admin_users = admin_users_result.scalar()
    
    # 分析统计
    total_analyses_stmt = select(func.count()).select_from(AnalysisRecord)
    total_analyses_result = await db.execute(total_analyses_stmt)
    total_analyses = total_analyses_result.scalar()
    
    completed_analyses_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.status == "completed"
    )
    completed_analyses_result = await db.execute(completed_analyses_stmt)
    completed_analyses = completed_analyses_result.scalar()
    
    running_analyses_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.status.in_(["initializing", "running"])
    )
    running_analyses_result = await db.execute(running_analyses_stmt)
    running_analyses = running_analyses_result.scalar()
    
    error_analyses_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.status == "error"
    )
    error_analyses_result = await db.execute(error_analyses_stmt)
    error_analyses = error_analyses_result.scalar()
    
    # 市场统计
    us_analyses_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.market == "US",
        AnalysisRecord.status == "completed"
    )
    us_analyses_result = await db.execute(us_analyses_stmt)
    us_analyses = us_analyses_result.scalar()
    
    hk_analyses_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.market == "HK",
        AnalysisRecord.status == "completed"
    )
    hk_analyses_result = await db.execute(hk_analyses_stmt)
    hk_analyses = hk_analyses_result.scalar()
    
    cn_analyses_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.market == "CN",
        AnalysisRecord.status == "completed"
    )
    cn_analyses_result = await db.execute(cn_analyses_stmt)
    cn_analyses = cn_analyses_result.scalar()
    
    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "admin": admin_users
        },
        "analyses": {
            "total": total_analyses,
            "completed": completed_analyses,
            "running": running_analyses,
            "error": error_analyses
        },
        "markets": {
            "US": us_analyses,
            "HK": hk_analyses,
            "CN": cn_analyses
        }
    }


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: int,
    status_update: UserStatusUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    更新用户状态（启用/禁用）（仅管理员）
    
    Args:
        user_id: 用户ID
        status_update: 状态更新数据
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        更新后的用户信息
    """
    
    # 防止管理员禁用自己的账户
    if user_id == current_user.id and not status_update.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="不能禁用当前登录的管理员账户"
        )
    
    # 查询用户
    stmt = select(User).filter(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 更新用户状态
    user.is_active = status_update.is_active
    await db.commit()
    await db.refresh(user)
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None
    }
