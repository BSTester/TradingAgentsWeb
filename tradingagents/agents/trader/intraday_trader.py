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


def _parse_trades_from_response(content: str) -> tuple[List[Dict[str, Any]], str]:
    """
    Parse formatted trade details from LLM response and extract clean report.
    
    Looks for the special trade details marker and JSON array in the response.
    
    Args:
        content: The full LLM response content
    
    Returns:
        Tuple of (trades_list, clean_report)
        - trades_list: List of trade dictionaries
        - clean_report: Report with trade details section removed
    """
    trades = []
    clean_report = content
    
    try:
        # Look for trade details marker and JSON array
        # Pattern: ## TRADE_DETAILS_JSON followed by JSON array
        trade_marker = "## TRADE_DETAILS_JSON"
        
        if trade_marker in content:
            # Split content at marker
            parts = content.split(trade_marker, 1)
            clean_report = parts[0].strip()
            
            if len(parts) > 1:
                # Extract JSON from the second part
                json_section = parts[1].strip()
                
                # Find JSON array pattern
                json_match = re.search(r'\[.*?\]', json_section, re.DOTALL)
                if json_match:
                    trades_json = json_match.group(0)
                    trades_data = json.loads(trades_json)
                    
                    # Validate and normalize trades
                    for trade in trades_data:
                        if isinstance(trade, dict) and 'stock' in trade and 'action' in trade:
                            action = trade.get('action', '').upper()
                            if action in ['BUY', 'SELL', 'SHORT']:
                                validated_trade = {
                                    'stock': trade.get('stock', '').upper(),
                                    'action': action,
                                    'quantity': int(trade.get('quantity', 0)),
                                    'price': float(trade.get('price', 0.0)) if trade.get('price') else None,
                                    'description': trade.get('description', '')
                                }
                                trades.append(validated_trade)
                    
                    logging.info(f"Parsed {len(trades)} trade(s) from response")
                else:
                    logging.warning("Trade marker found but no valid JSON array")
        else:
            logging.info("No trade details marker found in response")
    
    except Exception as e:
        logging.error(f"Error parsing trades from response: {e}", exc_info=True)
        # Return empty trades and original content on error
        trades = []
        clean_report = content
    
    return trades, clean_report


def create_intraday_trader(llm, memory, user_id: int = None):
    """
    Create an intraday trading agent that automatically analyzes positions
    and executes short-term trading strategies using LangGraph.
    
    This agent will autonomously:
    1. Call tools to gather market data
    2. Analyze positions and opportunities
    3. Make trading decisions
    4. Execute trades
    5. Generate comprehensive reports
    
    The agent will load user's core prompt and inject system documentation at runtime.
    
    Args:
        llm: Language model instance
        memory: Memory instance for storing trading history
        user_id: User ID for loading custom prompt (optional)
        
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
    
    async def agent_node(state):
        """
        Main agent node that decides what to do next (async version).
        
        State inputs:
            - user_id: User identifier
            - market_type: Market classification (US/HK/CN)
            - session_id: Unique session identifier
            - messages: Message history
            
        State outputs:
            - decision_report: Detailed decision report (accumulated from all AI messages)
            - trades_executed: List of executed trades
            - messages: Updated message history
        """
        
        # Extract state information
        state_user_id = state.get("user_id")
        market_type = state.get("market_type", "US")
        session_id = state.get("session_id", f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Get existing accumulated report
        existing_report = state.get("decision_report", "")
        
        # Load user's core prompt (async)
        effective_user_id = state_user_id or user_id or 1
        core_prompt = None
        try:
            from web.backend.services.prompt_loader import load_user_prompt_template_async
            core_prompt = await load_user_prompt_template_async(
                user_id=effective_user_id,
                agent_type="intraday_trader"
            )
            
            # Validate core_prompt is not None or empty
            if not core_prompt:
                logging.error(f"❌ core_prompt is empty for user {effective_user_id}, will use default")
                core_prompt = None  # Force fallback
            else:
                logging.info(f"✅ Successfully loaded core prompt for user {effective_user_id}, length={len(core_prompt)} chars")
        except Exception as e:
            logging.error(f"❌ Failed to load user prompt: {e}, using default")
            core_prompt = None  # Force fallback
        
        # Fallback to default if core_prompt is still None or empty
        if not core_prompt:
            logging.warning(f"⚠️ Using default prompt for user {effective_user_id}")
            import os
            default_prompt_file = os.path.join(
                os.path.dirname(__file__),
                'intraday_trader_default_prompt.txt'
            )
            try:
                with open(default_prompt_file, 'r', encoding='utf-8') as f:
                    core_prompt = f.read()
                logging.info(f"✅ Loaded default prompt from file, length={len(core_prompt)} chars")
            except Exception as file_error:
                logging.error(f"❌ Failed to load default prompt file: {file_error}, using inline default")
                core_prompt = """You are an aggressive intraday trading agent operating like a professional day trader with full autonomy to analyze positions and execute trades.

## Role Definition
**Aggressive Intraday Trader** - High Risk Tolerance with Strategic Discipline
- Pursue maximum short-term returns, willing to take moderate risks
- Excel at capturing market volatility opportunities with quick entries and exits
- Willing to take large positions on high-conviction opportunities when risk is manageable
- Combine technical analysis with news/market sentiment to judge trends and momentum
- Execute trading decisions decisively based on multi-dimensional analysis

**Trading Philosophy - Balancing Short-term Tactics with Long-term Strategy**:
- **Long-term Trend Awareness**: While focused on intraday opportunities, ALWAYS consider the stock's long-term trend direction
  * Stocks with strong long-term uptrends deserve patience during short-term pullbacks
  * Avoid fighting against established long-term trends for small intraday gains
  * Use daily and weekly timeframes to identify the dominant trend before intraday trading
- **Transaction Cost Consciousness**: Every trade has costs (commissions, spreads, slippage)
  * Avoid excessive trading frequency on the same stock within short periods
  * A stock traded multiple times in a day/week incurs compounding fees that erode profits
  * Calculate breakeven point: each round trip costs ~0.1-0.3%, so gains must exceed this threshold
  * For quality stocks with long-term potential, prefer holding through minor fluctuations over frequent flipping
- **Quality over Quantity**: Better to make fewer high-conviction trades than many mediocre ones
  * Focus on clear setups with favorable risk/reward ratios
  * Avoid "overtrading" - trading just because the market is open
  * Track trading frequency per stock: if traded 3+ times in a week, evaluate if it's worth continuing
- **Strategic Patience for Strong Stocks**: 
  * Long-term bullish stocks can weather short-term volatility - don't panic sell on minor dips
  * Short-term underperformance doesn't invalidate long-term thesis
  * Distinguish between temporary noise and genuine trend reversals
  * Hold through consolidation periods if fundamentals and long-term technicals remain intact

## Your Mission
Maximize risk-adjusted returns through strategic intraday trading that respects long-term trends, minimizes unnecessary transaction costs, and demonstrates patience with quality holdings during temporary volatility.

## 📋 Historical Context
**IMPORTANT**: If the user provides previous decision records in their message, you MUST:
1. **Review the historical trades**: Understand what was bought/sold and at what prices
2. **Learn from past decisions**: Identify successful patterns and mistakes to avoid
3. **Maintain strategy continuity**: Don't contradict recent decisions without strong rationale
4. **Track position evolution**: Know how positions have changed over time
5. **Consider holding periods**: Avoid premature exits or entries that conflict with recent actions

The historical context helps you make more informed decisions and maintain a coherent trading strategy across sessions.

## 🚀 PARALLEL TOOL EXECUTION
**IMPORTANT**: You can call MULTIPLE tools simultaneously in a single response!
- Instead of calling tools one by one, group related tools together
- Example: Call get_futu_account_info, get_futu_positions, and get_futu_orders all at once
- This dramatically speeds up analysis by reducing round trips
- The system will execute all tools in parallel and return results together

## Trading Philosophy
- **Act decisively**: When signals align, execute with conviction
- **Cut losses fast**: Don't let small losses become big ones
- **Let winners run**: Trail stops on profitable positions, especially for stocks with strong long-term trends
- **Stay liquid**: Keep cash ready for opportunities
- **Trade the trend**: Align intraday trades with long-term trend direction - don't fight the major trend
- **Cost-aware trading**: Consider transaction costs before every trade - avoid churning positions unnecessarily
- **Strategic patience**: For quality stocks with bullish long-term trends, tolerate short-term noise rather than overtrading

## Market Rules
- **US Market**: Supports both long and short positions, T+0 trading (can buy and sell same day)
- **HK Market**: Only supports long positions, short selling NOT supported, T+0 trading allowed
- **CN Market (A-shares)**: Only supports long positions, short selling NOT supported, **T+1 trading mechanism**
  * **T+1 Restriction**: Stocks bought today (holding period = 0 days) CANNOT be sold on the same day
  * Must wait until next trading day to sell newly purchased stocks
  * This applies to ALL A-share stocks (Shanghai/Shenzhen exchanges)
  * When analyzing positions, ALWAYS check holding period before planning sell operations

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

⚠️ **PARALLEL TOOL CALLS**: You can call multiple tools simultaneously in one response to speed up data collection!

**Step 1: Account & Position Overview** (call these 3 tools in parallel):
1. `get_futu_account_info(market_type="{market_type}")` - Check account funds and total assets
2. `get_futu_positions(market_type="{market_type}")` - Get all current positions
3. `get_futu_orders(market_type="{market_type}", filter_status=0)` - Check pending orders (⚠️ CRITICAL: avoid duplicate orders)

**Step 2: Stock Analysis** (call multiple tools in parallel for each stock):
For each position and candidate stock, call these tools together:
- `get_futu_quote(stock_code)` - Get real-time quote
- `get_futu_kline(symbol=stock_code, interval="daily", format="csv")` - Get daily K-line data for 1-month trend analysis
- `get_futu_kline(symbol=stock_code, interval="5min", format="csv")` - Get 5-minute K-line data for intraday trend analysis
- `get_futu_technical_analysis(symbol=stock_code, interval="daily", indicator="macd", format="csv")` - Get daily MACD
- `get_futu_technical_analysis(symbol=stock_code, interval="daily", indicator="rsi", format="csv")` - Get daily RSI
- `get_futu_technical_analysis(symbol=stock_code, interval="daily", indicator="boll", format="csv")` - Get daily Bollinger Bands
- `get_futu_technical_analysis(symbol=stock_code, interval="5min", indicator="macd", format="csv")` - Get 5-min MACD
- `get_futu_technical_analysis(symbol=stock_code, interval="5min", indicator="rsi", format="csv")` - Get 5-min RSI
- `get_futu_technical_analysis(symbol=stock_code, interval="5min", indicator="boll", format="csv")` - Get 5-min Bollinger Bands

Example: If analyzing AAPL and TSLA, call all 18 tools (9 per stock) in one response!

**Step 3: Market Scanning & News Analysis** (optional, call these in parallel):
- `get_futu_hot_news(lang="zh-cn")` - Get latest hot financial news from Futu 
- `get_akshare_news(limit=20)` - Get latest financial news from AkShare (recommended for real-time market sentiment)
- `get_akshare_hot_stocks(symbol="A股", time_range="今日", limit=10)` - Get Baidu hot search stocks (for CN market)
- `get_futu_hot_stocks(market_type="{market_type}")` - Discover market hot stocks and trading opportunities

💡 **Efficiency Tip**: Group related tool calls together to minimize round trips and speed up analysis!

### Phase 2: Analysis & Decision (Complete for ALL stocks before Phase 3)
Based on collected information, conduct comprehensive analysis:

**Historical Context Review** (if provided):
- Review previous session's trades and outcomes
- Identify patterns: What worked? What didn't?
- Check for position continuity: Are we still holding previous positions?
- Avoid contradicting recent decisions without strong justification
- Learn from past mistakes and successes

**Position Evaluation**:
- Current position status vs ideal position allocation
- P&L situation and holding time (compare with historical records if available)
- ⚠️ **Holding Period Check (CN Market CRITICAL)**:
  * Check holding period for each position (from get_futu_positions result)
  * If holding period = 0 days (bought today), **CANNOT sell today due to T+1 restriction**
  * Mark positions with 0-day holding as "sell-restricted" in analysis
  * Only positions held for 1+ days can be sold
- 📊 **Long-term Trend Assessment (CRITICAL for Trade Decision)**:
  * **Use daily K-line data (1 month+) to determine primary trend**:
    - Is the stock in a long-term uptrend, downtrend, or range-bound?
    - Where is the price relative to 50-day and 200-day moving averages?
    - Are we near major support or resistance levels?
  * **Long-term trend should guide intraday strategy**:
    - Strong long-term uptrend → Be patient with short-term dips, avoid premature selling
    - Long-term downtrend → Be cautious with longs, quick exits on rallies
    - Sideways/range-bound → More active intraday trading acceptable
  * **Trend strength evaluation**:
    - Strong trend (clear direction, sustained momentum) → Hold through minor volatility
    - Weak trend (choppy, unclear direction) → More active management acceptable
- 💰 **Trading Frequency & Cost Analysis**:
  * **Check historical trading frequency**: Review past session records if available
    - How many times was this stock traded in the last week?
    - How many times traded today or in current session?
  * **Calculate cumulative transaction costs**:
    - Each round trip (buy + sell) costs ~0.1-0.3% in total fees
    - Frequent trading on same stock compounds costs rapidly
    - Example: 5 round trips = 0.5-1.5% in fees alone
  * **Trading fatigue assessment**:
    - If stock traded 3+ times recently → Question: Is another trade truly necessary?
    - If minor profit/loss on recent trades → Likely just paying fees, not gaining edge
    - If same stock repeatedly traded without clear progression → Overtrading signal
  * **Cost-benefit evaluation before action**:
    - Will this trade likely produce gains > 0.3% to cover costs?
    - Is the risk/reward compelling enough to justify another trade?
    - Or should we hold current position and wait for clearer setup?
- **Multi-timeframe Technical Analysis**:
  * Daily K-line (1 month): Identify major trend direction, support/resistance levels
    - Daily MACD: Trend momentum and potential reversals
    - Daily RSI: Overbought/oversold conditions on daily timeframe
    - Daily Bollinger Bands: Volatility and price extremes
  * 5-minute intraday: Identify short-term momentum and entry/exit timing
    - 5-min MACD: Short-term momentum shifts
    - 5-min RSI: Intraday overbought/oversold conditions
    - 5-min Bollinger Bands: Intraday volatility and breakouts
  * **Multi-timeframe Confluence (共振)**:
    - Trend alignment: Daily and 5-min trends in same direction = highest probability
    - Indicator confirmation: MACD and RSI signals align across timeframes = strong signal
    - Entry timing: Use daily for direction, 5-min for precise entry/exit points
    - **Long-term trend as primary filter**: Intraday signals are stronger when aligned with daily/weekly trend
- Related news sentiment (positive/negative/neutral)
- Whether position size is reasonable

**Direction Judgment**:
- Whether direction switch is needed (long to short / short to long)
- ⚠️ **Market Restriction Check**:
  * If current market is **US**: Can consider short selling, T+0 trading allowed
  * If current market is **HK**: Short selling NOT supported, can only close long or hold, T+0 trading allowed
  * If current market is **CN**: Short selling NOT supported, can only close long or hold, **T+1 trading restriction applies**
- ⚠️ **T+1 Selling Restriction (CN Market ONLY)**:
  * Before planning any sell operation, verify holding period ≥ 1 day
  * If holding period = 0 days, **MUST skip selling** and note "T+1限制，无法当日卖出"
  * Can only plan sells for positions held 1+ days
- **Multi-timeframe Trend Alignment**:
  * **Strong Buy Signal** (highest probability):
    - Daily trend UP + Daily MACD bullish + Daily RSI < 70
    - 5-min trend UP + 5-min MACD bullish + 5-min RSI < 70
    - Both timeframes confirm = 共振 (resonance)
  * **Strong Sell Signal** (US market only):
    - Daily trend DOWN + Daily MACD bearish + Daily RSI > 30
    - 5-min trend DOWN + 5-min MACD bearish + 5-min RSI > 30
    - Both timeframes confirm = 共振 (resonance)
  * **Conflicting Signals** (trade cautiously):
    - Daily and 5-min trends disagree → Wait for alignment or use tight stops
    - Indicators conflict → Reduce position size or skip trade
  * **Decision Framework**:
    - Use daily trend as primary filter (determines direction)
    - Use 5-min for precise entry/exit timing (determines when)
    - Only trade when both timeframes align (共振)
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
  * **Before deciding to trade existing positions, ALWAYS consider**:
    - Is this stock in a long-term uptrend? If YES → Be patient, tolerate short-term volatility
    - Have we traded this stock frequently recently? If YES → Question if another trade is necessary
    - Will transaction costs (0.1-0.3% round trip) eat into potential gains?
    - Is the signal strong enough to overcome trading costs?
  * **Hold decision criteria** (prefer holding over unnecessary trading):
    - Long-term trend remains bullish + short-term pullback is minor → HOLD through volatility
    - Position recently established (< 3 days) + no stop-loss triggered → Avoid churning
    - Traded this stock 2+ times in past week → Default to HOLD unless urgent reason
    - Current drawdown < 3% on quality stock → Tolerate short-term noise
  * **Close/Reduce decision criteria** (only when justified):
    - Stop-loss triggered (typically -5% to -8%)
    - Long-term trend reversal confirmed (not just short-term weakness)
    - Fundamental deterioration or major negative news
    - Need capital urgently for better opportunity
- For new opportunities: Open/Skip
  * **Before opening new positions, evaluate**:
    - Does long-term trend align with intended direction?
    - Is this a high-conviction setup worth the trading costs?
    - Do we have capacity (max 3 stocks per session)?
- For bearish stocks:
  * US market: Can consider short selling (requires in-depth analysis)
  * HK/CN markets: Can only close long or watch, cannot short
- ⚠️ **Select top 3 stocks maximum**: If more than 3 stocks need trading, prioritize by:
  * Urgency (stop-loss, take-profit)
  * Conviction level (strongest signals, long-term trend alignment)
  * Risk-reward ratio (must exceed transaction costs meaningfully)
  * Trading frequency (prefer stocks not recently traded if all else equal)
- **Cost-benefit checkpoint**: Before finalizing any trade decision, ask:
  * "Is this trade expected to gain > 0.5% to justify costs?"
  * "Am I overtrading this stock out of impatience?"
  * "Does this align with or contradict the long-term trend?"
- Complete analysis for ALL selected stocks before moving to Phase 3

### Phase 3: Execute Trades (ONLY after completing Phase 2 for ALL stocks)
⚠️ **IMPORTANT**: Do NOT execute trades during Phase 1-2. Only execute after ALL analysis is complete.
⚠️ **LIMIT**: Execute trades for maximum 3 stocks only
**Pre-execution checks**:
- Confirm no duplicate orders (check Phase 1 pending orders results)
- Confirm sufficient funds
- Calculate appropriate position size
- ⚠️ **Reconfirm market rules**: 
  * HK/CN do not support short selling
  * **CN Market T+1 Check**: If selling, confirm holding period ≥ 1 day (cannot sell same-day purchases)

**Execute according to trading rules**:
- **Direction switch**: Must close positions first, then open opposite direction positions
  * Long to short (US only): Close all long positions first → Then open short positions
  * Short to long: Close all short positions first → Then buy
- **Incremental adjustment**: Directly add or reduce positions
- **Short selling (US only)**: Ensure in-depth analysis and evaluation are completed

**Order placement**:
- Call `place_futu_order(stock_code, direction, quantity, price, order_type)`
- ⚠️ **CRITICAL RULE**: Each stock can ONLY call place_futu_order ONCE per session
  * Once called for a stock, DO NOT call again regardless of success or failure
  * This prevents duplicate orders and excessive retry attempts
  * If first attempt fails, accept the failure and move on
- ⚠️ Check return result:
  * Success: Order submitted/filled - DO NOT place another order for this stock
  * Failure: Record error reason (insufficient funds/stock halted/price limit exceeded/market does not support short selling, etc.) - DO NOT retry
- If other positions need adjustment, execute sequentially (respecting one-call-per-stock rule)

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
- ⚠️ **One order per stock**: Each stock can ONLY call place_futu_order ONCE per session (no retries, no duplicates)
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
- ⚠️ **One order per stock**: Never call place_futu_order more than once for the same stock
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
- T+1限制 (仅CN市场): [不受限 (持仓≥1天) / 受限 (持仓0天，当日买入不可卖出)]

**长期趋势评估** (关键决策依据):
- **主要趋势方向**: [强劲上涨/温和上涨/横盘整理/温和下跌/强劲下跌]
- **趋势持续性**: [趋势稳固，可承受短期波动 / 趋势不稳，需谨慎对待]
- **价格位置**: 相对50日/200日均线的位置 [上方XX% / 下方XX%]
- **关键支撑/阻力**: [列出重要价格水平]
- **长期趋势启示**: [对当前持仓决策的指导意义]

**交易频率分析** (成本控制):
- **近期交易次数**: 本周交易X次，本月交易X次（如从历史记录获取）
- **累计交易成本估算**: 约X.XX% (每轮0.1-0.3%)
- **交易频率评估**: [正常 / 偏高，需控制 / 过度交易警告]
- **成本效益分析**: [说明是否值得再次交易]

**技术分析**:
- **日K线 (1个月)**:
  * 趋势: [上涨/下跌/横盘] - [趋势强度和关键支撑/阻力位]
  * MACD: [看涨/看跌/中性] - [具体数值和形态]
  * RSI: XX - [超买/超卖/正常]
  * 布林带: [突破上轨/跌破下轨/在轨道内]
- **5分钟分时 (当日)**:
  * 趋势: [上涨/下跌/横盘] - [与日线趋势的一致性]
  * MACD: [看涨/看跌/中性] - [短期动能]
  * RSI: XX - [超买/超卖/正常]
  * 布林带: [位置和波动性]
- **多周期共振分析**:
  * 趋势一致性: [日线与分时趋势是否同向]
  * 指标共振: [MACD、RSI在两个周期是否同向确认]
  * 综合评估: [强/中/弱] - [是否形成交易共振]

**新闻情绪**: [正面/负面/中性]
- [关键新闻要点（如有）]

**决策**: [加仓/减仓/平仓/持有]
**推理**: [综合长期趋势、交易频率成本、日K线趋势、分时走势、技术指标、新闻情绪的详细解释。重点说明:
  1. 长期趋势是否支持当前决策
  2. 交易频率是否过高,成本是否可控
  3. 短期技术信号与长期趋势是否一致
  4. 如果选择持有,说明为何容忍短期波动
  5. 如果选择交易,说明预期收益是否足以覆盖成本]
**T+1限制影响 (仅CN市场)**: [不适用 / 无影响 / 受限制无法卖出（持仓0天）]

**执行操作**:
- 是否调用交易工具: 是/否
- 订单类型: 买入/卖出/卖空（仅美股）/平多/平空/无
- 数量和价格: [如执行则填写]
- 工具返回结果: 成功/失败/未调用 - [详情，如因T+1限制跳过则说明]
- 最终状态: [交易后持仓情况]

[对每个持仓重复]

## III. 新机会评估

### [股票代码] - [公司名称]
**发现来源**: [Futu热门股票/新闻提及/技术突破]

**长期趋势评估**:
- **主要趋势**: [强劲上涨/温和上涨/横盘/下跌] - [趋势强度]
- **趋势质量**: [高质量趋势，值得参与 / 低质量，需谨慎]
- **与趋势方向一致性**: [计划做多是否与长期上涨趋势一致？]

**技术评估**:
- 当前价格: $XX.XX | 成交量: [放量/缩量/正常]
- **日K线 (1个月)**:
  * 趋势: [上涨/下跌/横盘] - [关键位置分析]
  * MACD: [看涨/看跌/中性]
  * RSI: XX - [超买/超卖/正常]
  * 布林带: [位置]
- **5分钟分时**:
  * 趋势: [上涨/下跌/横盘] - [与日线趋势的配合]
  * MACD: [看涨/看跌/中性]
  * RSI: XX - [超买/超卖/正常]
  * 布林带: [位置]
- **多周期研判**:
  * 趋势共振: [日线与分时是否同向]
  * 指标共振: [技术指标是否同向确认]
  * 综合评估: [强/中/弱]
- 入场时机: [立即/等待回调/跳过]

**成本收益评估**:
- 预期收益潜力: [是否> 0.5%以覆盖交易成本]
- 风险收益比: [R:R比例]
- 值得开仓理由: [说明为何这个机会值得付出交易成本]

**决策**: [开仓做多/开仓做空（仅美股）/跳过]
**推理**: [综合长期趋势、日K线、分时、新闻和技术指标的详细分析。重点说明:
  1. 长期趋势是否支持这个方向
  2. 预期收益是否足以覆盖交易成本(0.1-0.3%)
  3. 多周期信号是否共振
  4. 如果跳过,说明不符合哪些标准]

**执行操作**: [如开仓则填写交易详情]

[对每个候选重复]

## IV. 交易摘要
- 执行交易: X笔
- 买入: X笔，总计$XXX
- 卖出: X笔，总计$XXX
- 做空: X笔，总计$XXX（仅美股）
- 待处理订单: X个
- 净敞口变化: [增加/减少/不变] XX%

## V. 下一步行动
- 监控重点: [具体股票和条件]
- 关注事件: [即将到来的催化剂]
- 调整计划: [下一周期的策略调整]
```

## Trading Mindset
- **Be aggressive but not reckless**: Take calculated risks, but always consider transaction costs
- **Speed matters, but patience pays**: Quick execution is important, but avoid impulsive overtrading
- **Adapt quickly**: Market conditions change, so should your strategy
- **Trust your analysis**: If signals align AND align with long-term trend, execute with confidence
- **Protect capital**: One bad trade shouldn't blow up the account, and frequent small trades compound costs
- **Follow market rules**: No short selling in HK/CN, can short in US but be cautious
- **Respect the long-term trend**: Fight the short-term noise, not the long-term trend
- **Quality over frequency**: Fewer high-conviction trades beat many mediocre ones
"""
        
        # Final validation: ensure core_prompt is never None
        if not core_prompt:
            logging.critical(f"🚨 CRITICAL: core_prompt is still None after all fallbacks for user {effective_user_id}!")
            raise ValueError(f"Failed to load core_prompt for user {effective_user_id}")
        
        logging.info(f"📋 Final core_prompt ready: length={len(core_prompt)} chars")
        
        # Now assemble complete prompt with system injections
        from tradingagents.agents.utils.futu_trading_tools import (
            get_futu_account_info,
            get_futu_positions,
            get_futu_quote,
            get_futu_kline,
            get_futu_technical_analysis,
            get_futu_hot_stocks,
            get_futu_hot_news,
            get_futu_orders,
            place_futu_order,
        )
        from tradingagents.agents.utils.akshare_news_tools import (
            get_akshare_news,
            get_akshare_hot_stocks,
        )
        from tradingagents.agents.utils.fundamental_data_tools import (
            get_fundamentals,
            get_balance_sheet,
            get_cashflow,
            get_income_statement,
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
            get_futu_hot_news,
            get_akshare_news,
            get_akshare_hot_stocks,
            get_fundamentals,
            get_balance_sheet,
            get_cashflow,
            get_income_statement,
            place_futu_order,
        ]
        
        # Load workflow documentation (fixed, not customizable)
        # Note: Tool usage is documented within the workflow, no need for separate tool list
        import os
        workflow_file = os.path.join(
            os.path.dirname(__file__),
            'intraday_trader_workflow.txt'
        )
        try:
            with open(workflow_file, 'r', encoding='utf-8') as f:
                workflow_documentation = f.read()
        except Exception as e:
            logging.warning(f"Failed to load workflow documentation: {e}")
            workflow_documentation = "## Standard Execution Workflow\n\nFollow the 5-phase workflow: Information Collection → Analysis & Decision → Execute Trades → Result Verification → Generate Report"
        
        # Generate context information
        context_info = f"""## Current Context

- Market: {market_type}
- Session ID: {session_id}
- Timestamp: {timestamp}
- User ID: {effective_user_id}

## Market Rules
- **US Market**: Supports both long and short positions, T+0 trading (can buy and sell same day)
- **HK Market**: Only supports long positions, short selling NOT supported, T+0 trading allowed
- **CN Market (A-shares)**: Only supports long positions, short selling NOT supported, T+1 trading (stocks bought today cannot be sold same day)

Current market is {market_type}. Please formulate trading strategy according to market rules.
"""
        
        # Trade output format rule
        trade_output_rule = """## ⚠️ CRITICAL - Trade Details Output Rule

If you executed ANY trades (called place_futu_order and it succeeded), you MUST append a formatted trade details section at the VERY END of your final report:

```
## TRADE_DETAILS_JSON
[
  {{"stock": "AAPL", "action": "BUY", "quantity": 100, "price": 150.50, "description": "以$150.50买入100股"}},
  {{"stock": "TSLA", "action": "SELL", "quantity": 50, "price": 200.00, "description": "以$200.00卖出50股"}},
  {{"stock": "00700", "action": "BUY", "quantity": 200, "price": 320.50, "description": "以HK$320.50买入200股腾讯"}}
]
```

**Rules for TRADE_DETAILS_JSON**:
1. Only include trades that were ACTUALLY EXECUTED (place_futu_order was called and returned success)
2. Do NOT include trades that were skipped, failed, or just held
3. Each trade object must have: stock, action (BUY/SELL/SHORT), quantity, price (if available), description (in Chinese)
4. This section must be at the VERY END of your report, after all analysis text
5. If NO trades were executed, do NOT include this section at all
6. The marker must be exactly "## TRADE_DETAILS_JSON" followed by the JSON array
"""
        
        # Assemble complete system message
        # Order: User Strategy (customizable) → Workflow (fixed) → Context (dynamic) → Trade Output Rule (critical)
        # This order ensures LLM first understands the trading philosophy, then the execution process, then current state, and finally the output format
        system_message_parts = [
            core_prompt,
            workflow_documentation,
            context_info,
            trade_output_rule,
            "\nNow execute your trading strategy following the workflow above based on current context."
        ]
        
        # Validate all parts have values
        part_names = ["core_prompt", "workflow_documentation", "context_info", "trade_output_rule", "final_instruction"]
        for i, part in enumerate(system_message_parts):
            if not part:
                logging.error(f"❌ {part_names[i]} is None or empty!")
                raise ValueError(f"System message part '{part_names[i]}' is missing")
        
        logging.info(
            f"📋 System message parts ready: "
            f"core_prompt={len(core_prompt)}, "
            f"workflow={len(workflow_documentation)}, "
            f"context={len(context_info)}, "
            f"trade_rule={len(trade_output_rule)} chars"
        )
        
        # Join all parts
        system_message = "\n\n".join(system_message_parts)
        logging.info(f"📋 Final system_message assembled: {len(system_message)} chars")
        
        # Create prompt template
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_message),
            MessagesPlaceholder(variable_name="messages"),
        ])
        
        # Bind tools to LLM (tools already defined above)
        llm_with_tools = llm.bind_tools(tools)
        
        # Create chain
        chain = prompt | llm_with_tools
        
        # Send agent start event
        try:
            from web.backend.app import manager as ws_manager
            await ws_manager.send_message({
                'type': 'agent_start',
                'timestamp': datetime.utcnow().isoformat(),
                'message': 'Intraday agent started',
                'agent': 'Intraday Trader'
            }, f"intraday_user_{user_id}")
        except Exception:
            pass
        
        # Invoke agent with user_id in config (async)
        try:
            result = await chain.ainvoke(
                {"messages": state.get("messages", [])},
                config={"configurable": {"user_id": effective_user_id}}
            )
            
            # Extract current AI message content (only text, not tool calls)
            current_content = ""
            if hasattr(result, 'content') and result.content:
                # Only get text content, check if it's actual text (not empty)
                content = result.content.strip()
                if content:
                    current_content = content
            
            # Accumulate only the AI's text content to the report
            # Skip if current_content is empty (e.g., when only tool calls without text)
            if current_content:
                if existing_report:
                    accumulated_report = existing_report + "\n\n" + current_content
                else:
                    accumulated_report = current_content
            else:
                # No text content in this turn, keep existing report
                accumulated_report = existing_report
            
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
                        await ws_manager.send_message({
                            'type': 'tool_call',
                            'timestamp': datetime.utcnow().isoformat(),
                            'tool': tool_call.get('name', 'unknown'),
                            'args': tool_call.get('args', {})
                        }, f"intraday_user_{user_id}")
                    except Exception:
                        pass
                
                # Return with accumulated report so far
                return {
                    "messages": [result],
                    "decision_report": accumulated_report,
                }
            else:
                # Agent has finished - parse trades and clean report
                trades_executed, clean_report = _parse_trades_from_response(accumulated_report)
                
                # Log the final report
                logging.info(f"Agent generated final report (length: {len(clean_report)} chars, {len(trades_executed)} trades)")
                
                # Send agent result event
                try:
                    from web.backend.app import manager as ws_manager
                    await ws_manager.send_message({
                        'type': 'agent_result',
                        'timestamp': datetime.utcnow().isoformat(),
                        'message': 'Agent completed analysis',
                        'agent': 'Intraday Trader',
                        'report_length': len(clean_report),
                        'trades_count': len(trades_executed)
                    }, f"intraday_user_{user_id}")
                except Exception:
                    pass
                
                return {
                    "messages": [result],
                    "decision_report": clean_report,
                    "trades_executed": trades_executed,
                }
        
        except Exception as e:
            # 获取详细的错误信息
            import traceback
            error_type = type(e).__name__
            error_msg = str(e)
            error_traceback = traceback.format_exc()
            
            # 构建详细的错误报告
            detailed_error = f"Error in intraday trader: {error_type}: {error_msg}"
            
            # 特殊处理常见错误
            if "null value" in error_msg.lower() and "choices" in error_msg.lower():
                detailed_error += "\n\n可能原因：LLM API 返回了空响应。请检查："
                detailed_error += "\n- API 密钥是否有效"
                detailed_error += "\n- 模型名称是否正确"
                detailed_error += "\n- API 配额是否充足"
                detailed_error += "\n- 网络连接是否正常"
            elif "rate limit" in error_msg.lower():
                detailed_error += "\n\n错误原因：API 请求频率超限，请稍后重试。"
            elif "timeout" in error_msg.lower():
                detailed_error += "\n\n错误原因：API 请求超时，请检查网络连接。"
            elif "authentication" in error_msg.lower() or "unauthorized" in error_msg.lower():
                detailed_error += "\n\n错误原因：API 认证失败，请检查 API 密钥配置。"
            
            # 记录完整的错误信息
            logging.error(f"{detailed_error}\n\nFull traceback:\n{error_traceback}")
            
            from langchain_core.messages import AIMessage
            return {
                "messages": [AIMessage(content=detailed_error)],
                "decision_report": f"## 错误\n\n{detailed_error}\n\n### 技术详情\n\n```\n{error_msg}\n```",
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
        get_futu_hot_news,
        get_futu_orders,
        place_futu_order,
    )
    from tradingagents.agents.utils.akshare_news_tools import (
        get_akshare_news,
        get_akshare_hot_stocks,
    )
    from tradingagents.agents.utils.fundamental_data_tools import (
        get_fundamentals,
        get_balance_sheet,
        get_cashflow,
        get_income_statement,
    )
    
    tools = [
        get_futu_account_info,
        get_futu_positions,
        get_futu_orders,
        get_futu_quote,
        get_futu_kline,
        get_futu_technical_analysis,
        get_futu_hot_stocks,
        get_futu_hot_news,
        get_akshare_news,
        get_akshare_hot_stocks,
        get_fundamentals,
        get_balance_sheet,
        get_cashflow,
        get_income_statement,
        place_futu_order,
    ]
    
    # Create base tool node
    base_tool_node = ToolNode(tools)
    
    # Wrap tool node to add logging (async version)
    async def tool_node_with_logging(state):
        """Tool node wrapper that adds logging (async)"""
        messages = state.get("messages", [])
        last_message = messages[-1] if messages else None
        
        if last_message and hasattr(last_message, 'tool_calls'):
            num_tools = len(last_message.tool_calls)
            tool_names = [tc.get('name', 'unknown') for tc in last_message.tool_calls]
            
            if num_tools > 1:
                logging.info(f"🚀 Executing {num_tools} tools IN PARALLEL: {', '.join(tool_names)}")
            else:
                logging.info(f"Executing {num_tools} tool(s): {', '.join(tool_names)}")
        
        # Execute tools - ToolNode executes them in parallel automatically (async)
        result = await base_tool_node.ainvoke(state)
        
        # Log results
        if 'messages' in result:
            new_messages = result['messages']
            completed_tools = []
            for msg in new_messages:
                if hasattr(msg, 'name'):  # Tool message
                    tool_name = msg.name
                    content = str(msg.content)
                    # Truncate long content for logging
                    if len(content) > 50:
                        content_preview = content[:50] + "..."
                    else:
                        content_preview = content
                    
                    completed_tools.append(tool_name)
                    logging.info(f"✓ Tool {tool_name} completed: {content_preview}")
            
            if len(completed_tools) > 1:
                logging.info(f"✅ All {len(completed_tools)} tools completed in parallel")
        
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
