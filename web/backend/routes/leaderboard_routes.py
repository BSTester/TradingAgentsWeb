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
    
    规则：
    1. 按市场分类（US、HK、CN）
    2. 相同市场、相同分析日期、相同股票代码只显示最新完成的一条
    3. 按完成时间倒序排列
    4. 每个市场返回最多10条记录
    
    Returns:
        Dict with keys 'US', 'HK', 'CN', each containing a list of analysis records
    """
    result = {}
    
    # Query each market separately
    for market in ['US', 'HK', 'CN']:
        # 使用窗口函数对相同日期+股票代码的记录进行排序
        # row_number() 会为每个分区内的记录分配一个唯一的序号
        subquery = select(
            AnalysisRecord.analysis_id,
            AnalysisRecord.ticker,
            AnalysisRecord.company_name,
            AnalysisRecord.market,
            AnalysisRecord.analysis_date,
            AnalysisRecord.trading_decision,
            AnalysisRecord.completed_at,
            AnalysisRecord.progress_percentage,
            func.row_number().over(
                partition_by=[AnalysisRecord.analysis_date, AnalysisRecord.ticker],
                order_by=desc(AnalysisRecord.completed_at)
            ).label('rn')
        ).filter(
            AnalysisRecord.status == 'completed',
            AnalysisRecord.market == market,
            AnalysisRecord.is_public == True
        ).subquery()
        
        # 只选择每个分区中 row_number = 1 的记录（即最新的记录）
        # 然后按完成时间倒序排列，取前10条
        stmt = select(subquery).filter(
            subquery.c.rn == 1
        ).order_by(
            desc(subquery.c.completed_at)
        ).limit(10)
        
        query_result = await db.execute(stmt)
        rows = query_result.all()
        
        # 调试日志
        print(f"📊 排行榜查询 - 市场: {market}, 记录数: {len(rows)}")
        for row in rows:
            print(f"  - {row.ticker} ({row.analysis_date}): {row.trading_decision} @ {row.completed_at}")
        
        # Convert to dict format
        result[market] = [
            {
                'analysis_id': row.analysis_id,
                'ticker': row.ticker,
                'company_name': row.company_name,
                'market': row.market,
                'analysis_date': row.analysis_date,
                'trading_decision': row.trading_decision,
                'completed_at': row.completed_at.isoformat() if row.completed_at else None,
                'progress_percentage': row.progress_percentage
            }
            for row in rows
        ]
    
    return result
