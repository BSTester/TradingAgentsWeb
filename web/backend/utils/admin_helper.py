#!/usr/bin/env python3
"""
Admin helper utilities
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from web.backend.models import User


def is_admin(user: User) -> bool:
    """Check if user is admin"""
    return user.role == 'admin'


async def get_admin_users(db: AsyncSession) -> list[User]:
    """Get all admin users"""
    result = await db.execute(select(User).filter(User.role == 'admin'))
    return result.scalars().all()


async def get_user_count(db: AsyncSession) -> int:
    """Get total user count"""
    result = await db.execute(select(func.count()).select_from(User))
    return result.scalar()


async def ensure_first_user_is_admin_async(db: AsyncSession) -> None:
    """
    Ensure the first registered user is admin
    This is a safety check that can be run on startup
    """
    user_count = await get_user_count(db)
    
    if user_count == 0:
        return
    
    # Get first user by ID
    result = await db.execute(select(User).order_by(User.id).limit(1))
    first_user = result.scalar_one_or_none()
    
    if first_user and first_user.role != 'admin':
        first_user.role = 'admin'
        await db.commit()
        print(f"✅ Set first user '{first_user.username}' as admin")
