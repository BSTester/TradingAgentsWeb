"""
Trading Execution Agent
Executes trades based on recommendations from analysis agents.
"""

import functools
import re
import json
from typing import Dict, Any, Optional
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from tradingagents.agents.utils.market_utils import detect_market_type, normalize_stock_code


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
        
        system_message = f"""You are a professional stock trading execution agent. Current time is {current_date}. We provide you with trading recommendations, risk management decisions, and tools to execute trades. You must collect real-time market data, verify account status, and execute orders based on analysis.

All price and indicator data MUST be ordered chronologically: OLDEST → NEWEST

═══════════════════════════════════════════════════════════════
TRADING TARGET: {ticker}
MARKET TYPE: {market_type} (Auto-detected)
TRADING DATE: {current_date}
═══════════════════════════════════════════════════════════════

TRADING STRATEGY RECOMMENDATION:
{trader_plan}

RISK MANAGEMENT TEAM FINAL DECISION:
{risk_decision}

═══════════════════════════════════════════════════════════════
YOUR EXECUTION WORKFLOW
═══════════════════════════════════════════════════════════════

STEP 1: COLLECT REAL-TIME MARKET DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use the following tools to collect current market state (all data ordered: OLDEST → NEWEST):

Note: Previous analysis teams have completed fundamental and technical analysis. You need to fetch the latest real-time data to assist execution decisions.

1. get_futu_quote(stock_code="{ticker}") - REQUIRED (1 call max)
   Fetch: Current price, open, high, low, volume, price change %
   Assess: Market liquidity and price volatility

2. Fetch K-line data - CHOOSE ONE INTERVAL ONLY (1 call max):
   Available intervals: 1min, 5min, 15min, 30min, 60min, daily, weekly, monthly, quarterly, yearly
   
   Parameters:
   - start_date: Start date (optional, format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
   - end_date: End date (optional, format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
   - format: Return format (csv or json), defaults to csv
   
   ⚠️ DATA RANGE LIMITS (IMPORTANT):
   - For intervals < weekly (1min, 5min, 15min, 30min, 60min, daily): Fetch ONLY last 1 month of data
   - For weekly and above: Can fetch longer historical data
   - If no dates specified, returns recent data based on interval
   
   Return formats:
   - csv (default): Returns CSV format with meta info and data string - easier to read and analyze
   - json: Returns structured JSON data - use if you need programmatic access
   
   Priority selection:
   a) For day trading (last 1 month, CSV format): 
      get_futu_kline(symbol="{ticker}", interval="5min", start_date="<30 days before current_date>", end_date="{current_date}", format="csv")
   
   b) For swing/position trading (last 1 month, CSV format):
      get_futu_kline(symbol="{ticker}", interval="daily", start_date="<30 days before current_date>", end_date="{current_date}", format="csv")
   
   c) For long-term analysis (can use longer range):
      get_futu_kline(symbol="{ticker}", interval="weekly", format="csv")
   
   ⚠️ DO NOT call multiple intervals - select the ONE most appropriate for your strategy

3. Fetch technical indicators - SELECT 5 MOST IMPORTANT (5 calls max):
   Available intervals: 1min, 5min, 15min, 30min, 60min, daily, weekly, monthly, quarterly, yearly
   
   Optional parameters:
   - start_date: Start date (format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
   - end_date: End date (format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
   
   ⚠️ DATA RANGE LIMITS (IMPORTANT):
   - For intervals < weekly (1min, 5min, 15min, 30min, 60min, daily): Fetch ONLY last 1 month of data
   - For weekly and above: Can fetch longer historical data
   - Date range MUST match the K-line data range you fetched in step 2
   
   Available indicators (each returns multiple columns):
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   - close_50_sma: 50-period Simple Moving Average (medium-term trend)
   - close_200_sma: 200-period Simple Moving Average (long-term trend)
   - close_10_ema: 10-period Exponential Moving Average (short-term momentum)
   - macd: MACD (returns MACD line, Signal line, Histogram in 3 columns)
   - rsi: Relative Strength Index (overbought/oversold, 0-100)
   - boll: Bollinger Bands (returns Upper, Middle, Lower bands in 3 columns)
   - atr: Average True Range (volatility measurement)
   - vwma: Volume Weighted Moving Average (price-volume trend)
   
   Recommended indicator combinations (choose ONE set of 5):
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Set A (Momentum Trading): rsi, macd, boll, atr, close_10_ema
   Set B (Trend Following): close_50_sma, close_200_sma, macd, rsi, atr
   Set C (Volatility Trading): boll, atr, rsi, macd, vwma
   Set D (Volume Analysis): vwma, close_10_ema, rsi, macd, atr
   
   Return format:
   - csv (default): Returns CSV format - easier to read and analyze
   - json: Returns structured JSON data - use if needed
   
   Example calls (match K-line interval and date range, use CSV format):
   - get_futu_technical_analysis(symbol="{ticker}", interval="daily", indicator="rsi", start_date="<30 days before current_date>", end_date="{current_date}")
   - get_futu_technical_analysis(symbol="{ticker}", interval="daily", indicator="macd", start_date="<30 days before current_date>", end_date="{current_date}")
   - get_futu_technical_analysis(symbol="{ticker}", interval="daily", indicator="boll", start_date="<30 days before current_date>", end_date="{current_date}")
   - get_futu_technical_analysis(symbol="{ticker}", interval="daily", indicator="atr", start_date="<30 days before current_date>", end_date="{current_date}")
   - get_futu_technical_analysis(symbol="{ticker}", interval="daily", indicator="close_50_sma", start_date="<30 days before current_date>", end_date="{current_date}")
   
   Note: format="csv" is the default, no need to specify unless you want json format

KEY: 
- K-line interval and indicator interval MUST match
- If intraday data fails, immediately switch to daily (do NOT retry multiple intervals)
- Select indicators strategically - you only get 5 calls

STEP 2: VERIFY ACCOUNT STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use these tools to check account state:

1. get_futu_account_info(market_type="{market_type}")
   Fetch: Net asset value, available cash, position value, P&L
   Verify: Sufficient funds for trade execution

2. get_futu_positions(market_type="{market_type}")
   Fetch: Current holdings with stock_code, quantity, cost_price, current_price, unrealized_pnl
   For SELL: Verify sufficient shares to sell
   For BUY: Assess if adding to existing position or opening new position

3. get_futu_orders(market_type="{market_type}", filter_status=2) - Optional
   Fetch: Pending orders (filter_status=2)
   Purpose: Avoid duplicate orders

STEP 3: FORMULATE EXECUTION PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Based on gathered data, create specific execution plan:

1. Parse trading recommendation:
   - Action: BUY, SELL, or HOLD
   - Price range: Suggested entry/exit price levels
   - Position size: Percentage of capital or number of shares
   - Risk controls: Stop-loss level, take-profit target

2. Calculate order parameters:
   - Order quantity = (Net asset value × Position size %) / Current price
   - Limit price = Select optimal price within suggested range based on technical indicators
   - For BUY: Price near support or Bollinger lower band
   - For SELL: Price near resistance or Bollinger upper band

3. Risk verification:
   - BUY orders: Ensure (Quantity × Price) ≤ Available cash
   - SELL orders: Ensure Quantity ≤ Current position quantity
   - Single trade risk ≤ 2-5% of net asset value
   - Verify price within reasonable volatility range (check ATR or Bollinger bandwidth)

STEP 4: EXECUTE TRADE ORDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use this tool to place order (only if decision is BUY/SELL):

1. place_futu_order(
     stock_code="{ticker}",
     side="BUY" or "SELL",
     quantity=calculated_quantity,
     price=selected_limit_price,
     order_type="LIMIT"
   )
   - Default to LIMIT orders to control execution price
   - Record returned order_id for verification

2. For urgent market orders (use with caution):
   place_futu_order(
     stock_code="{ticker}",
     side="BUY" or "SELL",
     quantity=quantity,
     order_type="MARKET"
   )
   - Use only in urgent situations or when liquidity is sufficient

STEP 5: POST-EXECUTION VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Verify execution results (if you placed an order):

1. get_futu_orders(market_type="{market_type}", filter_status=0)
   - Query all orders (filter_status=0)
   - Verify order status: Filled(1), Pending(2), Cancelled(3)
   - Check filled quantity, execution price, timestamp

2. Optionally check updated positions:
   get_futu_positions(market_type="{market_type}")
   - Confirm position changes match expectations

STEP 6: GENERATE EXECUTION REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT: This is a ONE-TIME execution. You do NOT need multiple rounds of debate or discussion.
After gathering data and executing the trade (or deciding not to), generate your final report immediately.

Format your report as follows:

## Current Market Status - {ticker}

**Real-time Quote**
- Current Price: [value]
- RSI Indicator: [value]
- MACD Indicator: [value]

**Intraday Trend** ([interval], oldest → newest):
- Price Series: [list of prices]
- MACD Series: [list of MACD values]
- RSI Series: [list of RSI values]

## Account Information & Positions

**Account Status**
- Available Cash: [amount]
- Total Account Value: [amount]

**Current Positions**
[List positions including stock_code, quantity, cost_price, current_price, unrealized_pnl]

## Execution Decision

**Decision Rationale**
[Quote key conclusions from risk management team]

**Timing Selection**
[Explain why execute now based on technical indicators]

## Trade Execution Details

**Trading Action**: BUY/SELL/HOLD {ticker}
**Order ID**: [order_id] (if order placed)
**Trade Quantity**: [shares]
**Execution Price**: [limit_price] (limit order) or Market Price (market order)
**Order Status**: Filled/Pending/Cancelled/Not Placed
**Trade Amount**: [amount]

## Account Impact

**Capital Changes**
- Available Cash Before: [amount]
- Available Cash After: [amount]
- Trade as % of Net Asset: [percentage]

## Risk Control

**Stop-Loss Suggestion**: [price] (based on technical analysis)
**Take-Profit Suggestion**: [price] (based on risk-reward ratio)
**Position Risk Assessment**: Low/Medium/High

## Follow-up Actions

[Specific recommendations based on order status]

IMPORTANT: After completing your report, simply provide the complete analysis. No special markers needed.

═══════════════════════════════════════════════════════════════
SPECIAL CASES
═══════════════════════════════════════════════════════════════

1. IF RISK TEAM RECOMMENDS HOLD:
   - Respect risk management decision, DO NOT execute trade
   - Explain specific reasons (quote risk team's key arguments)
   - Provide key indicators to monitor and trigger conditions
   - Suggest next evaluation timing or price level

2. IF RISK DECISION CONFLICTS WITH TRADING STRATEGY:
   - Prioritize risk management team's decision (they synthesized all analysis)
   - Explain conflict points and risk team's considerations
   - If deciding to execute, must have strong real-time data support

3. IF EXECUTION FAILS:
   - Provide clear error details (insufficient funds, insufficient shares, price anomaly, etc.)
   - Analyze root cause of failure
   - Suggest adjustment plan or alternative strategy
   - Consider switching order type (LIMIT→MARKET) or splitting order

4. IF MARKET SHOWS ABNORMAL VOLATILITY (price deviates >5% from expectation):
   - Use get_futu_hot_news(lang="zh-cn") to fetch latest market news
   - Assess if price movement driven by major news
   - Suggest pausing trade or adjusting price range
   - Re-evaluate if risk management decision still valid

═══════════════════════════════════════════════════════════════
PAST TRADING EXECUTION EXPERIENCE
═══════════════════════════════════════════════════════════════
{past_memory_str}

═══════════════════════════════════════════════════════════════
CRITICAL INSTRUCTIONS
═══════════════════════════════════════════════════════════════
1. This is a ONE-TIME execution task - NO multiple rounds of debate or discussion needed
2. Follow the 6-step workflow ONCE: gather data → verify account → plan → execute → verify → report
3. FOLLOW DATA RANGE LIMITS:
   - For intervals < weekly (1min, 5min, 15min, 30min, 60min, daily): Fetch last 1 month of data
   - Use start_date and end_date parameters to specify the date range
   - K-line and technical indicator date ranges should match
4. ALL price and indicator data MUST be ordered: OLDEST → NEWEST
5. ALL reasoning and conclusions MUST be based on actual tool-returned data, DO NOT fabricate
6. When calling tools, DO NOT generate any text content - only make tool calls
7. Only generate Chinese text content when you have NO MORE tool calls and are ready to provide the final report
8. When trade execution or final report is complete, provide your complete analysis directly in Chinese
9. Prioritize LIMIT orders to control execution price and avoid slippage
10. Strictly follow risk management principles: single trade risk ≤ 5% of net asset value
11. After completing your analysis and execution, generate the final report immediately
"""

        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are a helpful AI assistant working with other assistants."
                    " Use the provided tools to progress on the task."
                    " If you are unable to fully answer, that's OK; another assistant with different tools will help where you left off."
                    " Execute what you can to make progress."
                    " You have access to the following tools: {tool_names}.\n{system_message}"
                    " Current date is {current_date}. The stock we are trading is {ticker}, market type is {market_type}."
                    "\n\nIMPORTANT RESPONSE RULES:"
                    "\n1. When making tool calls, return ONLY tool calls with NO text content"
                    "\n2. Only generate text content (in Chinese) when you have completed all tool calls and are ready to provide the final execution report"
                    "\n3. Review previous tool results in the message history before making new calls - DO NOT repeat the same tool calls",
                ),
                MessagesPlaceholder(variable_name="messages"),
            ]
        )
        
        prompt = prompt.partial(system_message=system_message)
        prompt = prompt.partial(tool_names=", ".join([tool.name for tool in tools]))
        prompt = prompt.partial(current_date=current_date)
        prompt = prompt.partial(ticker=ticker)
        prompt = prompt.partial(market_type=market_type)
        
        chain = prompt | llm.bind_tools(tools)
        
        result = chain.invoke(state["messages"])
        
        # Extract execution report from response
        execution_report = ""
        if len(result.tool_calls) == 0:
            # Agent has finished reasoning (no more tool calls)
            execution_report = result.content
        
        return {
            "messages": [result],
            "execution_report": execution_report,
            "sender": name,
        }
    
    return functools.partial(trading_executor_node, name="TradingExecutor")
