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
