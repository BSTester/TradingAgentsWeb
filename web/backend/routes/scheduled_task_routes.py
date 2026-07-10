#!/usr/bin/env python3
"""Scheduled analysis task APIs aligned with the frontend contract."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from web.backend.auth_routes import get_current_active_user
from web.backend.database import get_db
from web.backend.models import AnalysisRecord, ScheduledTask, User
from web.backend.schemas import ScheduledTaskCreate, ScheduledTaskUpdate
from web.backend.services.llm_config_resolver import (
    LLMConfigResolutionError,
    llm_config_error_response,
    resolve_llm_config,
)
from web.backend.services.report_formatter import report_preview
from web.backend.services.scheduler_service import get_scheduler_service
from web.backend.utils.market_detector import detect_market, normalize_ticker, normalize_ticker_with_suffix, validate_ticker

router = APIRouter(prefix="/api/scheduled-tasks", tags=["scheduled-tasks"])

MAX_TASKS_PER_USER = 100


def _cycle_for_scheduler(cycle: str, interval_days: int | None) -> tuple[str, int | None]:
    if cycle == "interval":
        return "every_n_days", interval_days or 1
    if cycle == "monthly":
        return "every_n_days", interval_days or 30
    return cycle, interval_days


def _cycle_for_contract(cycle: str, interval_days: int | None) -> str:
    if cycle == "every_n_days":
        return "interval"
    return cycle


def _iso(value):
    return value.isoformat() if value else None


async def _last_report(db: AsyncSession, task: ScheduledTask) -> dict:
    result = await db.execute(select(AnalysisRecord).where(
        AnalysisRecord.user_id == task.user_id,
        AnalysisRecord.ticker == task.ticker,
    ).order_by(desc(AnalysisRecord.created_at)).limit(1))
    record = result.scalars().first()
    if not record:
        return {"report_id": None, "status": None, "rating": None}
    preview = report_preview(record)
    return {"report_id": record.analysis_id, "status": preview.get("status"), "rating": preview.get("rating")}


async def _task_payload(db: AsyncSession, task: ScheduledTask) -> dict:
    return {
        "id": task.id,
        "task_name": task.task_name,
        "ticker": task.ticker,
        "market": task.market,
        "is_enabled": task.is_enabled,
        "execution_cycle": _cycle_for_contract(task.execution_cycle, task.interval_days),
        "execution_time": task.execution_time,
        "interval_days": task.interval_days,
        "end_date": task.end_date.date().isoformat() if task.end_date else None,
        "next_run": _iso(task.next_run_time),
        "last_run": _iso(task.last_run_time),
        "last_report": await _last_report(db, task),
        "analysts": task.analysts,
        "research_depth": task.research_depth,
        "created_at": _iso(task.created_at),
        "updated_at": _iso(task.updated_at),
    }


async def _task_or_404(db: AsyncSession, task_id: int, user_id: int) -> ScheduledTask:
    result = await db.execute(select(ScheduledTask).where(ScheduledTask.id == task_id, ScheduledTask.user_id == user_id))
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="定时任务不存在")
    return task


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_scheduled_task(
    request: ScheduledTaskCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not request.execution_cycle or not request.execution_time:
        raise HTTPException(status_code=400, detail="创建定时任务需要同时提供执行周期和执行时间")

    count_result = await db.execute(select(func.count(ScheduledTask.id)).where(
        ScheduledTask.user_id == current_user.id,
        ScheduledTask.status == "pending",
    ))
    if (count_result.scalar() or 0) >= MAX_TASKS_PER_USER:
        raise HTTPException(status_code=400, detail=f"定时任务数量已达上限（{MAX_TASKS_PER_USER}）")

    ticker = normalize_ticker(request.ticker)
    if not validate_ticker(ticker):
        raise HTTPException(status_code=400, detail=f"无效的股票代码格式: {request.ticker}")
    ticker = normalize_ticker_with_suffix(ticker)
    market = detect_market(ticker)

    end_date_dt = None
    if request.end_date:
        from pytz import timezone as pytz_timezone
        beijing_tz = pytz_timezone("Asia/Shanghai")
        end_date_dt = beijing_tz.localize(datetime.strptime(request.end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59))

    try:
        resolved_llm = await resolve_llm_config(
            db,
            user_id=current_user.id,
            llm_provider=request.llm_provider,
            backend_url=request.backend_url,
            shallow_thinker=request.shallow_thinker,
            deep_thinker=request.deep_thinker,
            api_key=request.api_key,
        )
    except LLMConfigResolutionError as exc:
        return llm_config_error_response(exc)
    scheduler_cycle, scheduler_interval_days = _cycle_for_scheduler(request.execution_cycle, request.interval_days)
    scheduled_task = ScheduledTask(
        user_id=current_user.id,
        task_name=request.task_name,
        ticker=ticker,
        market=market,
        analysts=request.analysts,
        research_depth=request.research_depth,
        llm_provider=resolved_llm.llm_provider,
        shallow_thinker=resolved_llm.shallow_thinker,
        deep_thinker=resolved_llm.deep_thinker,
        backend_url=resolved_llm.backend_url,
        api_key=None,
        is_public=request.is_public,
        email_notification_enabled=request.email_notification,
        execution_cycle=scheduler_cycle,
        execution_time=request.execution_time,
        interval_days=scheduler_interval_days,
        day_of_week=request.day_of_week,
        end_date=end_date_dt,
        is_enabled=True,
        status="pending",
        scheduler_job_id=f"scheduled_task_{current_user.id}_{uuid.uuid4().hex[:8]}",
        total_executions=0,
    )
    db.add(scheduled_task)
    await db.flush()

    try:
        scheduler = get_scheduler_service()
        scheduler.add_scheduled_task(
            task_id=scheduled_task.id,
            job_id=scheduled_task.scheduler_job_id,
            execution_cycle=scheduled_task.execution_cycle,
            execution_time=scheduled_task.execution_time,
            interval_days=scheduled_task.interval_days,
            day_of_week=scheduled_task.day_of_week,
            end_date=scheduled_task.end_date,
        )
        scheduled_task.next_run_time = scheduler.get_next_run_time(scheduled_task.scheduler_job_id)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"创建调度任务失败: {exc}")

    await db.commit()
    await db.refresh(scheduled_task)
    return {"data": await _task_payload(db, scheduled_task)}


@router.get("")
async def list_scheduled_tasks(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    ticker: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    filters = [ScheduledTask.user_id == current_user.id]
    if status_filter == "enabled":
        filters.append(ScheduledTask.status == "pending")
        filters.append(ScheduledTask.is_enabled == True)
    elif status_filter == "disabled":
        filters.append(ScheduledTask.status == "pending")
        filters.append(ScheduledTask.is_enabled == False)
    if ticker:
        filters.append(ScheduledTask.ticker.ilike(f"%{ticker}%"))

    total_result = await db.execute(select(func.count(ScheduledTask.id)).where(*filters))
    total = total_result.scalar() or 0
    result = await db.execute(select(ScheduledTask).where(*filters).order_by(desc(ScheduledTask.created_at)).offset((page - 1) * limit).limit(limit))
    tasks = result.scalars().all()
    return {
        "data": [await _task_payload(db, task) for task in tasks],
        "meta": {"page": page, "limit": limit, "total": total, "has_next": page * limit < total},
    }


@router.get("/stats")
async def scheduled_task_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    running_result = await db.execute(select(func.count(ScheduledTask.id)).where(
        ScheduledTask.user_id == current_user.id,
        ScheduledTask.status == "pending",
        ScheduledTask.is_enabled == True,
    ))
    paused_result = await db.execute(select(func.count(ScheduledTask.id)).where(
        ScheduledTask.user_id == current_user.id,
        ScheduledTask.status == "pending",
        ScheduledTask.is_enabled == False,
    ))
    failed_result = await db.execute(select(func.count(AnalysisRecord.id)).where(
        AnalysisRecord.user_id == current_user.id,
        AnalysisRecord.status.in_(["error", "interrupted"]),
    ))
    today = datetime.utcnow().date().isoformat()
    today_result = await db.execute(select(func.count(ScheduledTask.id)).where(
        ScheduledTask.user_id == current_user.id,
        ScheduledTask.next_run_time.is_not(None),
    ))
    return {
        "data": {
            "running": running_result.scalar() or 0,
            "paused": paused_result.scalar() or 0,
            "scheduled_today": today_result.scalar() or 0,
            "failed": failed_result.scalar() or 0,
        }
    }


@router.get("/{task_id}")
async def get_scheduled_task(
    task_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _task_or_404(db, task_id, current_user.id)
    return {"data": await _task_payload(db, task)}


@router.patch("/{task_id}")
async def update_scheduled_task(
    task_id: int,
    update_data: ScheduledTaskUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _task_or_404(db, task_id, current_user.id)
    scheduler = get_scheduler_service()

    if update_data.task_name is not None:
        task.task_name = update_data.task_name
    if update_data.ticker is not None:
        ticker = normalize_ticker(update_data.ticker)
        if not validate_ticker(ticker):
            raise HTTPException(status_code=400, detail=f"无效的股票代码格式: {update_data.ticker}")
        task.ticker = normalize_ticker_with_suffix(ticker)
        task.market = detect_market(task.ticker)
    if update_data.execution_cycle is not None:
        task.execution_cycle, task.interval_days = _cycle_for_scheduler(update_data.execution_cycle, update_data.interval_days or task.interval_days)
    elif update_data.interval_days is not None:
        task.interval_days = update_data.interval_days
    if update_data.execution_time is not None:
        task.execution_time = update_data.execution_time
    if update_data.end_date is not None:
        from pytz import timezone as pytz_timezone
        beijing_tz = pytz_timezone("Asia/Shanghai")
        task.end_date = beijing_tz.localize(datetime.strptime(update_data.end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)) if update_data.end_date else None

    if update_data.is_enabled is not None:
        task.is_enabled = update_data.is_enabled

    if task.status == "pending":
        try:
            scheduler.remove_scheduled_task(task.scheduler_job_id)
        except Exception:
            pass
        if task.is_enabled:
            scheduler.add_scheduled_task(
                task_id=task.id,
                job_id=task.scheduler_job_id,
                execution_cycle=task.execution_cycle,
                execution_time=task.execution_time,
                interval_days=task.interval_days,
                day_of_week=task.day_of_week,
                end_date=task.end_date,
            )
            task.next_run_time = scheduler.get_next_run_time(task.scheduler_job_id)
        else:
            task.next_run_time = None

    await db.commit()
    await db.refresh(task)
    return {"data": await _task_payload(db, task)}


@router.delete("/{task_id}")
async def delete_scheduled_task(
    task_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _task_or_404(db, task_id, current_user.id)
    task_name = task.task_name
    task_status = task.status
    scheduler_removed = False
    try:
        get_scheduler_service().remove_scheduled_task(task.scheduler_job_id)
        scheduler_removed = True
    except Exception:
        pass
    await db.delete(task)
    await db.commit()
    return {
        "data": {
            "success": True,
            "message": "任务已删除",
            "task_id": task_id,
            "task_name": task_name,
            "task_status": "deleted" if task_status else "deleted",
            "scheduler_removed": scheduler_removed,
        }
    }
