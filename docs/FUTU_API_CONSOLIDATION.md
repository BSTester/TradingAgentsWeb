# Futu API Implementation Consolidation

## Overview

This document describes the consolidation of Futu API implementation to eliminate code duplication and improve configuration management.

## Changes Made

### 1. Removed Duplicate Implementation

**Deleted:** `web/backend/services/futu_api_client.py`

This file contained a duplicate async wrapper implementation that has been replaced with a cleaner solution.

### 2. Updated Core Implementation

**Modified:** `tradingagents/dataflows/futu_trading.py`

All functions now support user-specific configuration through an optional `user_id` parameter:

- `get_account_info(market_type, user_id=None)`
- `get_positions(market_type, user_id=None)`
- `get_orders(market_type, filter_status=0, user_id=None)`
- `get_quote(stock_code, user_id=None)`
- `get_kline_data(symbol, interval="daily", start_date=None, end_date=None, format="csv", user_id=None)`
- `get_hot_stocks(market_type="US", count=10, user_id=None)`
- `place_order(stock_code, side, quantity, price=None, order_type="LIMIT", user_id=None)`
- `cancel_order(order_id, stock_code, user_id=None)`
- `get_technical_analysis(symbol, interval="daily", indicator="macd", start_date=None, end_date=None, format="csv", user_id=None)`
- `get_hot_news(lang="zh-cn", user_id=None)`

### 3. Configuration Priority

The implementation now follows this priority order for API configuration:

1. **User-specific configuration** (from `UserConfig` table if `user_id` is provided)
   - `intraday_futu_api_url` or `futu_api_base_url`
   - `intraday_futu_api_key` or `futu_api_key`

2. **Environment variables** (fallback)
   - `FUTU_API_BASE_URL`
   - `FUTU_API_KEY`

3. **Default configuration** (last resort)
   - From `tradingagents/dataflows/config.py`
   - Default: `http://localhost:9000`

### 4. New Async Wrapper

**Created:** `web/backend/services/futu_async_wrapper.py`

Provides async wrappers for all Futu API functions:

- `get_account_info_async(market_type, user_id=None)`
- `get_positions_async(market_type, user_id=None)`
- `get_orders_async(market_type, filter_status=0, user_id=None)`
- `get_quote_async(stock_code, user_id=None)`
- `get_kline_data_async(symbol, interval="daily", start_date=None, end_date=None, format="csv", user_id=None)`
- `get_hot_stocks_async(market_type="US", count=10, user_id=None)`
- `place_order_async(stock_code, side, quantity, price=None, order_type="LIMIT", user_id=None)`
- `cancel_order_async(order_id, stock_code, user_id=None)`
- `get_technical_analysis_async(symbol, interval="daily", indicator="macd", start_date=None, end_date=None, format="csv", user_id=None)`
- `get_hot_news_async(lang="zh-cn", user_id=None)`

These functions use `asyncio.to_thread()` to run the synchronous Futu API calls in a thread pool, making them safe for use in async FastAPI endpoints.

### 5. Updated Snapshot Scheduler

**Modified:** `web/backend/services/snapshot_scheduler.py`

Now uses the new async wrapper:

```python
from web.backend.services.futu_async_wrapper import get_account_info_async

# Get account info with user-specific configuration
account_info = await get_account_info_async(market_type, user_id=user.id)
```

## Usage Examples

### For Backend API Routes (Async)

```python
from web.backend.services.futu_async_wrapper import get_account_info_async, get_positions_async

@router.get("/account/{market_type}")
async def get_account(market_type: str, current_user: User = Depends(get_current_user)):
    # Uses user-specific configuration automatically
    account_info = await get_account_info_async(market_type, user_id=current_user.id)
    return account_info

@router.get("/positions/{market_type}")
async def get_positions(market_type: str, current_user: User = Depends(get_current_user)):
    # Enriches positions with database info and uses user-specific config
    positions = await get_positions_async(market_type, user_id=current_user.id)
    return positions
```

### For Synchronous Code (CLI, Background Tasks)

```python
from tradingagents.dataflows.futu_trading import get_account_info, get_positions

# Without user-specific config (uses environment variables or default config)
account_info = get_account_info("US")

# With user-specific config
account_info = get_account_info("US", user_id=123)
positions = get_positions("HK", user_id=123)
```

## Benefits

1. **No Code Duplication**: Single source of truth for Futu API implementation
2. **User-Specific Configuration**: Each user can have their own Futu API settings
3. **Flexible Configuration**: Supports environment variables for development and user-specific settings for production
4. **Clean Async Support**: Proper async wrappers that don't block the event loop
5. **Backward Compatible**: Existing code without `user_id` parameter continues to work

## Migration Guide

If you have existing code using the old `FutuAPIClient`:

**Before:**
```python
from web.backend.services.futu_api_client import FutuAPIClient

client = FutuAPIClient(base_url=futu_api_url)
account_info = await client.get_account_info(market_type)
```

**After:**
```python
from web.backend.services.futu_async_wrapper import get_account_info_async

# User-specific config is automatically loaded
account_info = await get_account_info_async(market_type, user_id=user.id)
```

## Database Schema

The implementation uses these fields from the `UserConfig` table:

- `futu_api_base_url`: Regular Futu API base URL
- `futu_api_key`: Regular Futu API key
- `intraday_futu_api_url`: Intraday trading Futu API URL (takes priority if set)
- `intraday_futu_api_key`: Intraday trading Futu API key (takes priority if set)

## Testing

To test with user-specific configuration:

1. Set user configuration in database:
```sql
UPDATE user_config 
SET futu_api_base_url = 'http://localhost:11111',
    futu_api_key = 'your-api-key'
WHERE user_id = 1;
```

2. Call API with user_id:
```python
account_info = await get_account_info_async("US", user_id=1)
```

To test with environment variables:

1. Set environment variables:
```bash
export FUTU_API_BASE_URL=http://localhost:11111
export FUTU_API_KEY=your-api-key
```

2. Call API without user_id:
```python
account_info = await get_account_info_async("US")
```
