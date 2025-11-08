"""
Intraday Trading Agent
Automatically analyzes positions and executes short-term trading strategies.
"""

import functools
import json
import logging
import re
from datetime import datetime
from typing import Dict, Any, List
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder


def _extract_trades_from_report(report: str, llm=None) -> List[Dict[str, Any]]:
    """
    Extract actual trade information from the decision report using LLM.
    
    Uses LLM to intelligently parse the report and extract trade information,
    which is more flexible and accurate than regex patterns.
    
    Args:
        report: The trading report text (can be in English or Chinese)
        llm: Language model instance (optional, will use simple extraction if not provided)
    
    Returns:
        List of trade dictionaries with stock, action, quantity, price, etc.
        Empty list if no trades found.
    """
    # If no LLM provided, fall back to simple regex extraction
    if llm is None:
        return _extract_trades_simple(report)
    
    try:
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import JsonOutputParser
        
        # Create extraction prompt
        extraction_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a trade information extraction assistant. 
Your task is to extract ONLY the trades that were ACTUALLY EXECUTED from the trading report.

IMPORTANT RULES:
1. Only extract trades where the tool was CALLED and SUCCEEDED
2. Ignore trades that were:
   - Not executed (未调用/not called)
   - Failed (失败/failed)
   - Skipped (跳过/skipped)
   - Just held (持有/hold)
3. Extract the following information for each executed trade:
   - stock: Stock code (e.g., "AAPL", "00700", "600519")
   - action: Trade action - "BUY" (买入/买入开仓), "SELL" (卖出/平多), or "SHORT" (卖空/开仓做空)
   - quantity: Number of shares (integer)
   - price: Trade price (float, if available)
   - description: Brief description of the trade

Return a JSON array of trade objects. If no trades were executed, return an empty array [].

Example output:
[
  {{"stock": "AAPL", "action": "BUY", "quantity": 100, "price": 150.50, "description": "Bought 100 shares at $150.50"}},
  {{"stock": "TSLA", "action": "SELL", "quantity": 50, "price": 200.00, "description": "Sold 50 shares at $200.00"}}
]
"""),
            ("user", "Extract executed trades from this report:\n\n{report}")
        ])
        
        # Create chain with JSON output parser
        chain = extraction_prompt | llm
        
        # Invoke LLM (limit report length to avoid token limits)
        max_report_length = 8000
        truncated_report = report[:max_report_length] if len(report) > max_report_length else report
        
        result = chain.invoke({"report": truncated_report})
        
        # Parse result
        content = result.content if hasattr(result, 'content') else str(result)
        
        # Try to extract JSON from the response
        # Look for JSON array pattern
        json_match = re.search(r'\[.*\]', content, re.DOTALL)
        if json_match:
            trades_json = json_match.group(0)
            trades = json.loads(trades_json)
            
            # Validate and normalize trades
            validated_trades = []
            for trade in trades:
                if isinstance(trade, dict) and 'stock' in trade and 'action' in trade:
                    # Normalize action
                    action = trade.get('action', '').upper()
                    if action in ['BUY', 'SELL', 'SHORT']:
                        validated_trade = {
                            'stock': trade.get('stock', '').upper(),
                            'action': action,
                            'quantity': int(trade.get('quantity', 0)),
                            'price': float(trade.get('price', 0.0)) if trade.get('price') else None,
                            'description': trade.get('description', '')
                        }
                        validated_trades.append(validated_trade)
            
            return validated_trades
        else:
            # No JSON found, fall back to simple extraction
            logging.warning("LLM did not return valid JSON, falling back to simple extraction")
            return _extract_trades_simple(report)
    
    except Exception as e:
        logging.error(f"Error extracting trades with LLM: {e}", exc_info=True)
        # Fall back to simple extraction
        return _extract_trades_simple(report)


def _extract_trades_simple(report: str) -> List[Dict[str, Any]]:
    """
    Simple regex-based trade extraction as fallback.
    
    Args:
        report: The trading report text
    
    Returns:
        List of trade dictionaries
    """
    trades = []
    
    # Pattern 1: Look for tool call results (place_futu_order)
    tool_pattern = r'place_futu_order\([^)]*stock_code=["\']([^"\']+)["\'][^)]*direction=["\']([^"\']+)["\'][^)]*quantity=(\d+)'
    for match in re.finditer(tool_pattern, report, re.IGNORECASE):
        direction = match.group(2).upper()
        action = 'BUY' if direction in ['BUY', '0'] else 'SELL' if direction in ['SELL', '1'] else 'SHORT'
        
        trades.append({
            'stock': match.group(1).upper(),
            'action': action,
            'quantity': int(match.group(3)),
            'price': None,
            'description': f"{action} {match.group(1)} {match.group(3)} shares"
        })
    
    # Pattern 2: Look for Chinese execution results that indicate success
    # Match: 工具返回结果: 成功
    success_pattern = r'###\s*([A-Z0-9]{1,6})\s*[-–—].*?订单类型[:：]\s*(买入|卖出|卖空).*?数量.*?(\d+).*?工具返回结果[:：]\s*成功'
    for match in re.finditer(success_pattern, report, re.DOTALL):
        stock = match.group(1)
        action_cn = match.group(2)
        quantity = int(match.group(3))
        
        action = 'BUY' if action_cn == '买入' else 'SELL' if action_cn == '卖出' else 'SHORT'
        
        trades.append({
            'stock': stock.upper(),
            'action': action,
            'quantity': quantity,
            'price': None,
            'description': f"{action} {stock} {quantity} shares"
        })
    
    # Remove duplicates
    seen = set()
    unique_trades = []
    for trade in trades:
        key = f"{trade['stock']}_{trade['action']}_{trade['quantity']}"
        if key not in seen:
            seen.add(key)
            unique_trades.append(trade)
    
    return unique_trades


def create_intraday_trader(llm, memory):
    """
    Create an intraday trading agent that automatically analyzes positions
    and executes short-term trading strategies using LangGraph.
    
    This agent will autonomously:
    1. Call tools to gather market data
    2. Analyze positions and opportunities
    3. Make trading decisions
    4. Execute trades
    5. Generate comprehensive reports
    
    Args:
        llm: Language model instance
        memory: Memory instance for storing trading history
        
    Returns:
        Compiled LangGraph agent that can be invoked with initial state
    """
    from langgraph.graph import StateGraph, END
    from langgraph.prebuilt import ToolNode
    from typing import TypedDict, Annotated, Sequence
    from langchain_core.messages import BaseMessage
    import operator
    
    # Define state schema
    class AgentState(TypedDict):
        messages: Annotated[Sequence[BaseMessage], operator.add]
        user_id: int
        market_type: str
        session_id: str
        decision_report: str
        trades_executed: list
    
    def agent_node(state):
        """
        Main agent node that decides what to do next.
        
        State inputs:
            - user_id: User identifier
            - market_type: Market classification (US/HK/CN)
            - session_id: Unique session identifier
            - messages: Message history
            
        State outputs:
            - decision_report: Detailed decision report
            - trades_executed: List of executed trades
            - messages: Updated message history
        """
        
        # Extract state information
        user_id = state.get("user_id")
        market_type = state.get("market_type", "US")
        session_id = state.get("session_id", f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        # System prompt with comprehensive trading logic
        system_message = """You are an aggressive intraday trading agent operating like a professional day trader with full autonomy to analyze positions and execute trades.

## Your Mission
Maximize short-term profits through active position management, quick entries/exits, and opportunistic trading based on technical momentum, news catalysts, and market dynamics.

## Trading Philosophy
- **Act decisively**: When signals align, execute with conviction
- **Cut losses fast**: Don't let small losses become big ones
- **Let winners run**: Trail stops on profitable positions
- **Stay liquid**: Keep cash ready for opportunities
- **Trade the trend**: Momentum is your friend in short-term trading

## Market Rules
- **US Market**: Supports both long and short positions
- **HK Market**: Only supports long positions, short selling NOT supported
- **CN Market**: Only supports long positions, short selling NOT supported

⚠️ **IMPORTANT**: Current market is {market_type}. Please formulate trading strategy according to market rules.

## Trading Constraints

⚠️ **CRITICAL TRADING LIMITS**:
1. **Maximum 3 stocks per session**: Can only trade up to 3 different stocks in one analysis session
2. **Analyze first, trade later**: Must complete ALL stock analysis before executing ANY trades
   - Phase 1-2: Collect information and analyze ALL stocks
   - Phase 3: Execute trades for selected stocks (max 3)
   - Phase 4: Verify results

## Standard Execution Workflow

### Phase 1: Information Collection
**Required tool calls** (in order):
1. `get_futu_account_info(market_type="{market_type}")` - Check account funds and total assets
2. `get_futu_positions(market_type="{market_type}")` - Get all current positions
3. `get_futu_orders(market_type="{market_type}", filter_status=0)` - Check pending orders (⚠️ CRITICAL: avoid duplicate orders)

**For each position and candidate stock**:
4. `get_futu_quote(stock_code)` - Get real-time quote
5. `get_futu_kline(stock_code, period="5min", count=50)` - Get K-line data for short-term trend analysis
6. `get_futu_technical_analysis(stock_code, indicators=["MACD", "RSI", "BOLL"])` - Get technical indicators

**Market scanning** (optional but recommended):
7. `get_akshare_news(limit=20)` - Get latest financial news
8. `get_akshare_hot_stocks(symbol="A股", time_range="今日", limit=10)` - Get Baidu hot search stocks (for CN market)
9. `get_futu_hot_stocks(market_type="{market_type}")` - Discover market hot stocks and trading opportunities

### Phase 2: Analysis & Decision (Complete for ALL stocks before Phase 3)
Based on collected information, conduct comprehensive analysis:

**Position Evaluation**:
- Current position status vs ideal position allocation
- P&L situation and holding time
- Technical indicator signals (bullish/bearish/neutral)
- Related news sentiment (positive/negative/neutral)
- Whether position size is reasonable

**Direction Judgment**:
- Whether direction switch is needed (long to short / short to long)
- ⚠️ **Short Selling Restriction Check**:
  * If current market is **US**: Can consider short selling
  * If current market is **HK** or **CN**: Short selling NOT supported, can only close long or hold
- If short selling is involved (US only), conduct in-depth analysis:
  * Technical support (trend, momentum, indicators)
  * Fundamental support (valuation, financials, industry)
  * News support (bearish news, negative events)
  * Risk controllability (volatility, liquidity, stop-loss space)

**Fund Check**:
- Whether available funds are sufficient
- Whether pending orders exist (⚠️ If pending orders exist for same stock, DO NOT place duplicate orders)
- Whether other positions need adjustment (take profit/stop loss)

**Decision Making**:
Based on your professional judgment, decide specific operation steps:
- For existing positions: Add/Reduce/Close/Hold
- For new opportunities: Open/Skip
- For bearish stocks:
  * US market: Can consider short selling (requires in-depth analysis)
  * HK/CN markets: Can only close long or watch, cannot short
- ⚠️ **Select top 3 stocks maximum**: If more than 3 stocks need trading, prioritize by:
  * Urgency (stop-loss, take-profit)
  * Conviction level (strongest signals)
  * Risk-reward ratio
- Complete analysis for ALL selected stocks before moving to Phase 3

### Phase 3: Execute Trades (ONLY after completing Phase 2 for ALL stocks)
⚠️ **IMPORTANT**: Do NOT execute trades during Phase 1-2. Only execute after ALL analysis is complete.
⚠️ **LIMIT**: Execute trades for maximum 3 stocks only
**Pre-execution checks**:
- Confirm no duplicate orders (check Phase 1 pending orders results)
- Confirm sufficient funds
- Calculate appropriate position size
- ⚠️ **Reconfirm market rules**: HK/CN do not support short selling

**Execute according to trading rules**:
- **Direction switch**: Must close positions first, then open opposite direction positions
  * Long to short (US only): Close all long positions first → Then open short positions
  * Short to long: Close all short positions first → Then buy
- **Incremental adjustment**: Directly add or reduce positions
- **Short selling (US only)**: Ensure in-depth analysis and evaluation are completed

**Order placement**:
- Call `place_futu_order(stock_code, direction, quantity, price, order_type)`
- ⚠️ Check return result:
  * Success: Order submitted/filled
  * Failure: Record error reason (insufficient funds/stock halted/price limit exceeded/market does not support short selling, etc.)
- If other positions need adjustment, execute sequentially

### Phase 4: Result Verification (only if trade succeeded)
If `place_futu_order` returned success:
1. `get_futu_account_info(market_type="{market_type}")` - Get post-trade account info
2. `get_futu_positions(market_type="{market_type}")` - Get post-trade positions
3. `get_futu_orders(market_type="{market_type}", filter_status=0)` - Get latest order status

If `place_futu_order` returned failure or not called:
- Skip verification, proceed directly to report phase

### Phase 5: Generate Report
Generate complete Chinese execution report (no more tool calls)

## Risk Parameters (Guidelines, Not Handcuffs)

**Position Sizing**:
- Single stock: Up to 40% on high-conviction plays, typically 15-25%
- Total exposure: Can go up to 95% when opportunities are strong
- Cash reserve: Minimum 5%, prefer 10-20% for flexibility

**Risk Management**:
- Hard stop: -8% on any position (cut immediately)
- Soft stop: -5% (evaluate if worth holding)
- Portfolio drawdown: If down -5% from peak, reduce exposure
- Winning positions: Trail stops to lock in gains

**Trading Constraints**:
- ⚠️ **Maximum 3 stocks per session**: Can only trade up to 3 different stocks
- ⚠️ **Analyze first, trade later**: Complete ALL analysis before executing ANY trades
- ⚠️ No duplicate orders: Must check pending orders before placing orders
- Direction switch must close positions first
- Avoid trading in first 5 minutes
- Trade cautiously in last 30 minutes
- Short selling requires thorough analysis (US only)
- ⚠️ HK/CN markets prohibit short selling operations

## Decision-Making Authority
You have full discretion to:
- Determine position sizes based on conviction and analysis
- Choose entry/exit timing based on technicals
- Decide which opportunities to pursue and which to skip
- Set stop-loss levels (within risk parameters)
- Override guidelines when you have strong rationale

**What you MUST do**:
- Follow the 5-phase standard workflow
- ⚠️ **Trade maximum 3 stocks per session**
- ⚠️ **Complete ALL analysis before executing ANY trades**
- Check pending orders before placing orders
- Direction switch must close positions first
- Stay within maximum position limits (40% single, 95% total)
- Execute hard stop at -8% loss
- Explain your reasoning clearly
- ⚠️ **Strictly follow market rules**: HK/CN must not short sell

## Output Format (MUST OUTPUT IN CHINESE)

```markdown
# 日内交易报告
**会话**: {session_id} | **时间**: {timestamp} | **市场**: {market_type}
**市场规则**: {market_type} 市场 - [支持做多和做空 / 仅支持做多，不支持做空]

## I. 账户状态
- 总资产: $XXX,XXX | 可用资金: $XX,XXX | 已部署: XX%
- 待处理订单: X个（如有则列出股票和方向）

## II. 持仓分析

### [股票代码] - [公司名称]
**当前状态**:
- 持仓: XXX股 @ $XX.XX成本 | 现价: $XX.XX
- 盈亏: ±X.XX% ($XXX) | 持仓规模: 占总资产XX%
- 持仓时间: X天/小时

**技术分析**:
- 5分钟趋势: [上涨/下跌/横盘]
- MACD: [看涨/看跌/中性] - [具体数值和形态]
- RSI: XX - [超买/超卖/正常]
- 布林带: [突破上轨/跌破下轨/在轨道内]
- 动能评估: [强/中/弱]

**新闻情绪**: [正面/负面/中性]
- [关键新闻要点（如有）]

**决策**: [加仓/减仓/平仓/持有]
**推理**: [基于技术面、新闻面、持仓管理的详细解释]

**执行操作**:
- 是否调用交易工具: 是/否
- 订单类型: 买入/卖出/卖空（仅美股）/平多/平空/无
- 数量和价格: [如执行则填写]
- 工具返回结果: 成功/失败/未调用 - [详情]
- 最终状态: [交易后持仓情况]

[对每个持仓重复]

## III. 新机会评估

### [股票代码] - [公司名称]
**发现来源**: [Futu热门股票/新闻提及/技术突破]

**技术评估**:
- 当前价格: $XX.XX | 成交量: [放量/缩量/正常]
- 技术形态: [突破/回调/整理]
- 指标信号: [具体评估]
- 入场时机: [立即/等待回调/跳过]

**决策**: [开仓做多/开仓做空（仅美股）/跳过]
**推理**: [为何开仓或跳过的详细理由]

**执行操作**: [如开仓则填写交易详情]

[对每个候选重复]

## IV. 交易摘要
- 执行交易: X笔
- 买入: X笔，总计$XXX
- 卖出: X笔，总计$XXX
- 做空: X笔，总计$XXX（仅美股）
- 待处理订单: X个
- 净敞口变化: [增加/减少/不变] XX%

## V. 工具调用记录
1. get_futu_account_info() → [结果摘要]
2. get_futu_positions() → [X个持仓]
3. get_futu_orders() → [X个待处理订单]
4. get_futu_hot_stocks() → [X只热门股票]
5. [列出所有工具调用及简要结果]

## VI. 下一步行动
- 监控重点: [具体股票和条件]
- 关注事件: [即将到来的催化剂]
- 调整计划: [下一周期的策略调整]
```

## Trading Mindset
- **Be aggressive but not reckless**: Take calculated risks
- **Speed matters**: In day trading, hesitation costs money
- **Adapt quickly**: Market conditions change, so should your strategy
- **Trust your analysis**: If signals align, execute with confidence
- **Protect capital**: One bad trade shouldn't blow up the account
- **Follow market rules**: No short selling in HK/CN, can short in US but be cautious

Now execute your trading strategy. Strictly follow the 5-phase workflow, starting with information collection.
Current market: {market_type} - Please formulate trading strategy according to market rules.
"""
        
        # Format system message with all required variables
        system_message = system_message.format(
            session_id=session_id,
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            market_type=market_type
        )
        
        # Create prompt template
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_message),
            MessagesPlaceholder(variable_name="messages"),
        ])
        
        # Import all required tools
        from tradingagents.agents.utils.futu_trading_tools import (
            get_futu_account_info,
            get_futu_positions,
            get_futu_quote,
            get_futu_kline,
            get_futu_technical_analysis,
            get_futu_hot_stocks,
            get_futu_orders,
            place_futu_order,
        )
        from tradingagents.agents.utils.akshare_news_tools import (
            get_akshare_news,
            get_akshare_hot_stocks,
        )
        
        # Define all available tools
        tools = [
            get_futu_account_info,
            get_futu_positions,
            get_futu_orders,
            get_futu_quote,
            get_futu_kline,
            get_futu_technical_analysis,
            get_futu_hot_stocks,
            get_akshare_news,
            get_akshare_hot_stocks,
            place_futu_order,
        ]
        
        # Bind tools to LLM
        llm_with_tools = llm.bind_tools(tools)
        
        # Create chain
        chain = prompt | llm_with_tools
        
        # Send agent start event
        try:
            from web.backend.app import manager as ws_manager
            import asyncio
            asyncio.create_task(ws_manager.send_message({
                'type': 'agent_start',
                'timestamp': datetime.utcnow().isoformat(),
                'message': 'Intraday agent started',
                'agent': 'Intraday Trader'
            }, f"intraday_user_{user_id}"))
        except Exception:
            pass
        
        # Invoke agent
        try:
            result = chain.invoke({
                "messages": state.get("messages", []),
            })
            
            # If result has tool calls, return for tool execution
            if hasattr(result, 'tool_calls') and result.tool_calls:
                # Log tool calls
                logging.info(f"Agent requesting {len(result.tool_calls)} tool call(s)")
                for i, tool_call in enumerate(result.tool_calls, 1):
                    tool_name = tool_call.get('name', 'unknown')
                    tool_args = tool_call.get('args', {})
                    logging.info(f"Tool call {i}: {tool_name}")
                
                # Send tool call notifications
                for tool_call in result.tool_calls:
                    try:
                        from web.backend.app import manager as ws_manager
                        import asyncio
                        asyncio.create_task(ws_manager.send_message({
                            'type': 'tool_call',
                            'timestamp': datetime.utcnow().isoformat(),
                            'tool': tool_call.get('name', 'unknown'),
                            'args': tool_call.get('args', {})
                        }, f"intraday_user_{user_id}"))
                    except Exception:
                        pass
                
                return {
                    "messages": [result],
                }
            else:
                # Agent has finished - extract final report from LLM's content
                decision_report = result.content if hasattr(result, 'content') else str(result)
                
                # Log the final report
                logging.info(f"Agent generated final report (length: {len(decision_report)} chars)")
                
                # Extract actual trades from the report using LLM
                trades_executed = _extract_trades_from_report(decision_report, llm)
                
                # Send agent result event
                try:
                    from web.backend.app import manager as ws_manager
                    import asyncio
                    asyncio.create_task(ws_manager.send_message({
                        'type': 'agent_result',
                        'timestamp': datetime.utcnow().isoformat(),
                        'message': 'Agent completed analysis',
                        'agent': 'Intraday Trader',
                        'report_length': len(decision_report)
                    }, f"intraday_user_{user_id}"))
                except Exception:
                    pass
                
                return {
                    "messages": [result],
                    "decision_report": decision_report,
                    "trades_executed": trades_executed,
                }
        
        except Exception as e:
            error_msg = f"Error in intraday trader: {str(e)}"
            logging.error(error_msg, exc_info=True)
            
            from langchain_core.messages import AIMessage
            return {
                "messages": [AIMessage(content=error_msg)],
                "decision_report": f"## Error\n\n{error_msg}",
                "trades_executed": [],
            }
    
    # Create tool node for executing tools
    from tradingagents.agents.utils.futu_trading_tools import (
        get_futu_account_info,
        get_futu_positions,
        get_futu_quote,
        get_futu_kline,
        get_futu_technical_analysis,
        get_futu_hot_stocks,
        get_futu_orders,
        place_futu_order,
    )
    from tradingagents.agents.utils.akshare_news_tools import (
        get_akshare_news,
        get_akshare_hot_stocks,
    )
    
    tools = [
        get_futu_account_info,
        get_futu_positions,
        get_futu_orders,
        get_futu_quote,
        get_futu_kline,
        get_futu_technical_analysis,
        get_futu_hot_stocks,
        get_akshare_news,
        get_akshare_hot_stocks,
        place_futu_order,
    ]
    
    # Create base tool node
    base_tool_node = ToolNode(tools)
    
    # Wrap tool node to add logging
    def tool_node_with_logging(state):
        """Tool node wrapper that adds logging"""
        messages = state.get("messages", [])
        last_message = messages[-1] if messages else None
        
        if last_message and hasattr(last_message, 'tool_calls'):
            logging.info(f"Executing {len(last_message.tool_calls)} tool(s)")
        
        # Execute tools - ToolNode needs to be invoked, not called directly
        result = base_tool_node.invoke(state)
        
        # Log results
        if 'messages' in result:
            new_messages = result['messages']
            for msg in new_messages:
                if hasattr(msg, 'name'):  # Tool message
                    tool_name = msg.name
                    content = str(msg.content)
                    # Truncate long content for logging
                    if len(content) > 50:
                        content_preview = content[:50] + "..."
                    else:
                        content_preview = content
                    
                    logging.info(f"Tool {tool_name} completed: {content_preview}")
        
        return result
    
    tool_node = tool_node_with_logging
    
    # Define routing logic
    iteration_count = {'count': 0}  # Mutable counter
    
    def should_continue(state):
        """Determine if we should continue to tools or end."""
        messages = state.get("messages", [])
        last_message = messages[-1] if messages else None
        
        # If the last message has tool calls, route to tools
        if last_message and hasattr(last_message, 'tool_calls') and last_message.tool_calls:
            iteration_count['count'] += 1
            logging.info(f"Agent iteration #{iteration_count['count']}")
            return "tools"
        # Otherwise, we're done
        logging.info(f"Agent completed after {iteration_count['count']} iteration(s)")
        return END
    
    # Build the graph
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", tool_node)
    
    # Set entry point
    workflow.set_entry_point("agent")
    
    # Add conditional edges
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            END: END
        }
    )
    
    # After tools, always go back to agent
    workflow.add_edge("tools", "agent")
    
    # Compile the graph
    app = workflow.compile()
    
    return app
