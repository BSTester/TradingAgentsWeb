#!/usr/bin/env python3
"""Report list/detail/export APIs backed by AnalysisRecord structured_report."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, Response
from sqlalchemy import desc, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from web.backend.auth_routes import get_current_active_user
from web.backend.database import get_db
from web.backend.models import AnalysisRecord, ConversationMessage, User
from web.backend.services.report_formatter import report_detail, report_json_bytes, report_markdown, report_preview

router = APIRouter(prefix="/api/reports", tags=["reports"])


async def _source_session_id(db: AsyncSession, analysis_id: str) -> str | None:
    result = await db.execute(select(ConversationMessage.session_id).where(
        ConversationMessage.analysis_id == analysis_id,
        ConversationMessage.role == "assistant",
    ).limit(1))
    return result.scalar()


async def _record_or_404(report_id: str, current_user: User, db: AsyncSession) -> AnalysisRecord:
    result = await db.execute(select(AnalysisRecord).where(
        AnalysisRecord.analysis_id == report_id,
        (AnalysisRecord.user_id == current_user.id) | (AnalysisRecord.is_public == True),
    ))
    record = result.scalars().first()
    if not record:
        raise HTTPException(status_code=404, detail="报告不存在")
    return record


@router.get("")
async def list_reports(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    ticker: Optional[str] = None,
    market: Optional[str] = None,
    rating: Optional[int] = Query(None, ge=1, le=5),
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort: str = Query("created_at", pattern="^(created_at|rating)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    filters = [(AnalysisRecord.user_id == current_user.id) | (AnalysisRecord.is_public == True)]
    if ticker:
        filters.append(AnalysisRecord.ticker.ilike(f"%{ticker}%"))
    if market:
        filters.append(AnalysisRecord.market == market)
    if status:
        if status == "completed":
            filters.append(AnalysisRecord.status == "completed")
        elif status == "failed":
            filters.append(AnalysisRecord.status.in_(["error", "interrupted"]))
        elif status == "partial":
            filters.append(AnalysisRecord.status.notin_(["completed", "error", "interrupted"]))
    if date_from:
        filters.append(AnalysisRecord.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        filters.append(AnalysisRecord.created_at <= datetime.fromisoformat(date_to))

    count_result = await db.execute(select(func.count(AnalysisRecord.id)).where(*filters))
    total = count_result.scalar() or 0
    sort_column = AnalysisRecord.created_at
    order_clause = sort_column.asc() if order == "asc" else desc(sort_column)
    result = await db.execute(select(AnalysisRecord).where(*filters).order_by(order_clause).offset((page - 1) * limit).limit(limit))
    records = result.scalars().all()

    items = []
    for record in records:
        preview = report_preview(record, await _source_session_id(db, record.analysis_id))
        if rating and preview.get("rating") != rating:
            continue
        items.append(preview)

    return {"data": items, "meta": {"page": page, "limit": limit, "total": total, "has_next": page * limit < total}}


@router.get("/{report_id}")
async def get_report(report_id: str, current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    record = await _record_or_404(report_id, current_user, db)
    return {"data": report_detail(record, await _source_session_id(db, record.analysis_id))}


@router.get("/{report_id}/export")
async def export_report(
    report_id: str,
    format: str = Query(..., pattern="^(md|json|pdf)$"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    record = await _record_or_404(report_id, current_user, db)
    filename = f"report-{report_id}.{format}"
    if format == "json":
        return Response(
            report_json_bytes(record),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    if format == "md":
        return Response(
            report_markdown(record),
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    # PDF generation will be completed in M6; provide explicit JSON fallback instead of fake binary.
    return JSONResponse(
        {"data": {"download_url": None, "expires_at": None, "message": "PDF export pending M6 implementation"}},
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
