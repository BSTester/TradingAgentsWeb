#!/usr/bin/env python3
"""Conversation session and message APIs."""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from cli.models import AnalystType
from tradingagents.default_config import DEFAULT_CONFIG
from web.backend.analysis_task import run_analysis_task
from web.backend.auth_routes import get_current_active_user
from web.backend.database import get_db
from web.backend.models import AnalysisRecord, ConversationMessage, ConversationSession, User, UserConfig
from web.backend.utils.market_detector import detect_market, normalize_ticker, normalize_ticker_with_suffix, validate_ticker

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

task_manager = None
manager = None


def init_conversation_routes(tm, ws_manager):
    global task_manager, manager
    task_manager = tm
    manager = ws_manager


class ConversationCreate(BaseModel):
    title: str = Field("新对话", max_length=200)


class ConversationUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)
    client_message_id: Optional[str] = None


class FollowUpCreate(BaseModel):
    action: str = Field(..., pattern="^(retry_stage|expand_section|ask_followup)$")
    stage: Optional[str] = None
    section: Optional[str] = None
    content: Optional[str] = None


def _now_id() -> str:
    return str(uuid.uuid4())


def _message_blocks(role: str, content: str, report_id: str | None = None) -> list[dict]:
    blocks = [{"type": "text", "content": content}]
    if report_id:
        blocks.append({"type": "report", "report_id": report_id, "report_preview": None})
    return blocks


async def _session_or_404(db: AsyncSession, session_id: str, user_id: int) -> ConversationSession:
    result = await db.execute(select(ConversationSession).where(
        ConversationSession.id == session_id,
        ConversationSession.user_id == user_id,
        ConversationSession.deleted_at.is_(None),
    ))
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return session


async def _session_payload(db: AsyncSession, session: ConversationSession) -> Dict[str, Any]:
    count_result = await db.execute(select(func.count(ConversationMessage.id)).where(ConversationMessage.session_id == session.id))
    message_count = count_result.scalar() or 0
    last_result = await db.execute(select(ConversationMessage).where(ConversationMessage.session_id == session.id).order_by(desc(ConversationMessage.created_at)).limit(1))
    last = last_result.scalars().first()
    active_result = await db.execute(select(func.count(ConversationMessage.id)).where(
        ConversationMessage.session_id == session.id,
        ConversationMessage.analysis_id.is_not(None),
        ConversationMessage.status.in_(["queued", "running"]),
    ))
    return {
        "id": session.id,
        "title": session.title,
        "last_message_preview": (last.content[:120] if last else None),
        "message_count": message_count,
        "has_active_analysis": (active_result.scalar() or 0) > 0,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
    }


def _message_payload(message: ConversationMessage) -> Dict[str, Any]:
    return {
        "id": message.id,
        "session_id": message.session_id,
        "role": message.role,
        "content": message.content,
        "content_blocks": message.content_blocks or _message_blocks(message.role, message.content, message.analysis_id if message.role == "assistant" else None),
        "created_at": message.created_at.isoformat() if message.created_at else None,
    }


def _extract_ticker(content: str) -> str | None:
    patterns = [
        r"\b\d{6}\.(?:SH|SZ)\b",
        r"\b\d{4,5}\.HK\b",
        r"\b[A-Z]{1,5}\b",
        r"\b\d{6}\b",
        r"\b\d{4,5}\b",
    ]
    text = content.upper()
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0)
    return None


async def _get_user_config(db: AsyncSession, user_id: int) -> UserConfig:
    result = await db.execute(select(UserConfig).where(UserConfig.user_id == user_id))
    config = result.scalars().first()
    if not config:
        config = UserConfig(user_id=user_id)
        db.add(config)
        await db.flush()
    return config


async def _trigger_analysis(db: AsyncSession, user: User, session: ConversationSession, assistant_message: ConversationMessage, content: str) -> AnalysisRecord:
    ticker_raw = _extract_ticker(content)
    if not ticker_raw:
        raise HTTPException(status_code=400, detail="未识别到标的代码，请在消息中包含如 AAPL、0700.HK 或 600519.SH 的代码")
    ticker = normalize_ticker_with_suffix(normalize_ticker(ticker_raw))
    if not validate_ticker(normalize_ticker(ticker)):
        raise HTTPException(status_code=400, detail=f"无效的股票代码格式: {ticker_raw}")

    user_config = await _get_user_config(db, user.id)
    api_key = user_config.last_api_key or DEFAULT_CONFIG.get("openai_api_key") or ""
    now = datetime.utcnow()
    analysis_id = f"conv_{now.strftime('%Y%m%d_%H%M%S')}_{ticker}_{user.id}_{assistant_message.id[:8]}"
    analysts = [item.value for item in AnalystType if item.value in {"market", "social", "news", "fundamentals"}]
    record = AnalysisRecord(
        analysis_id=analysis_id,
        user_id=user.id,
        ticker=ticker,
        market=detect_market(ticker),
        analysis_date=now.strftime("%Y-%m-%d"),
        analysts=analysts,
        research_depth=user_config.last_research_depth or 1,
        llm_provider=user_config.last_llm_provider or DEFAULT_CONFIG["llm_provider"],
        shallow_thinker=user_config.last_shallow_thinker or DEFAULT_CONFIG["quick_think_llm"],
        deep_thinker=user_config.last_deep_thinker or DEFAULT_CONFIG["deep_think_llm"],
        backend_url=user_config.last_backend_url or DEFAULT_CONFIG["backend_url"],
        api_key=api_key,
        is_public=False,
        status="queued",
        current_step="对话触发分析已入队",
        progress_percentage=0.0,
    )
    db.add(record)
    assistant_message.analysis_id = analysis_id
    assistant_message.status = "queued"
    assistant_message.content = f"已识别标的 {ticker}，正在启动分析。"
    assistant_message.content_blocks = [
        {"type": "text", "content": assistant_message.content},
        {
            "type": "stage_progress",
            "stage_id": "intent",
            "stage_name": "意图识别",
            "status": "complete",
            "summary": f"识别到分析请求：{ticker}",
            "started_at": now.isoformat(),
            "completed_at": now.isoformat(),
        },
    ]
    await db.flush()
    # Commit before submit_task: the worker uses an independent SessionLocal and
    # cannot see this AnalysisRecord while the route transaction is uncommitted.
    await db.commit()

    request_data = {
        "ticker": ticker,
        "analysis_date": record.analysis_date,
        "analysts": analysts,
        "research_depth": record.research_depth,
        "llm_provider": record.llm_provider,
        "shallow_thinker": record.shallow_thinker,
        "deep_thinker": record.deep_thinker,
        "backend_url": record.backend_url,
        "api_key": api_key,
        "conversation_session_id": session.id,
        "conversation_message_id": assistant_message.id,
    }
    submitted = task_manager.submit_task(
        analysis_id,
        user.id,
        run_analysis_task,
        analysis_id,
        user.id,
        request_data,
        manager,
        task_manager,
    )
    record.status = "running" if submitted else "queued"
    assistant_message.status = record.status
    return record


@router.get("")
async def list_conversations(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit
    total_result = await db.execute(select(func.count(ConversationSession.id)).where(
        ConversationSession.user_id == current_user.id,
        ConversationSession.deleted_at.is_(None),
    ))
    total = total_result.scalar() or 0
    result = await db.execute(select(ConversationSession).where(
        ConversationSession.user_id == current_user.id,
        ConversationSession.deleted_at.is_(None),
    ).order_by(desc(ConversationSession.updated_at)).offset(offset).limit(limit))
    items = [await _session_payload(db, session) for session in result.scalars().all()]
    return {"data": items, "meta": {"page": page, "limit": limit, "total": total, "has_next": offset + limit < total}}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_conversation(payload: ConversationCreate, current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    session = ConversationSession(id=_now_id(), user_id=current_user.id, title=payload.title or "新对话")
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {"data": await _session_payload(db, session)}


@router.get("/{session_id}")
async def get_conversation(session_id: str, current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    session = await _session_or_404(db, session_id, current_user.id)
    return {"data": await _session_payload(db, session)}


@router.patch("/{session_id}")
async def update_conversation(session_id: str, payload: ConversationUpdate, current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    session = await _session_or_404(db, session_id, current_user.id)
    session.title = payload.title.strip()
    await db.commit()
    await db.refresh(session)
    return {"data": await _session_payload(db, session)}


@router.delete("/{session_id}")
async def delete_conversation(session_id: str, current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    session = await _session_or_404(db, session_id, current_user.id)
    session.deleted_at = datetime.utcnow()
    await db.commit()
    return {"data": {"deleted": True, "id": session_id}}


@router.get("/{session_id}/messages")
async def list_messages(
    session_id: str,
    before_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    await _session_or_404(db, session_id, current_user.id)
    stmt = select(ConversationMessage).where(ConversationMessage.session_id == session_id)
    if before_id:
        before = await db.get(ConversationMessage, before_id)
        if before:
            stmt = stmt.where(ConversationMessage.created_at < before.created_at)
    result = await db.execute(stmt.order_by(desc(ConversationMessage.created_at)).limit(limit + 1))
    rows = result.scalars().all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    rows.reverse()
    return {
        "data": [_message_payload(row) for row in rows],
        "meta": {"has_more": has_more, "oldest_message_id": rows[0].id if rows else None},
    }


@router.post("/{session_id}/messages", status_code=status.HTTP_201_CREATED)
async def create_message(session_id: str, payload: MessageCreate, current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    session = await _session_or_404(db, session_id, current_user.id)
    if payload.client_message_id:
        existing_result = await db.execute(select(ConversationMessage).where(
            ConversationMessage.session_id == session_id,
            ConversationMessage.client_message_id == payload.client_message_id,
        ))
        existing = existing_result.scalars().first()
        if existing:
            return {"data": _message_payload(existing)}

    user_message = ConversationMessage(
        id=_now_id(),
        session_id=session.id,
        user_id=current_user.id,
        role="user",
        content=payload.content,
        content_blocks=_message_blocks("user", payload.content),
        client_message_id=payload.client_message_id,
    )
    assistant_message = ConversationMessage(
        id=_now_id(),
        session_id=session.id,
        user_id=current_user.id,
        role="assistant",
        content="正在理解你的请求...",
        content_blocks=[{"type": "stage_progress", "stage_id": "intent", "stage_name": "意图识别", "status": "active", "summary": "正在识别标的与分析意图", "started_at": datetime.utcnow().isoformat(), "completed_at": None}],
        status="queued",
    )
    db.add_all([user_message, assistant_message])
    session.updated_at = datetime.utcnow()
    await db.flush()
    await _trigger_analysis(db, current_user, session, assistant_message, payload.content)
    await db.commit()
    await db.refresh(user_message)
    return {"data": _message_payload(user_message)}


@router.post("/{session_id}/messages/{message_id}/follow-up", status_code=status.HTTP_201_CREATED)
async def follow_up(session_id: str, message_id: str, payload: FollowUpCreate, current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    await _session_or_404(db, session_id, current_user.id)
    content = payload.content or f"请继续处理 {payload.action}: {payload.stage or payload.section or message_id}"
    return await create_message(session_id, MessageCreate(content=content), current_user, db)
