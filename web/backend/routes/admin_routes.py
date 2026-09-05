#!/usr/bin/env python3
"""Admin console routes (WS-133 redesign) — subscription products & public report governance.

Admin-only: reuse `require_admin` from user_management_routes.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from web.backend.database import get_db
from web.backend.models import SubscriptionPlan, CreditTransaction, AnalysisRecord, User
from web.backend.schemas import (
    AdminSubscriptionPlanIn,
    AdminSubscriptionPlanOut,
    AdminSubscriptionPlanUpdate,
    AdminOrderOut,
    UserRoleUpdateIn,
    ReportPublicIn,
)
from web.backend.routes.user_management_routes import require_admin
from web.backend.services.report_formatter import report_preview

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------- 订阅商品管理 ----------

@router.get("/subscription-products")
async def list_subscription_products(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """All plans (including inactive), newest first."""
    result = await db.execute(
        select(SubscriptionPlan).order_by(desc(SubscriptionPlan.id))
    )
    plans = result.scalars().all()
    return {"data": [AdminSubscriptionPlanOut.model_validate(p) for p in plans]}


@router.post("/subscription-products")
async def create_subscription_product(
    body: AdminSubscriptionPlanIn,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    plan = SubscriptionPlan(
        name=body.name,
        credits=body.credits,
        price=body.price,
        description=body.description,
        is_active=body.is_active,
        sort_order=body.sort_order,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return {"data": AdminSubscriptionPlanOut.model_validate(plan)}


@router.patch("/subscription-products/{plan_id}")
async def update_subscription_product(
    plan_id: int,
    body: AdminSubscriptionPlanUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Modify an existing subscription plan (name/credits/price/description/active)."""
    plan = (await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id))).scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail="套餐不存在")

    if body.name is not None:
        plan.name = body.name
    if body.credits is not None:
        plan.credits = body.credits
    if body.price is not None:
        plan.price = body.price
    if body.description is not None:
        plan.description = body.description
    if body.is_active is not None:
        plan.is_active = body.is_active
    if body.sort_order is not None:
        plan.sort_order = body.sort_order

    await db.commit()
    await db.refresh(plan)
    return {"data": AdminSubscriptionPlanOut.model_validate(plan)}


@router.delete("/subscription-products/{plan_id}")
async def delete_subscription_product(
    plan_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a subscription plan. Existing credit transactions keep their plan_name (string)."""
    plan = (await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id))).scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail="套餐不存在")
    await db.delete(plan)
    await db.commit()
    return {"data": {"id": plan_id, "deleted": True}}


# ---------- 订单列表（所有用户的次数流水）----------

@router.get("/orders")
async def list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: str = Query("", description="按类型过滤：purchase/consume/refund/grant"),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func
    filters = []
    if type:
        filters.append(CreditTransaction.type == type)

    count_stmt = select(func.count(CreditTransaction.id)).where(*filters)
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = (
        select(CreditTransaction, User)
        .join(User, CreditTransaction.user_id == User.id)
        .where(*filters)
        .order_by(desc(CreditTransaction.id))
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()

    items = [
        {
            "id": ct.id,
            "user_id": ct.user_id,
            "username": u.username,
            "type": ct.type,
            "amount": ct.amount,
            "balance": ct.balance,
            "status": ct.status,
            "description": ct.description,
            "plan_name": ct.plan_name,
            "created_at": ct.created_at.isoformat() if ct.created_at else None,
        }
        for ct, u in rows
    ]
    return {"data": items, "meta": {"page": page, "limit": limit, "total": total, "has_next": page * limit < total}}


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
        "balance": user.credit_balance or 0,
    }
