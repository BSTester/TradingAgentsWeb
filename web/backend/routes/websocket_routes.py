#!/usr/bin/env python3
"""
WebSocket Routes
WebSocket 路由
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
from datetime import datetime

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


@router.websocket("/ws/leaderboard")
async def leaderboard_websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time leaderboard updates (public, no auth required)"""
    print("🔌 Leaderboard WebSocket connection attempt received")
    
    # Get channel ID for leaderboard broadcasts
    channel_id = "leaderboard_public"
    
    try:
        # Connect to leaderboard channel (this will accept the connection)
        await manager.connect(websocket, channel_id)
        print(f"✅ Leaderboard WebSocket connected successfully to channel: {channel_id}")

        # Get initial data with better error handling
        try:
            from web.backend.database import AsyncSessionLocal
            from web.backend.models import User, AccountSnapshot, UserConfig
            from sqlalchemy import select, desc

            async with AsyncSessionLocal() as db:
                # First, try to get users participating in leaderboard
                users_query = select(User).where(User.participate_in_leaderboard == True)
                users_result = await db.execute(users_query)
                participating_users = users_result.scalars().all()

                print(f"📊 Found {len(participating_users)} users participating in leaderboard")

                users_list = []
                
                # Get user configs for model information
                user_ids = [user.id for user in participating_users]
                configs = {}
                if user_ids:
                    config_query = select(UserConfig).where(UserConfig.user_id.in_(user_ids))
                    config_result = await db.execute(config_query)
                    configs = {config.user_id: config for config in config_result.scalars().all()}
                    print(f"📊 Found {len(configs)} user configs")

                if participating_users:
                    # For each participating user, get their latest snapshot for each market
                    for user in participating_users:
                        # Get model name from config
                        model_name = None
                        if user.id in configs:
                            config = configs[user.id]
                            model_name = config.intraday_llm_model if config.intraday_llm_model else None
                        
                        # Get all snapshots for this user
                        snapshot_query = select(AccountSnapshot).where(
                            AccountSnapshot.user_id == user.id
                        ).order_by(AccountSnapshot.snapshot_date.desc())

                        snapshot_result = await db.execute(snapshot_query)
                        all_snapshots = snapshot_result.scalars().all()

                        if all_snapshots:
                            # Group by market_type and get the latest for each market
                            market_snapshots = {}
                            for snapshot in all_snapshots:
                                market = snapshot.market_type or 'US'
                                if market not in market_snapshots:
                                    market_snapshots[market] = snapshot
                            
                            # Add one entry per market
                            for market, snapshot in market_snapshots.items():
                                users_list.append({
                                    'user_id': user.id,
                                    'username': user.username,
                                    'market_type': market,
                                    'total_assets': float(snapshot.total_assets) if snapshot.total_assets else 100000.0,
                                    'latest_snapshot_date': snapshot.snapshot_date.strftime('%Y-%m-%d') if snapshot.snapshot_date else datetime.now().strftime('%Y-%m-%d'),
                                    'model_name': model_name
                                })
                        else:
                            # Create default snapshots for all markets if no data exists
                            for market in ['US', 'HK', 'CN']:
                                users_list.append({
                                    'user_id': user.id,
                                    'username': user.username,
                                    'market_type': market,
                                    'total_assets': 100000.0,  # Default starting amount
                                    'latest_snapshot_date': datetime.now().strftime('%Y-%m-%d'),
                                    'model_name': model_name
                                })
                else:
                    # No participating users, send empty data
                    print("ℹ️ No users participating in leaderboard yet")

        except Exception as db_error:
            print(f"❌ Database error in leaderboard WebSocket: {db_error}")
            # Send empty data if database query fails
            users_list = []

        # Sort by total_assets descending
        users_list.sort(key=lambda x: x['total_assets'], reverse=True)
        print(f"📤 Sending initial data with {len(users_list)} users")

        # Send initial data to client
        await websocket.send_text(json.dumps({
            'type': 'initial_data',
            'timestamp': datetime.now().isoformat(),
            'data': {
                'users': users_list
            }
        }))
        print("✅ Initial data sent successfully")

        # Listen for messages from client
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                message_type = message.get('type')

                if message_type == 'get_initial_data':
                    # Resend current data
                    await websocket.send_text(json.dumps({
                        'type': 'initial_data',
                        'timestamp': datetime.now().isoformat(),
                        'data': {
                            'users': users_list
                        }
                    }))
                    print("📤 Resent initial data on request")
                elif message_type == 'ping':
                    # Respond to ping
                    await websocket.send_text(json.dumps({'type': 'pong'}))
                    print("🏓 Responded to ping")

            except WebSocketDisconnect:
                # Client disconnected, break the loop
                print(f"🔌 Client disconnected from leaderboard WebSocket")
                break
            except json.JSONDecodeError:
                print(f"⚠️ Invalid JSON received from leaderboard WebSocket client: {data}")
                try:
                    await websocket.send_text(json.dumps({
                        'type': 'error',
                        'message': 'Invalid JSON format'
                    }))
                except Exception:
                    # Connection might be closed, break the loop
                    break
            except Exception as msg_error:
                print(f"⚠️ Error processing leaderboard WebSocket message: {msg_error}")
                try:
                    await websocket.send_text(json.dumps({
                        'type': 'error',
                        'message': 'Error processing message'
                    }))
                except Exception:
                    # Connection might be closed, break the loop
                    break

    except WebSocketDisconnect:
        print(f"🔌 Leaderboard WebSocket disconnected normally")
    except Exception as e:
        print(f"❌ Leaderboard WebSocket error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Always cleanup connection
        try:
            manager.disconnect(websocket, channel_id)
            print(f"✅ Cleaned up leaderboard WebSocket connection for channel: {channel_id}")
        except Exception as cleanup_error:
            print(f"⚠️ Error during cleanup: {cleanup_error}")


# Function to broadcast leaderboard updates
async def broadcast_leaderboard_update(users_data: list = None, user_data: dict = None):
    """Broadcast leaderboard updates to all connected leaderboard clients"""
    if not manager:
        return

    message = {
        'type': 'leaderboard_update' if users_data else 'user_update',
        'timestamp': datetime.now().isoformat(),
        'data': {}
    }

    if users_data:
        message['data']['users'] = users_data
    elif user_data:
        message['data']['user'] = user_data

    await manager.broadcast_to_channel("leaderboard_public", json.dumps(message))


# Simple test WebSocket endpoint
@router.websocket("/ws/test")
async def test_websocket_endpoint(websocket: WebSocket):
    """Simple test WebSocket endpoint"""
    print("🔌 Test WebSocket connection attempt received")
    try:
        await websocket.accept()
        print("✅ Test WebSocket connected successfully")

        # Send a test message
        await websocket.send_text(json.dumps({
            'type': 'test_message',
            'message': 'WebSocket connection successful!',
            'timestamp': datetime.now().isoformat()
        }))

        # Keep connection alive and echo messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                if message.get('type') == 'ping':
                    await websocket.send_text(json.dumps({'type': 'pong'}))
                else:
                    await websocket.send_text(json.dumps({
                        'type': 'echo',
                        'data': message,
                        'timestamp': datetime.now().isoformat()
                    }))
            except WebSocketDisconnect:
                print("🔌 Test WebSocket disconnected")
                break
            except Exception as e:
                print(f"⚠️ Test WebSocket error: {e}")
                break

    except Exception as e:
        print(f"❌ Test WebSocket connection error: {e}")


# Export the broadcast function for use in other routes
__all__ = ['router', 'init_websocket_routes', 'broadcast_leaderboard_update']
