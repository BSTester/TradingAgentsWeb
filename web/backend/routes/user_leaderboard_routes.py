"""
User Leaderboard Toggle Routes

用户排名开关相关API
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from web.backend.database import get_db
from web.backend.models import User
from web.backend.auth_routes import get_current_user

router = APIRouter(prefix="/api/user", tags=["user-leaderboard"])


@router.post("/leaderboard-toggle")
async def toggle_leaderboard_participation(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    切换用户是否参加排名
    """
    # Get current user
    query = select(User).where(User.id == current_user.id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Toggle the participation flag
    user.participate_in_leaderboard = not user.participate_in_leaderboard

    await db.commit()

    return {
        "success": True,
        "participating": user.participate_in_leaderboard,
        "message": "已开启排名展示" if user.participate_in_leaderboard else "已关闭排名展示"
    }
