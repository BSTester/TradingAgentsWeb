#!/usr/bin/env python3
"""
WebSocket Routes
WebSocket 路由
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json

router = APIRouter(tags=["websocket"])

# Connection manager will be injected
manager = None


def init_websocket_routes(connection_manager):
    """Initialize WebSocket routes with connection manager"""
    global manager
    manager = connection_manager


@router.websocket("/ws/analysis/{analysis_id}")
async def websocket_endpoint(websocket: WebSocket, analysis_id: str):
    """WebSocket endpoint for real-time analysis logs"""
    print(f"🔌 WebSocket connection request for analysis: {analysis_id}")

    # 使用子协议进行鉴权：期望格式为 Sec-WebSocket-Protocol: jwt.<token>
    offered_protocols = websocket.headers.get('sec-websocket-protocol') or ''
    chosen_subprotocol = None
    token = None
    if offered_protocols:
        # 可能为逗号分隔，取第一个以 jwt. 开头的值
        parts = [p.strip() for p in offered_protocols.split(',')]
        for p in parts:
            if p.startswith('jwt.'):
                chosen_subprotocol = p
                token = p[len('jwt.'):]
                break

    if not token:
        # 无 token，拒绝连接（1008: Policy Violation）
        try:
            await websocket.close(code=1008)
        except Exception:
            pass
        print("❌ WebSocket missing token in subprotocol, connection rejected")
        return

    from web.backend.auth import get_current_user_from_token
    from web.backend.database import SessionLocal
    from web.backend.models import AnalysisRecord
    db = SessionLocal()
    try:
        user = get_current_user_from_token(token, db)
        if user is None or not user.is_active:
            try:
                await websocket.close(code=1008)
            except Exception:
                pass
            print("❌ WebSocket invalid token, connection rejected")
            return
        # 细粒度：校验 analysis_id 归属
        analysis = db.query(AnalysisRecord).filter(
            AnalysisRecord.analysis_id == analysis_id,
            AnalysisRecord.user_id == user.id
        ).first()
        if not analysis:
            try:
                await websocket.close(code=1008)
            except Exception:
                pass
            print("❌ WebSocket access denied: analysis not found or not owned by user")
            return
    finally:
        db.close()

    try:
        await manager.connect(websocket, analysis_id, subprotocol=chosen_subprotocol)
        print(f"✅ WebSocket connected: {analysis_id}")
        
        while True:
            # Keep connection alive and handle ping/pong
            data = await websocket.receive_text()
            print(f"📨 Received message: {data}")
            
            try:
                message = json.loads(data)
                
                if message.get('type') == 'ping':
                    print(f"🏓 Sending pong response")
                    await websocket.send_text(json.dumps({'type': 'pong', 'analysis_id': analysis_id}))
            except json.JSONDecodeError as e:
                print(f"❌ JSON decode error: {e}")
                
    except WebSocketDisconnect:
        print(f"🔌 WebSocket disconnected: {analysis_id}")
        manager.disconnect(websocket, analysis_id)
    except Exception as e:
        print(f"❌ WebSocket error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
