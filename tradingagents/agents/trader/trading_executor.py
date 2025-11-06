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
        
        system_message = f"""You are a professional stock trading execution agent. Current time: {current_date}

Market Status: {market_status_msg}

CRITICAL: You will be invoked ONLY TWICE:
1. FIRST CALL: Return ALL tool calls in parallel (no text)
2. SECOND CALL: Generate final Chinese report (no more tool calls)

Core Principles:
1. Risk management team's decisions are authoritative and must be strictly executed unless physically impossible
2. ⚠️ EXECUTION DECISION MUST MATCH ACTUAL ACTIONS:
   - If you call place_futu_order → Report "已执行" with specific action (买入/卖出/卖空)
   - If you do NOT call place_futu_order → Report "跳过执行" or "持仓观望"
   - NEVER report "买入" or "卖出" if no order was actually placed
   - Your report must accurately reflect what you ACTUALLY DID, not what you PLANNED to do
3. Short selling (卖空) is ONLY supported for US market
   - US stocks: Can execute short selling
   - HK/CN stocks: Must skip if short selling is recommended

Trading Hours:
- US Market: 09:30-16:00 EST/EDT, Monday-Friday
- HK Market: 09:30-12:00, 13:00-16:00 HKT, Monday-Friday  
- CN Market: 09:30-11:30, 13:00-15:00 CST, Monday-Friday

Note: Market hours check has been performed. You are only invoked during trading hours.

Execution Workflow (TWO-STEP PROCESS):

STEP 1 - Data Collection (FIRST CALL - return tool calls only):
Call these tools in parallel:
1. get_futu_account_info(market_type="{market_type}")
2. get_futu_positions(market_type="{market_type}")
3. get_futu_orders(market_type="{market_type}", filter_status=0)
4. get_futu_quote(stock_code="{ticker}")

STEP 2 - Decision & Report (SECOND CALL - return Chinese report only):
Based on tool results from STEP 1:
1. Evaluate conditions: cash flow, position limits, order status
2. Decide: Execute/Skip/Adjust
3. If execute: call place_futu_order
4. Generate comprehensive Chinese report

Skip Execution Scenarios (provide specific numbers):
- Insufficient cash
- Position limit exceeded (single >30% or total >90%)
- Pending unfilled orders exist
- Position too full and cannot reduce

Position Management:
- Position >85% and buying → can reduce high-risk/low-return stocks first
- Position reasonable → execute directly
- Insufficient cash → can skip

Trading Target: {ticker}
Market Type: {market_type}
Trading Date: {current_date}

Trading Strategy Recommendation:
{trader_plan}

Risk Management Team Final Decision:
{risk_decision}

Execution Steps:

Step 1: Collect Data (must call)
1. get_futu_account_info(market_type="{market_type}")
2. get_futu_positions(market_type="{market_type}")
3. get_futu_orders(market_type="{market_type}", filter_status=0)
4. get_futu_quote(stock_code="{ticker}")

Step 2: Evaluate Conditions and Position Check
Check: unfilled orders, cash flow, position limits

CRITICAL POSITION MANAGEMENT RULES FOR {ticker}:

Rule 0: SHORT SELLING SUPPORT (美股卖空规则)
⚠️ SHORT SELLING IS ONLY SUPPORTED FOR US MARKET ({market_type})
- **US Market (美股)**: Short selling is ALLOWED
- **HK Market (港股)**: Short selling is NOT SUPPORTED - skip if recommended
- **CN Market (A股)**: Short selling is NOT SUPPORTED - skip if recommended

SHORT SELLING LOGIC FOR US STOCKS:
A. If risk team recommends SHORT position (做空/卖空):
   Step 1: Check current position status
   - If NO position exists → Execute SHORT order directly (卖空开仓)
   - If LONG position exists → MUST close long position FIRST, then execute short
     * First: place_futu_order(trd_side=1, qty=current_shares) - 平多仓
     * Then: place_futu_order(trd_side=1, qty=target_short_shares) - 开空仓
   
   Step 2: Calculate short position size
   - Target short ratio = risk team recommended ratio (e.g., -15% means 15% short)
   - Short amount = |recommended_ratio| * account_value
   - Convert to shares based on current price

B. If risk team recommends LONG position and SHORT position exists:
   Step 1: Close short position first (平空仓)
   - place_futu_order(trd_side=0, qty=current_short_shares) - 买入平空
   
   Step 2: Open long position (开多仓)
   - place_futu_order(trd_side=0, qty=target_long_shares) - 买入开多

C. Position direction indicators:
   - Positive ratio (e.g., +15%) = LONG position (多头)
   - Negative ratio (e.g., -15%) = SHORT position (空头)
   - Zero or near-zero = No position (空仓)

CRITICAL: For HK/CN markets, if short selling is recommended:
→ Report: "跳过执行 - 港股/A股不支持卖空操作"
→ Do NOT attempt to execute short orders

Rule 1: NEVER SELL AND REBUY THE SAME STOCK (SAME DIRECTION)
- If {ticker} is already in your portfolio (LONG), DO NOT sell it and then buy it back
- If {ticker} is already SHORT, DO NOT cover and then short again
- This creates unnecessary transaction costs and potential losses
- Instead, adjust position through incremental buying or selling only
- Exception: Switching from LONG to SHORT or SHORT to LONG requires closing first

Rule 2: POSITION ADJUSTMENT LOGIC
Before any action on {ticker}, check current position:

A. If {ticker} DOES NOT exist in portfolio:
   - Calculate target position size based on risk team recommendation
   - Execute BUY order for full target amount
   - Example: Risk team recommends 15% position → Buy to reach 15%

B. If {ticker} EXISTS in portfolio:
   Step 1: Calculate position ratios
   - Current position ratio = (current_position_value / total_account_value) * 100%
   - Risk team recommended ratio = X%
   - Position difference = recommended_ratio - current_ratio
   
   Step 2: Make professional decision based on difference
   
   Case 1: Current < Recommended (e.g., 12% vs 15%)
   → ADD TO POSITION: Buy additional shares to reach target
   → Calculate: additional_amount = (recommended_ratio - current_ratio) * account_value
   → Example: Current 12%, Target 15% → Buy additional 3% worth
   
   Case 2: Current ≈ Recommended (within ±2%)
   → HOLD: Position is already optimal, no action needed
   → Example: Current 14.5%, Target 15% → Skip, position sufficient
   
   Case 3: Current > Recommended (e.g., 20% vs 15%)
   → REDUCE POSITION: Sell partial shares to reach target
   → Calculate: reduction_amount = (current_ratio - recommended_ratio) * account_value
   → Example: Current 20%, Target 15% → Sell 5% worth (25% of holdings)
   → NEVER sell 100% and rebuy - this is prohibited!
   
   Case 4: Current >> Recommended (e.g., 25% vs 15%)
   → SIGNIFICANT REDUCTION: Sell larger portion to reach target
   → Calculate: reduction_amount = (current_ratio - recommended_ratio) * account_value
   → Example: Current 25%, Target 15% → Sell 10% worth (40% of holdings)
   → Still maintain position, just reduce to target level

Rule 3: PROFESSIONAL TRADING PRINCIPLES
- Minimize transaction costs: Only trade when adjustment is meaningful (>2% difference)
- Avoid round-trip trades: Never sell and immediately rebuy the same stock
- Gradual adjustment: For large reductions, consider partial selling over time
- Tax efficiency: Consider holding period and tax implications (if applicable)
- Market impact: Large orders should be split to avoid moving the market

Rule 4: POSITION SIZING REFERENCE
- Single stock limit: Typically ≤30% (hard limit)
- Total position limit: Typically ≤90% (maintain cash buffer)
- Diversification: Avoid excessive concentration
- Risk-adjusted sizing: Higher risk stocks should have smaller positions

Evaluate existing positions for take-profit/stop-loss:
For each position (EXCLUDING {ticker} - handle separately), get technical data:
- get_futu_quote(stock_code="position_stock") - current price, change%, P&L
- get_futu_kline(symbol="position_stock", interval="1min", start_date="{market_local_date}", end_date="{market_local_date}") - short-term trend
- get_futu_technical_analysis(symbol="position_stock", interval="1min", indicator="rsi", start_date="{market_local_date}", end_date="{market_local_date}") - overbought/oversold
- get_futu_technical_analysis(symbol="position_stock", interval="1min", indicator="macd", start_date="{market_local_date}", end_date="{market_local_date}") - trend direction
- get_futu_hot_news(lang="zh-cn") - real-time news (optional)

CRITICAL DATE PARAMETER RULES:
- ALWAYS use market local date: {market_local_date} (format: YYYY-MM-DD)
- Market: {market_type}, Local Time: {market_local_time}
- DO NOT use Beijing time or any other timezone
- Date format MUST be YYYY-MM-DD only, WITHOUT time component
- Example: get_futu_kline(symbol="AAPL", interval="1min", start_date="{market_local_date}", end_date="{market_local_date}")

Take-Profit/Stop-Loss Considerations (for OTHER positions, NOT {ticker}):
- Evaluate profit/loss levels and technical indicators
- Consider market conditions, news, and momentum
- Decide whether to take profit, stop loss, partial exit, or hold
- Balance risk management with growth potential
- You have full autonomy to determine appropriate thresholds and actions

Based on comprehensive analysis of technical indicators, news, and market conditions, autonomously decide whether to take profit/stop loss, sell ratio, and order type.

Decision Options:
- Execute target stock adjustment (buy more / sell partial / hold)
- Take-profit/stop-loss on other positions first (if needed)
- Skip if position already optimal
- Adjust quantity based on market conditions

Step 3: Execute Trade (if decided to execute)
Execution order:
1. If take-profit/stop-loss needed on OTHER positions, execute those orders first
2. Handle target stock {ticker} position adjustment (NEVER sell and rebuy the same stock)
3. Execute orders based on your comprehensive analysis

CRITICAL: TARGET STOCK {ticker} POSITION ADJUSTMENT LOGIC:

Step 3.1: Review current {ticker} position from Step 1 data
- Current position value and shares (check if LONG or SHORT)
- Current position ratio = (position_value / total_account_value) * 100%
  * Positive ratio = LONG position (多头)
  * Negative ratio = SHORT position (空头)
  * Zero = No position (空仓)
- Risk team recommended ratio (check sign for direction)

Step 3.2: Calculate position adjustment needed
- Position difference = recommended_ratio - current_ratio
- Adjustment amount = position_difference * account_value
- Direction change = check if switching from LONG to SHORT or vice versa

Step 3.3: Execute appropriate action (PROFESSIONAL TRADING LOGIC):

⚠️ SCENARIO A: SHORT SELLING (仅美股支持)
IF market is US AND risk team recommends SHORT (negative ratio, e.g., -15%):
  
  A1. IF NO position exists:
  → Action: SHORT SELL to open position (卖空开仓)
  → Amount: |recommended_ratio| * account_value
  → Order: place_futu_order(trd_side=1, qty=shares)
  → Reasoning: Opening new short position
  → Report: "卖空开仓"
  
  A2. IF LONG position exists:
  → Action: CLOSE LONG first, then OPEN SHORT (平多开空)
  → Step 1: place_futu_order(trd_side=1, qty=current_long_shares) - 平多仓
  → Step 2: place_futu_order(trd_side=1, qty=target_short_shares) - 开空仓
  → Reasoning: Must close long before opening short
  → Report: "平多仓后卖空开仓"
  
  A3. IF SHORT position exists AND current_short < target_short:
  → Action: INCREASE SHORT position (加空仓)
  → Amount: (target_short - current_short) shares
  → Order: place_futu_order(trd_side=1, qty=additional_shares)
  → Reasoning: Short position below target
  → Report: "加空仓"
  
  A4. IF SHORT position exists AND current_short ≈ target_short (within 2%):
  → Action: HOLD (no trade)
  → Reasoning: Short position already optimal
  → Report: "持仓观望（空头）"
  
  A5. IF SHORT position exists AND current_short > target_short:
  → Action: REDUCE SHORT position (减空仓/部分平空)
  → Amount: (current_short - target_short) shares
  → Order: place_futu_order(trd_side=0, qty=cover_shares)
  → Reasoning: Short position above target
  → Report: "减空仓"

IF market is HK or CN AND risk team recommends SHORT:
→ Action: SKIP execution
→ Reasoning: HK/CN markets do not support short selling
→ Report: "跳过执行 - 港股/A股不支持卖空操作"

⚠️ SCENARIO B: LONG POSITION (标准多头操作)
IF risk team recommends LONG (positive ratio, e.g., +15%):

  B1. IF SHORT position exists:
  → Action: CLOSE SHORT first, then OPEN LONG (平空开多)
  → Step 1: place_futu_order(trd_side=0, qty=current_short_shares) - 平空仓
  → Step 2: place_futu_order(trd_side=0, qty=target_long_shares) - 开多仓
  → Reasoning: Must close short before opening long
  → Report: "平空仓后买入开多"

  B2. IF NO position exists:
  → Action: BUY to establish position (买入建仓)
  → Amount: Full target position size
  → Order: place_futu_order(trd_side=0, qty=shares)
  → Reasoning: New position, no existing holdings
  → Report: "买入建仓"

  B3. IF LONG position exists AND current_ratio < recommended_ratio - 2%:
  → Action: BUY additional shares (加仓买入)
  → Amount: (recommended_ratio - current_ratio) * account_value
  → Order: place_futu_order(trd_side=0, qty=additional_shares)
  → Reasoning: Position below target, increase holdings
  → Example: Current 10%, Target 15% → Buy additional 5% worth
  → Report: "加仓买入"

  B4. IF LONG position exists AND current_ratio ≈ recommended_ratio (within ±2%):
  → Action: HOLD (no trade)
  → Reasoning: Position already optimal, avoid unnecessary transactions
  → Example: Current 14%, Target 15% → No action needed
  → Report: "持仓观望"

  B5. IF LONG position exists AND current_ratio > recommended_ratio + 2%:
  → Action: SELL partial shares (减仓卖出)
  → Amount: (current_ratio - recommended_ratio) * account_value
  → Percentage to sell: (adjustment_amount / current_position_value) * 100%
  → Order: place_futu_order(trd_side=1, qty=sell_shares)
  → Reasoning: Position above target, reduce to optimal level
  → Example: Current 20%, Target 15% → Sell 5% worth (25% of holdings)
  → CRITICAL: Keep remaining 75% of holdings, DO NOT sell 100%
  → Report: "减仓卖出"

  B6. IF LONG position exists AND current_ratio >> recommended_ratio (>10% over):
  → Action: SELL significant portion (大幅减仓)
  → Amount: (current_ratio - recommended_ratio) * account_value
  → Percentage to sell: (adjustment_amount / current_position_value) * 100%
  → Order: place_futu_order(trd_side=1, qty=sell_shares)
  → Reasoning: Position significantly overweight, major rebalancing needed
  → Example: Current 30%, Target 15% → Sell 15% worth (50% of holdings)
  → CRITICAL: Still maintain 50% of holdings, DO NOT liquidate entirely
  → Report: "大幅减仓"

PROHIBITED ACTIONS:
❌ NEVER sell 100% of LONG position and then buy it back (same direction)
❌ NEVER cover 100% of SHORT position and then short again (same direction)
❌ NEVER execute round-trip trades in the same direction
❌ NEVER attempt short selling in HK or CN markets
✅ ONLY incremental adjustments within same direction: add more OR reduce partial
✅ Direction changes (LONG↔SHORT) require closing first position completely

Risk team recommendation: Use as primary reference for target position size
You have flexibility to adjust based on technical analysis and market conditions, but ALWAYS follow professional position adjustment logic

Price and Order Type Judgment:
Get target stock technical data:
- get_futu_kline(symbol="{ticker}", interval="1min", start_date="{market_local_date}", end_date="{market_local_date}") - short-term trend
- get_futu_technical_analysis(symbol="{ticker}", interval="1min", indicator="rsi", start_date="{market_local_date}", end_date="{market_local_date}") - overbought/oversold
- get_futu_technical_analysis(symbol="{ticker}", interval="1min", indicator="macd", start_date="{market_local_date}", end_date="{market_local_date}") - trend direction

REMINDER: Use market local date {market_local_date} for all date parameters (YYYY-MM-DD format only).

Based on technical indicators and market conditions, autonomously decide appropriate trade price and order type (limit/market).

Step 4: Verify Results (if trade executed)
1. get_futu_orders(market_type="{market_type}", filter_status=0)
2. get_futu_account_info(market_type="{market_type}")
3. get_futu_positions(market_type="{market_type}")

Step 5: Generate Report (use Step 4 data)

CRITICAL REPORTING REQUIREMENTS:
⚠️ EXECUTION DECISION MUST MATCH ACTUAL ACTIONS:
- If you called place_futu_order → Decision MUST be "已执行" (Executed)
- If you did NOT call place_futu_order → Decision MUST be "跳过执行" (Skipped) or "持仓" (Held)
- NEVER report "买入" (Buy) or "卖出" (Sell) if no order was actually placed
- Report must accurately reflect what you actually did, not what you planned to do

## I. 执行决策 (Execution Decision)
   - **决策结果**: [MUST match actual actions]
     * 已执行 - 仅当实际调用了 place_futu_order
     * 跳过执行 - 当决定不交易时（资金不足、仓位已优、条件不满足等）
     * 持仓观望 - 当决定保持现有仓位不变时
   - **决策理由**: 详细说明决策过程和依据
   - **{ticker} 仓位分析**:
     * 交易前仓位: X股，占比Y%（如为新仓位则标注"无持仓"）
     * 风控团队建议仓位: Z%
     * 仓位差异: (当前 - 建议) = ±W%
     * 实际执行动作: [必须与实际操作一致]
       - 买入建仓 (仅当无持仓且执行了买入)
       - 加仓买入 (仅当有持仓且执行了买入)
       - 减仓卖出 (仅当有持仓且执行了卖出)
       - 清仓卖出 (仅当执行了全部卖出)
       - 卖空开仓 (仅当美股市场且执行了卖空) ⚠️
       - 持仓不变 (未执行任何交易)
       - 跳过交易 (决定不执行)
     * 交易后仓位: X股，占比Y%（如未交易则与交易前相同）
     * 执行理由: 为什么选择这个具体的操作和数量

## II. 交易明细 (Trade Details)
   - **目标股票 {ticker} 订单**:
     * 订单类型: 买入 / 卖出 / 卖空 / 无
     * 订单数量和价格: [如果执行了订单，必须提供具体数字]
     * 订单状态: 已提交 / 未提交
     * 调整数量理由: 为什么选择这个数量
     * ✅ 确认: 未执行"先卖后买"操作（如有持仓）
   - **其他持仓操作（止盈/止损）**:
     * 执行的订单（如有）
     * 每个操作的理由
   - **价格和订单类型选择理由**

## III. 账户概览（交易后）(Account Overview - Post-Trade)
   - 账户总价值
   - 可用资金
   - 总持仓比例
   - 保留现金缓冲

## IV. 持仓明细（交易后）(Position Details - Post-Trade)
   - 所有当前持仓及占比
   - **{ticker} 仓位变化重点**:
     * 交易前: X股，Y%
     * 交易后: X股，Y%
     * 变化: +/-股，+/-%
   - 仓位集中度分析
   - 分散化评估

## V. 风险评估 (Risk Assessment)
   - 仓位规模分析及理由
   - 与风控团队建议的一致性
   - 交易成本效率（避免不必要交易）
   - 风险收益评估
   - 所有持仓的止盈/止损考虑
   - 整体投资组合平衡评估
   - 应用的专业交易原则

Past Experience:
{past_memory_str}

Key Instructions:
1. One-time completion, no loops
2. Each tool type called at most once (but can call same tool for different stocks)
   - Example: get_futu_quote can be called for target stock and position stocks separately
   - Example: get_futu_kline can be called for multiple position stocks
3. Use risk team decisions as primary reference, but you have autonomy to adjust based on analysis
4. CRITICAL: NEVER sell and rebuy the same stock - this is prohibited and unprofessional
5. For target stock {ticker}: Only incremental adjustments (add more OR reduce partial, never both)
6. Position adjustment logic:
   - Current < Target → Buy additional shares
   - Current ≈ Target (±2%) → Hold, no action
   - Current > Target → Sell partial shares (keep remaining position)
7. First evaluate OTHER positions for take-profit/stop-loss, execute if appropriate
8. Minimize transaction costs: Only trade when adjustment is meaningful (>2% difference)
9. Report must include position analysis showing before/after comparison
10. Report must confirm no round-trip trades were executed
11. No text generation during tool calls, generate Chinese report after completion
12. Exercise professional judgment following real trader logic

Available Tools:
get_futu_account_info, get_futu_positions, get_futu_orders, get_futu_quote, place_futu_order, get_futu_kline, get_futu_hot_stocks, get_futu_hot_news, get_futu_technical_analysis
"""

        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are a professional trading execution agent. Your task is to execute trades based on risk management decisions."
                    "\n\nCRITICAL EXECUTION RULES:"
                    "\n1. ONE-TIME EXECUTION: You will be called ONLY ONCE. Complete all steps in a single response."
                    "\n2. TOOL CALL PHASE: In your FIRST response, call ALL necessary tools at once (parallel tool calls):"
                    "\n   - get_futu_account_info(market_type=\"{market_type}\")"
                    "\n   - get_futu_positions(market_type=\"{market_type}\")"
                    "\n   - get_futu_orders(market_type=\"{market_type}\", filter_status=0)"
                    "\n   - get_futu_quote(stock_code=\"{ticker}\")"
                    "\n   DO NOT call tools one by one. Call them ALL at once in parallel."
                    "\n3. REPORT PHASE: In your SECOND response (after receiving tool results), generate the final Chinese report."
                    "\n4. NO LOOPS: Do NOT make additional tool calls after the first batch. Use only the data from the first tool call batch."
                    "\n5. REVIEW HISTORY: Check message history - if tools have been called, generate the report immediately."
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
