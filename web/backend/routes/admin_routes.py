#!/usr/bin/env python3
"""Admin console routes — user management & public report governance.

Admin-only: reuse `require_admin` from user_management_routes.

注意：订阅商品与订单管理已随订阅功能下线移除。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from web.backend.database import get_db
from web.backend.models import AnalysisRecord, User
from web.backend.schemas import UserRoleUpdateIn, ReportPublicIn
from web.backend.routes.user_management_routes import require_admin
from web.backend.services.report_formatter import report_preview

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------- 用户管理（角色 / 状态）----------

@router.post("/users/{user_id}/active")
async def set_user_active(
    user_id: int,
    body: dict,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.is_active = bool(body.get("is_active"))
    await db.commit()
    await db.refresh(user)
    return {"data": _admin_user(user)}


@router.post("/users/{user_id}/role")
async def set_user_role(
    user_id: int,
    body: UserRoleUpdateIn,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.role = body.role
    await db.commit()
    await db.refresh(user)
    return {"data": _admin_user(user)}


# ---------- 公开报告治理 ----------

@router.get("/public-reports")
async def public_reports(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    market: str = "",
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func
    filters = []
    if market:
        filters.append(AnalysisRecord.market == market)

    count_stmt = select(func.count(AnalysisRecord.id)).where(*filters)
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = (
        select(AnalysisRecord)
        .where(*filters)
        .order_by(desc(AnalysisRecord.created_at))
        .offset((page - 1) * limit)
        .limit(limit)
    )
    records = (await db.execute(stmt)).scalars().all()

    items = []
    for rec in records:
        preview = report_preview(rec)
        preview["owner"] = None
        if rec.user_id:
            u = (await db.execute(select(User).where(User.id == rec.user_id))).scalars().first()
            preview["owner"] = u.username if u else None
        items.append(preview)

    return {"data": items, "meta": {"page": page, "limit": limit, "total": total, "has_next": page * limit < total}}


@router.post("/reports/{report_id}/public")
async def set_report_public(
    report_id: str,
    body: ReportPublicIn,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AnalysisRecord).where(AnalysisRecord.analysis_id == report_id))
    rec = result.scalars().first()
    if not rec:
        raise HTTPException(status_code=404, detail="报告不存在")
    rec.is_public = body.is_public
    await db.commit()
    return {"data": {"analysis_id": report_id, "is_public": rec.is_public}}


def _admin_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }
