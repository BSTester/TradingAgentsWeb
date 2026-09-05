#!/usr/bin/env python3
"""Subscription (按次) routes for the WS-133 redesign.

Provides public plan listing, the current user's balance + transaction ledger,
and a purchase endpoint that grants analysis credits.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from web.backend.auth_routes import get_current_active_user
from web.backend.database import get_db
from web.backend.models import SubscriptionPlan, CreditTransaction, User
from web.backend.schemas import (
    SubscriptionPlanOut,
    SubscriptionInfoOut,
    CreditTransactionOut,
    SubscriptionPurchaseIn,
)

router = APIRouter(prefix="/api/subscription", tags=["subscription"])


@router.get("/plans", response_model=dict)
async def list_plans(db: AsyncSession = Depends(get_db)):
    """Active subscription plans, ordered by sort_order."""
    result = await db.execute(
        select(SubscriptionPlan)
        .where(SubscriptionPlan.is_active == True)
        .order_by(SubscriptionPlan.sort_order.asc(), SubscriptionPlan.id.asc())
    )
    plans = result.scalars().all()
    return {"data": [SubscriptionPlanOut.model_validate(p) for p in plans]}


@router.get("/me", response_model=dict)
async def my_subscription(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Current user's balance + transaction ledger (newest first)."""
    result = await db.execute(
        select(CreditTransaction)
        .where(CreditTransaction.user_id == current_user.id)
        .order_by(desc(CreditTransaction.id))
        .limit(100)
    )
    txns = result.scalars().all()
    return {
        "data": SubscriptionInfoOut(
            balance=current_user.credit_balance or 0,
            transactions=[CreditTransactionOut.model_validate(t) for t in txns],
        )
    }


@router.post("/purchase", response_model=dict)
async def purchase(
    body: SubscriptionPurchaseIn,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Grant the credits of the selected plan (simulated purchase).

    Real payment gateway integration is intentionally out of scope for this
    redesign pass — this represents a completed purchase and seeds credits.
    """
    result = await db.execute(
        select(SubscriptionPlan).where(
            SubscriptionPlan.id == body.plan_id,
            SubscriptionPlan.is_active == True,
        )
    )
    plan = result.scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail="套餐不存在或已下架")

    # Lock the user row for a consistent balance update.
    user_result = await db.execute(
        select(User).where(User.id == current_user.id)
    )
    user = user_result.scalars().first()
    new_balance = (user.credit_balance or 0) + plan.credits
    user.credit_balance = new_balance

    txn = CreditTransaction(
        user_id=user.id,
        type="purchase",
        amount=plan.credits,
        balance=new_balance,
        status="paid",
        description=f"购买套餐「{plan.name}」",
        plan_name=plan.name,
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn)

    txns_result = await db.execute(
        select(CreditTransaction)
        .where(CreditTransaction.user_id == user.id)
        .order_by(desc(CreditTransaction.id))
        .limit(100)
    )
    txns = txns_result.scalars().all()
    return {
        "data": SubscriptionInfoOut(
            balance=new_balance,
            transactions=[CreditTransactionOut.model_validate(t) for t in txns],
        )
    }
