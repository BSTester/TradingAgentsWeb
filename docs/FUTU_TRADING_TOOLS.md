# Futu Trading Tools Reference

## Overview

The trading executor has access to 10 Futu trading tools for comprehensive market analysis and trade execution.

## Tool Categories

### 1. Account Management (2 tools)

#### `get_futu_account_info`
Get account information for a specific market.

**Parameters:**
- `market_type` (str): Market type (US/HK/CN)

**Returns:**
- Net asset value
- Available cash
- Position value
- Profit/loss information

**Example:**
```python
get_futu_account_info(market_type="US")
```

#### `get_futu_positions`
Get all current positions for a specific market.

**Parameters:**
- `market_type` (str): Market type (US/HK/CN)

**Returns:**
- List of holdings with:
  - Stock code
  - Quantity
  - Cost price
  - Current price
  - Profit/loss

**Example:**
```python
get_futu_positions(market_type="US")
```

---

### 2. Market Data (4 tools)

#### `get_futu_quote`
Get real-time quote for a specific stock (auto-detects market type).

**Parameters:**
- `stock_code` (str): Stock symbol (e.g., AAPL, 00700, 600519)

**Returns:**
- Current price
- Open, high, low
- Volume
- Change percentage

**Example:**
```python
get_futu_quote(stock_code="AAPL")
```

#### `get_futu_kline`
Get K-line (candlestick) data for a stock (auto-detects market type).

**Parameters:**
- `symbol` (str): Stock symbol
- `interval` (str): Time interval
  - **Intraday**: `1min`, `5min`, `15min`, `30min`, `60min`
  - **Daily+**: `daily`, `weekly`, `monthly`
  - **Long-term**: `quarterly`, `yearly`

**Returns:**
- Historical OHLCV data with timestamps in market local time

**Timezone handling:**
- US stocks: Eastern Time (EST/EDT, UTC-5/-4, auto-handles DST)
- HK stocks: Hong Kong Time (HKT, UTC+8)
- A stocks: China Standard Time (CST, UTC+8)

**Example:**
```python
# Get 5-minute intraday data
get_futu_kline(symbol="AAPL", interval="5min")

# Get daily data
get_futu_kline(symbol="AAPL", interval="daily")
```

#### `get_futu_hot_stocks`
Get list of hot/trending stocks.

**Parameters:**
- `market_type` (str): Market type (US/HK/CN), defaults to US
- `count` (int): Number of stocks to return, defaults to 10

**Returns:**
- List of hot stocks with:
  - Stock code
  - Name
  - Current price
  - Change percentage

**Example:**
```python
get_futu_hot_stocks(market_type="US", count=5)
```

#### `get_futu_hot_news`
Get hot/trending news articles.

**Parameters:**
- `lang` (str): Language code
  - `zh-cn`: Simplified Chinese
  - `zh-hk`: Traditional Chinese
  - `en-us`: English

**Returns:**
- List of news articles with:
  - Title
  - URL
  - Source
  - Publish time

**Example:**
```python
get_futu_hot_news(lang="zh-cn")
```

---

### 3. Technical Analysis (1 tool)

#### `get_futu_technical_analysis`
Get technical analysis indicators (returns time series data, auto-detects market type).

**Parameters:**
- `symbol` (str): Stock symbol
- `interval` (str): Time interval (same as get_futu_kline)
  - **Intraday**: `1min`, `5min`, `15min`, `30min`, `60min`
  - **Daily+**: `daily`, `weekly`, `monthly`
  - **Long-term**: `quarterly`, `yearly`
- `indicator` (str): Technical indicator name
  - `close_50_sma`: 50-period Simple Moving Average
  - `close_200_sma`: 200-period Simple Moving Average
  - `close_10_ema`: 10-period Exponential Moving Average
  - `macd`: MACD (returns MACD, MACD_Signal, MACD_Hist)
  - `rsi`: Relative Strength Index
  - `boll`: Bollinger Bands (returns Boll_Upper, Boll_Middle, Boll_Lower)
  - `atr`: Average True Range
  - `vwma`: Volume Weighted Moving Average
- `format` (str): Return format (`json` or `csv`), defaults to `csv`

**Return formats:**
- `csv` (default): CSV format with meta information and data string
- `json`: Structured JSON data suitable for plotting charts

**Example:**
```python
# Get MACD indicator in CSV format (default)
get_futu_technical_analysis(symbol="AAPL", interval="daily", indicator="macd")

# Get RSI in JSON format
get_futu_technical_analysis(symbol="AAPL", interval="5min", indicator="rsi", format="json")

# Get Bollinger Bands
get_futu_technical_analysis(symbol="AAPL", interval="60min", indicator="boll")
```

---

### 4. Order Management (3 tools)

#### `place_futu_order`
Place a buy or sell order (auto-detects market type).

**Parameters:**
- `stock_code` (str): Stock symbol
- `side` (str): Order side (`BUY` or `SELL`)
- `quantity` (int): Number of shares
- `price` (float, optional): Limit price (required for LIMIT orders)
- `order_type` (str): Order type (`LIMIT` or `MARKET`), defaults to `LIMIT`

**Returns:**
- Success status
- Message
- Order ID (if successful)

**Example:**
```python
# Place limit buy order
place_futu_order(stock_code="AAPL", side="BUY", quantity=10, price=180.50)

# Place market sell order
place_futu_order(stock_code="AAPL", side="SELL", quantity=10, order_type="MARKET")
```

#### `get_futu_orders`
Query order history and status.

**Parameters:**
- `market_type` (str): Market type (US/HK/CN)
- `filter_status` (int): Filter by status
  - `0`: All orders
  - `1`: Filled orders
  - `2`: Pending orders
  - `3`: Cancelled orders

**Returns:**
- List of orders with:
  - Order ID
  - Stock code
  - Side (BUY/SELL)
  - Quantity
  - Price
  - Status
  - Timestamps

**Example:**
```python
# Get all orders
get_futu_orders(market_type="US")

# Get only filled orders
get_futu_orders(market_type="US", filter_status=1)
```

#### `cancel_futu_order`
Cancel a pending order (auto-detects market type).

**Parameters:**
- `order_id` (str): Order ID to cancel
- `stock_code` (str): Stock code (used for auto-detecting market type)

**Returns:**
- Success status
- Message

**Note:** Only pending orders can be cancelled. Filled or already cancelled orders cannot be cancelled.

**Example:**
```python
cancel_futu_order(order_id="123456789", stock_code="AAPL")
```

---

## Tool Usage in Trading Executor

All 10 tools are available to the trading executor agent:

```python
tools = [
    get_futu_account_info,      # 1. Account info
    get_futu_positions,          # 2. Current positions
    get_futu_quote,              # 3. Real-time quote
    place_futu_order,            # 4. Place order
    cancel_futu_order,           # 5. Cancel order
    get_futu_orders,             # 6. Query orders
    get_futu_kline,              # 7. K-line data
    get_futu_hot_stocks,         # 8. Hot stocks
    get_futu_hot_news,           # 9. Hot news
    get_futu_technical_analysis  # 10. Technical indicators
]
```

## Recommended Workflow

### Pre-Execution Analysis
1. `get_futu_quote` - Get current price
2. `get_futu_kline` - Get price history (prefer 5min/15min intraday)
3. `get_futu_technical_analysis` - Get MACD, RSI, Bollinger Bands
4. `get_futu_hot_news` - Check for market-moving news (if needed)

### Account Verification
5. `get_futu_account_info` - Check available cash
6. `get_futu_positions` - Check current holdings
7. `get_futu_orders` - Check pending orders (filter_status=2)

### Order Execution
8. `place_futu_order` - Place buy/sell order
9. `get_futu_orders` - Verify order status (filter_status=0)

### Post-Execution (if needed)
10. `cancel_futu_order` - Cancel unfilled orders
11. `get_futu_positions` - Confirm position changes

## Market Type Auto-Detection

Tools with `stock_code` or `symbol` parameters automatically detect market type:
- 5-digit numbers (e.g., 00700) → HK stock
- 6-digit numbers (e.g., 600519) → CN stock
- Contains letters (e.g., AAPL) → US stock
- Explicit suffix (.HK, .SH, .SZ) → Corresponding market

Tools with `market_type` parameter require explicit market specification:
- `get_futu_account_info`
- `get_futu_positions`
- `get_futu_orders`

## Error Handling

All tools return error messages in case of failure:
```json
{
  "error": "Error description",
  "details": "Additional error details"
}
```

Common errors:
- Insufficient funds (buy orders)
- Insufficient shares (sell orders)
- Invalid stock code
- Market closed
- Order not found (cancel operations)
- API connection issues
