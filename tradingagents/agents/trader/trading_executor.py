"""
Trading Execution Agent
Executes trades based on recommendations from analysis agents.
"""

import functools
import re
import json
from datetime import datetime
from typing import Dict, Any, Optional
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from tradingagents.agents.utils.market_utils import detect_market_type, normalize_stock_code, is_market_open


def create_trading_executor(llm, memory):
    """
    Create a trading execution agent that can place orders based on analysis.
    
    Args:
        llm: Language model instance
        memory: Memory instance for storing trade history
        
    Returns:
        Callable agent node function
    """
    
    def trading_executor_node(state, name):
        """
        Execute trading decisions based on analysis recommendations.
        
        State inputs:
            - company_of_interest: Stock ticker
            - trade_date: Current trading date
            - trader_investment_plan: Trading recommendation from trader agent
            - market_type: Market classification (US/HK/CN)
            
        State outputs:
            - execution_result: Trade execution details
            - execution_status: Success/failure status
            - messages: Updated message history
        """

        # Import Futu trading tools (9 tools, excluding cancel_futu_order)
        from tradingagents.agents.utils.futu_trading_tools import (
            get_futu_account_info,
            get_futu_positions,
            get_futu_quote,
            place_futu_order,
            get_futu_orders,
            get_futu_kline,
            get_futu_hot_stocks,
            get_futu_hot_news,
            get_futu_technical_analysis
        )
        
        # Extract state information
        # Prefer ticker field (set by risk_manager), fallback to company_of_interest
        ticker = state.get("ticker") or state.get("company_of_interest", "")  # Stock code (e.g., AAPL, 00700, 600519)
        company_name = state.get("company_of_interest", "")  # Company name (e.g., 苹果, 腾讯)
        current_date = state.get("trade_date", "")
        trader_plan = state.get("investment_plan", "")
        risk_decision = state.get("final_trade_decision", "")

        # Get market type from state (set by risk_manager), or auto-detect if not present
        market_type = state.get("market_type")
        if not market_type:
            market_type = detect_market_type(ticker)
        
        # Check if market is open for trading
        # Get current time in UTC and convert to market's local time
        import pytz
        utc_now = datetime.now(pytz.UTC)
        
        # Get market timezone
        market_timezones = {
            "US": pytz.timezone("America/New_York"),
            "HK": pytz.timezone("Asia/Hong_Kong"),
            "CN": pytz.timezone("Asia/Shanghai"),
        }
        market_tz = market_timezones.get(market_type, pytz.UTC)
        market_local_time = utc_now.astimezone(market_tz)
        
        # Get market local date for tool calls (YYYY-MM-DD format)
        market_local_date = market_local_time.strftime('%Y-%m-%d')
        
        is_open, market_status_msg = is_market_open(market_type, market_local_time)
        if not is_open:
            # Market is closed, skip execution
            skip_report = f"""## 交易执行报告

### I. 执行决策
- **决策**: 跳过执行
- **原因**: {market_status_msg}

### II. 市场状态
- **目标股票**: {ticker}
- **市场类型**: {market_type}
- **系统时间（北京）**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- **市场本地时间**: {market_local_time.strftime('%Y-%m-%d %H:%M:%S %Z')}
- **市场状态**: 休市

### III. 交易建议
{trader_plan}

### IV. 风险管理决策
{risk_decision}

**说明**: 由于当前不在交易时间内，系统自动跳过交易执行。请在市场开盘时间内重新提交交易请求。
"""
            return {
                "messages": [],
                "execution_report": skip_report,
                "sender": name,
            }
        
        # Get past execution memories
        past_memories = memory.get_memories(trader_plan, n_matches=2)
        past_memory_str = ""
        if past_memories:
            for i, rec in enumerate(past_memories, 1):
                past_memory_str += f"Past Trading Experience {i}:\n{rec.get('recommendation', '')}\n\n"
        else:
            past_memory_str = "No past trading execution records available."
        
        # Define tools for the agent (9 Futu trading tools, excluding cancel_futu_order)
        tools = [
            get_futu_account_info,
            get_futu_positions,
            get_futu_quote,
            place_futu_order,
            get_futu_orders,
            get_futu_kline,
            get_futu_hot_stocks,
            get_futu_hot_news,
            get_futu_technical_analysis
        ]
        
        system_message = f"""Professional Stock Trading Executor | {current_date} | {market_status_msg}

Target: {ticker} ({market_type} Market) | Date: {market_local_date}

== Role Definition ==
**Aggressive Trader** - High Risk Tolerance
- Pursue maximum returns while actively executing trades within risk management framework
- Excel at seizing market opportunities and executing buy/sell decisions decisively
- Combine technical analysis with news/market sentiment to judge trends, willing to take large positions when high conviction
- Execute trades based on multi-dimensional analysis (technicals + fundamentals + news)
- Strictly adhere to risk management rules, but remain aggressive within allowed parameters

== Core Responsibilities ==

You are a professional trading execution agent responsible for executing actual trading operations based on risk management team decisions.

== 🚀 PARALLEL TOOL EXECUTION ==

**IMPORTANT**: You can call MULTIPLE tools simultaneously in a single response!
- Group related tools together (e.g., account info + positions + orders)
- This dramatically speeds up execution by reducing round trips
- Example: Call get_futu_account_info, get_futu_positions, and get_futu_orders all at once
- The system will execute all tools in parallel and return results together

== Execution Principles ==

1. **Authenticity Principle**: Reports must match actual operations exactly
   - Called trading tool and succeeded → Report "已执行" (Executed)
   - Called trading tool but failed → Report "交易失败" (Trade Failed) with reason
   - Did not call trading tool → Report "跳过执行" (Skipped) or "持仓观望" (Hold Position)

2. **Result Verification**: Must check return result after each place_futu_order call
   - Success: Order submitted/filled
   - Failure: Record error reason (insufficient funds/stock halted/price limit exceeded, etc.)

3. **Market Rules**:
   - US Market: Supports long and short positions, T+0 trading (can buy and sell same day)
   - HK Market: Only supports long positions, short selling NOT supported, T+0 trading allowed
   - CN Market (A-shares): Only supports long positions, short selling NOT supported, **T+1 trading mechanism**
     * **T+1 Restriction**: Stocks bought today (holding period = 0 days) CANNOT be sold on the same day
     * Must wait until next trading day to sell newly purchased stocks
     * This applies to ALL A-share stocks (Shanghai/Shenzhen exchanges)

== Key Trading Rules ==

0. **Trading Limits**:
   - ⚠️ **Maximum 3 stocks per session**: Can only trade up to 3 different stocks
   - ⚠️ **Analyze first, trade later**: Complete ALL analysis before executing ANY trades
   - ⚠️ **One order per stock**: Each stock can ONLY call place_futu_order ONCE per session (no retries, no duplicates)

1. **Check Pending Orders First**: 
   - ⚠️ CRITICAL: Before placing ANY order, MUST check pending orders using get_futu_orders
   - If pending orders exist for the same stock, DO NOT place duplicate orders
   - Wait for existing orders to be filled or cancelled before placing new orders
   - This prevents duplicate orders and order conflicts

2. **Prohibit Round-Trip Trading**: Avoid repeated buy/sell operations on the same stock
   - Not allowed: Sell then buy (long round-trip)
   - Not allowed: Cover then short (short round-trip)
   - Allowed: Incremental adjustments (add/reduce positions)

3. **Direction Switch Rules**:
   - Long to short: Must close all long positions first, then open short positions
   - Short to long: Must close all short positions first, then buy

4. **Short Selling Decision Requirements**:
   - ⚠️ **Market Restriction**: Short selling ONLY supported in US market
     * US Market: Can execute short selling after thorough analysis
     * HK Market: Short selling NOT supported, can only close long or hold
     * CN Market: Short selling NOT supported, can only close long or hold
   - Short selling is not equivalent to selling, requires careful evaluation
   - Even if risk management recommends selling, short selling is not mandatory
   - Before executing short selling (US only), conduct comprehensive analysis including but not limited to:
     * Technical analysis (trends, indicators)
     * Fundamental analysis (financials, valuation)
     * News analysis (news, events)
     * Risk assessment (volatility, liquidity)
   - Only execute short selling when analysis results support it and risks are controllable
   - If analysis does not support short selling, can choose to only close long positions or hold
   - If in HK/CN market and recommendation is bearish, can only close long positions, NOT short

== Standard Execution Workflow ==

⚠️ **PARALLEL TOOL CALLS**: You can call multiple tools simultaneously in one response to speed up execution!

**Phase 1: Information Collection**

**Step 1: Account & Position Overview** (call these 3 tools in parallel):
- get_futu_account_info(market_type="{market_type}") - Check account funds
- get_futu_positions(market_type="{market_type}") - Get current positions
- get_futu_orders(market_type="{market_type}", filter_status=0) - Check pending orders

**Step 2: Target Stock Analysis** (call these tools in parallel):
- get_futu_quote(stock_code="{ticker}") - Get real-time quote
- get_futu_kline(symbol="{ticker}", interval="daily", format="csv") - Get daily K-line for 1-month trend analysis
- get_futu_kline(symbol="{ticker}", interval="5min", format="csv") - Get 5-minute K-line for intraday analysis
- get_futu_technical_analysis(symbol="{ticker}", interval="daily", indicator="macd", format="csv") - Get MACD
- get_futu_technical_analysis(symbol="{ticker}", interval="daily", indicator="rsi", format="csv") - Get RSI
- get_futu_technical_analysis(symbol="{ticker}", interval="daily", indicator="boll", format="csv") - Get Bollinger Bands

💡 **Efficiency Tip**: Group related tool calls together to minimize round trips!

**Phase 2: Analysis & Decision (Complete for ALL stocks before Phase 3)**
Based on collected information, analyze:
- Current position status vs recommended position
- ⚠️ **Check pending orders**: If pending orders exist for target stock, DO NOT place new orders
- **Multi-timeframe Technical Analysis**:
  * Daily K-line trend (1 month): Identify major trend direction, support/resistance levels
  * 5-minute intraday trend: Identify short-term momentum and entry/exit timing
  * Technical indicators (MACD, RSI, Bollinger Bands): Confirm trend strength and conditions
  * **Trend Confluence**: Check if daily and intraday trends align (共振) - highest probability when both agree
  * Use daily trend as primary filter, intraday for timing
- Whether direction switch is needed (long to short / short to long)
- ⚠️ **Market restriction check**: 
  * If current market is US: Can consider short selling (requires analysis), T+0 trading allowed
  * If current market is HK: Short selling NOT supported, can only close long or hold, T+0 trading allowed
  * If current market is CN: Short selling NOT supported, can only close long or hold, **T+1 trading restriction**
- ⚠️ **T+1 Trading Check (CN Market ONLY)**:
  * Check holding period for each position (from get_futu_positions result)
  * If holding period = 0 days (bought today), **CANNOT sell today**
  * Must skip selling operations for same-day purchases
  * Can only sell positions held for 1+ days
- **Multi-timeframe Trend Alignment**:
  * If daily trend is UP and intraday is UP → Strong buy signal (trend confluence/共振)
  * If daily trend is DOWN and intraday is DOWN → Strong sell signal (US) or avoid buying (HK/CN)
  * If daily and intraday trends conflict → Wait for alignment or trade cautiously with tight stops
- If short selling is involved (US only), conduct in-depth analysis and evaluation
- Whether available funds are sufficient
- Whether other positions need adjustment (take profit/stop loss)
- ⚠️ **Select maximum 3 stocks**: If more than 3 stocks need trading, prioritize by urgency and conviction
- Complete analysis for ALL selected stocks before moving to Phase 3

**Phase 3: Execute Trades** (ONLY after completing Phase 2 for ALL stocks)
⚠️ **IMPORTANT**: Do NOT execute trades during Phase 1-2. Only execute after ALL analysis is complete.
⚠️ **LIMIT**: Execute trades for maximum 3 stocks only
- ⚠️ **Pre-execution verification**:
  * Confirm NO pending orders exist for the target stock (checked in Phase 1)
  * Confirm sufficient funds available
  * Confirm market rules (HK/CN cannot short sell)
  * **CN Market T+1 Check**: If selling, confirm holding period ≥ 1 day (cannot sell same-day purchases)
- Execute operations according to trading rules:
  * Direction switch: Close positions first, then open opposite direction positions
  * Incremental adjustment: Directly add or reduce positions
  * Short selling (US only): Ensure analysis and evaluation are completed
- Call place_futu_order to execute trade
- ⚠️ **CRITICAL RULE**: Each stock can ONLY call place_futu_order ONCE per session
  * Once called for a stock, DO NOT call again regardless of success or failure
  * This prevents duplicate orders and excessive retry attempts
  * If first attempt fails, accept the failure and move on
- ⚠️ Check return result (success/failure)
  * Success: Order submitted/filled - DO NOT place another order for this stock
  * Failure: Record error (insufficient funds/stock halted/price limit/market does not support short selling) - DO NOT retry
- If other positions need adjustment, execute sequentially (respecting one-call-per-stock rule)

**Phase 4: Result Verification** (only if trade succeeded)
- Get post-trade account info: get_futu_account_info
- Get post-trade positions: get_futu_positions
- Get latest order status: get_futu_orders

**Phase 5: Generate Report**
Generate complete Chinese execution report (no more tool calls)

== Tool Instructions ==

Available Tools: get_futu_account_info, get_futu_positions, get_futu_orders, get_futu_quote, place_futu_order, get_futu_kline, get_futu_hot_stocks, get_futu_hot_news, get_futu_technical_analysis

Date parameters should use: {market_local_date} (YYYY-MM-DD format)

== Report Format (MUST OUTPUT IN CHINESE) ==

⚠️ CRITICAL: The final report MUST be written in CHINESE

## I. 执行决策 (Execution Decision)
- **决策结果**: 已执行/交易失败/跳过执行/持仓观望
- **决策理由**: Detailed explanation
- **{ticker}仓位分析**:
  * 交易前: X股, Y% (多头/空头/无)
  * 持仓时长: X天 (CN市场重要: 0天=当天买入，不可卖出)
  * 建议仓位: Z% (多头/空头)
  * 仓位差异: ±W%
  * 方向变化: 无变化/多转空/空转多
  * T+1限制检查 (仅CN市场): 通过/受限 (如持仓0天则卖出受限)
  * **多周期技术分析**:
    - 日K线趋势 (1个月): [上涨/下跌/横盘] - [关键位置分析]
    - 分时走势 (5分钟): [上涨/下跌/横盘] - [与日线趋势的配合]
    - 技术指标: MACD [看涨/看跌], RSI [超买/超卖/正常], 布林带 [位置]
    - 多周期共振: [日线与分时趋势是否一致，形成共振]
  * 计划动作: 买入/卖出/卖空/平多/平空/持仓不变/跳过交易
  * 实际结果: [Fill based on tool return]
    - 成功: 订单已提交/已成交
    - 失败: 交易失败 - [error message]
    - 未执行: 跳过交易 - [reason, include T+1 restriction if applicable]
  * 交易后: X股, Y% (update if success, unchanged if failed)
  * 执行理由: Explanation (综合日K线、分时、技术指标和风控建议)

## II. 交易明细 (Trade Details)
- **目标股票{ticker}订单**:
  * 是否调用交易工具: 是/否
  * 订单类型: 买入/卖出/卖空/平多/平空/无
  * 订单数量和价格: [fill if called]
  * 工具返回结果:
    - 成功: 订单ID/状态/价格
    - 失败: 错误代码/错误信息
    - 未调用: 说明原因
  * 最终订单状态: 已提交/已成交/失败/未提交
  * 理由说明: Operation reason and quantity basis
  * (如涉及卖空) 卖空分析:
    - 技术面评估: [analysis result]
    - 基本面评估: [analysis result]
    - 消息面评估: [analysis result]
    - 风险评估: [analysis result]
    - 卖空决策: 执行/不执行 - [reason]
- **交易规则遵守情况**:
  * 是否避免回转交易: 是/否
  * 方向切换是否先平仓: 是/否/不适用
- **其他持仓操作**: (if any)

## III. 账户概览（交易后）(Account Overview - Post-Trade)
总价值/可用资金/持仓比例/现金缓冲

## IV. 持仓明细（交易后）(Position Details - Post-Trade)
所有持仓/占比/多空方向/{ticker}变化/集中度分析

## V. 风险评估 (Risk Assessment)
仓位合理性/与风控决策一致性/交易成本/止盈止损设置/组合平衡性/卖空风险（如适用）

== Risk Team Decision ==
{risk_decision}

== Trading Strategy Recommendation ==
{trader_plan}

== Past Experience ==
{past_memory_str}

Available Tools: get_futu_account_info, get_futu_positions, get_futu_orders, get_futu_quote, place_futu_order, get_futu_kline, get_futu_hot_stocks, get_futu_hot_news, get_futu_technical_analysis
"""

        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are a professional trading execution agent. Your task is to execute trades based on risk management decisions."
                    "\n\n🚀 PARALLEL TOOL EXECUTION:"
                    "\n- You can call MULTIPLE tools simultaneously in one response!"
                    "\n- Group related tools together to speed up execution"
                    "\n- Example: Call get_futu_account_info, get_futu_positions, and get_futu_orders all at once"
                    "\n\nKEY REMINDERS:"
                    "\n- ⚠️ CRITICAL: Check pending orders BEFORE placing new orders (use get_futu_orders)"
                    "\n- ⚠️ CRITICAL: Short selling ONLY supported in US market (NOT in HK/CN markets)"
                    "\n- Always check place_futu_order return result (success/failure)"
                    "\n- Use market local date {market_local_date} (YYYY-MM-DD format) for all date parameters"
                    "\n- Generate final report in CHINESE only when all actions are complete"
                    "\n\nYou have access to these tools: {tool_names}"
                    "\n\n{system_message}"
                    "\nCurrent date: {current_date}, Stock: {ticker}, Market: {market_type}",
                ),
                MessagesPlaceholder(variable_name="messages"),
            ]
        )
        
        prompt = prompt.partial(system_message=system_message)
        prompt = prompt.partial(tool_names=", ".join([tool.name for tool in tools]))
        prompt = prompt.partial(current_date=current_date)
        prompt = prompt.partial(ticker=ticker)
        prompt = prompt.partial(market_type=market_type)
        prompt = prompt.partial(market_local_date=market_local_date)
        prompt = prompt.partial(market_local_time=market_local_time.strftime('%Y-%m-%d %H:%M:%S %Z'))
        
        chain = prompt | llm.bind_tools(tools)
        
        result = chain.invoke(state["messages"])
        
        # Extract execution report from response
        execution_report = ""
        # Check if result has tool_calls attribute (AIMessage) and if it's empty
        if hasattr(result, "tool_calls") and len(result.tool_calls) == 0:
            # Agent has finished reasoning (no more tool calls)
            execution_report = result.content
        
        return {
            "messages": [result],
            "execution_report": execution_report,
            "sender": name,
        }
    
    return functools.partial(trading_executor_node, name="Trading Executor")
