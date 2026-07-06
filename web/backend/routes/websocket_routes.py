#!/usr/bin/env python3
"""
WebSocket routes for analysis progress streaming.
"""

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["websocket"])

manager = None


def init_websocket_routes(connection_manager):
    """Initialize WebSocket routes with the shared connection manager."""
    global manager
    manager = connection_manager


@router.websocket("/ws/analysis/{analysis_id}")
async def websocket_endpoint(websocket: WebSocket, analysis_id: str):
    """WebSocket endpoint for authenticated real-time analysis logs."""
    offered_protocols = websocket.headers.get("sec-websocket-protocol") or ""
    chosen_subprotocol = None
    token = None
    if offered_protocols:
        for protocol in [p.strip() for p in offered_protocols.split(",")]:
            if protocol.startswith("jwt."):
                chosen_subprotocol = protocol
                token = protocol[len("jwt.") :]
                break

    if not token:
        await websocket.close(code=1008)
        return

    from sqlalchemy import select
    from web.backend.auth import get_current_user_from_token
    from web.backend.database import AsyncSessionLocal
    from web.backend.models import AnalysisRecord

    async with AsyncSessionLocal() as db:
        user = await get_current_user_from_token(token, db)
        if user is None or not user.is_active:
            await websocket.close(code=1008)
            return

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
