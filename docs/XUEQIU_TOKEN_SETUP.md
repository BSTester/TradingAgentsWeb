# XueQiu (雪球) Token Setup Guide

## Overview

Some data providers in TradingAgentsWeb use the XueQiu (雪球) API for real-time stock quotes and fundamental data. XueQiu requires authentication via a token (`xq_a_token`).

## Affected Features

The following features require a XueQiu token:

1. **Real-time Stock Quotes** (`get_stock_realtime_quote`)
   - A-shares, US stocks, and Hong Kong stocks
   - Located in: `tradingagents/dataflows/akshare_stock.py`

2. **Fundamental Data** (fallback source)
   - A-shares: `stock_individual_basic_info_xq`
   - US stocks: `stock_individual_basic_info_us_xq`
   - HK stocks: `stock_individual_basic_info_hk_xq`
   - Located in: `tradingagents/dataflows/akshare_fundamentals.py`

## How to Get Your XueQiu Token

### Method 1: Browser Developer Tools (Recommended)

1. **Visit XueQiu website**
   - Go to https://xueqiu.com
   - Log in to your account (or browse as guest)

2. **Open Developer Tools**
   - Press `F12` or right-click and select "Inspect"
   - Go to the "Application" or "Storage" tab

3. **Find the Cookie**
   - Navigate to: Cookies → https://xueqiu.com
   - Look for the cookie named `xq_a_token`
   - Copy its value (a long alphanumeric string)

### Method 2: Network Tab

1. Visit https://xueqiu.com and log in
2. Open Developer Tools (F12) → Network tab
3. Refresh the page
4. Click on any request to xueqiu.com
5. Look at the Request Headers
6. Find the `Cookie` header and extract the `xq_a_token` value

## Setting Up the Token

### Option 1: Environment Variable (Recommended)

Set the `XUEQIU_TOKEN` environment variable:

**Linux/Mac:**
```bash
export XUEQIU_TOKEN="your_token_here"
```

**Windows (CMD):**
```cmd
set XUEQIU_TOKEN=your_token_here
```

**Windows (PowerShell):**
```powershell
$env:XUEQIU_TOKEN="your_token_here"
```

**Docker (.env file):**
```env
XUEQIU_TOKEN=your_token_here
```

### Token Usage

The token is automatically read from the `XUEQIU_TOKEN` environment variable when calling XueQiu-related functions. You don't need to pass it as a parameter.

```python
from tradingagents.dataflows.akshare_stock import get_stock_realtime_quote
from tradingagents.dataflows.akshare_fundamentals import get_fundamentals

# Real-time quote (uses XUEQIU_TOKEN from environment)
quote = get_stock_realtime_quote("600000")

# Fundamentals (uses XUEQIU_TOKEN for fallback sources)
fundamentals = get_fundamentals("600000")
```

## Token Validity

- XueQiu tokens typically expire after a period of inactivity
- If you get authentication errors, try getting a fresh token
- The token is tied to your browser session

## Fallback Behavior

If no token is provided:
- The functions will attempt to use akshare's default token (may not work)
- For fundamentals, the system will try other data sources first (EastMoney for A-shares)
- Real-time quotes will return an error if the token is invalid

## Testing Your Setup

Run the test script to verify your token works:

```bash
python test_xueqiu_with_env.py
```

## Troubleshooting

### Error: "遇到错误，请刷新页面或者重新登录帐号后再试"

This means your token is invalid or expired. Get a fresh token from xueqiu.com.

### Error: "KeyError: 'data'"

The API response structure is unexpected. This usually means:
- Token is invalid
- XueQiu API has changed
- Network/firewall issues

### Token Not Being Used

Check that:
1. Environment variable is set correctly: `echo $XUEQIU_TOKEN` (Linux/Mac) or `echo %XUEQIU_TOKEN%` (Windows)
2. You're running the script in the same shell where you set the variable
3. For Docker, the .env file is in the correct location and loaded

## Security Notes

- **Never commit your token to version control**
- Add `.env` to your `.gitignore` file
- Treat the token like a password
- Rotate tokens periodically for security

## Alternative Data Sources

If you don't want to use XueQiu:

- **A-shares**: EastMoney (东方财富) is used as the primary source
- **US stocks**: Consider using yfinance or other providers
- **HK stocks**: Consider using yfinance or other providers

The system will automatically fall back to other sources when XueQiu is unavailable.
