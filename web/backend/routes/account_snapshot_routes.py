"""
Account Snapshot Routes

API endpoints for managing and retrieving account snapshots
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc
from typing import List
from datetime import datetime, timedelta

from web.backend.database import get_db
from web.backend.models import AccountSnapshot, User
from web.backend.auth_routes import get_current_user

router = APIRouter(prefix="/api/account-snapshots", tags=["account-snapshots"])


@router.get("/trend/{market_type}")
async def get_account_trend(
    market_type: str,
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get account balance trend for the specified market
    
    Args:
        market_type: Market type (US, HK, CN)
        days: Number of days to retrieve (default: 30)
    
    Returns:
        List of daily snapshots with balance information
    """
    # Calculate date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    # Query snapshots
    query = select(AccountSnapshot).where(
        and_(
            AccountSnapshot.user_id == current_user.id,
            AccountSnapshot.market_type == market_type.upper(),
            AccountSnapshot.snapshot_date >= start_date,
            AccountSnapshot.snapshot_date <= end_date
        )
    ).order_by(AccountSnapshot.snapshot_date.asc())
    
    result = await db.execute(query)
    snapshots = result.scalars().all()
    
    # Format response
    trend_data = []
    for snapshot in snapshots:
        trend_data.append({
            "date": snapshot.snapshot_date.strftime("%Y-%m-%d"),
            "total_assets": snapshot.total_assets,
            "cash": snapshot.cash,
            "market_value": snapshot.market_value,
            "unrealized_pnl": snapshot.unrealized_pnl,
            "realized_pnl": snapshot.realized_pnl,
        })
    
    return {
        "market_type": market_type.upper(),
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": end_date.strftime("%Y-%m-%d"),
        "data": trend_data
    }


@router.get("/latest/{market_type}")
async def get_latest_snapshot(
    market_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the latest account snapshot for the specified market
    """
    query = select(AccountSnapshot).where(
        and_(
            AccountSnapshot.user_id == current_user.id,
            AccountSnapshot.market_type == market_type.upper()
        )
    ).order_by(desc(AccountSnapshot.snapshot_date)).limit(1)
    
    result = await db.execute(query)
    snapshot = result.scalar_one_or_none()
    
    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No snapshot found for market {market_type}"
        )
    
    return snapshot.to_dict()


# Manual snapshot creation endpoint removed - snapshots are now created automatically
# by the snapshot scheduler at market close times


@router.get("/stats/{market_type}")
async def get_account_stats(
    market_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get account statistics for the specified market
    
    Returns:
        - Latest snapshot
        - 7-day change
        - 30-day change
        - Total snapshots count
    """
    # Get latest snapshot
    latest_query = select(AccountSnapshot).where(
        and_(
            AccountSnapshot.user_id == current_user.id,
            AccountSnapshot.market_type == market_type.upper()
        )
    ).order_by(desc(AccountSnapshot.snapshot_date)).limit(1)
    
    latest_result = await db.execute(latest_query)
    latest = latest_result.scalar_one_or_none()
    
    if not latest:
        return {
            "market_type": market_type.upper(),
            "latest": None,
            "change_7d": None,
            "change_30d": None,
            "total_snapshots": 0
        }
    
    # Get snapshot from 7 days ago
    date_7d_ago = datetime.now() - timedelta(days=7)
    query_7d = select(AccountSnapshot).where(
        and_(
            AccountSnapshot.user_id == current_user.id,
            AccountSnapshot.market_type == market_type.upper(),
            AccountSnapshot.snapshot_date <= date_7d_ago
        )
    ).order_by(desc(AccountSnapshot.snapshot_date)).limit(1)
    
    result_7d = await db.execute(query_7d)
    snapshot_7d = result_7d.scalar_one_or_none()
    
    # Get snapshot from 30 days ago
    date_30d_ago = datetime.now() - timedelta(days=30)
    query_30d = select(AccountSnapshot).where(
        and_(
            AccountSnapshot.user_id == current_user.id,
            AccountSnapshot.market_type == market_type.upper(),
            AccountSnapshot.snapshot_date <= date_30d_ago
        )
    ).order_by(desc(AccountSnapshot.snapshot_date)).limit(1)
    
    result_30d = await db.execute(query_30d)
    snapshot_30d = result_30d.scalar_one_or_none()
    
    # Calculate changes
    change_7d = None
    if snapshot_7d:
        change_7d = {
            "amount": latest.total_assets - snapshot_7d.total_assets,
            "percentage": ((latest.total_assets - snapshot_7d.total_assets) / snapshot_7d.total_assets * 100) if snapshot_7d.total_assets > 0 else 0
        }
    
    change_30d = None
    if snapshot_30d:
        change_30d = {
            "amount": latest.total_assets - snapshot_30d.total_assets,
            "percentage": ((latest.total_assets - snapshot_30d.total_assets) / snapshot_30d.total_assets * 100) if snapshot_30d.total_assets > 0 else 0
        }
    
    # Get total count
    count_query = select(func.count(AccountSnapshot.id)).where(
        and_(
            AccountSnapshot.user_id == current_user.id,
            AccountSnapshot.market_type == market_type.upper()
        )
    )
    count_result = await db.execute(count_query)
    total_count = count_result.scalar()
    
    return {
        "market_type": market_type.upper(),
        "latest": latest.to_dict(),
        "change_7d": change_7d,
        "change_30d": change_30d,
        "total_snapshots": total_count
    }
