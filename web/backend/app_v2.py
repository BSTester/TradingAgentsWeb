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

# Import TradingAgents components
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG
from cli.models import AnalystType


# Import database and authentication components
from web.backend.database import get_db, init_db, SessionLocal
from web.backend.models import User, AnalysisRecord, AnalysisLog
from web.backend.schemas import (
    AnalysisRequest, AnalysisResponse, AnalysisStatus, 
    AnalysisResults, ConfigResponse
)
from web.backend.auth_routes import router as auth_router, get_current_active_user
from web.backend.middleware import LoggingMiddleware

# Import API routes
from web.backend.routes import analysis_routes, config_routes, task_routes, page_routes, websocket_routes, export_routes


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
            init_db()
            print("✅ Database tables initialized successfully")
            
            cleanup_running_tasks()
            print("✅ Running tasks cleaned up")
            
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
        monitor_task = getattr(app.state, "monitor_task", None)
        if monitor_task:
            monitor_task.cancel()
        leader_sock = getattr(app.state, "leader_sock", None)
        if leader_sock:
            try:
                leader_sock.close()
            except Exception:
                pass


def cleanup_running_tasks():
    """Clean up running tasks on server restart"""
    db = SessionLocal()
    try:
        # 查找所有运行中或初始化中的任务
        running_tasks = db.query(AnalysisRecord).filter(
            AnalysisRecord.status.in_(["initializing", "running"])
        ).all()
        
        if running_tasks:
            print(f"🔄 发现 {len(running_tasks)} 个运行中的任务，准备中断...")
            
            for task in running_tasks:
                task.status = "interrupted"
                task.current_step = "服务重启，任务已中断"
                task.error_message = "服务重启导致任务中断"
                print(f"  🛑 中断任务: {task.analysis_id}")
            
            db.commit()
            print(f"✅ 已中断 {len(running_tasks)} 个任务")
        else:
            print("✅ 没有需要清理的运行中任务")
            
    except Exception as e:
        print(f"❌ 清理运行中任务失败: {e}")
        db.rollback()
    finally:
        db.close()


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
    
    async def connect(self, websocket: WebSocket, analysis_id: str):
        await websocket.accept()
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
        # 用户级别的任务管理
        self.user_running_tasks: Dict[int, str] = {}  # user_id -> analysis_id
        self.user_task_queues: Dict[int, Queue] = {}  # user_id -> Queue
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

            # 检查该用户是否已有运行中的任务
            if user_id in self.user_running_tasks:
                # 用户已有运行中的任务，加入用户队列
                if user_id not in self.user_task_queues:
                    self.user_task_queues[user_id] = Queue()
                self.user_task_queues[user_id].put((analysis_id, func, args, kwargs))
                print(f"⚠️  用户 {user_id} 已有运行中的任务，任务 {analysis_id} 加入用户队列")
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
        self.user_running_tasks[user_id] = analysis_id
        self.running_count += 1
        
        # 初始化监控
        self.task_last_log_time[analysis_id] = datetime.now()
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
            raise
    
    def _task_completed(self, analysis_id: str, user_id: int):
        """Callback when task completes"""
        with self.lock:
            # 清理任务
            if analysis_id in self.active_tasks:
                del self.active_tasks[analysis_id]
            if user_id in self.user_running_tasks:
                del self.user_running_tasks[user_id]
            if analysis_id in self.task_last_log_time:
                del self.task_last_log_time[analysis_id]
            if analysis_id in self.task_no_log_count:
                del self.task_no_log_count[analysis_id]
            
            self.running_count -= 1
            
            print(f"✅ 任务 {analysis_id} 完成 ({self.running_count}/{self.max_workers} 运行中)")
            
            # 处理该用户的队列
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
        """Update task last log time (called when task sends log)"""
        with self.lock:
            if analysis_id in self.task_last_log_time:
                self.task_last_log_time[analysis_id] = datetime.now()
                self.task_no_log_count[analysis_id] = 0  # 重置计数
    
    def check_stalled_tasks(self):
        """Check for stalled tasks (no log output for too long)"""
        with self.lock:
            current_time = datetime.now()
            stalled_tasks = []
            
            for analysis_id, last_log_time in list(self.task_last_log_time.items()):
                time_diff = (current_time - last_log_time).total_seconds()
                
                # 如果超过 60 秒没有日志输出
                if time_diff > 60:
                    self.task_no_log_count[analysis_id] = self.task_no_log_count.get(analysis_id, 0) + 1
                    print(f"⏰ 任务 {analysis_id} 无日志输出 {time_diff:.0f}秒 (计数: {self.task_no_log_count[analysis_id]}/5)")
                    
                    # 如果连续 5 次检测没有日志输出，判断为异常
                    if self.task_no_log_count[analysis_id] >= 5:
                        print(f"⚠️  任务 {analysis_id} 异常：连续 5 次检测无日志输出，准备中断")
                        stalled_tasks.append(analysis_id)
            
            # 中断异常任务
            for analysis_id in stalled_tasks:
                if analysis_id in self.active_tasks:
                    print(f"🛑 自动中断异常任务 {analysis_id}")
                    print(f"   - stop_event 对象: {self.active_tasks[analysis_id]}")
                    print(f"   - stop_event.is_set() 前: {self.active_tasks[analysis_id].is_set()}")
                    self.active_tasks[analysis_id].set()
                    print(f"   - stop_event.is_set() 后: {self.active_tasks[analysis_id].is_set()}")
                    
                    # 清理监控数据，避免重复触发
                    if analysis_id in self.task_no_log_count:
                        del self.task_no_log_count[analysis_id]
                else:
                    print(f"⚠️  任务 {analysis_id} 不在 active_tasks 中，无法中断")
    
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
websocket_routes.init_websocket_routes(manager)

# Include authentication routes
app.include_router(auth_router)

# Include API routes
app.include_router(analysis_routes.router)
app.include_router(config_routes.router)
app.include_router(task_routes.router)
app.include_router(export_routes.router)

# Include page and WebSocket routes
app.include_router(page_routes.router)
app.include_router(websocket_routes.router)


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
        "web.backend.app_v2:app",
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )