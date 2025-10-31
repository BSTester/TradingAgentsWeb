# Real-Time Stock Quote Usage Guide

## Overview

The `get_stock_realtime_quote()` function provides real-time stock quotes for A-shares, US stocks, and Hong Kong stocks through the XueQiu (雪球) API interface.

## Function Signature

```python
def get_stock_realtime_quote(symbol: str, token: str = None) -> str
```

## Parameters

- **symbol** (str): Stock symbol in any supported format
  - A-shares: "600000", "000001", "SH600000", "SZ000001"
  - US stocks: "AAPL", "TSLA", "MSFT"
  - HK stocks: "00700", "09988", "00700.HK"

- **token** (str, optional): XueQiu API token (xq_a_token)
  - If not provided, uses akshare's default token
  - Required for reliable access to XueQiu API
  - Can be obtained from XueQiu website cookies

## Usage Examples

### Basic Usage with Token

```python
from tradingagents.dataflows.akshare_stock import get_stock_realtime_quote

# Set your XueQiu token
token = "your_xq_a_token_here"

# Get A-share quote
quote = get_stock_realtime_quote("600000", token=token)
print(quote)

# Get US stock quote
quote = get_stock_realtime_quote("AAPL", token=token)
print(quote)

# Get HK stock quote
quote = get_stock_realtime_quote("00700", token=token)
print(quote)
```

### Usage Without Token

```python
# Uses akshare's default token (may not work reliably)
quote = get_stock_realtime_quote("600000")
print(quote)
```

## Output Format

The function returns a formatted string with two sections:

### 1. Metadata Header (comment lines)
- Stock symbol
- Data source
- Market type
- Retrieval timestamp

### 2. Quote Data (key-value pairs)

**Essential Trading Data:**
- Symbol, Name, Current_Price
- Open, High, Low, Previous_Close
- Volume, Amount
- Change, Change_Percent

**Additional Metrics:**
- Timestamp, Average_Price, Amplitude
- PE_Ratio_TTM, PE_Ratio_Dynamic, PE_Ratio_Static
- PB_Ratio, Market_Cap
- EPS, Net_Asset_Per_Share
- Dividend_TTM, Dividend_Yield_TTM
- 52_Week_High, 52_Week_Low
- YTD_Change, Currency, Exchange

## Example Output

```
# Real-time quote for 600000
# Data source: AKShare - XueQiu (雪球)
# Market: A股市场 (深圳/上海/科创板/创业板/北交所)
# Retrieved: 2025-10-31 15:30:00

Symbol: SH600000
Name: 浦发银行
Current_Price: 11.49
Open: 11.72
High: 11.74
Low: 11.49
Previous_Close: 11.64
Volume: 143534203
Amount: 1657883721.0
Change: -0.15
Change_Percent: -1.29%
Timestamp: 2025-10-31 15:00:00
Average_Price: 11.55
Amplitude: 2.15
PE_Ratio_TTM: 7.833
PB_Ratio: 0.513
Market_Cap: 382684082067.0
EPS: 1.47
Dividend_Yield_TTM: 3.246%
52_Week_High: 14.3644
52_Week_Low: 8.9098
Currency: CNY
Exchange: SH
```

## Getting XueQiu Token

To obtain a XueQiu token:

1. Visit https://xueqiu.com in your browser
2. Log in to your account (or browse as guest)
3. Open browser developer tools (F12)
4. Go to Application/Storage → Cookies → https://xueqiu.com
5. Find the `xq_a_token` cookie value
6. Copy the token value and use it in your code

**Note:** Tokens may expire after some time. If you get authentication errors, obtain a fresh token.

## Error Handling

The function handles various error scenarios:

- **AkShare not installed**: Returns "Error: akshare not installed"
- **Invalid symbol**: Returns "Error: Unable to identify market for symbol {symbol}"
- **API failure**: Returns "Error retrieving real-time quote for {symbol}: {error_message}"
- **No data**: Returns "No real-time data available for {symbol}"

## Supported Markets

- **A-shares (A股)**: Shanghai, Shenzhen, STAR, ChiNext, Beijing Stock Exchange
- **US stocks (美股)**: NASDAQ, NYSE, etc.
- **Hong Kong stocks (港股)**: HKEX

## Symbol Normalization

The function automatically normalizes symbols to XueQiu format:

- A-shares: Adds exchange prefix (SH/SZ/BJ)
  - "600000" → "SH600000"
  - "000001" → "SZ000001"
  
- US stocks: Converts to uppercase
  - "aapl" → "AAPL"
  
- HK stocks: Removes .HK suffix and zero-pads
  - "700" → "00700"
  - "00700.HK" → "00700"

## Integration with TradingAgents

This function can be integrated into the TradingAgents workflow for real-time market data analysis:

```python
# In your agent or analysis code
from tradingagents.dataflows.akshare_stock import get_stock_realtime_quote

def analyze_current_market(symbol: str, token: str):
    # Get real-time quote
    quote_data = get_stock_realtime_quote(symbol, token=token)
    
    # Parse and analyze the data
    # ... your analysis logic here
    
    return analysis_result
```

## Performance Notes

- Single API call per invocation
- Expected response time: < 2 seconds
- No caching implemented (data is always fresh)
- Rate limiting may apply from XueQiu API

## Troubleshooting

**Problem**: Getting "Error: 'data'" or authentication errors

**Solution**: Provide a valid XueQiu token using the `token` parameter

**Problem**: Symbol not found

**Solution**: Verify the symbol format is correct for the market type

**Problem**: Slow response or timeout

**Solution**: Check network connection and XueQiu API availability
