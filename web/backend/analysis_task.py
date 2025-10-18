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
import io
from datetime import datetime
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


class LogCapture:
    """Capture logs from standard output."""
    def __init__(self, callback):
        self.callback = callback
        self.original_stdout = sys.stdout
        self.original_stderr = sys.stderr
        
    def write(self, text):
        """捕获写入的文本"""
        # 同时输出到原始stdout
        self.original_stdout.write(text)
        self.original_stdout.flush()
        
        # 解析并回调
        if text.strip():
            self.callback(text)
    
    def flush(self):
        """刷新缓冲"""
        self.original_stdout.flush()
    
    def __enter__(self):
        sys.stdout = self
        return self
    
    def __exit__(self, *args):
        sys.stdout = self.original_stdout


def parse_agent_log(log_line: str) -> dict:
    """
    Parse agent log line and extract role information.
    
    Log format example:
    [14:23:15] Icon RoleName[TICKER] | Icon Level: Message
    
    Returns dict with timestamp, role, ticker, level, message
    """
    # 移除ANSI颜色代码
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    clean_line = ansi_escape.sub('', log_line)
    
    # 匹配日志格式: [时间] emoji 角色名[股票] | 级别: 消息
    pattern = r'\[(\d{2}:\d{2}:\d{2})\]\s+[^\s]+\s+([^\[]+)\[([^\]]+)\]\s+\|\s+[^\s]+\s+([^:]+):\s+(.+)'
    match = re.match(pattern, clean_line)
    
    if match:
        timestamp, role_name, ticker, level_text, message = match.groups()
        
        # 角色名称到角色代码的映射
        role_name_to_code = {
            '基本面分析师': 'FUNDAMENTALS_ANALYST',
            '市场分析师': 'MARKET_ANALYST',
            '新闻分析师': 'NEWS_ANALYST',
            '社交媒体分析师': 'SOCIAL_ANALYST',
            '多头研究员': 'BULL_RESEARCHER',
            '空头研究员': 'BEAR_RESEARCHER',
            '交易员': 'TRADER',
            '投资评审': 'INVEST_JUDGE',
            '激进风险分析师': 'RISKY_ANALYST',
            '中性风险分析师': 'NEUTRAL_ANALYST',
            '保守风险分析师': 'SAFE_ANALYST',
            '风险管理评审': 'RISK_MANAGER'
        }
        
        # 级别文本到级别代码的映射
        level_text_to_code = {
            '开始': 'START',
            '完成': 'END',
            '信息': 'INFO',
            '决策': 'DECISION',
            '工具调用': 'TOOL',
            '错误': 'ERROR'
        }
        
        role_code = role_name_to_code.get(role_name.strip(), None)
        level_code = level_text_to_code.get(level_text.strip(), 'INFO')
        
        return {
            'timestamp': timestamp,
            'role': role_code,
            'ticker': ticker.strip(),
            'level': level_code,
            'message': message.strip()
        }
    
    return None


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
    
    # 创建新的数据库会话
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
        
        if request_data.get('openai_api_key') and request_data.get('llm_provider', '').lower() in ("openai", "oneai"):
            os.environ["OPENAI_API_KEY"] = request_data['openai_api_key']
        elif request_data.get('anthropic_api_key') and request_data.get('llm_provider', '').lower() == "anthropic":
            os.environ["ANTHROPIC_API_KEY"] = request_data['anthropic_api_key']
        elif request_data.get('google_api_key') and request_data.get('llm_provider', '').lower() == "google":
            os.environ["GOOGLE_API_KEY"] = request_data['google_api_key']
        elif request_data.get('openrouter_api_key') and request_data.get('llm_provider', '').lower() == "openrouter":
            # os.environ["OPENROUTER_API_KEY"] = request_data['openrouter_api_key']
            os.environ["OPENAI_API_KEY"] = request_data['openrouter_api_key']
        
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
        args = graph.propagator.get_graph_args(stream_mode="values")
        
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
            'market': '市场分析师',
            'social': '社交媒体分析师',
            'news': '新闻分析师',
            'fundamentals': '基本面分析师',
            'researcher': '研究分析师',
            'bull': '多头研究员',
            'bear': '空头研究员',
            'trader': '交易员',
            'invest_judge': '投资评审',
            'risky': '激进风险分析师',
            'neutral': '中性风险分析师',
            'safe': '保守风险分析师',
            'risk_manager': '风险管理评审'
        }
        
        # 日志角色代码到内部角色的映射(用于解析新日志格式)
        log_role_to_agent = {
            'FUNDAMENTALS_ANALYST': 'fundamentals',
            'MARKET_ANALYST': 'market',
            'NEWS_ANALYST': 'news',
            'SOCIAL_ANALYST': 'social',
            'BULL_RESEARCHER': 'bull',
            'BEAR_RESEARCHER': 'bear',
            'TRADER': 'trader',
            'INVEST_JUDGE': 'invest_judge',
            'RISKY_ANALYST': 'risky',
            'NEUTRAL_ANALYST': 'neutral',
            'SAFE_ANALYST': 'safe',
            'RISK_MANAGER': 'risk_manager'
        }
        
        # 流式执行并定期检查中断
        trace = []
        step_num = 0
        last_agent = None
        current_agent = None
        
        # 用于跟踪从日志中检测到的智能体
        log_detected_agent = None
        last_log_agent = None
        
        # 用户选择的分析师映射(用于判断阶段完成)
        selected_analysts_set = set()
        for analyst in analyst_types:
            if analyst == 'market':
                selected_analysts_set.add('market')
            elif analyst == 'social':
                selected_analysts_set.add('social')
            elif analyst == 'news':
                selected_analysts_set.add('news')
            elif analyst == 'fundamentals':
                selected_analysts_set.add('fundamentals')
        
        # 日志捕获回调函数
        def on_log_captured(log_line: str):
            """处理捕获的日志行"""
            nonlocal log_detected_agent, last_log_agent, current_analyst_index, current_agent
            
            parsed = parse_agent_log(log_line)
            if parsed and parsed['role']:
                role_code = parsed['role']
                level = parsed['level']
                message = parsed['message']
                
                # 映射到内部角色代码
                agent = log_role_to_agent.get(role_code)
                
                if agent:
                    log_detected_agent = agent
                    
                    # 检测智能体切换(START级别)
                    if level == 'START' and agent != last_log_agent:
                        # 上一个智能体完成
                        if last_log_agent:
                            agent_display_name = agent_name_map.get(last_log_agent, last_log_agent)
                            progress = min(90.0, base_progress + (current_analyst_index * progress_per_agent))
                            send_log('info', f'{agent_display_name} 完成分析', last_log_agent, '完成', progress, '分析阶段')
                            current_analyst_index += 1
                        
                        # 新智能体开始
                        current_agent = agent
                        agent_display_name = agent_name_map.get(agent, agent)
                        progress = min(90.0, base_progress + (current_analyst_index * progress_per_agent))
                        send_log('info', f'🔍 {agent_display_name} 开始分析...', agent, '开始', progress, '分析阶段')
                        
                        if analysis_record:
                            analysis_record.progress_percentage = progress
                            try:
                                db.commit()
                            except:
                                pass
                        
                        last_log_agent = agent
                    
                    # 记录决策
                    elif level == 'DECISION':
                        agent_display_name = agent_name_map.get(agent, agent)
                        progress = min(90.0, base_progress + (current_analyst_index * progress_per_agent) + (progress_per_agent * 0.8))
                        send_log('info', f'🎯 {agent_display_name} {message}', agent, '决策', progress, '分析阶段')
                    
                    # 记录工具调用
                    elif level == 'TOOL':
                        progress = min(90.0, base_progress + (current_analyst_index * progress_per_agent) + (progress_per_agent * 0.3))
                        send_log('info', f'🔨 {message}', agent, '工具调用', progress, '分析阶段')
                    
                    # 记录信息(包括分析结果内容)
                    elif level == 'INFO':
                        # 输出智能体分析结果内容到控制台(00字符
                        # 注意：这里不能使用 print()，因为会触发递归的日志捕获
                        # if '生成报告完成' in message or '完成' in message:
                        #     agent_display_name = agent_name_map.get(agent, agent)
                        #     sys.__stdout__.write(f"📝 {agent_display_name} 输出内容预览: {message[:200]}\n")
                        #     sys.__stdout__.flush()
                        progress = min(90.0, base_progress + (current_analyst_index * progress_per_agent) + (progress_per_agent * 0.5))
                        send_log('info', message[:200], agent, '信息', progress, '分析阶段')
        
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
                        chunk_queue.put(('chunk', chunk))
                        if stop_event.is_set():
                            print(f"🛑 Stream reader 检测到中断信号")
                            break
                    chunk_queue.put(('done', None))
                except Exception as e:
                    exception_holder[0] = e
                    chunk_queue.put(('error', e))
                finally:
                    finished.set()
            
            # 启动后台读取线程
            reader_thread = threading.Thread(target=stream_reader, daemon=True)
            reader_thread.start()
            
            # 主线程从队列中获取 chunks，同时检查中断
            while not finished.is_set() or not chunk_queue.empty():
                # 检查中断信号
                if stop_event.is_set():
                    print(f"🛑 主线程检测到中断信号，停止迭代")
                    raise InterruptedError("Analysis interrupted during stream")
                
                try:
                    # 尝试从队列获取 chunk，带超时
                    msg_type, data = chunk_queue.get(timeout=check_interval)
                    
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
        
        # 使用日志捕获
        with LogCapture(on_log_captured):
            try:
                stream_iterator = graph.graph.stream(init_agent_state, **args)
                for chunk in stream_with_interrupt_check(stream_iterator):
                    check_stop()
                    step_num += 1
                    
                    # 优先使用日志检测的智能体
                    if log_detected_agent:
                        detected_agent = log_detected_agent
                    else:
                        detected_agent = None
                    
                    # 简化处理:从消息内容和工具调用推断智能体
                    messages = chunk.get("messages", []) if isinstance(chunk, dict) else []
                    if messages:
                        trace.append(chunk)
                        
                        # 如果日志没有检测到,使用工具调用检测(回退方案)
                        if not detected_agent:
                            # 优先:通过工具调用推断智能体
                            for msg in messages:
                                if hasattr(msg, 'tool_calls') and msg.tool_calls:
                                    for tool_call in msg.tool_calls:
                                        tool_name = tool_call.get('name', '') if isinstance(tool_call, dict) else getattr(tool_call, 'name', '')
                                        
                                        # 根据工具名称推断智能体
                                        if tool_name in ['get_stock_data', 'get_indicators', 'get_realtime_data']:
                                            detected_agent = 'market'
                                        elif tool_name in ['get_fundamentals', 'get_balance_sheet', 'get_cashflow', 'get_income_statement', 'get_dividend_data']:
                                            detected_agent = 'fundamentals'
                                        elif tool_name in ['get_news', 'get_global_news']:
                                            detected_agent = 'news'
                                        elif tool_name in ['get_insider_sentiment', 'get_insider_transactions']:
                                            detected_agent = 'social'
                                        
                                        if detected_agent:
                                            print(f"  🔧 Tool call: {tool_name} Agent: {detected_agent}")
                                            break
                                if detected_agent:
                                    break
                            
                            # 回退:从内容推断智能体
                            if not detected_agent:
                                for msg in messages:
                                    if hasattr(msg, 'content') and msg.content:
                                        content = str(msg.content)
                                        content_lower = content.lower()
                                        
                                        if any(kw in content_lower for kw in ['市场', 'market', '股价', 'price']):
                                            detected_agent = 'market'
                                        elif any(kw in content_lower for kw in ['社交', 'social', '情绪', 'sentiment']):
                                            detected_agent = 'social'
                                        elif any(kw in content_lower for kw in ['新闻', 'news']):
                                            detected_agent = 'news'
                                        elif any(kw in content_lower for kw in ['基本面', 'fundamental', '财报']):
                                            detected_agent = 'fundamentals'
                                        elif any(kw in content_lower for kw in ['研究', 'research']):
                                            detected_agent = 'invest_judge'
                                        elif any(kw in content_lower for kw in ['多头', 'bull', '看涨']):
                                            detected_agent = 'bull'
                                        elif any(kw in content_lower for kw in ['空头', 'bear', '看跌']):
                                            detected_agent = 'bear'
                                        elif any(kw in content_lower for kw in ['交易', 'trade', '策略']):
                                            detected_agent = 'trader'
                                        elif any(kw in content_lower for kw in ['风险', 'risk']):
                                            detected_agent = 'risk_manager'
                                        
                                        if detected_agent:
                                            break
                        
                        # 智能体切换检测(避免与日志检测重复)
                        if detected_agent and detected_agent != last_agent and detected_agent != last_log_agent:
                            # 上一个智能体完成
                            if last_agent and last_agent != last_log_agent:
                                agent_display_name = agent_name_map.get(last_agent, last_agent)
                                progress = min(90.0, base_progress + (current_analyst_index * progress_per_agent))
                                send_log('info', f'{agent_display_name} 完成分析', last_agent, '完成', progress, '分析阶段')
                                current_analyst_index += 1
                            
                            # 新智能体开始(如果日志还没有报告)
                            if detected_agent != last_log_agent:
                                current_agent = detected_agent
                                agent_display_name = agent_name_map.get(current_agent, current_agent)
                                progress = min(90.0, base_progress + (current_analyst_index * progress_per_agent))
                                send_log('info', f'🔍 {agent_display_name} 开始分析...', current_agent, '开始', progress, '分析阶段')
                                # 使用独立会话更新进度，避免跨线程共享会话提交冲突
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
                        elif detected_agent:
                            # 同一个智能体继续工作
                            current_agent = detected_agent
                        
                        # 发送日志消息(避免与日志捕获重复)
                        # 只在没有日志检测时才发送内容消息
                        if not log_detected_agent:
                            for msg in messages:
                                if hasattr(msg, 'content') and msg.content:
                                    content = str(msg.content)
                                    if len(content) > 20:
                                        # 输出智能体分析结果内容到控制台(00字符
                                        agent_to_use = current_agent if current_agent else 'system'
                                        # 避免递归日志捕获，直接写入原始 stdout
                                        # agent_display_name = agent_name_map.get(agent_to_use, agent_to_use)
                                        # sys.__stdout__.write(f"📝 {agent_display_name} 输出内容: {content[:200]}...\n")
                                        # sys.__stdout__.flush()
                                        
                                        progress = min(90.0, base_progress + (current_analyst_index * progress_per_agent) + (progress_per_agent * 0.5))
                                        send_log('info', truncate_message(content, 150), agent_to_use, '分析中', progress, '分析阶段')
                                        break
              
            except InterruptedError:
                # 任务被中断，直接向上抛出
                raise
            except Exception as e:
                print(f"⚠️  Error: {e}")
                raise
                
        # 日志捕获结束
        
        check_stop()
        
        # 获取最终状态
        final_state = trace[-1]
        decision = graph.process_signal(final_state.get("final_trade_decision", "UNKNOWN"))
        
        # 获取股票代码(确保不为 None)
        ticker = request_data.get('ticker', 'UNKNOWN')
        analysis_date = request_data.get('analysis_date', datetime.now().strftime('%Y-%m-%d'))
        
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
                "company_of_interest": final_state.get("company_of_interest", ticker),
                "trade_date": final_state.get("trade_date", analysis_date),
                "market_report": final_state.get("market_report", ""),
                "sentiment_report": final_state.get("sentiment_report", ""),
                "news_report": final_state.get("news_report", ""),
                "fundamentals_report": final_state.get("fundamentals_report", ""),
                "investment_debate_state": final_state.get("investment_debate_state", {}),
                "trader_investment_plan": final_state.get("trader_investment_plan", ""),
                "risk_debate_state": final_state.get("risk_debate_state", {}),
                "investment_plan": final_state.get("investment_plan", ""),
                "final_trade_decision": final_state.get("final_trade_decision", decision),
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
        _update_fields = {
            AnalysisRecord.status: "completed",
            AnalysisRecord.current_step: "分析成功完成",
            AnalysisRecord.progress_percentage: 100.0,
            AnalysisRecord.completed_at: datetime.utcnow(),
            AnalysisRecord.final_state: _cleaned_state,
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
                    AnalysisRecord.completed_at: datetime.utcnow(),
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
                'analysis_id': analysis_id,
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
                'analysis_id': analysis_id,
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
        
        # 检测 token 超限错误
        if 'context_length_exceeded' in error_msg or 'maximum context length' in error_msg.lower():
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
                'analysis_id': analysis_id,
                'status': 'error',
                'error': user_friendly_error
            }
        }, analysis_id))
        loop.close()
        
    finally:
        db.close()
