#!/usr/bin/env python3
"""
TradingAgents Web Interface v2 with Authentication
FastAPI backend with user authentication and database integration
"""

import os
import sys
import asyncio
import json
import threading
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from queue import Queue
import time
import socket

# Add the project root to the path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from fastapi import FastAPI, Request, HTTPException, BackgroundTasks, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from contextlib import asynccontextmanager
import uvicorn
import json
import asyncio
from typing import Dict, List

# Windows asyncio 修复：使用 Selector 事件循环，避免 Proactor 写管道断言
try:
    import os as _os
    if _os.name == "nt":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
except Exception:
    pass

# Load environment variables
load_dotenv()

# Configure logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Disable verbose logging from third-party libraries
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('httpcore').setLevel(logging.WARNING)
logging.getLogger('urllib3').setLevel(logging.WARNING)

# Import TradingAgents components
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG
from cli.models import AnalystType


# Import database and authentication components
from web.backend.database import get_db, init_db, AsyncSessionLocal, SessionLocal
from web.backend.models import User, AnalysisRecord, AnalysisLog
from web.backend.schemas import (
    AnalysisRequest, AnalysisResponse, AnalysisStatus, 
    AnalysisResults, ConfigResponse
)
from web.backend.auth_routes import router as auth_router, get_current_active_user
from web.backend.middleware import LoggingMiddleware

# Import API routes
from web.backend.routes import analysis_routes, config_routes, task_routes, page_routes, websocket_routes, export_routes, leaderboard_routes, user_management_routes, scheduled_task_routes, user_config_routes, intraday_trading_routes, user_leaderboard_routes, public_leaderboard_routes


async def leaderboard_update_task():
    """Background task to periodically update leaderboard data via WebSocket"""
    from web.backend.routes.websocket_routes import broadcast_leaderboard_update
    from web.backend.database import get_db
    from web.backend.models import User, AccountSnapshot, UserConfig
    from sqlalchemy import select, desc

    print("🚀 Leaderboard update task started")

    while True:
        try:
            await asyncio.sleep(60)  # Update every minute

            # Check if there are any leaderboard WebSocket connections
            if "leaderboard_public" in manager.active_connections:
                print(f"📡 Broadcasting leaderboard update to {len(manager.active_connections['leaderboard_public'])} clients")

                try:
                    # Fetch latest leaderboard data with better error handling
                    async with AsyncSessionLocal() as db:
                        # Get participating users first
                        users_query = select(User).where(User.participate_in_leaderboard == True)
                        users_result = await db.execute(users_query)
                        participating_users = users_result.scalars().all()

                        users_list = []
                        
                        # Get user configs for model information
                        user_ids = [user.id for user in participating_users]
                        configs = {}
                        if user_ids:
                            config_query = select(UserConfig).where(UserConfig.user_id.in_(user_ids))
                            config_result = await db.execute(config_query)
                            configs = {config.user_id: config for config in config_result.scalars().all()}

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
                                            'total_assets': 100000.0,
                                            'latest_snapshot_date': datetime.now().strftime('%Y-%m-%d'),
                                            'model_name': model_name
                                        })

                        # Sort by total_assets descending
                        users_list.sort(key=lambda x: x['total_assets'], reverse=True)

                    # Broadcast updates to all leaderboard clients
                    await broadcast_leaderboard_update(users_data=users_list)
                    print(f"📤 Leaderboard update broadcasted with {len(users_list)} users")

                except Exception as db_error:
                    print(f"❌ Database error in leaderboard update: {db_error}")
                    # Broadcast empty data if database query fails
                    await broadcast_leaderboard_update(users_data=[])

        except Exception as e:
            print(f"⚠️ Leaderboard update task error: {e}")
            await asyncio.sleep(60)  # Wait before retrying


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown"""
    # Startup
    try:
        # Leader election via local TCP sentinel to avoid duplicate startup work across workers
        LEADER_PORT = int(os.getenv("TASK_MONITOR_LEADER_PORT", "8001"))  # avoid conflict with service port 8000
        leader_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        leader_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            leader_sock.bind(("127.0.0.1", LEADER_PORT))
            leader_sock.listen(1)
            app.state.is_leader = True
            app.state.leader_sock = leader_sock
            
            # 仅 leader 执行启动任务
            # Initialize database tables (leader only)
            await init_db()
            print("✅ Database tables initialized successfully")
            
            # Run auto migrations (leader only)
            print("🔄 Running auto migrations...")
            try:
                from web.backend.migrations.auto_migrate import auto_migrate
                success, failed, skipped = auto_migrate(verbose=False)
                if failed > 0:
                    print(f"⚠️  {failed} migration(s) failed")
                elif success > 0:
                    print(f"✅ {success} migration(s) applied successfully")
                else:
                    print("✅ Database schema is up to date")
            except Exception as e:
                print(f"⚠️  Auto migration error: {e}")
                # Continue startup even if migrations fail
            
            # Ensure first user is admin
            from web.backend.utils.admin_helper import ensure_first_user_is_admin_async
            async with AsyncSessionLocal() as db:
                await ensure_first_user_is_admin_async(db)
            
            await cleanup_running_tasks()
            print("✅ Running tasks cleaned up")
            
            # Initialize and start scheduler service
            from web.backend.services.scheduler_service import init_scheduler_service
            from web.backend.database import DATABASE_URL
            scheduler = init_scheduler_service(DATABASE_URL)
            scheduler.start()
            app.state.scheduler = scheduler
            print("✅ Scheduler service started")
            
            # Load existing enabled scheduled tasks
            await load_scheduled_tasks(scheduler)
            print("✅ Scheduled tasks loaded")
            
            # Initialize email service
            from web.backend.services.email_service import init_email_service
            email_service = init_email_service()
            app.state.email_service = email_service
            
            # Initialize intraday trading scheduler manager (multi-user)
            # Note: Individual user schedulers are created on-demand via API
            # No global scheduler needed - each user has their own scheduler instance
            print("✅ Intraday trading scheduler manager ready (user schedulers created on-demand)")
            
            # Restore schedulers that were running before service restart
            from web.backend.services.user_intraday_scheduler import get_manager as get_intraday_manager
            intraday_manager = get_intraday_manager()
            await intraday_manager.restore_schedulers_from_db()
            print("✅ Intraday trading schedulers restored from database")
            
            # Initialize and start snapshot scheduler for daily account snapshots
            from web.backend.services.snapshot_scheduler import init_snapshot_scheduler
            snapshot_scheduler = init_snapshot_scheduler()
            app.state.snapshot_scheduler = snapshot_scheduler
            print("✅ Snapshot scheduler started (daily account snapshots)")

            # Start leaderboard WebSocket update task
            asyncio.create_task(leaderboard_update_task())
            print("✅ Leaderboard real-time update task started")
            
            # Preload user configurations into cache
            from web.backend.services.user_config_cache import preload_user_configs
            config_count = preload_user_configs()
            print(f"✅ User configurations preloaded into cache ({config_count} users)")
            
            app.state.monitor_task = asyncio.create_task(task_monitor())
            print("✅ Task monitor started (leader)")
        except OSError:
            # 已有 leader 存在，作为 follower 跳过启动任务
            app.state.is_leader = False
            try:
                leader_sock.close()
            except Exception:
                pass
            print("ℹ️ Task monitor not started (follower)")
            
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
    
    yield
    
    # Shutdown (cleanup if needed)
    print("🔌 Shutting down...")
    if getattr(app.state, "is_leader", False):
        # Stop all user intraday schedulers (but keep auto_start flags for restart)
        try:
            from web.backend.services.user_intraday_scheduler import get_manager as get_intraday_manager
            intraday_manager = get_intraday_manager()
            await intraday_manager.stop_all_schedulers()
            print("✅ All intraday trading schedulers stopped")
        except Exception as e:
            print(f"⚠️  Error stopping intraday schedulers: {e}")
        
        # Stop snapshot scheduler
        snapshot_scheduler = getattr(app.state, "snapshot_scheduler", None)
        if snapshot_scheduler:
            snapshot_scheduler.shutdown(wait=True)
            print("✅ Snapshot scheduler stopped")
        
        # Stop scheduler
        scheduler = getattr(app.state, "scheduler", None)
        if scheduler:
            scheduler.shutdown(wait=True)
            print("✅ Scheduler service stopped")
        
        # Stop task monitor
        monitor_task = getattr(app.state, "monitor_task", None)
        if monitor_task:
            monitor_task.cancel()
        
        # Close leader socket
        leader_sock = getattr(app.state, "leader_sock", None)
        if leader_sock:
            try:
                leader_sock.close()
            except Exception:
                pass


async def cleanup_running_tasks():
    """Clean up running tasks on server restart and restore queued tasks"""
    async with AsyncSessionLocal() as db:
        try:
            from sqlalchemy import select
            
            # 1. 查找所有运行中或初始化中的任务
            result = await db.execute(
                select(AnalysisRecord).where(
                    AnalysisRecord.status.in_(["initializing", "running"])
                )
            )
            running_tasks = result.scalars().all()
            
            if running_tasks:
                print(f"🔄 发现 {len(running_tasks)} 个运行中的任务，准备中断...")
                
                for task in running_tasks:
                    task.status = "interrupted"
                    task.current_step = "服务重启，任务已中断"
                    task.error_message = "服务重启导致任务中断"
                    print(f"  🛑 中断任务: {task.analysis_id}")
                
                await db.commit()
                print(f"✅ 已中断 {len(running_tasks)} 个任务")
            else:
                print("✅ 没有需要清理的运行中任务")
            
            # 2. 查找所有排队中的任务并恢复
            result = await db.execute(
                select(AnalysisRecord).where(
                    AnalysisRecord.status == "queued"
                ).order_by(AnalysisRecord.created_at)  # 按创建时间排序
            )
            queued_tasks = result.scalars().all()
            
            if queued_tasks:
                print(f"🔄 发现 {len(queued_tasks)} 个排队中的任务，准备恢复...")
                
                # 导入必要的模块
                from web.backend.analysis_task import run_analysis_task
                
                restored_count = 0
                for task in queued_tasks:
                    try:
                        # 优先使用任务中保存的 API 密钥，如果没有则从用户配置中读取（兜底）
                        api_key = task.api_key
                        
                        if not api_key:
                            # 兜底：从用户配置中读取
                            from web.backend.models import UserConfig
                            user_config_result = await db.execute(
                                select(UserConfig).where(UserConfig.user_id == task.user_id)
                            )
                            user_config = user_config_result.scalars().first()
                            api_key = user_config.last_api_key if user_config else ''
                        
                        # 准备请求数据（严格使用任务保存的配置）
                        request_data = {
                            'ticker': task.ticker,
                            'analysis_date': task.analysis_date,
                            'analysts': task.analysts if task.analysts else [],
                            'research_depth': task.research_depth or 1,
                            'llm_provider': task.llm_provider or 'openai',
                            'deep_thinker': task.deep_thinker or 'gpt-4o',
                            'shallow_thinker': task.shallow_thinker or 'gpt-4o-mini',
                            'api_key': api_key,  # 优先任务配置，兜底用户配置
                            'backend_url': task.backend_url or '',
                            'enable_trading_executor': task.enable_trading_executor or False,
                            'futu_api_base_url': task.futu_api_base_url,
                            'futu_api_key': task.futu_api_key,
                        }
                        
                        # 提交任务到任务管理器
                        from web.backend.app import task_manager, manager as ws_manager
                        
                        success = task_manager.submit_task(
                            task.analysis_id,
                            task.user_id,
                            run_analysis_task,
                            task.analysis_id,
                            task.user_id,
                            request_data,
                            ws_manager,
                            task_manager
                        )
                        
                        if success:
                            print(f"  ✅ 恢复任务: {task.analysis_id} ({task.ticker})")
                            restored_count += 1
                        else:
                            print(f"  ⏳ 任务已加入队列: {task.analysis_id} ({task.ticker})")
                            restored_count += 1
                            
                    except Exception as e:
                        print(f"  ❌ 恢复任务失败 {task.analysis_id}: {e}")
                        # 将失败的任务标记为错误
                        task.status = "error"
                        task.error_message = f"服务重启后恢复失败: {str(e)}"
                        await db.commit()
                
                print(f"✅ 已恢复 {restored_count}/{len(queued_tasks)} 个排队任务")
            else:
                print("✅ 没有需要恢复的排队任务")
                
        except Exception as e:
            print(f"❌ 清理和恢复任务失败: {e}")
            import traceback
            traceback.print_exc()
            await db.rollback()


async def load_scheduled_tasks(scheduler):
    """Load existing enabled scheduled tasks from database and register with scheduler"""
    async with AsyncSessionLocal() as db:
        try:
            from sqlalchemy import select
            from web.backend.models import ScheduledTask
            
            # Find all enabled pending tasks
            result = await db.execute(
                select(ScheduledTask).where(
                    ScheduledTask.is_enabled == True,
                    ScheduledTask.status == 'pending'
                )
            )
            tasks = result.scalars().all()
            
            if tasks:
                print(f"📋 Loading {len(tasks)} scheduled tasks...")
                
                loaded_count = 0
                expired_count = 0
                
                for task in tasks:
                    try:
                        # Check if task has passed end date before loading
                        if task.end_date:
                            from pytz import timezone as pytz_timezone
                            from datetime import datetime
                            beijing_tz = pytz_timezone('Asia/Shanghai')
                            now_beijing = datetime.now(beijing_tz)
                            
                            # Ensure end_date is timezone-aware
                            if task.end_date.tzinfo is None:
                                end_date_aware = beijing_tz.localize(task.end_date)
                            else:
                                end_date_aware = task.end_date.astimezone(beijing_tz)
                            
                            # If current time is past end date, mark as completed and skip
                            if now_beijing > end_date_aware:
                                print(f"  ⏰ Task {task.id} ({task.task_name}) has passed end date, marking as completed")
                                task.status = 'completed'
                                task.next_run_time = None
                                expired_count += 1
                                continue
                        
                        # Register with scheduler
                        scheduler.add_scheduled_task(
                            task_id=task.id,
                            job_id=task.scheduler_job_id,
                            execution_cycle=task.execution_cycle,
                            execution_time=task.execution_time,
                            interval_days=task.interval_days,
                            day_of_week=task.day_of_week,
                            start_date=task.next_run_time,
                            end_date=task.end_date
                        )
                        
                        # Update next run time
                        next_run = scheduler.get_next_run_time(task.scheduler_job_id)
                        if next_run:
                            # Check if next run is after end date
                            if task.end_date:
                                from pytz import timezone as pytz_timezone
                                from datetime import datetime
                                beijing_tz = pytz_timezone('Asia/Shanghai')
                                
                                # Ensure end_date is timezone-aware
                                if task.end_date.tzinfo is None:
                                    end_date_aware = beijing_tz.localize(task.end_date)
                                else:
                                    end_date_aware = task.end_date.astimezone(beijing_tz)
                                
                                # Ensure next_run is timezone-aware
                                if next_run.tzinfo is None:
                                    next_run_aware = beijing_tz.localize(next_run)
                                else:
                                    next_run_aware = next_run.astimezone(beijing_tz)
                                
                                if next_run_aware > end_date_aware:
                                    print(f"  ⏰ Task {task.id} ({task.task_name}) next run is after end date, marking as completed")
                                    task.status = 'completed'
                                    task.next_run_time = None
                                    scheduler.remove_scheduled_task(task.scheduler_job_id)
                                    expired_count += 1
                                    continue
                            
                            task.next_run_time = next_run
                            loaded_count += 1
                            print(f"  ✅ Loaded task {task.id}: {task.task_name} (next run: {next_run})")
                        else:
                            # No next run scheduled
                            print(f"  ⏰ Task {task.id} ({task.task_name}) has no more runs, marking as completed")
                            task.status = 'completed'
                            task.next_run_time = None
                            scheduler.remove_scheduled_task(task.scheduler_job_id)
                            expired_count += 1
                        
                    except Exception as e:
                        print(f"  ❌ Failed to load task {task.id}: {e}")
                
                await db.commit()
                print(f"✅ Loaded {loaded_count} scheduled tasks, {expired_count} tasks marked as completed")
            else:
                print("✅ No scheduled tasks to load")
                
        except Exception as e:
            print(f"❌ Failed to load scheduled tasks: {e}")
            await db.rollback()


async def task_monitor():
    """Monitor tasks for stalled execution"""
    while True:
        try:
            await asyncio.sleep(60)  # 每 60 秒检查一次
            task_manager.check_stalled_tasks()
        except asyncio.CancelledError:
            print("🛑 Task monitor stopped")
            break
        except Exception as e:
            print(f"❌ Task monitor error: {e}")

# Initialize FastAPI app with lifespan
app = FastAPI(
    title="TradingAgents Web Interface v2",
    description="Multi-Agents LLM Financial Trading Framework - Web Interface with Authentication",
    version="2.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add custom middleware
app.add_middleware(LoggingMiddleware)


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, analysis_id: str, subprotocol: str | None = None):
        # Accept with optional subprotocol for auth negotiation
        await websocket.accept(subprotocol=subprotocol)
        if analysis_id not in self.active_connections:
            self.active_connections[analysis_id] = []
        self.active_connections[analysis_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, analysis_id: str):
        if analysis_id in self.active_connections:
            connections = self.active_connections[analysis_id]
            # 幂等安全移除：仅当存在时移除，避免 list.remove 抛错
            if websocket in connections:
                connections.remove(websocket)
            # 若列表已空则清理该 analysis_id
            if not connections:
                try:
                    del self.active_connections[analysis_id]
                except Exception:
                    self.active_connections[analysis_id] = []
    
    async def send_message(self, message: dict, analysis_id: str):
        # Ensure analysis_id is present at top-level
        if not isinstance(message, dict):
            message = { 'type': 'log', 'timestamp': datetime.utcnow().isoformat(), 'message': str(message) }
        message['analysis_id'] = analysis_id

        if analysis_id in self.active_connections:
            for connection in list(self.active_connections[analysis_id]):
                try:
                    await connection.send_text(json.dumps(message))
                except (ConnectionResetError, BrokenPipeError, OSError, RuntimeError):
                    # Windows/网络层连接已断，静默移除
                    try:
                        self.active_connections[analysis_id].remove(connection)
                    except Exception:
                        pass
                except Exception as e:
                    # 其它异常保留日志，并移除失效连接
                    print(f"⚠️ 发送消息失败: {e}")
                    try:
                        self.active_connections[analysis_id].remove(connection)
                    except Exception:
                        pass
    
    async def close_connections(self, analysis_id: str):
        """Close all WebSocket connections for a specific analysis"""
        if analysis_id in self.active_connections:
            connections = list(self.active_connections[analysis_id])
            for connection in connections:
                try:
                    await connection.close(code=1000, reason="Analysis stopped by user")
                    print(f"🔌 Closed WebSocket connection for {analysis_id}")
                except (ConnectionResetError, BrokenPipeError, OSError, RuntimeError):
                    # 已被远端关闭或管道断开，静默忽略
                    pass
                except Exception as e:
                    print(f"❌ Error closing WebSocket: {e}")
            # 清理连接列表
            try:
                del self.active_connections[analysis_id]
            except Exception:
                self.active_connections[analysis_id] = []

    async def broadcast_to_channel(self, channel_id: str, message: str):
        """Broadcast a message to all connections in a specific channel"""
        if channel_id in self.active_connections:
            connections = list(self.active_connections[channel_id])
            for connection in connections:
                try:
                    await connection.send_text(message)
                except (ConnectionResetError, BrokenPipeError, OSError, RuntimeError):
                    # Connection closed, remove it
                    try:
                        self.active_connections[channel_id].remove(connection)
                    except Exception:
                        pass
                except Exception as e:
                    print(f"⚠️ Error broadcasting to channel {channel_id}: {e}")
                    try:
                        self.active_connections[channel_id].remove(connection)
                    except Exception:
                        pass

manager = ConnectionManager()

# Task management
class TaskManager:
    def __init__(self, max_workers=50):
        self.max_workers = max_workers
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.active_tasks: Dict[str, threading.Event] = {}
        self.task_queue = Queue()
        self.running_count = 0
        self.lock = threading.Lock()
        # 用户级别的任务管理（允许每个用户同时运行2个任务）
        self.user_running_tasks: Dict[int, set] = {}  # user_id -> set of analysis_ids
        self.user_task_queues: Dict[int, Queue] = {}  # user_id -> Queue
        self.max_concurrent_tasks_per_user = 2  # 每个用户最多同时运行2个任务
        # 任务监控
        self.task_last_log_time: Dict[str, datetime] = {}  # analysis_id -> last_log_time
        self.task_no_log_count: Dict[str, int] = {}  # analysis_id -> no_log_count
        
    def submit_task(self, analysis_id: str, user_id: int, func, *args, **kwargs):
        """Submit a task to the executor with user-level queuing"""
        with self.lock:
            # 幂等去重：同一 analysis_id 仅允许存在一次（运行中或队列中）
            if analysis_id in self.active_tasks:
                print(f"ℹ️ 任务 {analysis_id} 已在运行，忽略重复提交")
                return False
            # 检查全局等待队列
            try:
                from collections import deque
                queued = list(self.task_queue.queue)  # type: ignore[attr-defined]
            except Exception:
                queued = []
            if any(item and item[0] == analysis_id for item in queued):
                print(f"ℹ️ 任务 {analysis_id} 已在全局队列中，忽略重复提交")
                return False
            # 检查该用户的等待队列
            if user_id in self.user_task_queues:
                try:
                    user_q_items = list(self.user_task_queues[user_id].queue)  # type: ignore[attr-defined]
                except Exception:
                    user_q_items = []
                if any(item and item[0] == analysis_id for item in user_q_items):
                    print(f"ℹ️ 任务 {analysis_id} 已在用户队列中，忽略重复提交")
                    return False

            # 检查该用户当前运行的任务数
            user_running_count = len(self.user_running_tasks.get(user_id, set()))
            if user_running_count >= self.max_concurrent_tasks_per_user:
                # 用户已达到并发上限，加入用户队列
                if user_id not in self.user_task_queues:
                    self.user_task_queues[user_id] = Queue()
                self.user_task_queues[user_id].put((analysis_id, func, args, kwargs))
                print(f"⚠️  用户 {user_id} 已有 {user_running_count} 个运行中的任务（上限 {self.max_concurrent_tasks_per_user}），任务 {analysis_id} 加入用户队列")
                return False
            
            # 检查全局任务数
            if self.running_count >= self.max_workers:
                print(f"⚠️  任务队列已满 ({self.running_count}/{self.max_workers})，任务 {analysis_id} 进入等待队列")
                self.task_queue.put((analysis_id, user_id, func, args, kwargs))
                return False
            
            # 创建并启动任务
            self._start_task(analysis_id, user_id, func, *args, **kwargs)
            return True
    
    def _start_task(self, analysis_id: str, user_id: int, func, *args, **kwargs):
        """Start a task (internal method)"""
        # Create stop event for this task
        stop_event = threading.Event()
        self.active_tasks[analysis_id] = stop_event
        
        # Add to user's running tasks set
        if user_id not in self.user_running_tasks:
            self.user_running_tasks[user_id] = set()
        self.user_running_tasks[user_id].add(analysis_id)
        
        self.running_count += 1
        
        # 初始化监控 (use Beijing time)
        from pytz import timezone as pytz_timezone
        beijing_tz = pytz_timezone('Asia/Shanghai')
        self.task_last_log_time[analysis_id] = datetime.now(beijing_tz)
        self.task_no_log_count[analysis_id] = 0
        
        print(f"✅ 提交任务 {analysis_id} (用户 {user_id}) ({self.running_count}/{self.max_workers} 运行中)")
        
        # Submit task
        future = self.executor.submit(self._run_task, analysis_id, user_id, stop_event, func, *args, **kwargs)
        future.add_done_callback(lambda f: self._task_completed(analysis_id, user_id))
    
    def _run_task(self, analysis_id: str, user_id: int, stop_event: threading.Event, func, *args, **kwargs):
        """Run task with stop event"""
        try:
            return func(stop_event, *args, **kwargs)
        except Exception as e:
            print(f"❌ 任务 {analysis_id} 执行失败: {e}")
            # Ensure task status is set to "failed" in database (only if not already set to error/interrupted)
            try:
                from web.backend.database import SessionLocal
                from web.backend.models import AnalysisRecord
                db = SessionLocal()
                try:
                    record = db.query(AnalysisRecord).filter(AnalysisRecord.analysis_id == analysis_id).first()
                    if record and record.status not in ("error", "interrupted", "failed"):
                        # Only update if status hasn't been set by the task itself
                        record.status = "failed"
                        db.commit()
                        print(f"✅ 任务 {analysis_id} 状态已更新为 failed")
                    elif record:
                        print(f"ℹ️  任务 {analysis_id} 状态已是 {record.status}，跳过更新")
                except Exception as db_error:
                    print(f"⚠️  更新任务状态失败: {db_error}")
                    try:
                        db.rollback()
                    except Exception:
                        pass
                finally:
                    db.close()
            except Exception as update_error:
                print(f"⚠️  无法更新任务状态: {update_error}")
            raise
    
    def _task_completed(self, analysis_id: str, user_id: int):
        """Callback when task completes"""
        with self.lock:
            # Check task status from database
            task_status = "unknown"
            try:
                from web.backend.database import SessionLocal
                from web.backend.models import AnalysisRecord
                db = SessionLocal()
                try:
                    record = db.query(AnalysisRecord).filter(AnalysisRecord.analysis_id == analysis_id).first()
                    if record:
                        task_status = record.status
                finally:
                    db.close()
            except Exception:
                pass
            
            # 清理任务
            if analysis_id in self.active_tasks:
                del self.active_tasks[analysis_id]
            
            # Remove from user's running tasks set
            if user_id in self.user_running_tasks:
                self.user_running_tasks[user_id].discard(analysis_id)
                # Clean up empty set
                if not self.user_running_tasks[user_id]:
                    del self.user_running_tasks[user_id]
            
            if analysis_id in self.task_last_log_time:
                del self.task_last_log_time[analysis_id]
            if analysis_id in self.task_no_log_count:
                del self.task_no_log_count[analysis_id]
            
            self.running_count -= 1
            
            user_running_count = len(self.user_running_tasks.get(user_id, set()))
            
            # Log with appropriate status indicator
            if task_status == "completed":
                status_icon = "✅"
                status_text = "完成"
            elif task_status in ("error", "failed"):
                status_icon = "❌"
                status_text = "失败"
            elif task_status == "interrupted":
                status_icon = "⚠️"
                status_text = "中断"
            else:
                status_icon = "🔄"
                status_text = "结束"
            
            print(f"{status_icon} 任务 {analysis_id} {status_text} (全局: {self.running_count}/{self.max_workers}, 用户 {user_id}: {user_running_count}/{self.max_concurrent_tasks_per_user})")
            
            # 处理该用户的队列（如果用户还有空闲槽位）
            if user_running_count < self.max_concurrent_tasks_per_user:
                if user_id in self.user_task_queues and not self.user_task_queues[user_id].empty():
                    queued_id, func, args, kwargs = self.user_task_queues[user_id].get()
                    print(f"📤 从用户 {user_id} 队列中取出任务 {queued_id}")
                    self._start_task(queued_id, user_id, func, *args, **kwargs)
                    return
            
            # 处理全局队列
            if not self.task_queue.empty():
                queued_id, queued_user_id, func, args, kwargs = self.task_queue.get()
                print(f"📤 从全局队列中取出任务 {queued_id}")
                self.submit_task(queued_id, queued_user_id, func, *args, **kwargs)
    
    def update_task_log_time(self, analysis_id: str):
        """Update task last log time (called when task sends log) - kept for compatibility"""
        # 保留此方法以保持兼容性,但不再使用
        pass
    
    def check_stalled_tasks(self):
        """Check for stalled tasks - deprecated, now using HeartbeatMonitor"""
        # 此方法已废弃,现在使用 HeartbeatMonitor 进行心跳检测
        # 保留空方法以保持兼容性
        pass
    
    def stop_task(self, analysis_id: str) -> bool:
        """Stop a running task"""
        with self.lock:
            if analysis_id in self.active_tasks:
                print(f"🛑 中断任务 {analysis_id}")
                self.active_tasks[analysis_id].set()
                return True
            return False
    
    def get_status(self):
        """Get task manager status"""
        with self.lock:
            return {
                "running": self.running_count,
                "max_workers": self.max_workers,
                "queued": self.task_queue.qsize(),
                "active_tasks": list(self.active_tasks.keys()),
                "user_running_tasks": dict(self.user_running_tasks)
            }

task_manager = TaskManager(max_workers=50)


# Initialize route dependencies
analysis_routes.init_analysis_routes(task_manager, manager)
task_routes.init_task_routes(task_manager)

# Include authentication routes
app.include_router(auth_router)

# Include API routes
app.include_router(analysis_routes.router)
app.include_router(config_routes.router)
app.include_router(task_routes.router)
app.include_router(export_routes.router)
app.include_router(leaderboard_routes.router)
app.include_router(user_management_routes.router)
app.include_router(scheduled_task_routes.router)

# Include intraday trading routes
from web.backend.routes import intraday_trading_routes
app.include_router(intraday_trading_routes.router)

# Include user config routes
from web.backend.routes import user_config_routes
from web.backend.routes import user_leaderboard_routes
from web.backend.routes import public_leaderboard_routes
app.include_router(user_config_routes.router)
app.include_router(user_leaderboard_routes.router)
app.include_router(public_leaderboard_routes.router)

# Include prompt management routes
from web.backend.routes import prompt_routes
app.include_router(prompt_routes.router)

# Include WebSocket routes
websocket_routes.init_websocket_routes(manager)
app.include_router(websocket_routes.router)

# Include account snapshot routes
from web.backend.routes import account_snapshot_routes
app.include_router(account_snapshot_routes.router)

# Include LLM configuration routes
from web.backend.routes import llm_config_routes
app.include_router(llm_config_routes.router)

# Include page routes
app.include_router(page_routes.router)


def generate_final_summary(ticker: str, decision: str, final_state: dict) -> str:
    """Generate a comprehensive markdown summary from analysis results"""
    summary_parts = [
        f"# 股票分析报告 - {ticker}\n",
        f"## 最终交易决策: **{decision}**\n"
    ]
    
    # Add market analysis
    if final_state.get("market_analysis"):
        summary_parts.append("## 市场环境分析\n")
        summary_parts.append(f"{final_state['market_analysis']}\n")
    
    # Add fundamentals analysis
    if final_state.get("fundamentals_analysis"):
        summary_parts.append("## 基本面评估\n")
        summary_parts.append(f"{final_state['fundamentals_analysis']}\n")
    
    # Add sentiment analysis
    if final_state.get("sentiment_analysis"):
        summary_parts.append("## 情绪与舆论\n")
        summary_parts.append(f"{final_state['sentiment_analysis']}\n")
    
    # Add news analysis
    if final_state.get("news_analysis"):
        summary_parts.append("## 新闻分析\n")
        summary_parts.append(f"{final_state['news_analysis']}\n")
    
    # Add risk assessment
    if final_state.get("risk_assessment"):
        summary_parts.append("## 风险评估\n")
        summary_parts.append(f"{final_state['risk_assessment']}\n")
    
    # Add investment recommendation
    summary_parts.append("## 投资建议\n")
    summary_parts.append(f"综合以上分析，建议**{decision}**该标的。\n")
    
    # Add risk warning
    summary_parts.append("\n---\n")
    summary_parts.append("**风险提示：** 投资有风险，建议严格执行风险管理策略。市场环境变化时应及时调整策略。\n")
    
    return "\n".join(summary_parts)

def generate_phases_data(final_state: dict, analyst_types: list) -> list:
    """Generate phases data structure for frontend display"""
    phases = []
    
    # Phase 1: Analyst Team
    analyst_team = {
        "id": 1,
        "name": "分析师团队",
        "icon": "fa-users",
        "color": "blue",
        "agents": []
    }
    
    for analyst_type in analyst_types:
        agent_name = ""
        agent_result = ""
        
        if analyst_type == "market":
            agent_name = "市场分析师"
            agent_result = final_state.get("market_analysis", "暂无分析结果")
        elif analyst_type == "social":
            agent_name = "社交分析师"
            agent_result = final_state.get("sentiment_analysis", "暂无分析结果")
        elif analyst_type == "news":
            agent_name = "新闻分析师"
            agent_result = final_state.get("news_analysis", "暂无分析结果")
        elif analyst_type == "fundamentals":
            agent_name = "基本面分析师"
            agent_result = final_state.get("fundamentals_analysis", "暂无分析结果")
        
        if agent_name:
            analyst_team["agents"].append({
                "name": agent_name,
                "result": agent_result[:500] + "..." if len(agent_result) > 500 else agent_result
            })
    
    if analyst_team["agents"]:
        phases.append(analyst_team)
    
    # Phase 2: Research Team (if available)
    if final_state.get("research_analysis"):
        phases.append({
            "id": 2,
            "name": "研究团队",
            "icon": "fa-search",
            "color": "green",
            "agents": [{
                "name": "研究分析师",
                "result": final_state["research_analysis"]
            }]
        })
    
    # Phase 3: Trading Team (if available)
    if final_state.get("trading_strategy"):
        phases.append({
            "id": 3,
            "name": "交易团队",
            "icon": "fa-chart-line",
            "color": "purple",
            "agents": [{
                "name": "交易策略师",
                "result": final_state["trading_strategy"]
            }]
        })
    
    # Phase 4: Risk Management
    if final_state.get("risk_assessment"):
        phases.append({
            "id": 4,
            "name": "风险管理",
            "icon": "fa-shield-alt",
            "color": "red",
            "agents": [{
                "name": "风险分析师",
                "result": final_state["risk_assessment"]
            }]
        })
    
    return phases

# Mount static files
app.mount("/static", StaticFiles(directory="web/backend/static"), name="static")

if __name__ == "__main__":
    uvicorn.run(
        "web.backend.app:app",
        host="0.0.0.0",
        port=8000,
        reload=os.getenv("NODE_ENV", "production") != "production",
        log_level="info"
    )