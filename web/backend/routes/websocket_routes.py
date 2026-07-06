#!/usr/bin/env python3
"""
WebSocket routes for analysis progress streaming.
"""

import json
import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["websocket"])

manager = None


def init_websocket_routes(connection_manager):
    """Initialize WebSocket routes with the shared connection manager."""
    global manager
    manager = connection_manager


def _extract_jwt_subprotocol(websocket: WebSocket) -> tuple[str | None, str | None]:
    offered_protocols = websocket.headers.get("sec-websocket-protocol") or ""
    if offered_protocols:
        for protocol in [p.strip() for p in offered_protocols.split(",")]:
            if protocol.startswith("jwt."):
                return protocol, protocol[len("jwt.") :]
    return None, None


async def _authenticate_ws_token(websocket: WebSocket, token: str | None):
    if not token:
        await websocket.close(code=1008)
        return None

    from web.backend.auth import get_current_user_from_token
    from web.backend.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        user = await get_current_user_from_token(token, db)
        if user is None or not user.is_active:
            await websocket.close(code=1008)
            return None
        return user


@router.websocket("/ws/analysis/{analysis_id}")
async def websocket_endpoint(websocket: WebSocket, analysis_id: str):
    """WebSocket endpoint for authenticated real-time analysis logs."""
    chosen_subprotocol, token = _extract_jwt_subprotocol(websocket)

    from sqlalchemy import select
    from web.backend.database import AsyncSessionLocal
    from web.backend.models import AnalysisRecord

    user = await _authenticate_ws_token(websocket, token)
    if user is None:
        return

    async with AsyncSessionLocal() as db:
        stmt = select(AnalysisRecord).filter(
            AnalysisRecord.analysis_id == analysis_id,
            AnalysisRecord.user_id == user.id,
        )
        result = await db.execute(stmt)
        if not result.scalars().first():
            await websocket.close(code=1008)
            return

    try:
        await manager.connect(websocket, analysis_id, subprotocol=chosen_subprotocol)
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                continue

            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong", "analysis_id": analysis_id}))
    except WebSocketDisconnect:
        manager.disconnect(websocket, analysis_id)


async def _authenticate_conversation_ws(websocket: WebSocket, chosen_subprotocol: str | None, token: str | None):
    """Authenticate conversation WS using jwt subprotocol or first auth message."""
    if token:
        user = await _authenticate_ws_token(websocket, token)
        return user, False

    await websocket.accept()
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=10)
        message = json.loads(raw)
    except Exception:
        await websocket.close(code=1008)
        return None, True
    if message.get("type") != "auth" or not message.get("token"):
        await websocket.close(code=1008)
        return None, True

    from web.backend.auth import get_current_user_from_token
    from web.backend.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        user = await get_current_user_from_token(message["token"], db)
        if user is None or not user.is_active:
            await websocket.close(code=1008)
            return None, True
        return user, True


@router.websocket("/ws/conversation/{session_id}")
async def conversation_websocket(websocket: WebSocket, session_id: str):
    """Authenticated conversation stream using the locked contract event names."""
    chosen_subprotocol, token = _extract_jwt_subprotocol(websocket)
    user, already_accepted = await _authenticate_conversation_ws(websocket, chosen_subprotocol, token)
    if user is None:
        return

    from sqlalchemy import desc, select
    from web.backend.database import AsyncSessionLocal
    from web.backend.models import AnalysisRecord, ConversationMessage, ConversationSession
    from web.backend.services.report_formatter import report_detail

    async with AsyncSessionLocal() as db:
        session_result = await db.execute(select(ConversationSession).where(
            ConversationSession.id == session_id,
            ConversationSession.user_id == user.id,
            ConversationSession.deleted_at.is_(None),
        ))
        if not session_result.scalars().first():
            await websocket.close(code=1008)
            return

    channel_id = f"conversation_{session_id}"
    if already_accepted:
        if channel_id not in manager.active_connections:
            manager.active_connections[channel_id] = []
        manager.active_connections[channel_id].append(websocket)
    else:
        await manager.connect(websocket, channel_id, subprotocol=chosen_subprotocol)

    async def send_snapshot():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(ConversationMessage).where(
                ConversationMessage.session_id == session_id,
                ConversationMessage.analysis_id.is_not(None),
            ).order_by(desc(ConversationMessage.created_at)).limit(1))
            msg = result.scalars().first()
            if not msg:
                return
            record = None
            if msg.analysis_id:
                rec_result = await db.execute(select(AnalysisRecord).where(AnalysisRecord.analysis_id == msg.analysis_id))
                record = rec_result.scalars().first()
            await websocket.send_text(json.dumps({
                "type": "stage_update",
                "data": {
                    "stage_id": "reconnect",
                    "summary": f"当前分析状态：{record.status if record else msg.status}",
                },
            }, ensure_ascii=False))
            if record and record.status == "completed":
                await websocket.send_text(json.dumps({
                    "type": "report_ready",
                    "data": {
                        "report_id": record.analysis_id,
                        "message_id": msg.id,
                        "report": report_detail(record, session_id),
                    },
                }, ensure_ascii=False, default=str))

    try:
        await send_snapshot()
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                continue
            msg_type = message.get("type")
            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif msg_type == "reconnect":
                await send_snapshot()
            elif msg_type == "stop":
                async with AsyncSessionLocal() as db:
                    result = await db.execute(select(ConversationMessage).where(
                        ConversationMessage.session_id == session_id,
                        ConversationMessage.analysis_id.is_not(None),
                        ConversationMessage.status.in_(["queued", "running"]),
                    ).order_by(desc(ConversationMessage.created_at)).limit(1))
                    msg = result.scalars().first()
                    stopped = False
                    if msg and msg.analysis_id:
                        from web.backend.app import task_manager
                        stopped = task_manager.stop_task(msg.analysis_id)
                        msg.status = "stopped"
                        await db.commit()
                    await websocket.send_text(json.dumps({
                        "type": "stop_ack",
                        "data": {
                            "message_id": msg.id if msg else None,
                            "stopped_at": __import__("datetime").datetime.utcnow().isoformat(),
                            "completed_stages": [],
                            "partial_content": "已停止" if stopped else "没有运行中的分析",
                        },
                    }, ensure_ascii=False))
            elif msg_type == "retry_stage":
                await websocket.send_text(json.dumps({
                    "type": "stage_warning",
                    "data": {"stage_id": message.get("stage"), "message": "阶段重试将在后续 M2 增量中执行", "can_continue": True},
                }, ensure_ascii=False))
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel_id)


@router.websocket("/ws/skills-health")
async def skills_health_websocket(websocket: WebSocket):
    """Authenticated Skills health push stream."""
    chosen_subprotocol, token = _extract_jwt_subprotocol(websocket)
    user = await _authenticate_ws_token(websocket, token)
    if user is None:
        return

    from web.backend.services.skills import get_skill_registry

    channel_id = f"skills_health_{user.id}"
    await manager.connect(websocket, channel_id, subprotocol=chosen_subprotocol)
    try:
        registry = get_skill_registry()
        await websocket.send_text(json.dumps({
            "type": "skills.health.snapshot",
            "data": registry.list_health(),
        }, ensure_ascii=False))
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                message = json.loads(data)
                if message.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({
                    "type": "skills.health.changed",
                    "data": registry.list_health(),
                }, ensure_ascii=False))
            except json.JSONDecodeError:
                continue
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel_id)


@router.websocket("/ws/test")
async def test_websocket_endpoint(websocket: WebSocket):
    """Simple WebSocket endpoint for connectivity checks."""
    await websocket.accept()
    try:
        await websocket.send_text(json.dumps({"type": "connected", "message": "WebSocket test connected"}))
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(json.dumps({"type": "echo", "data": data}))
    except WebSocketDisconnect:
        return
