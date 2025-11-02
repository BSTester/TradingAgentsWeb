# Trading Executor Tool Call Limits

## Overview

To prevent infinite loops and excessive API calls, the Trading Executor now enforces strict tool call limits.

## Tool Call Limits

### Global Limits
- **Total tool calls**: 15 maximum across all tools
- **Technical analysis calls**: 5 maximum (get_futu_technical_analysis)

### Per-Tool Limits

| Tool | Max Calls | Required | Notes |
|------|-----------|----------|-------|
| `get_futu_quote` | 1 | ✅ Yes | Get current market price |
| `get_futu_kline` | 1 | ✅ Yes | Choose ONE interval only |
| `get_futu_technical_analysis` | 5 | ✅ Yes | Select 5 most important indicators |
| `get_futu_account_info` | 1 | ✅ Yes | Check account balance |
| `get_futu_positions` | 1 | ✅ Yes | Check current holdings |
| `get_futu_orders` | 2 | ⚠️ Optional | Once for pending, once for verification |
| `get_futu_hot_stocks` | 1 | ❌ No | Optional market context |
| `get_futu_hot_news` | 1 | ❌ No | Only if volatility detected |
| `place_futu_order` | 1 | ⚠️ Conditional | Only if executing trade |

## Recommended Tool Call Sequence

### Typical Execution (10-12 calls)

```python
# Calculate date range (last 1 month for intervals < weekly)
from datetime import datetime, timedelta
end_date = "2025-11-03"  # Current trading date
start_date = (datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=30)).strftime("%Y-%m-%d")

# Tool calls
1. get_futu_quote(stock_code="AAPL")                    # 1 call
2. get_futu_kline(symbol="AAPL", interval="daily", start_date=start_date, end_date=end_date)  # 1 call
3. get_futu_technical_analysis(symbol="AAPL", interval="daily", indicator="rsi", start_date=start_date, end_date=end_date)    # 1 call
4. get_futu_technical_analysis(symbol="AAPL", interval="daily", indicator="macd", start_date=start_date, end_date=end_date)   # 1 call
5. get_futu_technical_analysis(symbol="AAPL", interval="daily", indicator="boll", start_date=start_date, end_date=end_date)   # 1 call
6. get_futu_technical_analysis(symbol="AAPL", interval="daily", indicator="atr", start_date=start_date, end_date=end_date)    # 1 call
7. get_futu_technical_analysis(symbol="AAPL", interval="daily", indicator="close_50_sma", start_date=start_date, end_date=end_date)  # 1 call
8. get_futu_account_info(market_type="US")              # 1 call
9. get_futu_positions(market_type="US")                 # 1 call
10. get_futu_orders(market_type="US", filter_status=2)  # 1 call (optional)
11. place_futu_order(...)                               # 1 call (if executing)
12. get_futu_orders(market_type="US", filter_status=0)  # 1 call (verify)

Total: 10-12 calls
```

### Data Range Limits

**IMPORTANT**: For intervals below weekly, only fetch last 1 month of data:

| Interval | Max Data Range | Reason |
|----------|----------------|--------|
| 1min, 5min, 15min, 30min, 60min | 1 month | High-frequency data, large volume |
| daily | 1 month | Recommended for execution decisions |
| weekly, monthly, quarterly, yearly | Flexible | Lower frequency, can fetch more history |

**Example Date Calculation**:
```python
# For daily interval on 2025-11-03
start_date = "2025-10-04"  # 30 days before
end_date = "2025-11-03"    # Current date
```

## Technical Indicator Selection

### Available Indicators

Each indicator may return multiple columns:

- **close_50_sma**: 50-period Simple Moving Average (medium-term trend)
- **close_200_sma**: 200-period Simple Moving Average (long-term trend)
- **close_10_ema**: 10-period Exponential Moving Average (short-term momentum)
- **macd**: MACD (returns 3 columns: MACD line, Signal line, Histogram)
- **rsi**: Relative Strength Index (overbought/oversold, 0-100)
- **boll**: Bollinger Bands (returns 3 columns: Upper band, Middle band, Lower band)
- **atr**: Average True Range (volatility measurement)
- **vwma**: Volume Weighted Moving Average (price-volume trend)

### Recommended Indicator Sets (Choose ONE set of 5)

**Set A: Momentum Trading**
- `rsi` - Relative Strength Index (overbought/oversold)
- `macd` - MACD (line, signal, histogram)
- `boll` - Bollinger Bands (upper, middle, lower)
- `atr` - Average True Range (volatility)
- `close_10_ema` - 10-period EMA (short-term momentum)

**Set B: Trend Following**
- `close_50_sma` - 50-period SMA (medium-term trend)
- `close_200_sma` - 200-period SMA (long-term trend)
- `macd` - MACD (line, signal, histogram)
- `rsi` - RSI (overbought/oversold)
- `atr` - Average True Range (volatility)

**Set C: Volatility Trading**
- `boll` - Bollinger Bands (upper, middle, lower)
- `atr` - Average True Range (volatility)
- `rsi` - RSI (overbought/oversold)
- `macd` - MACD (line, signal, histogram)
- `vwma` - Volume Weighted MA (volume-price trend)

**Set D: Volume Analysis**
- `vwma` - Volume Weighted MA (volume-price trend)
- `close_10_ema` - 10-period EMA (short-term momentum)
- `rsi` - RSI (overbought/oversold)
- `macd` - MACD (line, signal, histogram)
- `atr` - Average True Range (volatility)

## Enforcement Mechanism

### 1. Prompt-Level Guidance (Soft Limits)
The system prompt provides recommended tool call limits to guide the LLM toward efficient execution. These are **recommendations**, not hard constraints.

### 2. Monitoring and Logging (No Hard Enforcement)
```python
# Count tool calls in message history for monitoring
tool_call_count = 0
technical_analysis_count = 0

for msg in state["messages"]:
    if hasattr(msg, "tool_calls") and msg.tool_calls:
        for tc in msg.tool_calls:
            tool_call_count += 1
            if tool_name == "get_futu_technical_analysis":
                technical_analysis_count += 1

# Soft warnings (not enforcing, just logging)
if tool_call_count >= 15:
    print(f"[WARNING] Tool call count has reached recommended limit (15).")
```

**Note**: The system does NOT force-stop execution when limits are reached. The LLM may slightly exceed recommendations if necessary for proper analysis.

### 3. Debug Logging
All tool calls are logged with counts:
```
[DEBUG] Tool call statistics:
  - Total tool calls so far: 8
  - Technical analysis calls: 3

[WARNING] Tool call count (16) has reached recommended limit (15). Agent should generate final report soon.
```

## Benefits

1. **Encourages Efficiency**: Soft limits guide the LLM toward efficient tool usage
2. **Reduces API Costs**: Recommendations help minimize expensive API calls
3. **Faster Execution**: Guidance promotes focused data collection
4. **Better Focus**: Agent is encouraged to select most important indicators
5. **Flexibility**: Agent can exceed limits if necessary for proper analysis
6. **Monitoring**: Debug logs help identify inefficient tool usage patterns

## Error Handling

### If Recommended Limit Exceeded
- System logs warning message (no forced stop)
- Agent continues execution if needed
- Debug logs show actual vs recommended counts
- Agent should aim to complete analysis efficiently

### If Tool Call Fails
- DO NOT retry the same call (per prompt instructions)
- Analyze error in final report
- Proceed with available data
- System continues normally (no forced termination)

## Testing

To test tool call limits:

```bash
# Run CLI with debug logging enabled
python cli/main.py

# Watch for debug output:
# [DEBUG] Tool call statistics:
#   - Total tool calls so far: X
#   - Technical analysis calls: Y
```

## Related Files

- `tradingagents/agents/trader/trading_executor.py` - Main implementation
- `tradingagents/graph/conditional_logic.py` - Loop control logic
- `tradingagents/graph/setup.py` - Graph setup with executor node

## Future Improvements

1. Make limits configurable via config file
2. Add per-tool call tracking and warnings
3. Implement adaptive limits based on market conditions
4. Add tool call budget visualization in CLI
