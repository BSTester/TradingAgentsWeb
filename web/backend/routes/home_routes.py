#!/usr/bin/env python3
"""Home page data APIs."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from web.backend.database import get_db
from web.backend.models import AnalysisRecord
from web.backend.services.report_formatter import report_preview

router = APIRouter(prefix="/api/home", tags=["home"])


@router.get("/public-reports")
async def public_report_feed(limit: int = Query(6, ge=1, le=20), db: AsyncSession = Depends(get_db)):
    """Return recent public analysis reports for the home entry, replacing legacy ranking data."""
    result = await db.execute(select(AnalysisRecord).where(
        AnalysisRecord.is_public == True,
        AnalysisRecord.status == "completed",
    ).order_by(desc(AnalysisRecord.created_at)).limit(limit))
    records = result.scalars().all()
    return {"data": [report_preview(record) for record in records], "meta": {"limit": limit, "total": len(records), "has_next": False}}
