# Futu Trading Tools Date Parameters Update

## Overview

Added `start_date` and `end_date` parameters to K-line and technical analysis tools to support date range filtering.

## Updated Tools

### 1. get_futu_kline

**New Signature:**
```python
def get_futu_kline(
    symbol: str,
    interval: str = "daily",
    start_date: Optional[str] = None,  # NEW
    end_date: Optional[str] = None,    # NEW
    format: str = "json"                # NEW
) -> str
```

**Parameters:**
- `start_date`: Start date (optional, format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
- `end_date`: End date (optional, format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
- `format`: Return format (csv or json), defaults to csv

**Example Usage:**
```python
# Get daily K-line for last month in CSV format (default)
klines_csv = get_futu_kline("AAPL", interval="daily", 
                            start_date="2025-10-04", 
                            end_date="2025-11-03")

# Get 5-minute intraday data in JSON format
klines_json = get_futu_kline("AAPL", interval="5min",
                             start_date="2025-10-04",
                             end_date="2025-11-03",
                             format="json")

# Get weekly data (no date range needed, CSV format by default)
klines_weekly = get_futu_kline("AAPL", interval="weekly")
```

### 2. get_futu_technical_analysis

**New Signature:**
```python
def get_futu_technical_analysis(
    symbol: str,
    interval: str = "daily",
    indicator: str = "macd",
    start_date: Optional[str] = None,  # NEW
    end_date: Optional[str] = None,    # NEW
    format: str = "csv"
) -> str
```

**Parameters:**
- `start_date`: Start date (optional, format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
- `end_date`: End date (optional, format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)

**Example Usage:**
```python
# Get MACD for last month
macd = get_futu_technical_analysis("AAPL", interval="daily", indicator="macd",
                                    start_date="2025-10-04", 
                                    end_date="2025-11-03")

# Get RSI with date range
rsi = get_futu_technical_analysis("AAPL", interval="5min", indicator="rsi",
                                   start_date="2025-10-04",
                                   end_date="2025-11-03", 
                                   format="json")
```

## Data Range Recommendations

### For Intervals < Weekly

**Recommended**: Fetch only last 1 month of data

| Interval | Recommended Range | Reason |
|----------|-------------------|--------|
| 1min | 1 month | High-frequency data, large volume |
| 5min | 1 month | High-frequency data, large volume |
| 15min | 1 month | High-frequency data, large volume |
| 30min | 1 month | High-frequency data, large volume |
| 60min | 1 month | High-frequency data, large volume |
| daily | 1 month | Sufficient for execution decisions |

**Example Date Calculation:**
```python
from datetime import datetime, timedelta

# For trading date 2025-11-03
end_date = "2025-11-03"
start_date = (datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=30)).strftime("%Y-%m-%d")
# Result: start_date = "2025-10-04"
```

### For Weekly and Above

**Flexible**: Can fetch longer historical data

| Interval | Recommended Range | Reason |
|----------|------------------|--------|
| weekly | Flexible | Lower frequency, can fetch more history |
| monthly | Flexible | Lower frequency, can fetch more history |
| quarterly | Flexible | Lower frequency, can fetch more history |
| yearly | Flexible | Lower frequency, can fetch more history |

## Date Format Support

Both parameters support two formats:

1. **Date only**: `YYYY-MM-DD`
   - Example: `"2025-10-04"`
   - Used for daily and higher intervals

2. **Date and time**: `YYYY-MM-DD HH:MM:SS`
   - Example: `"2025-10-04 09:30:00"`
   - Used for intraday intervals (1min, 5min, etc.)

## Implementation Details

### Files Updated

1. **tradingagents/agents/utils/futu_trading_tools.py**
   - Updated `get_futu_kline` tool wrapper
   - Updated `get_futu_technical_analysis` tool wrapper
   - Added parameter documentation and examples

2. **tradingagents/dataflows/futu_trading.py**
   - Updated `get_kline_data` function signature
   - Updated `get_technical_analysis` function signature
   - Added parameter documentation
   - **CRITICAL**: Updated API request params to include start_date and end_date when provided

3. **tradingagents/agents/trader/trading_executor.py**
   - Updated prompt with date parameter instructions
   - Added data range limit guidelines
   - Updated example tool calls with date parameters

4. **docs/TRADING_EXECUTOR_TOOL_LIMITS.md**
   - Added data range limits table
   - Updated example tool calls
   - Added date calculation examples

## Backward Compatibility

✅ **Fully backward compatible**

Both parameters are optional with default value `None`:
- If not provided, tools will return recent data based on interval
- Existing code without date parameters will continue to work

```python
# Old code still works
klines = get_futu_kline("AAPL", interval="daily")

# New code with date range
klines = get_futu_kline("AAPL", interval="daily", 
                        start_date="2025-10-04", 
                        end_date="2025-11-03")
```

## Benefits

1. **Precise Data Control**: Specify exact date range for analysis
2. **Reduced Data Volume**: Fetch only needed data for efficiency
3. **Consistent Analysis**: Ensure K-line and indicators use same date range
4. **Better Performance**: Smaller data sets process faster
5. **Clearer Intent**: Explicit date ranges make code more readable

## Usage in Trading Executor

The Trading Executor prompt now includes:

```
⚠️ DATA RANGE LIMITS (IMPORTANT):
- For intervals < weekly: Fetch ONLY last 1 month of data
- Use start_date and end_date parameters to specify the date range
- K-line and technical indicator date ranges MUST match
```

**Example from prompt:**
```python
# Step 2: Fetch K-line data
get_futu_kline(symbol="AAPL", interval="daily", 
               start_date="2025-10-04", 
               end_date="2025-11-03")

# Step 3: Fetch technical indicators (matching date range)
get_futu_technical_analysis(symbol="AAPL", interval="daily", indicator="rsi",
                            start_date="2025-10-04", 
                            end_date="2025-11-03")
```

## API Request Implementation

### get_kline_data

```python
# Build params dict
params = {
    "symbol": symbol,
    "interval": interval,
    "format": format  # NEW: format parameter
}

# Add optional date parameters if provided
if start_date:
    params["start_date"] = start_date
if end_date:
    params["end_date"] = end_date

# Make API request
response = _make_request(
    method="GET",
    endpoint="/api/kline",
    params=params
)

# For csv format, return response directly
if format == "csv":
    return response

# For json format, handle different response structures
if isinstance(response, list):
    klines = response
elif isinstance(response, dict) and "klines" in response:
    klines = response["klines"]
elif isinstance(response, dict) and "data" in response:
    klines = response["data"]
else:
    klines = []

return klines
```

### get_technical_analysis

```python
# Build params dict
params = {
    "symbol": symbol,
    "interval": interval,
    "indicator": indicator,
    "format": format
}

# Add optional date parameters if provided
if start_date:
    params["start_date"] = start_date
if end_date:
    params["end_date"] = end_date

# Make API request
response = _make_request(
    method="GET",
    endpoint="/api/technical-analysis",
    params=params
)
```

## Testing

To test the new parameters:

```python
from tradingagents.dataflows.futu_trading import get_kline_data, get_technical_analysis

# Test K-line with date range
klines = get_kline_data("AAPL", interval="daily",
                        start_date="2025-10-04",
                        end_date="2025-11-03")
print(f"Fetched {len(klines)} K-lines")

# Test technical analysis with date range
macd = get_technical_analysis("AAPL", interval="daily", indicator="macd",
                              start_date="2025-10-04",
                              end_date="2025-11-03")
print(f"MACD data: {macd}")

# Test without date range (backward compatibility)
klines_no_date = get_kline_data("AAPL", interval="daily")
print(f"Fetched {len(klines_no_date)} K-lines (no date range)")
```

### Verify API Request

Check logs to confirm parameters are sent:
```
INFO: Fetching K-line data for AAPL with interval=daily, start_date=2025-10-04, end_date=2025-11-03
INFO: Fetching technical analysis for AAPL: macd with interval=daily, start_date=2025-10-04, end_date=2025-11-03, format=csv
```

## Related Documentation

- `docs/TRADING_EXECUTOR_TOOL_LIMITS.md` - Tool call limits and recommendations
- `docs/FUTU_TRADING_TOOLS.md` - Complete Futu trading tools documentation
- `tradingagents/dataflows/README_FUTU.md` - Futu dataflow implementation details
