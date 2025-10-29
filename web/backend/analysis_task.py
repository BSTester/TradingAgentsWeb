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
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict

# Add the project root to the path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG
from cli.models import AnalystType

from web.backend.database import SessionLocal
from web.backend.models import AnalysisRecord


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
    
    try:
        # 获取分析记录
        analysis_record = db.query(AnalysisRecord).filter(
            AnalysisRecord.analysis_id == analysis_id
        ).first()
        
        if not analysis_record:
            print(f"❌ 分析记录未找到: {analysis_id}")
            return
        
        def send_log(level: str, message: str, agent: str = 'system', step: str = '', progress: float = 0.0, phase: str = ''):
            """发送日志到控制台和 WebSocket"""
            timestamp = datetime.utcnow().strftime('%H:%M:%S')
            print(f"[{timestamp}] [{level.upper()}] [{agent}] {message} ({progress:.1f}%)")
            
            # 更新任务日志时间(用于监控)
            if task_manager:
                task_manager.update_task_log_time(analysis_id)
            
            # 截断消息以减少带宽
            truncated_message = truncate_message(message, max_length=200)
            
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(manager.send_message({
                    'type': 'log',
                    'timestamp': datetime.utcnow().isoformat(),
                    'data': {
                        'level': level,
                        'message': truncated_message,
                        'agent': agent,
                        'step': step,
                        'progress': progress,
                        'phase': phase
                    }
                }, analysis_id))
                loop.close()
            except Exception as e:
                print(f"⚠️  发送 WebSocket 消息失败: {e}")
        
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
        
        # 更新状态
        analysis_record.status = "initializing"
        analysis_record.current_step = "设置配置"
        analysis_record.started_at = datetime.utcnow()
        db.commit()
        
        # 配置 API 密钥
        send_log('info', '🔑 配置 API 密钥...', 'system', '配置', 2.0, '准备阶段')
        check_stop()
        
        if request_data.get('openai_api_key') and request_data.get('llm_provider', '').lower() in ("openai", "oneai", "openrouter", "deepseek", "qwen"):
            os.environ["OPENAI_API_KEY"] = request_data['openai_api_key']
        elif request_data.get('anthropic_api_key') and request_data.get('llm_provider', '').lower() == "anthropic":
            os.environ["ANTHROPIC_API_KEY"] = request_data['anthropic_api_key']
        elif request_data.get('google_api_key') and request_data.get('llm_provider', '').lower() == "google":
            os.environ["GOOGLE_API_KEY"] = request_data['google_api_key']
        
        # 准备配置
        send_log('info', '⚙️ 准备分析配置...', 'system', '配置', 4.0, '准备阶段')
        check_stop()
        
        config = DEFAULT_CONFIG.copy()
        config["llm_provider"] = request_data.get('llm_provider', 'openai').lower()
        config["deep_think_llm"] = request_data.get('deep_thinker', 'gpt-4o')
        config["quick_think_llm"] = request_data.get('shallow_thinker', 'gpt-4o-mini')
        config["backend_url"] = request_data.get('backend_url', '')
        config["max_debate_rounds"] = request_data.get('research_depth', 1)
        config["max_risk_discuss_rounds"] = request_data.get('research_depth', 1)
        
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
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(manager.send_message({
                'type': 'config',
                'timestamp': datetime.utcnow().isoformat(),
                'data': {
                    'selected_analysts': analyst_types,
                    'research_depth': request_data.get('research_depth', 1)
                }
            }, analysis_id))
            loop.close()
            print(f"✅ 配置消息已发送")
        except Exception as e:
            print(f"⚠️  发送配置消息失败: {e}")
        
        analysis_record.status = "running"
        analysis_record.current_step = "初始化分析图"
        analysis_record.progress_percentage = 8.0
        db.commit()
        
        # 初始化图
        send_log('info', '🔧 初始化 TradingAgents 分析图...', 'system', '初始化', 8.0, '初始化阶段')
        check_stop()
        
        graph = TradingAgentsGraph(analyst_types, config=config, debug=False)
        
        analysis_record.current_step = "开始分析"
        analysis_record.progress_percentage = 10.0
        db.commit()
        
        send_log('info', f'📊 开始分析 {request_data.get("ticker")}...', 'system', '分析开始', 10.0, '分析阶段')
        check_stop()
        
        # 运行分析
        send_log('info', '👨‍💼 分析师团队开始工作...', 'system', '分析师团队', 10.0, '分析师团队')
        
        # 初始化状态
        init_agent_state = graph.propagator.create_initial_state(
            request_data.get('ticker'),
            request_data.get('analysis_date')
        )
        args = graph.propagator.get_graph_args()
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
            'risk_manager': '风险管理评审及投资组合分析'
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
        }
        
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
                    elif msg_type == 'done':
                        break
                    elif msg_type == 'error':
                        raise data
                        
                except queue.Empty:
                    # 超时，继续循环检查中断信号
                    continue
            
            # 等待读取线程结束
            reader_thread.join(timeout=1.0)
        
        try:
            stream_iterator = graph.graph.stream(init_agent_state, **args)
            for chunk in stream_with_interrupt_check(stream_iterator):
                check_stop()
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
                                print(f"  📊 收集到 risk_debate_state")
                                if current_agent in ['risky', 'safe', 'neutral'] and not agent_completed:
                                    agent_completed = True
                                    print(f"  ✅ {current_agent} 节点完成（收集到报告）")
                                    # 立即触发切换到下一个智能体
                                    if current_agent_index < len(agent_execution_order) - 1:
                                        next_agent_index = current_agent_index + 1
                                        next_agent = agent_execution_order[next_agent_index]
                                        detected_agent = next_agent
                                        print(f"  🔄 触发切换: {current_agent} -> {next_agent} (收集到报告)")
                            
                            if "investment_plan" in state_update and state_update["investment_plan"]:
                                report_sections["investment_plan"] = state_update["investment_plan"]
                                print(f"  📊 收集到 investment_plan")
                                if current_agent == 'risk_manager' and not agent_completed:
                                    agent_completed = True
                                    print(f"  ✅ risk_manager 节点完成（收集到报告）")
                                    # 立即触发切换到下一个智能体
                                    if current_agent_index < len(agent_execution_order) - 1:
                                        next_agent_index = current_agent_index + 1
                                        next_agent = agent_execution_order[next_agent_index]
                                        detected_agent = next_agent
                                        print(f"  🔄 触发切换: {current_agent} -> {next_agent} (收集到报告)")
                            
                            if "final_trade_decision" in state_update and state_update["final_trade_decision"]:
                                report_sections["final_trade_decision"] = state_update["final_trade_decision"]
                                print(f"  📊 收集到 final_trade_decision")
                
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
                        db2.commit()
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
        if decision_raw.upper() == 'HOLD':
            decision_raw = '观望'
        elif decision_raw.upper() == 'SELL':
            decision_raw = '卖出'
        elif decision_raw.upper() == 'BUY':
            decision_raw = '买入'
        else:
            decision_raw = '未明确'
        decision = graph.process_signal(decision_raw)
        
        # 获取基本信息（从收集的字段中）
        ticker = report_sections.get("ticker", request_data.get('ticker', 'UNKNOWN'))
        company_of_interest = report_sections.get("company_of_interest") or ticker
        trade_date = report_sections.get("trade_date") or request_data.get('analysis_date', datetime.now().strftime('%Y-%m-%d'))
        analysis_date = request_data.get('analysis_date', datetime.now().strftime('%Y-%m-%d'))
        
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
        }
        
        # 保存状态到文件(按用户、股票代码和分析ID分开，避免覆盖)
        user_ticker_dir = Path(f"eval_results/user_{user_id}/{ticker}/TradingAgentsStrategy_logs/")
        user_ticker_dir.mkdir(parents=True, exist_ok=True)
        
        # 使用 analysis_id 作为文件名的一部分，确保每次分析都有唯一的文件
        log_file = user_ticker_dir / f"full_states_log_{analysis_date}_{analysis_id}.json"
        
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
            }
        }
        
        # 保存为 JSON,支持中文显示
        # with open(log_file, "w", encoding="utf-8") as f:
        #     json.dump(log_data, f, indent=4, ensure_ascii=False)
        
        # print(f"💾 分析结果已保存到: {log_file}")
        # send_log('info', f'💾 结果已保存: {log_file}', 'system', '保存', 92.0, '完成阶段')
        
        send_log('info', '分析流程完成', 'system', '完成', 90.0, '完成阶段')
        check_stop()
        
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
            db2.commit()
        except Exception as e:
            print(f"保存分析结果失败: {e}")
            try:
                db2.rollback()
            except Exception:
                pass
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
                db2.commit()
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
        
        # 发送完成消息
        send_log('info', f'分析完成!交易决 {decision}', 'system', '完成', 100.0, '完成阶段')
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(manager.send_message({
            'type': 'complete',
            'timestamp': datetime.utcnow().isoformat(),
            'data': {
                'status': 'completed',
                'trading_decision': str(decision)
            }
        }, analysis_id))
        loop.close()
        
    except InterruptedError as e:
        # 任务被中断
        print(f"⚠️  任务 {analysis_id} 被中断")
        analysis_record.status = "interrupted"
        analysis_record.current_step = "任务已中断"
        analysis_record.error_message = str(e)
        try:
            db.commit()
        except Exception:
            # 会话可能已关闭/失败，回滚并使用新会话兜底更新
            try:
                db.rollback()
            except Exception:
                pass
            try:
                db2 = SessionLocal()
                db2.query(AnalysisRecord).filter(AnalysisRecord.analysis_id == analysis_id).update({
                    AnalysisRecord.status: "interrupted",
                    AnalysisRecord.current_step: "任务已中断",
                    AnalysisRecord.error_message: str(e)
                })
                db2.commit()
            finally:
                try:
                    db2.close()
                except Exception:
                    pass
        
        # 发送中断消息到前端
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(manager.send_message({
            'type': 'interrupted',
            'timestamp': datetime.utcnow().isoformat(),
            'data': {
                'status': 'interrupted',
                'message': '分析任务已被中断'
            }
        }, analysis_id))
        loop.close()
        
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
        
        # 友好的错误消息
        user_friendly_error = None
        
        # 检测 JSON 解析错误（通常是 API 返回了非 JSON 响应）
        if error_type == 'JSONDecodeError' or 'json' in error_msg.lower() or 'expecting value' in error_msg.lower():
            user_friendly_error = "API 返回了无效的响应格式。可能原因：1) API 服务暂时不可用，2) API 密钥配额不足，3) 网络连接不稳定。请稍后重试或检查 API 配置"
            print(f"💡 JSON 解析错误建议: {user_friendly_error}")
        
        # 检测 token 超限错误
        elif 'context_length_exceeded' in error_msg or 'maximum context length' in error_msg.lower():
            # 提取 token 数量信息
            import re
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
            import re
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
        
        analysis_record.status = "error"
        analysis_record.current_step = f"错误: {user_friendly_error}"
        analysis_record.error_message = user_friendly_error
        analysis_record.error_traceback = error_trace
        try:
            db.commit()
        except Exception:
            # 会话可能已关闭/失败，回滚并使用新会话兜底更新
            try:
                db.rollback()
            except Exception:
                pass
            try:
                db2 = SessionLocal()
                db2.query(AnalysisRecord).filter(AnalysisRecord.analysis_id == analysis_id).update({
                    AnalysisRecord.status: "error",
                    AnalysisRecord.current_step: f"错误: {user_friendly_error}",
                    AnalysisRecord.error_message: user_friendly_error,
                    AnalysisRecord.error_traceback: error_trace
                })
                db2.commit()
            finally:
                try:
                    db2.close()
                except Exception:
                    pass
        
        # 发送错误消息到前端
        print(f"📤 发送错误消息到前端: {user_friendly_error}")
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(manager.send_message({
            'type': 'error',
            'timestamp': datetime.utcnow().isoformat(),
            'data': {
                'status': 'error',
                'error': user_friendly_error
            }
        }, analysis_id))
        loop.close()
        
    finally:
        db.close()
