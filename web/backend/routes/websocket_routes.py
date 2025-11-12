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


@router.websocket("/ws/intraday/{user_id}")
async def intraday_websocket_endpoint(websocket: WebSocket, user_id: int):
    """WebSocket endpoint for intraday trading real-time updates (user-specific)"""


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

        return

    from web.backend.auth import get_current_user_from_token
    from web.backend.database import AsyncSessionLocal
    
    async with AsyncSessionLocal() as db:
        user = await get_current_user_from_token(token, db)
        if user is None or not user.is_active:
            try:
                await websocket.close(code=1008)
            except Exception:
                pass

            return
        
        # Verify user_id matches
        if user.id != user_id:
            try:
                await websocket.close(code=1008)
            except Exception:
                pass

            return

    try:
        # Use user-specific channel
        channel_id = f"intraday_user_{user_id}"
        await manager.connect(websocket, channel_id, subprotocol=chosen_subprotocol)

        
        # Send current scheduler status on connection (always send, even if not running)
        try:
            from web.backend.services.user_intraday_scheduler import get_manager as get_scheduler_manager
            from datetime import datetime
            
            scheduler_manager = get_scheduler_manager()
            status = scheduler_manager.get_scheduler_status(user_id)
            
            # If no scheduler exists, send default stopped status
            if not status:
                # Get user config for default values
                try:
                    from web.backend.database import SessionLocal
                    from web.backend.models import UserConfig
                    from sqlalchemy import select
                    
                    db = SessionLocal()
                    try:
                        result = db.execute(
                            select(UserConfig).where(UserConfig.user_id == user_id)
                        )
                        user_config = result.scalar_one_or_none()
                        
                        # Determine futu_api_url (fallback chain)
                        futu_api_url = None
                        if user_config:
                            if user_config.intraday_futu_api_url:
                                futu_api_url = user_config.intraday_futu_api_url
                            else:
                                futu_api_url = user_config.futu_api_base_url
                        
                        status = {
                            "is_running": False,
                            "interval_minutes": user_config.intraday_interval_minutes if user_config else 5,
                            "market_type": user_config.intraday_market_type if user_config else "US,HK,CN",
                            "market_status": "Scheduler not running",
                            "market_is_open": False,
                            "markets_status": {},
                            "next_run_time": None,
                            "current_time": datetime.now().isoformat(),
                            "futu_api_url": futu_api_url,
                        }
                    finally:
                        db.close()
                except Exception as db_error:
                    print(f"⚠️ Failed to get user config: {db_error}")
                    # Fallback to minimal default status
                    status = {
                        "is_running": False,
                        "interval_minutes": 5,
                        "market_type": "US,HK,CN",
                        "market_status": "Scheduler not running",
                        "market_is_open": False,
                        "markets_status": {},
                        "next_run_time": None,
                        "current_time": datetime.now().isoformat(),
                    }
            
            # Always send status (running or stopped)
            await websocket.send_text(json.dumps({
                'type': 'scheduler_status_sync',
                'timestamp': status.get('current_time'),
                'status': status,
            }))
            print(f"📤 Sent scheduler status sync to user {user_id}: running={status.get('is_running')}")
            
        except Exception as sync_error:
            print(f"⚠️ Failed to sync scheduler status: {sync_error}")
            import traceback
            traceback.print_exc()
        
        # Send initial decisions list on connection
        try:
            from web.backend.database import SessionLocal
            from web.backend.models import IntradayDecisionRecord
            from sqlalchemy import select, desc
            
            db = SessionLocal()
            try:
                # Get total count of user's decisions
                from sqlalchemy import func
                total_count_result = db.execute(
                    select(func.count(IntradayDecisionRecord.id))
                    .where(IntradayDecisionRecord.user_id == user_id)
                )
                total_count = total_count_result.scalar() or 0
                
                # Get recent 20 decisions
                result = db.execute(
                    select(IntradayDecisionRecord)
                    .where(IntradayDecisionRecord.user_id == user_id)
                    .order_by(desc(IntradayDecisionRecord.start_time))
                    .limit(20)
                )
                decisions = result.scalars().all()
                
                # Convert to dict - only include summary, not full report
                decisions_data = []
                for decision in decisions:
                    # Extract brief summary from report
                    report_summary = ""
                    if decision.decision_report:
                        lines = decision.decision_report.split('\n')
                        summary_lines = []
                        char_count = 0
                        for line in lines:
                            if char_count > 200:
                                break
                            summary_lines.append(line)
                            char_count += len(line)
                        report_summary = '\n'.join(summary_lines[:5])
                        if len(decision.decision_report) > 200:
                            report_summary += "\n..."
                    
                    decisions_data.append({
                        'id': decision.id,
                        'session_id': decision.session_id,
                        'start_time': decision.start_time.isoformat(),
                        'end_time': decision.end_time.isoformat() if decision.end_time else None,
                        'status': decision.status,
                        'market_type': decision.market_type,
                        'positions_analyzed': decision.positions_analyzed if decision.positions_analyzed else [],
                        'trades_executed': decision.trades_executed if decision.trades_executed else [],
                        'report_summary': report_summary,  # Brief summary only
                        'created_at': decision.created_at.isoformat(),
                    })
                
                # Send decisions list with correct total count
                await websocket.send_text(json.dumps({
                    'type': 'decisions_initial',
                    'timestamp': datetime.now().isoformat(),
                    'decisions': {
                        'items': decisions_data,
                        'total': total_count,  # Total count of all user's decisions
                        'page': 1,
                        'limit': 20,
                    },
                }))
                print(f"📤 Sent initial decisions to user {user_id}: {len(decisions_data)} records (total: {total_count})")
                
            finally:
                db.close()
                
        except Exception as decisions_error:
            print(f"⚠️ Failed to send initial decisions: {decisions_error}")
            import traceback
            traceback.print_exc()
        
        while True:
            # Keep connection alive and handle ping/pong
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                
                if message.get('type') == 'ping':
                    await websocket.send_text(json.dumps({'type': 'pong', 'user_id': user_id}))
            except json.JSONDecodeError:
                pass
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel_id)
    except Exception as e:
        logging.error(f"Intraday WebSocket error for user {user_id}: {e}")
        manager.disconnect(websocket, channel_id)


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
    from web.backend.database import AsyncSessionLocal
    from web.backend.models import AnalysisRecord
    from sqlalchemy import select
    
    async with AsyncSessionLocal() as db:
        user = await get_current_user_from_token(token, db)
        if user is None or not user.is_active:
            try:
                await websocket.close(code=1008)
            except Exception:
                pass
            print("❌ WebSocket invalid token, connection rejected")
            return
        # 细粒度：校验 analysis_id 归属（intraday_* 会话跳过 AnalysisRecord 检查）
        if not analysis_id.startswith('intraday_'):
            stmt = select(AnalysisRecord).filter(
                AnalysisRecord.analysis_id == analysis_id,
                AnalysisRecord.user_id == user.id
            )
            result = await db.execute(stmt)
            analysis = result.scalars().first()
            if not analysis:
                try:
                    await websocket.close(code=1008)
                except Exception:
                    pass
                print("❌ WebSocket access denied: analysis not found or not owned by user")
                return

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
