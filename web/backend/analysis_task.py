#!/usr/bin/env python3
"""
独立的分析任务模块- 在独立线程中运行
"""

import os
import sys
import asyncio
import json
import threading
import re
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict

# Add the project root to the path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG
from cli.models import AnalystType

from web.backend.database import SessionLocal, AsyncSessionLocal
from web.backend.models import AnalysisRecord, User
from tradingagents.utils.checkpoints import load_checkpoint, save_checkpoint
from tradingagents.utils.security import safe_join, safe_path_component
from tradingagents.utils.structured_outputs import (
    build_structured_report,
    previous_decision_reflection,
)
from web.backend.services.skills.base import clear_skill_event_sink, set_skill_event_sink


def serialize_state(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Clean state object and remove non-serializable objects.
    """
    if not isinstance(state, dict):
        return {}
    
    cleaned = {}
    for key, value in state.items():
        try:
            # 尝试序列化测试
            json.dumps(value)
            cleaned[key] = value
        except (TypeError, ValueError):
            # 如果无法序列化,转换为字符串
            if hasattr(value, '__dict__'):
                cleaned[key] = str(value)
            elif isinstance(value, (list, tuple)):
                cleaned[key] = [str(item) if not isinstance(item, (str, int, float, bool, type(None))) else item for item in value]
            elif isinstance(value, dict):
                cleaned[key] = serialize_state(value)
            else:
                cleaned[key] = str(value)
    
    return cleaned


def truncate_message(message: str, max_length: int = 200) -> str:
    """Truncate message and add ellipsis."""
    if len(message) <= max_length:
        return message
    return message[:max_length] + '...'


def safe_commit(db, operation_name="operation"):
    """
    Safely commit database changes with proper error handling
    
    Args:
        db: Database session
        operation_name: Name of the operation for logging
    """
    try:
        # Ensure we're in a transaction
        if not db.in_transaction():
            db.begin()
        db.commit()
    except Exception as e:
        print(f"⚠️  Failed to commit {operation_name}: {e}")
        try:
            db.rollback()
        except Exception:
            pass
        # Re-raise to let caller handle
        raise


def _provider_api_key(provider: str, request_api_key: str | None, config: Dict[str, Any]) -> str:
    """Resolve API key from request, TRADINGAGENTS_* config, then legacy env."""
    if request_api_key:
        return request_api_key
    provider = (provider or "openai").lower()
    if provider == "anthropic":
        return config.get("anthropic_api_key") or os.getenv("TRADINGAGENTS_ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_API_KEY", "")
    if provider == "google":
        return config.get("google_api_key") or os.getenv("TRADINGAGENTS_GOOGLE_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
    return config.get("openai_api_key") or os.getenv("TRADINGAGENTS_OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY", "")


class HeartbeatMonitor:
    """
    心跳监控器 - 在长时间操作期间定期发送日志,并在超时时主动停止任务
    """
    def __init__(self, send_log_func, analysis_record, stop_event, manager=None, timeout_seconds=600):
        """
        初始化心跳监控器
        
        Args:
            send_log_func: 日志发送函数
            analysis_record: 分析记录对象
            stop_event: 任务停止事件
            manager: WebSocket 连接管理器
            timeout_seconds: 超时时间(秒),默认 600 秒(10分钟)
        """
        self.send_log = send_log_func
        self.analysis_record = analysis_record
        self.analysis_id = analysis_record.analysis_id
        self.stop_event = stop_event
        self.manager = manager
        self.timeout_seconds = timeout_seconds
        self.last_activity = time.time()
        self.active = threading.Event()
        self.active.set()
        self.thread = None
        self.cached_status = None  # 缓存任务状态
    
    def start(self):
        """启动心跳监控线程"""
        self.thread = threading.Thread(target=self._heartbeat_worker, daemon=True)
        self.thread.start()
        print(f"💓 心跳监控已启动 (超时时间: {self.timeout_seconds}秒)")
    
    def _send_ws_message(self, message_data):
        """在心跳线程中发送 WebSocket 消息（使用线程本地事件循环）"""
        if not self.manager:
            return
        try:
            # 获取或创建当前线程的事件循环
            try:
                loop = asyncio.get_event_loop()
                if loop.is_closed():
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            loop.run_until_complete(self.manager.send_message(message_data, self.analysis_id))
        except Exception as e:
            print(f"⚠️  心跳监控发送消息失败: {e}")
    
    def _heartbeat_worker(self):
        """心跳工作线程 - 每30秒检查一次"""
        heartbeat_count = 0
        while self.active.is_set():
            time.sleep(30)  # 每 30 秒检查一次
            
            if self.active.is_set():
                # 检查任务状态（从数据库）
                try:
                    db = SessionLocal()
                    try:
                        record = db.query(AnalysisRecord).filter(
                            AnalysisRecord.analysis_id == self.analysis_id
                        ).first()
                        if record:
                            self.cached_status = record.status
                            # 如果状态变为 error，立即停止心跳并中断任务
                            if self.cached_status == "error":
                                print(f"🛑 检测到任务 {self.analysis_id} 状态为 error，停止心跳监控")
                                
                                # 发送终止消息到前端
                                self._send_ws_message({
                                    'type': 'interrupted',
                                    'timestamp': datetime.utcnow().isoformat(),
                                    'data': {
                                        'status': 'error',
                                        'message': '任务执行失败，已终止'
                                    }
                                })
                                print(f"✅ 已发送任务终止消息到前端")
                                
                                self.stop_event.set()
                                self.active.clear()
                                break
                    finally:
                        db.close()
                except Exception as e:
                    print(f"⚠️  心跳监控检查状态失败: {e}")
                
                elapsed = time.time() - self.last_activity
                
                # 检查是否超时
                if elapsed > self.timeout_seconds:
                    # 超过 10 分钟没有活动,主动停止任务
                    minutes = int(elapsed / 60)
                    print(f"⚠️  任务超时: 已等待 {minutes} 分钟,超过限制 {self.timeout_seconds/60:.0f} 分钟")
                    
                    self.send_log(
                        'error',
                        f'❌ 任务超时: AI 响应时间过长(已等待 {minutes} 分钟),任务已自动终止',
                        'system',
                        '超时',
                        self.analysis_record.progress_percentage,
                        '错误'
                    )
                    
                    # 设置停止事件
                    self.stop_event.set()
                    print(f"🛑 已设置停止事件,任务将被中断")
                    
                    # 停止心跳监控
                    self.active.clear()
                    break
                
                if elapsed > 30:
                    # 超过 30 秒没有活动,发送心跳日志
                    heartbeat_count += 1
                    minutes = int(elapsed / 60)
                    seconds = int(elapsed % 60)
                    
                    if minutes > 0:
                        time_str = f"{minutes}分{seconds}秒"
                    else:
                        time_str = f"{seconds}秒"
                    
                    self.send_log(
                        'info',
                        f'⏳ AI 正在深度思考中,请耐心等待... (已等待 {time_str})',
                        'system',
                        '处理中',
                        self.analysis_record.progress_percentage,
                        '分析阶段'
                    )
                    print(f"💓 发送心跳日志 #{heartbeat_count} (已等待 {elapsed:.0f}秒)")
    
    def update(self):
        """更新活动时间 - 在收到响应时调用"""
        self.last_activity = time.time()
    
    def stop(self):
        """停止心跳监控"""
        self.active.clear()
        # Wait for thread to finish (with timeout to avoid blocking)
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=1.0)
        print("💓 心跳监控已停止")


def run_analysis_task(
    stop_event: threading.Event,
    analysis_id: str,
    user_id: int,
    request_data: dict,
    manager,
    task_manager=None
):
    """
    在独立线程中运行分析任务
    
    Args:
        stop_event: 用于中断任务的事件
        analysis_id: 分析ID
        user_id: 用户ID
        request_data: 请求数据
        manager: WebSocket 连接管理器
        task_manager: 任务管理器(用于更新日志时间)
        manager: WebSocket 连接管理器
    """
    
    # 创建新的数据库会话（同步，用于后台任务）
    db = SessionLocal()
    
    # 线程本地事件循环（复用以避免频繁创建/销毁）
    _thread_loop = None
    
    def get_or_create_loop():
        """获取或创建当前线程的事件循环"""
        nonlocal _thread_loop
        if _thread_loop is None or _thread_loop.is_closed():
            try:
                _thread_loop = asyncio.get_event_loop()
                if _thread_loop.is_closed():
                    _thread_loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(_thread_loop)
            except RuntimeError:
                _thread_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(_thread_loop)
        return _thread_loop
    
    try:
        # 获取分析记录
        analysis_record = db.query(AnalysisRecord).filter(
            AnalysisRecord.analysis_id == analysis_id
        ).first()
        
        if not analysis_record:
            print(f"❌ 分析记录未找到: {analysis_id}")
            return

        conversation_session_id = request_data.get("conversation_session_id")
        conversation_message_id = request_data.get("conversation_message_id")
        conversation_channel_id = f"conversation_{conversation_session_id}" if conversation_session_id else None

        def send_conversation_event(event_type: str, data: dict):
            if not conversation_channel_id:
                return
            try:
                loop = get_or_create_loop()
                loop.run_until_complete(manager.send_message({
                    "type": event_type,
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": data,
                }, conversation_channel_id))
            except Exception as e:
                print(f"⚠️  发送对话 WebSocket 事件失败: {e}")
        
        def send_log(level: str, message: str, agent: str = 'system', step: str = '', progress: float = 0.0, phase: str = ''):
            """发送日志到控制台和 WebSocket"""
            # Use Beijing time
            from pytz import timezone as pytz_timezone
            beijing_tz = pytz_timezone('Asia/Shanghai')
            now_beijing = datetime.now(beijing_tz)
            timestamp = now_beijing.strftime('%H:%M:%S')
            print(f"[{timestamp}] [{level.upper()}] [{agent}] {message} ({progress:.1f}%)")
            
            # 更新任务日志时间(用于监控)
            if task_manager:
                task_manager.update_task_log_time(analysis_id)
            
            # 截断消息以减少带宽
            truncated_message = truncate_message(message, max_length=200)
            
            try:
                loop = get_or_create_loop()
                loop.run_until_complete(manager.send_message({
                    'type': 'log',
                    'timestamp': now_beijing.isoformat(),
                    'data': {
                        'level': level,
                        'message': truncated_message,
                        'agent': agent,
                        'step': step,
                        'progress': progress,
                        'phase': phase
                    }
                }, analysis_id))
                stage_id = agent or step or phase or "analysis"
                if "开始" in message:
                    send_conversation_event("stage_start", {
                        "stage_id": stage_id,
                        "stage_name": step or phase or stage_id,
                        "display_name": step or phase or stage_id,
                    })
                elif "完成" in message:
                    send_conversation_event("stage_complete", {
                        "stage_id": stage_id,
                        "completed_at": now_beijing.isoformat(),
                        "duration_ms": None,
                    })
                else:
                    send_conversation_event("stage_update", {
                        "stage_id": stage_id,
                        "summary": truncated_message,
                    })
                    if agent != "system" and truncated_message:
                        send_conversation_event("token", {
                            "content": truncated_message,
                            "message_id": conversation_message_id,
                        })
            except Exception as e:
                print(f"⚠️  发送 WebSocket 消息失败: {e}")

        def handle_skill_event(event: dict):
            severity = event.get("severity", "warning")
            message = truncate_message(event.get("message") or "数据源调用降级", max_length=200)
            stage_id = event.get("skill") or "data-source"
            progress = max(float(analysis_record.progress_percentage or 12.0), 12.0)
            level = "error" if severity == "error" else "warning"
            send_log(level, message, 'system', '数据源', progress, '分析阶段')
            if severity == "error":
                send_conversation_event("stage_error", {
                    "stage_id": stage_id,
                    "message": message,
                    "retryable": event.get("retryable", True),
                })
            else:
                send_conversation_event("stage_warning", {
                    "stage_id": stage_id,
                    "message": message,
                    "partial": event.get("partial", True),
                    "retryable": event.get("retryable", True),
                })
        
        def check_stop():
            """检查是否应该停止"""
            is_set = stop_event.is_set()
            if is_set:
                print(f"🛑 检测到中断信号！任务 {analysis_id} 即将中断")
                print(f"   - stop_event: {stop_event}")
                print(f"   - stop_event.is_set(): {is_set}")
                send_log('warning', '⚠️ 分析任务被中断', 'system', '中断', analysis_record.progress_percentage, '中断')
                raise InterruptedError("Analysis interrupted by user or system")
        
        # 开始分析
        send_log('info', '🚀 分析任务已启动', 'system', '初始化', 0.0, '准备阶段')
        check_stop()
        
        # 更新状态 (use Beijing time)
        from pytz import timezone as pytz_timezone
        beijing_tz = pytz_timezone('Asia/Shanghai')
        now_beijing = datetime.now(beijing_tz)
        
        analysis_record.status = "initializing"
        analysis_record.current_step = "设置配置"
        analysis_record.started_at = now_beijing
        safe_commit(db, "update analysis status to initializing")
        
        # 配置 API 密钥（单个字段，根据provider设置对应的环境变量）
        send_log('info', '🔑 配置 API 密钥...', 'system', '配置', 2.0, '准备阶段')
        check_stop()
        
        llm_provider = request_data.get('llm_provider', '').lower()
        api_key = _provider_api_key(llm_provider, request_data.get('api_key'), DEFAULT_CONFIG)
        
        if api_key:
            if llm_provider == "anthropic":
                os.environ["ANTHROPIC_API_KEY"] = api_key
            elif llm_provider == "google":
                os.environ["GOOGLE_API_KEY"] = api_key
            else:
                os.environ["OPENAI_API_KEY"] = api_key
        
        # 准备配置
        send_log('info', '⚙️ 准备分析配置...', 'system', '配置', 4.0, '准备阶段')
        check_stop()
        
        config = DEFAULT_CONFIG.copy()
        config["llm_provider"] = request_data.get('llm_provider', 'openai').lower()
        config["deep_think_llm"] = request_data.get('deep_thinker', DEFAULT_CONFIG["deep_think_llm"])
        config["quick_think_llm"] = request_data.get('shallow_thinker', DEFAULT_CONFIG["quick_think_llm"])
        config["backend_url"] = request_data.get('backend_url') or DEFAULT_CONFIG["backend_url"]
        config["max_debate_rounds"] = request_data.get('research_depth', 1)
        config["max_risk_discuss_rounds"] = request_data.get('research_depth', 1)
        # Pass analysis_id to ensure unique memory collections per analysis (multi-user safety)
        config["analysis_id"] = analysis_id
        config["checkpoint_dir"] = os.getenv("TRADINGAGENTS_CHECKPOINT_DIR", "eval_results")
        if config["llm_provider"] == "anthropic":
            config["anthropic_api_key"] = api_key
        elif config["llm_provider"] == "google":
            config["google_api_key"] = api_key
        else:
            config["openai_api_key"] = api_key

        previous_record = db.query(AnalysisRecord).filter(
            AnalysisRecord.user_id == user_id,
            AnalysisRecord.ticker == request_data.get("ticker"),
            AnalysisRecord.status == "completed",
            AnalysisRecord.analysis_id != analysis_id,
        ).order_by(AnalysisRecord.completed_at.desc()).first()
        previous_reflection = previous_decision_reflection(previous_record)
        config["previous_decision_reflection"] = previous_reflection
        
        # 转换分析师类型
        analyst_types = []
        for analyst_str in request_data.get('analysts', []):
            for analyst_type in AnalystType:
                if analyst_type.value == analyst_str:
                    analyst_types.append(analyst_type.value)
                    break
        
        send_log('info', f'👥 已选择 {len(analyst_types)} 个分析师', 'system', '配置', 6.0, '准备阶段')
        check_stop()
        
        # 发送配置信息给前端，告知选择的智能体
        # 等待一小段时间，确保 WebSocket 连接已建立
        import time
        time.sleep(0.5)
        
        print(f"📋 发送配置消息: selected_analysts={analyst_types}")
        try:
            loop = get_or_create_loop()
            loop.run_until_complete(manager.send_message({
                'type': 'config',
                'timestamp': datetime.utcnow().isoformat(),
                'data': {
                    'selected_analysts': analyst_types,
                    'research_depth': request_data.get('research_depth', 1),
                    'previous_decision_reflection': previous_reflection,
                }
            }, analysis_id))
            print(f"✅ 配置消息已发送")
        except Exception as e:
            print(f"⚠️  发送配置消息失败: {e}")
        
        analysis_record.status = "running"
        analysis_record.current_step = "初始化分析图"
        analysis_record.progress_percentage = 8.0
        safe_commit(db, "update progress to 8%")
        
        # 初始化图
        send_log('info', '🔧 初始化 TradingAgents 分析图...', 'system', '初始化', 8.0, '初始化阶段')
        check_stop()
        
        graph = TradingAgentsGraph(analyst_types, config=config, debug=False)
        
        analysis_record.current_step = "开始分析"
        analysis_record.progress_percentage = 10.0
        safe_commit(db, "update progress to 10%")
        
        send_log('info', f'📊 开始分析 {request_data.get("ticker")}...', 'system', '分析开始', 10.0, '分析阶段')
        check_stop()
        
        # 运行分析
        send_log('info', '👨‍💼 分析师团队开始工作...', 'system', '分析师团队', 10.0, '分析师团队')
        
        # 初始化状态
        init_agent_state = graph.propagator.create_initial_state(
            request_data.get('ticker'),
            request_data.get('analysis_date'),
            user_id=analysis_record.user_id,
            previous_decision_reflection=previous_reflection,
        )
        # Pass user_id to graph args for tools to access
        args = graph.propagator.get_graph_args(user_id=analysis_record.user_id)
        # 修改 stream_mode 为 "updates" 以获取节点信息
        args["stream_mode"] = "updates"
        
        # 计算进度分配
        # 总进度: 10% -> 90%, 共 80% 的进度空间
        # 估算总智能体数量: 分析师 + 研究员(2-3个) + 投资评审(1个) + 交易员(1个) + 风险分析(3-4个) + 风险管理(1个)
        num_analysts = len(analyst_types)
        # 固定的其他智能体: 研究员(bull+bear) + 投资评审 + 交易员 + 风险分析(risky+neutral+safe) + 风险管理
        # 根据配置的辩论轮数估算
        num_researchers = 2  # bull + bear
        num_invest_judge = 1
        num_trader = 1
        num_risk_analysts = 3  # risky + neutral + safe
        num_risk_manager = 1
        # 总智能体数量
        total_agents = num_analysts + num_researchers + num_invest_judge + num_trader + num_risk_analysts + num_risk_manager
        
        progress_per_agent = 80.0 / max(total_agents, 1)  # 每个智能体分配的进度
        base_progress = 10.0
        current_analyst_index = 0
        
        print(f"📊 进度计算: 分析师={num_analysts}, 总智能体={total_agents}, 每个智能体进度={progress_per_agent:.1f}%")
        
        # 智能体名称映射(与logger.py中的ROLES对应)
        agent_name_map = {
            'news': '新闻分析师',
            'social': '社交媒体分析师',
            'market': '市场分析师',
            'fundamentals': '基本面分析师',
            'bull': '多头研究员',
            'bear': '空头研究员',
            'researcher': '研究分析师',
            'invest_judge': '投资评审',
            'trader': '交易员',
            'risky': '激进风险分析师',
            'safe': '保守风险分析师',
            'neutral': '中性风险分析师',
            'risk_manager': '风险管理评审及投资组合分析',
        }
        
        # LangGraph 节点名称到内部智能体代码的映射
        node_to_agent_map = {
            'News Analyst': 'news',
            'Social Analyst': 'social',
            'Market Analyst': 'market',
            'Fundamentals Analyst': 'fundamentals',
            'Bull Researcher': 'bull',
            'Bear Researcher': 'bear',
            'Research Manager': 'invest_judge',
            'Trader': 'trader',
            'Risky Analyst': 'risky',
            'Safe Analyst': 'safe',
            'Neutral Analyst': 'neutral',
            'Portfolio Manager': 'risk_manager',
            'Risk Judge': 'risk_manager',
        }
        
        # 智能体对应的报告字段（用于判断节点完成）
        agent_report_fields = {
            'news': 'news_report',
            'social': 'sentiment_report',
            'market': 'market_report',
            'fundamentals': 'fundamentals_report',
            'bull': 'investment_debate_state',
            'bear': 'investment_debate_state',
            'invest_judge': 'investment_debate_state',
            'trader': 'trader_investment_plan',
            'risky': 'risk_debate_state',
            'safe': 'risk_debate_state',
            'neutral': 'risk_debate_state',
            'risk_manager': 'investment_plan',
        }
        
        # 报告字段收集器
        report_sections = {
            "ticker": request_data.get('ticker', 'UNKNOWN'),
            "company_of_interest": None,
            "trade_date": None,
            "market_report": None,
            "sentiment_report": None,
            "news_report": None,
            "fundamentals_report": None,
            "investment_debate_state": None,
            "trader_investment_plan": None,
            "risk_debate_state": None,
            "investment_plan": None,
            "final_trade_decision": None,
            "grounded_evidence": [],
            "stage_log": [],
            "structured_report": None,
            "reflection": previous_reflection or {},
        }
        checkpoint_payload = load_checkpoint(
            config["checkpoint_dir"],
            user_id,
            request_data.get('ticker', 'UNKNOWN'),
            analysis_id,
        )
        if checkpoint_payload.get("report_sections"):
            report_sections.update(checkpoint_payload["report_sections"])
            init_agent_state.update({
                key: value
                for key, value in report_sections.items()
                if value is not None and key in init_agent_state
            })
            send_log(
                'info',
                f"已从 checkpoint 恢复到阶段: {checkpoint_payload.get('last_successful_stage', 'unknown')}",
                'system',
                '续跑',
                9.0,
                '准备阶段',
            )
        
        # 预定义节点执行顺序（用于追踪智能体切换）
        # 使用与图构建时相同的顺序（analyst_types 就是图的执行顺序）
        agent_execution_order = list(analyst_types)  # 直接使用 analyst_types 的顺序
        
        # 后面的固定顺序（按 node_to_agent_map 的顺序）
        fixed_order = ['bull', 'bear', 'invest_judge', 'trader', 'risky', 'safe', 'neutral', 'risk_manager']
        agent_execution_order.extend(fixed_order)
        
        print(f"📋 预定义智能体执行顺序: {agent_execution_order}")
        
        # 流式执行并定期检查中断
        step_num = 0
        last_agent = None
        current_agent = None
        current_agent_index = 0  # 当前智能体在顺序中的索引
        current_analyst_index = 0  # 用于进度计算
        agent_completed = False  # 标记当前智能体是否已完成（收集到报告字段）
        
        # 创建一个包装器，在 stream 迭代时定期检查中断
        def stream_with_interrupt_check(stream_iterator, check_interval=0.1):
            """
            包装 stream 迭代器，在等待下一个 chunk 时定期检查中断信号
            
            Args:
                stream_iterator: 原始的 stream 迭代器
                check_interval: 检查间隔（秒）
            """
            import queue
            import time
            
            # 创建一个队列来接收 chunks
            chunk_queue = queue.Queue()
            exception_holder = [None]
            finished = threading.Event()
            
            def stream_reader():
                """在后台线程中读取 stream"""
                set_skill_event_sink(lambda event: chunk_queue.put(('skill_event', event, analysis_id)))
                try:
                    for chunk in stream_iterator:
                        chunk_queue.put(('chunk', chunk, analysis_id))
                        if stop_event.is_set():
                            print(f"🛑 [{analysis_id}] Stream reader 检测到中断信号")
                            break
                    chunk_queue.put(('done', None, analysis_id))
                except Exception as e:
                    exception_holder[0] = e
                    chunk_queue.put(('error', e, analysis_id))
                finally:
                    clear_skill_event_sink()
                    finished.set()
            
            # 启动后台读取线程
            reader_thread = threading.Thread(target=stream_reader, daemon=True)
            reader_thread.start()
            
            # 主线程从队列中获取 chunks，同时检查中断
            while not finished.is_set() or not chunk_queue.empty():
                # 检查中断信号
                if stop_event.is_set():
                    print(f"🛑 [{analysis_id}] 主线程检测到中断信号，停止迭代")
                    raise InterruptedError("Analysis interrupted during stream")
                
                try:
                    # 尝试从队列获取 chunk，带超时
                    queue_item = chunk_queue.get(timeout=check_interval)
                    msg_type = queue_item[0]
                    data = queue_item[1]
                    item_analysis_id = queue_item[2] if len(queue_item) > 2 else None
                    
                    # 验证 analysis_id 匹配，避免混淆
                    if item_analysis_id and item_analysis_id != analysis_id:
                        print(f"⚠️  警告: 队列中的 analysis_id ({item_analysis_id}) 与当前任务 ({analysis_id}) 不匹配，跳过")
                        continue
                    
                    if msg_type == 'chunk':
                        yield data
                    elif msg_type == 'skill_event':
                        handle_skill_event(data)
                    elif msg_type == 'done':
                        break
                    elif msg_type == 'error':
                        raise data
                        
                except queue.Empty:
                    # 超时，继续循环检查中断信号
                    continue
            
            # 等待读取线程结束
            reader_thread.join(timeout=1.0)
        
        # 启动心跳监控(传入 stop_event 以支持超时停止)
        heartbeat = HeartbeatMonitor(send_log, analysis_record, stop_event, manager)
        heartbeat.start()
        
        try:
            # 添加日志:开始流式处理
            send_log('info', '🔄 开始流式处理分析图...', 'system', '流式处理', 12.0, '分析阶段')
            
            stream_iterator = graph.graph.stream(init_agent_state, **args)
            for chunk in stream_with_interrupt_check(stream_iterator):
                check_stop()
                heartbeat.update()  # 更新活动时间
                step_num += 1
                
                detected_agent = None
                agent_switched = False
                
                # 在 updates 模式下，chunk 是 {node_name: state_update} 的字典
                # 提取节点名称
                node_name = None
                state_update = None
                if isinstance(chunk, dict):
                    # updates 模式：chunk 的键就是节点名称
                    if len(chunk) > 0:
                        node_name = list(chunk.keys())[0]
                        state_update = chunk[node_name]
                        
                        print(f"🔍 Step {step_num} - Name: {node_name}")
                        
                        # 根据节点名称映射到智能体（这是当前节点的内容）
                        if node_name in node_to_agent_map:
                            mapped_agent = node_to_agent_map[node_name]
                            
                            # 如果还没有当前智能体，这是第一个节点
                            if current_agent is None:
                                detected_agent = mapped_agent
                                print(f"  ✅ 初始化智能体节点: {node_name} -> {detected_agent}")
                            # 如果映射的智能体与当前智能体相同，这是当前节点的内容
                            elif mapped_agent == current_agent:
                                print(f"  📝 当前节点 {node_name} 的内容")
                                # 不改变 detected_agent，继续使用当前智能体
                            # 如果不同，说明切换到了新节点
                            else:
                                detected_agent = mapped_agent
                                print(f"  🔄 切换到新节点: {node_name} -> {detected_agent}")
                        
                        # 收集报告字段
                        if state_update and isinstance(state_update, dict):
                            # 收集基本信息字段
                            if "company_of_interest" in state_update and state_update["company_of_interest"]:
                                report_sections["company_of_interest"] = state_update["company_of_interest"]
                                print(f"  📊 收集到 company_of_interest: {state_update['company_of_interest']}")
                            
                            if "trade_date" in state_update and state_update["trade_date"]:
                                report_sections["trade_date"] = state_update["trade_date"]
                                print(f"  📊 收集到 trade_date: {state_update['trade_date']}")
                            
                            # 收集各个报告字段，并检查是否触发节点完成
                            if "market_report" in state_update and state_update["market_report"]:
                                report_sections["market_report"] = state_update["market_report"]
                                print(f"  📊 收集到 market_report")
                                if current_agent == 'market' and not agent_completed:
                                    agent_completed = True
                                    print(f"  ✅ market 节点完成（收集到报告）")
                                    # 立即触发切换到下一个智能体
                                    if current_agent_index < len(agent_execution_order) - 1:
                                        next_agent_index = current_agent_index + 1
                                        next_agent = agent_execution_order[next_agent_index]
                                        detected_agent = next_agent
                                        print(f"  🔄 触发切换: {current_agent} -> {next_agent} (收集到报告)")
                            
                            if "sentiment_report" in state_update and state_update["sentiment_report"]:
                                report_sections["sentiment_report"] = state_update["sentiment_report"]
                                print(f"  📊 收集到 sentiment_report")
                                if current_agent == 'social' and not agent_completed:
                                    agent_completed = True
                                    print(f"  ✅ social 节点完成（收集到报告）")
                                    # 立即触发切换到下一个智能体
                                    if current_agent_index < len(agent_execution_order) - 1:
                                        next_agent_index = current_agent_index + 1
                                        next_agent = agent_execution_order[next_agent_index]
                                        detected_agent = next_agent
                                        print(f"  🔄 触发切换: {current_agent} -> {next_agent} (收集到报告)")
                            
                            if "news_report" in state_update and state_update["news_report"]:
                                report_sections["news_report"] = state_update["news_report"]
                                print(f"  📊 收集到 news_report")
                                if current_agent == 'news' and not agent_completed:
                                    agent_completed = True
                                    print(f"  ✅ news 节点完成（收集到报告）")
                                    # 立即触发切换到下一个智能体
                                    if current_agent_index < len(agent_execution_order) - 1:
                                        next_agent_index = current_agent_index + 1
                                        next_agent = agent_execution_order[next_agent_index]
                                        detected_agent = next_agent
                                        print(f"  🔄 触发切换: {current_agent} -> {next_agent} (收集到报告)")
                            
                            if "fundamentals_report" in state_update and state_update["fundamentals_report"]:
                                report_sections["fundamentals_report"] = state_update["fundamentals_report"]
                                print(f"  📊 收集到 fundamentals_report")
                                if current_agent == 'fundamentals' and not agent_completed:
                                    agent_completed = True
                                    print(f"  ✅ fundamentals 节点完成（收集到报告）")
                                    # 立即触发切换到下一个智能体
                                    if current_agent_index < len(agent_execution_order) - 1:
                                        next_agent_index = current_agent_index + 1
                                        next_agent = agent_execution_order[next_agent_index]
                                        detected_agent = next_agent
                                        print(f"  🔄 触发切换: {current_agent} -> {next_agent} (收集到报告)")
                            
                            if "investment_debate_state" in state_update and state_update["investment_debate_state"]:
                                report_sections["investment_debate_state"] = state_update["investment_debate_state"]
                                print(f"  📊 收集到 investment_debate_state")
                                if current_agent in ['bull', 'bear', 'invest_judge'] and not agent_completed:
                                    agent_completed = True
                                    print(f"  ✅ {current_agent} 节点完成（收集到报告）")
                                    # 立即触发切换到下一个智能体
                                    if current_agent_index < len(agent_execution_order) - 1:
                                        next_agent_index = current_agent_index + 1
                                        next_agent = agent_execution_order[next_agent_index]
                                        detected_agent = next_agent
                                        print(f"  🔄 触发切换: {current_agent} -> {next_agent} (收集到报告)")
                            
                            if "trader_investment_plan" in state_update and state_update["trader_investment_plan"]:
                                report_sections["trader_investment_plan"] = state_update["trader_investment_plan"]
                                print(f"  📊 收集到 trader_investment_plan")
                                if current_agent == 'trader' and not agent_completed:
                                    agent_completed = True
                                    print(f"  ✅ trader 节点完成（收集到报告）")
                                    # 立即触发切换到下一个智能体
                                    if current_agent_index < len(agent_execution_order) - 1:
                                        next_agent_index = current_agent_index + 1
                                        next_agent = agent_execution_order[next_agent_index]
                                        detected_agent = next_agent
                                        print(f"  🔄 触发切换: {current_agent} -> {next_agent} (收集到报告)")
                            
                            if "risk_debate_state" in state_update and state_update["risk_debate_state"]:
                                report_sections["risk_debate_state"] = state_update["risk_debate_state"]
                                risk_state = state_update["risk_debate_state"]
                                latest_speaker = risk_state.get("latest_speaker", "")
                                print(f"  📊 收集到 risk_debate_state, latest_speaker={latest_speaker}")
                                
                                # 基于 latest_speaker 判断是否需要切换智能体
                                # 只有当 latest_speaker 指示下一个分析师时才切换
                                if current_agent in ['risky', 'safe', 'neutral']:
                                    # 检查是否应该切换到下一个分析师
                                    should_switch = False
                                    next_agent_name = None
                                    
                                    if current_agent == 'risky' and latest_speaker in ['Safe', 'Judge']:
                                        should_switch = True
                                        next_agent_name = 'safe' if latest_speaker == 'Safe' else 'risk_manager'
                                    elif current_agent == 'safe' and latest_speaker in ['Neutral', 'Judge']:
                                        should_switch = True
                                        next_agent_name = 'neutral' if latest_speaker == 'Neutral' else 'risk_manager'
                                    elif current_agent == 'neutral' and latest_speaker == 'Judge':
                                        should_switch = True
                                        next_agent_name = 'risk_manager'
                                    
                                    if should_switch and next_agent_name and not agent_completed:
                                        agent_completed = True
                                        print(f"  ✅ {current_agent} 节点完成（latest_speaker={latest_speaker}）")
                                        # 触发切换到下一个智能体
                                        detected_agent = next_agent_name
                                        print(f"  🔄 触发切换: {current_agent} -> {next_agent_name} (基于latest_speaker)")
                            
                            if "investment_plan" in state_update and state_update["investment_plan"]:
                                report_sections["investment_plan"] = state_update["investment_plan"]
                                print(f"  📊 收集到 investment_plan")
                                # investment_plan 是由 research_manager 生成的，不是 risk_manager
                            
                            if "final_trade_decision" in state_update and state_update["final_trade_decision"]:
                                report_sections["final_trade_decision"] = state_update["final_trade_decision"]
                                print(f"  📊 收集到 final_trade_decision")
                                if current_agent == 'risk_manager' and not agent_completed:
                                    agent_completed = True
                                    print(f"  ✅ risk_manager 节点完成（收集到报告）")
                                    if current_agent_index < len(agent_execution_order) - 1:
                                        next_agent_index = current_agent_index + 1
                                        next_agent = agent_execution_order[next_agent_index]
                                        detected_agent = next_agent
                                        print(f"  🔄 触发切换: {current_agent} -> {next_agent} (收集到报告)")

                            if "grounded_evidence" in state_update and state_update["grounded_evidence"]:
                                existing = report_sections.get("grounded_evidence") or []
                                report_sections["grounded_evidence"] = existing + list(state_update["grounded_evidence"])
                                print(f"  📊 收集到 grounded_evidence")

                            if "structured_report" in state_update and state_update["structured_report"]:
                                report_sections["structured_report"] = state_update["structured_report"]
                                print(f"  📊 收集到 structured_report")

                            if "reflection" in state_update and state_update["reflection"]:
                                report_sections["reflection"] = state_update["reflection"]
                                print(f"  📊 收集到 reflection")
                
                # 获取消息列表（从 state_update 或 chunk 中）
                messages = []
                if state_update and isinstance(state_update, dict):
                    messages = state_update.get("messages", [])
                elif isinstance(chunk, dict):
                    # 兼容旧格式
                    for key, value in chunk.items():
                        if isinstance(value, dict) and "messages" in value:
                            messages = value.get("messages", [])
                            break
                
                # 智能体切换检测（基于节点名称）
                if detected_agent and detected_agent != last_agent:
                    # 上一个智能体完成
                    if last_agent:
                        agent_display_name = agent_name_map.get(last_agent, last_agent)
                        progress = min(90.0, base_progress + (current_analyst_index * progress_per_agent))
                        send_log('info', f'✅ {agent_display_name} 完成分析', last_agent, '完成', progress, '分析阶段')
                        report_sections.setdefault("stage_log", []).append({
                            "id": last_agent,
                            "name": agent_display_name,
                            "status": "completed",
                            "completed_at": datetime.utcnow().isoformat(),
                            "summary": f"{agent_display_name} 完成分析",
                        })
                        try:
                            save_checkpoint(
                                config["checkpoint_dir"],
                                user_id,
                                request_data.get('ticker', 'UNKNOWN'),
                                analysis_id,
                                last_agent,
                                report_sections,
                            )
                        except Exception as checkpoint_error:
                            print(f"⚠️ 保存 checkpoint 失败: {checkpoint_error}")
                        current_analyst_index += 1
                    
                    # 新智能体开始
                    current_agent = detected_agent
                    agent_completed = False  # 重置完成标记
                    
                    # 更新 current_agent_index
                    try:
                        current_agent_index = agent_execution_order.index(current_agent)
                    except ValueError:
                        # 如果不在列表中，保持当前索引
                        print(f"  ⚠️  警告: {current_agent} 不在预定义顺序中")
                    
                    agent_display_name = agent_name_map.get(current_agent, current_agent)
                    progress = min(90.0, base_progress + (current_analyst_index * progress_per_agent))
                    send_log('info', f'🔍 {agent_display_name} 开始分析...', current_agent, '开始', progress, '分析阶段')
                    
                    # 使用独立会话更新进度
                    try:
                        db2 = SessionLocal()
                        db2.query(AnalysisRecord).filter(AnalysisRecord.analysis_id == analysis_id).update({
                            AnalysisRecord.progress_percentage: progress
                        })
                        safe_commit(db2, f"update progress to {progress}%")
                    except Exception as e:
                        print(f"⚠️  Failed to update progress: {e}")
                    finally:
                        try:
                            db2.close()
                        except Exception:
                            pass
                    
                    # 更新 last_agent
                    last_agent = detected_agent
                
                # 处理消息日志
                if len(messages) > 0:
                    first_msg = messages[0]
                    first_msg_content = ""
                    if hasattr(first_msg, 'content'):
                        first_msg_content = str(first_msg.content).strip()
                    
                    # 优先检查工具调用
                    if hasattr(first_msg, 'tool_calls') and first_msg.tool_calls:
                        for tool_call in first_msg.tool_calls:
                            tool_name = ""
                            tool_args = {}
                            
                            if isinstance(tool_call, dict):
                                tool_name = tool_call.get('name', '')
                                tool_args = tool_call.get('args', {})
                            else:
                                tool_name = getattr(tool_call, 'name', '')
                                tool_args = getattr(tool_call, 'args', {})
                            
                            if tool_name:
                                # 格式化工具调用信息
                                args_str = ", ".join([f"{k}={v}" for k, v in list(tool_args.items())[:3]])
                                if len(tool_args) > 3:
                                    args_str += ", ..."
                                
                                log_message = f"🔧 调用工具: {tool_name}({args_str})"
                                
                                # 使用当前智能体
                                agent_to_use = current_agent if current_agent else 'system'
                                progress = min(90.0, base_progress + (current_analyst_index * progress_per_agent) + (progress_per_agent * 0.5))
                                send_log('info', truncate_message(log_message, 150), agent_to_use, '工具调用', progress, '分析阶段')
                                
                                print(f"  🔧 [{agent_to_use}] 工具调用: {tool_name}")
                                break
                    
                    # 如果有普通内容消息，作为当前智能体的日志
                    elif first_msg_content and len(first_msg_content) > 5:
                        agent_to_use = current_agent if current_agent else 'system'
                        progress = min(90.0, base_progress + (current_analyst_index * progress_per_agent) + (progress_per_agent * 0.5))
                        send_log('info', truncate_message(first_msg_content, 150), agent_to_use, '分析中', progress, '分析阶段')
        
        except InterruptedError:
            # 停止心跳监控
            heartbeat.stop()
            # 任务被中断，直接向上抛出
            raise
        except Exception as e:
            print(f"⚠️  Error: {e}")
            raise
        
        check_stop()
        
        # 从收集的报告字段构建最终状态
        print(f"📋 构建最终报告，收集到的字段: {[k for k, v in report_sections.items() if v is not None]}")
        
        # 获取最终决策
        decision_raw = report_sections.get("final_trade_decision", "UNKNOWN")
        decision = graph.process_signal(decision_raw)
        decision = re.sub(r'<thinking>.*?</thinking>', '', decision, flags=re.DOTALL).strip()
        decision = re.sub(r'<思考>.*?</思考>', '', decision, flags=re.DOTALL).strip()
        decision = re.sub(r'<think>.*?</think>', '', decision, flags=re.DOTALL).strip()
        decision = re.sub(r'\s+', ' ', decision).strip()

        if decision.upper() == 'HOLD':
            decision = '观望'
        elif decision.upper() == 'SELL':
            decision = '卖出'
        elif decision.upper() == 'BUY':
            decision = '买入'
        elif decision.upper() == 'UNKNOWN':
            decision = '未明确'

        structured_report = report_sections.get("structured_report") or build_structured_report(report_sections, decision_raw)
        
        # 获取基本信息（从收集的字段中）- use Beijing time
        from pytz import timezone as pytz_timezone
        beijing_tz = pytz_timezone('Asia/Shanghai')
        now_beijing = datetime.now(beijing_tz)
        
        ticker = report_sections.get("ticker", request_data.get('ticker', 'UNKNOWN'))
        company_of_interest = report_sections.get("company_of_interest") or ticker
        trade_date = report_sections.get("trade_date") or request_data.get('analysis_date', now_beijing.strftime('%Y-%m-%d'))
        analysis_date = request_data.get('analysis_date', now_beijing.strftime('%Y-%m-%d'))
        
        print(f"📊 最终信息: ticker={ticker}, company={company_of_interest}, date={trade_date}")
        
        # 构建完整的最终状态（使用收集的报告字段）
        final_state = {
            "company_of_interest": company_of_interest,
            "trade_date": trade_date,
            "market_report": report_sections.get("market_report", ""),
            "sentiment_report": report_sections.get("sentiment_report", ""),
            "news_report": report_sections.get("news_report", ""),
            "fundamentals_report": report_sections.get("fundamentals_report", ""),
            "investment_debate_state": report_sections.get("investment_debate_state", {}),
            "trader_investment_plan": report_sections.get("trader_investment_plan", ""),
            "risk_debate_state": report_sections.get("risk_debate_state", {}),
            "investment_plan": report_sections.get("investment_plan", ""),
            "final_trade_decision": decision_raw,
            "risk_assessment": decision_raw,
            "grounded_evidence": report_sections.get("grounded_evidence", []),
            "stage_log": report_sections.get("stage_log", []),
            "reflection": structured_report.get("reflection", report_sections.get("reflection", {})),
            "structured_report": structured_report,
        }
        
        # Build the role-chain view once and persist it alongside the structured
        # report so the report API can serve it without re-running the builder.
        try:
            from tradingagents.utils.role_chain import build_role_chain
            final_state["role_chain"] = build_role_chain(
                report_sections,
                ticker=ticker,
                company=company_of_interest,
                market=request_data.get("market"),
                published_at=now_beijing.isoformat(),
                model_id=request_data.get("deep_thinker") or request_data.get("shallow_thinker"),
                summary=structured_report.get("summary") or str(decision),
            )
        except Exception as role_chain_err:  # pragma: no cover - never block persistence
            print(f"⚠️  role_chain 构建失败（不影响分析结果）: {role_chain_err}")
        
        # 保存状态到文件(按用户、股票代码和分析ID分开，避免覆盖)
        user_ticker_dir = safe_join(
            "eval_results",
            f"user_{user_id}",
            ticker,
            "TradingAgentsStrategy_logs",
        )
        user_ticker_dir.mkdir(parents=True, exist_ok=True)
        
        # 使用 analysis_id 作为文件名的一部分，确保每次分析都有唯一的文件
        log_file = user_ticker_dir / f"full_states_log_{safe_path_component(analysis_date)}_{safe_path_component(analysis_id)}.json"
        
        # 构建完整的日志数据
        log_data = {
            str(analysis_date): {
                "user_id": user_id,
                "analysis_id": analysis_id,
                "ticker": ticker,
                "company_of_interest": company_of_interest,
                "trade_date": trade_date,
                "market_report": report_sections.get("market_report", ""),
                "sentiment_report": report_sections.get("sentiment_report", ""),
                "news_report": report_sections.get("news_report", ""),
                "fundamentals_report": report_sections.get("fundamentals_report", ""),
                "investment_debate_state": report_sections.get("investment_debate_state", {}),
                "trader_investment_plan": report_sections.get("trader_investment_plan", ""),
                "risk_debate_state": report_sections.get("risk_debate_state", {}),
                "investment_plan": report_sections.get("investment_plan", ""),
                "final_trade_decision": decision_raw,
                "grounded_evidence": report_sections.get("grounded_evidence", []),
                "stage_log": report_sections.get("stage_log", []),
                "reflection": structured_report.get("reflection", report_sections.get("reflection", {})),
                "structured_report": structured_report,
            }
        }
        
        # 保存为 JSON,支持中文显示
        # with open(log_file, "w", encoding="utf-8") as f:
        #     json.dump(log_data, f, indent=4, ensure_ascii=False)
        
        # print(f"💾 分析结果已保存到: {log_file}")
        # send_log('info', f'💾 结果已保存: {log_file}', 'system', '保存', 92.0, '完成阶段')
        
        send_log('info', '分析流程完成', 'system', '完成', 90.0, '完成阶段')
        check_stop()
        
        # 停止心跳监控
        heartbeat.stop()
        
        # 清理内存集合
        send_log('info', '🧹 清理内存资源...', 'system', '清理', 92.0, '完成阶段')
        try:
            graph.cleanup_memories()
        except Exception as e:
            print(f"⚠️  清理内存失败（可忽略）: {e}")
        
        # 保存结果（使用独立会话，避免主会话事务污染导致的重连错误）
        send_log('info', '💾 保存分析结果...', 'system', '保存结果', 95.0, '完成阶段')
        
        # 构造更新字段
        _cleaned_state = serialize_state(final_state) if final_state else None
        # 使用北京时间 (UTC+8)
        beijing_tz = timezone(timedelta(hours=8))
        completed_time = datetime.now(beijing_tz)
        _update_fields = {
            AnalysisRecord.status: "completed",
            AnalysisRecord.current_step: "分析成功完成",
            AnalysisRecord.progress_percentage: 100.0,
            AnalysisRecord.completed_at: completed_time,
            AnalysisRecord.final_state: _cleaned_state,
            AnalysisRecord.company_name: company_of_interest if company_of_interest != ticker else None,
            AnalysisRecord.market_analysis: final_state.get("market_report", "") if final_state else "",
            AnalysisRecord.sentiment_analysis: final_state.get("sentiment_report", "") if final_state else "",
            AnalysisRecord.news_analysis: final_state.get("news_report", "") if final_state else "",
            AnalysisRecord.fundamentals_analysis: final_state.get("fundamentals_report", "") if final_state else "",
            AnalysisRecord.risk_assessment: final_state.get("risk_assessment", "") if final_state else "",
            AnalysisRecord.trading_decision: str(decision) if decision else None,
        }
        try:
            db2 = SessionLocal()
            db2.query(AnalysisRecord).filter(AnalysisRecord.analysis_id == analysis_id).update(_update_fields)
            safe_commit(db2, "save analysis results")
        except Exception as e:
            print(f"保存分析结果失败: {e}")
            # 尝试只保存基本信息（不包含 final_state）
            try:
                db2.query(AnalysisRecord).filter(AnalysisRecord.analysis_id == analysis_id).update({
                    AnalysisRecord.status: "completed",
                    AnalysisRecord.current_step: "分析成功完成",
                    AnalysisRecord.progress_percentage: 100.0,
                    AnalysisRecord.completed_at: completed_time,
                    AnalysisRecord.final_state: None,
                    AnalysisRecord.trading_decision: str(decision) if decision else None,
                })
                safe_commit(db2, "save basic analysis info")
            except Exception:
                try:
                    db2.rollback()
                except Exception:
                    pass
        finally:
            try:
                db2.close()
            except Exception:
                pass

        if conversation_message_id:
            try:
                from web.backend.models import ConversationMessage
                from web.backend.services.report_formatter import report_detail, report_preview

                db3 = SessionLocal()
                try:
                    conv_msg = db3.query(ConversationMessage).filter(ConversationMessage.id == conversation_message_id).first()
                    saved_record = db3.query(AnalysisRecord).filter(AnalysisRecord.analysis_id == analysis_id).first()
                    if conv_msg and saved_record:
                        conv_msg.status = "completed"
                        conv_msg.content = structured_report.get("summary") or str(decision)
                        conv_msg.content_blocks = [
                            {"type": "text", "content": conv_msg.content},
                            {
                                "type": "report",
                                "report_id": analysis_id,
                                "report_preview": report_preview(saved_record, conversation_session_id),
                            },
                        ]
                        safe_commit(db3, "update conversation assistant message")
                        send_conversation_event("analysis_complete", {
                            "message_id": conversation_message_id,
                            "duration_ms": None,
                            "stages_completed": len(report_sections.get("stage_log", [])),
                            "stages_total": 9,
                        })
                        send_conversation_event("report_ready", {
                            "report_id": analysis_id,
                            "message_id": conversation_message_id,
                            "report": report_detail(saved_record, conversation_session_id),
                        })
                finally:
                    db3.close()
            except Exception as conv_error:
                print(f"⚠️ 更新对话消息失败: {conv_error}")
        
        # 发送完成消息
        send_log('info', f'分析完成!交易决 {decision}', 'system', '完成', 100.0, '完成阶段')
        
        loop = get_or_create_loop()
        loop.run_until_complete(manager.send_message({
            'type': 'complete',
            'timestamp': datetime.utcnow().isoformat(),
            'data': {
                'status': 'completed',
                'trading_decision': str(decision)
            }
        }, analysis_id))
        
        # Trigger email sending if enabled (in background thread)
        if analysis_record.email_notification_enabled:
            print(f"📧 Email notification enabled, triggering email send for analysis {analysis_id}")
            try:
                # Run email sending in a separate thread with its own event loop
                email_thread = threading.Thread(
                    target=_send_email_in_thread,
                    args=(analysis_id, user_id),
                    daemon=True
                )
                email_thread.start()
                print(f"📧 Email sending thread started for analysis {analysis_id}")
            except Exception as e:
                print(f"⚠️  Failed to start email thread: {e}")
                import traceback
                traceback.print_exc()
        
    except RuntimeError as e:
        # 处理解释器关闭错误
        if 'interpreter shutdown' in str(e) or 'cannot schedule new futures' in str(e):
            print(f"⚠️  应用正在关闭,任务 {analysis_id} 被终止")
            # 停止心跳监控
            try:
                heartbeat.stop()
            except Exception:
                pass
            # 不需要更新数据库或发送消息,因为应用正在关闭
            return
        else:
            # 其他 RuntimeError,继续抛出
            raise
    
    except InterruptedError as e:
        # 停止心跳监控
        try:
            heartbeat.stop()
        except Exception:
            pass
        
        # 任务被中断
        print(f"⚠️  任务 {analysis_id} 被中断")
        analysis_record.status = "interrupted"
        analysis_record.current_step = "任务已中断"
        analysis_record.error_message = str(e)
        try:
            safe_commit(db, "save error message")
        except Exception as commit_error:
            print(f"⚠️  Failed to save error message: {commit_error}")
            try:
                db2 = SessionLocal()
                db2.query(AnalysisRecord).filter(AnalysisRecord.analysis_id == analysis_id).update({
                    AnalysisRecord.status: "interrupted",
                    AnalysisRecord.current_step: "任务已中断",
                    AnalysisRecord.error_message: str(e)
                })
                safe_commit(db2, "save interrupted status")
            finally:
                try:
                    db2.close()
                except Exception:
                    pass
        
        # 发送中断消息到前端
        loop = get_or_create_loop()
        loop.run_until_complete(manager.send_message({
            'type': 'interrupted',
            'timestamp': datetime.utcnow().isoformat(),
            'data': {
                'status': 'interrupted',
                'message': '分析任务已被中断'
            }
        }, analysis_id))
        if conversation_message_id:
            send_conversation_event("stop_ack", {
                "message_id": conversation_message_id,
                "stopped_at": datetime.utcnow().isoformat(),
                "completed_stages": [item.get("id") for item in report_sections.get("stage_log", []) if isinstance(item, dict)],
                "partial_content": "分析任务已被中断",
            })
            try:
                from web.backend.models import ConversationMessage
                db_stop = SessionLocal()
                try:
                    msg = db_stop.query(ConversationMessage).filter(ConversationMessage.id == conversation_message_id).first()
                    if msg:
                        msg.status = "stopped"
                        msg.content = "分析任务已被中断"
                        safe_commit(db_stop, "mark conversation message stopped")
                finally:
                    db_stop.close()
            except Exception as conv_error:
                print(f"⚠️ 更新对话中断状态失败: {conv_error}")
        
        print(f"✅ 中断消息已发送到前端")
        
    except Exception as e:
        # 其他错误
        import traceback
        
        # 获取异常类型和消息
        error_type = type(e).__name__
        error_msg = str(e)
        error_trace = traceback.format_exc()
        
        # 提取关键错误信息(避免发送整个堆栈)
        # 对于 OpenAI 错误,提取 error 字段
        resp = getattr(e, 'response', None)
        if resp is not None and hasattr(resp, 'json'):
            try:
                error_data = resp.json()
                if 'error' in error_data and isinstance(error_data['error'], dict):
                    error_msg = error_data['error'].get('message', error_msg)
            except:
                pass
        
        print(f"❌ 任务 {analysis_id} 执行失败 [{error_type}]: {error_msg}")
        print(error_trace)  # 完整堆栈仅在控制台显示
        
        # 检测应用关闭错误
        if error_type == 'RuntimeError' and ('interpreter shutdown' in error_msg or 'cannot schedule new futures' in error_msg):
            print(f"⚠️  应用正在关闭,任务 {analysis_id} 被终止")
            # 停止心跳监控
            try:
                heartbeat.stop()
            except Exception:
                pass
            # 不需要更新数据库或发送消息,因为应用正在关闭
            return
        
        # 友好的错误消息
        user_friendly_error = None
        
        # 检测 JSON 解析错误（通常是 API 返回了非 JSON 响应）
        if error_type == 'JSONDecodeError' or 'json' in error_msg.lower() or 'expecting value' in error_msg.lower():
            user_friendly_error = "API 返回了无效的响应格式。可能原因：1) API 服务暂时不可用，2) API 密钥配额不足，3) 网络连接不稳定。请稍后重试或检查 API 配置"
            print(f"💡 JSON 解析错误建议: {user_friendly_error}")
        
        # 检测 token 超限错误
        elif 'context_length_exceeded' in error_msg or 'maximum context length' in error_msg.lower():
            # 提取 token 数量信息
            token_match = re.search(r'(\d+)\s+tokens', error_msg)
            if token_match:
                token_count = token_match.group(1)
                user_friendly_error = f"分析内容过多,超出模型上下文限制(使用了 {token_count} tokens).建议:1) 减少分析师数量,2) 使用更大上下文的模型,3) 减少研究深度"
            else:
                user_friendly_error = "分析内容过多,超出模型上下文限制.建议:1) 减少分析师数量,2) 使用更大上下文的模型,3) 减少研究深度"
            print(f"💡 Token 超限建议: {user_friendly_error}")
        
        # 检测 API 密钥错误
        elif 'api_key' in error_msg.lower() or 'authentication' in error_msg.lower() or 'unauthorized' in error_msg.lower() or '无效的令牌' in error_msg or 'invalid' in error_msg.lower():
            user_friendly_error = f"API 密钥验证失败: {error_msg}.请检查密钥是否正确、是否过期、或是否有足够的额度"
        
        # 检测网络错误
        elif 'connection' in error_msg.lower() or 'timeout' in error_msg.lower():
            user_friendly_error = "网络连接失败,请检查网络连接或 API 服务是否可用"
        
        # 检测限流错误
        elif 'rate_limit' in error_msg.lower() or 'too many requests' in error_msg.lower():
            user_friendly_error = "API 请求频率超限,请稍后再试"
        
        # 检测工具调用错误（如 fundamentals 获取失败）
        elif 'runtimeerror' in error_msg.lower() and 'vendor implementations failed' in error_msg.lower():
            # 提取工具名称
            tool_match = re.search(r"method '(\w+)'", error_msg)
            if tool_match:
                tool_name = tool_match.group(1)
                user_friendly_error = f"数据获取工具 '{tool_name}' 调用失败。可能原因：1) 数据源暂时不可用，2) 股票代码不存在，3) 网络连接问题。建议稍后重试"
            else:
                user_friendly_error = "数据获取工具调用失败，数据源可能暂时不可用。建议稍后重试"
            print(f"💡 工具调用错误: {user_friendly_error}")
        
        # 如果没有匹配到特定错误,使用原始错误消息(但限制长度)
        if not user_friendly_error:
            # 只保留错误消息的前 200 个字符
            if len(error_msg) > 200:
                user_friendly_error = error_msg[:200] + "..."
            else:
                user_friendly_error = error_msg
        
        # 停止心跳监控
        try:
            heartbeat.stop()
        except Exception:
            pass
        
        analysis_record.status = "error"
        analysis_record.current_step = f"错误: {user_friendly_error}"
        analysis_record.error_message = user_friendly_error
        analysis_record.error_traceback = error_trace
        try:
            safe_commit(db, "save error traceback")
        except Exception as commit_error:
            print(f"⚠️  Failed to save error traceback: {commit_error}")
            try:
                db2 = SessionLocal()
                db2.query(AnalysisRecord).filter(AnalysisRecord.analysis_id == analysis_id).update({
                    AnalysisRecord.status: "error",
                    AnalysisRecord.current_step: f"错误: {user_friendly_error}",
                    AnalysisRecord.error_message: user_friendly_error,
                    AnalysisRecord.error_traceback: error_trace
                })
                safe_commit(db2, "save error status")
            finally:
                try:
                    db2.close()
                except Exception:
                    pass
        
        # 发送错误消息到前端
        print(f"📤 准备发送错误消息到前端: {user_friendly_error}")
        try:
            loop = get_or_create_loop()
            error_message = {
                'type': 'error',
                'timestamp': datetime.utcnow().isoformat(),
                'data': {
                    'status': 'error',
                    'error': user_friendly_error
                }
            }
            print(f"📤 错误消息内容: {error_message}")
            loop.run_until_complete(manager.send_message(error_message, analysis_id))
            if conversation_message_id:
                send_conversation_event("stage_error", {
                    "stage_id": analysis_record.current_step or "analysis",
                    "message": user_friendly_error,
                    "retryable": True,
                })
                send_conversation_event("error", {
                    "code": error_type,
                    "message": user_friendly_error,
                    "stage_id": analysis_record.current_step,
                })
                try:
                    from web.backend.models import ConversationMessage
                    db_err = SessionLocal()
                    try:
                        msg = db_err.query(ConversationMessage).filter(ConversationMessage.id == conversation_message_id).first()
                        if msg:
                            msg.status = "error"
                            msg.content = user_friendly_error
                            msg.content_blocks = [{
                                "type": "stage_progress",
                                "stage_id": "analysis",
                                "stage_name": "分析",
                                "status": "error",
                                "summary": user_friendly_error,
                                "started_at": None,
                                "completed_at": datetime.utcnow().isoformat(),
                            }]
                            safe_commit(db_err, "mark conversation message error")
                    finally:
                        db_err.close()
                except Exception as conv_error:
                    print(f"⚠️ 更新对话错误状态失败: {conv_error}")
            print(f"✅ 错误消息已发送到前端")
        except Exception as send_error:
            print(f"❌ 发送错误消息失败: {send_error}")
            import traceback
            traceback.print_exc()
        
    finally:
        # 清理内存集合（无论成功、中断还是失败）
        try:
            if 'graph' in locals():
                graph.cleanup_memories()
                print(f"🧹 已清理分析 {analysis_id} 的内存集合")
        except Exception as e:
            print(f"⚠️  清理内存失败（可忽略）: {e}")
        
        db.close()


def _send_email_in_thread(analysis_id: str, user_id: int):
    """
    Send email in a separate thread using synchronous database operations
    
    Args:
        analysis_id: Analysis ID
        user_id: User ID
    """
    # Use synchronous database session
    db = SessionLocal()
    
    try:
        from web.backend.services.email_service import get_email_service
        
        print(f"📧 [Email] Fetching analysis record for {analysis_id}...")
        
        # Fetch analysis record (synchronous)
        analysis = db.query(AnalysisRecord).filter(
            AnalysisRecord.analysis_id == analysis_id
        ).first()
        
        if not analysis:
            print(f"❌ [Email] Analysis record not found: {analysis_id}")
            return
        
        print(f"📧 [Email] Analysis found: {analysis.ticker}")
        
        # Fetch user (synchronous)
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            print(f"❌ [Email] User not found: {user_id}")
            return
        
        if not user.email:
            print(f"❌ [Email] User {user.username} has no email address")
            return
        
        print(f"📧 [Email] User found: {user.username}, email: {user.email}")
        
        # Get email service
        print(f"📧 [Email] Initializing email service...")
        email_service = get_email_service()
        
        if not email_service.enabled:
            print("⚠️  [Email] Email service not configured, skipping email send")
            analysis.email_error = "Email service not configured"
            db.commit()
            return
        
        print(f"✅ [Email] Email service enabled")
        
        # Prepare report data
        report_sections = {
            "market_analysis": analysis.market_analysis or "",
            "fundamentals_analysis": analysis.fundamentals_analysis or "",
            "sentiment_analysis": analysis.sentiment_analysis or "",
            "news_analysis": analysis.news_analysis or "",
            "risk_assessment": analysis.risk_assessment or ""
        }
        
        # Send email synchronously (we're already in a background thread)
        print(f"📧 [Email] Sending email to {user.email}...")
        
        # Create a new event loop for the async email service
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            success = loop.run_until_complete(
                email_service.send_analysis_report(
                    user_email=user.email,
                    analysis_id=analysis.analysis_id,
                    ticker=analysis.ticker,
                    company_name=analysis.company_name or analysis.ticker,
                    analysis_date=analysis.analysis_date,
                    trading_decision=analysis.trading_decision or "未明确",
                    report_sections=report_sections
                )
            )
        finally:
            loop.close()
        
        # Update database (synchronous)
        from pytz import timezone as pytz_timezone
        beijing_tz = pytz_timezone('Asia/Shanghai')
        now_beijing = datetime.now(beijing_tz)
        
        analysis.email_sent = success
        analysis.email_sent_at = now_beijing if success else None
        if not success:
            analysis.email_error = "Failed to send email after retries"
        else:
            analysis.email_error = None
        
        db.commit()
        
        if success:
            print(f"✅ [Email] Email sent successfully to {user.email}")
        else:
            print(f"❌ [Email] Failed to send email to {user.email}")
        
        print(f"✅ [Email] Email thread completed for analysis {analysis_id}")
        
    except Exception as e:
        print(f"❌ [Email] Error in email thread for analysis {analysis_id}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
