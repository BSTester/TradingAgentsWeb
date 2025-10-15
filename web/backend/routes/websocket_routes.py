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
    
    try:
        await manager.connect(websocket, analysis_id)
        print(f"✅ WebSocket connected: {analysis_id}")
        
        while True:
            # Keep connection alive and handle ping/pong
            data = await websocket.receive_text()
            print(f"📨 Received message: {data}")
            
            try:
                message = json.loads(data)
                
                if message.get('type') == 'ping':
                    print(f"🏓 Sending pong response")
                    await websocket.send_text(json.dumps({'type': 'pong'}))
            except json.JSONDecodeError as e:
                print(f"❌ JSON decode error: {e}")
                
    except WebSocketDisconnect:
        print(f"🔌 WebSocket disconnected: {analysis_id}")
        manager.disconnect(websocket, analysis_id)
    except Exception as e:
        print(f"❌ WebSocket error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
