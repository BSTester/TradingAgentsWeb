#!/usr/bin/env python3
"""
Leaderboard API Routes
排行榜相关的 API 路由
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import desc, func, select
from typing import Dict, List
from collections import defaultdict

from web.backend.database import get_db
from web.backend.models import AnalysisRecord

router = APIRouter(prefix="/api", tags=["leaderboard"])


@router.get("/leaderboard")
async def get_leaderboard(db: AsyncSession = Depends(get_db)) -> Dict[str, List[dict]]:
    """
    获取排行榜数据，按市场分组返回最新的10条完成分析
    
    Returns:
        Dict with keys 'US', 'HK', 'CN', each containing a list of analysis records
    """
    # Query all completed and public analyses, ordered by completion time
    stmt = select(AnalysisRecord).filter(
        AnalysisRecord.status == 'completed',
        AnalysisRecord.market != None,
        AnalysisRecord.is_public == True  # Only show public analyses
    ).order_by(
        desc(AnalysisRecord.completed_at)
    )
    result = await db.execute(stmt)
    completed_analyses = result.scalars().all()
    
    # Group by market and deduplicate by ticker (keep latest)
    market_data = {
        'US': {},
        'HK': {},
        'CN': {}
    }
    
    for analysis in completed_analyses:
        market = analysis.market
        ticker = analysis.ticker
        
        # Skip if market is invalid
        if market not in market_data:
            continue
        
        # Only keep the latest analysis for each ticker
        if ticker not in market_data[market]:
            market_data[market][ticker] = {
                'analysis_id': analysis.analysis_id,
                'ticker': analysis.ticker,
                'market': analysis.market,
                'analysis_date': analysis.analysis_date,
                'trading_decision': analysis.trading_decision,
                'completed_at': analysis.completed_at.isoformat() if analysis.completed_at else None,
                'progress_percentage': analysis.progress_percentage
            }
    
    # Convert to list and take top 10 for each market
    result = {}
    for market in ['US', 'HK', 'CN']:
        # Convert dict values to list and take first 10
        market_list = list(market_data[market].values())[:10]
        result[market] = market_list
    
    return result
