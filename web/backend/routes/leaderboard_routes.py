#!/usr/bin/env python3
"""
Leaderboard API Routes
排行榜相关的 API 路由
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import desc, func, select, over
from typing import Dict, List
from collections import defaultdict

from web.backend.database import get_db
from web.backend.models import AnalysisRecord

router = APIRouter(prefix="/api", tags=["leaderboard"])


@router.get("/leaderboard")
async def get_leaderboard(db: AsyncSession = Depends(get_db)) -> Dict[str, List[dict]]:
    """
    获取排行榜数据，按市场分组返回最新的10条完成分析
    相同分析日期的相同股票代码只显示完成时间最新的一条
    
    Returns:
        Dict with keys 'US', 'HK', 'CN', each containing a list of analysis records
    """
    result = {}
    
    # Query each market separately with limit at database level
    for market in ['US', 'HK', 'CN']:
        # Create a subquery with row_number partitioned by analysis_date and ticker
        subquery = select(
            AnalysisRecord,
            func.row_number().over(
                partition_by=[AnalysisRecord.analysis_date, AnalysisRecord.ticker],
                order_by=desc(AnalysisRecord.completed_at)
            ).label('rn')
        ).filter(
            AnalysisRecord.status == 'completed',
            AnalysisRecord.market == market,
            AnalysisRecord.is_public == True
        ).subquery()
        
        # Select only records where row_number = 1 (latest for each date+ticker combination)
        # and limit to 10 records
        stmt = select(AnalysisRecord).select_from(subquery).filter(
            subquery.c.rn == 1
        ).order_by(
            desc(subquery.c.completed_at)
        ).limit(10)
        
        query_result = await db.execute(stmt)
        analyses = query_result.scalars().all()
        
        # Convert to dict format
        result[market] = [
            {
                'analysis_id': analysis.analysis_id,
                'ticker': analysis.ticker,
                'company_name': analysis.company_name,
                'market': analysis.market,
                'analysis_date': analysis.analysis_date,
                'trading_decision': analysis.trading_decision,
                'completed_at': analysis.completed_at.isoformat() if analysis.completed_at else None,
                'progress_percentage': analysis.progress_percentage
            }
            for analysis in analyses
        ]
    
    return result
