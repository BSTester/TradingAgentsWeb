# Snapshot Field Mapping Fix

## Issue

The snapshot scheduler was using incorrect field names when extracting data from the Futu API response, causing snapshots to have incorrect or zero values.

## Root Cause

The snapshot scheduler was calling the Futu API directly via `get_account_info_async()`, which returns the raw Futu API response format. However, the code was expecting the mapped field names used by the backend API route.

### Actual Futu API Response Format

```json
{
  "account_id": "17198232",
  "net_asset": 98887.006,
  "cash": 54047.006,
  "market_value": 44840,
  "buying_power": 152934.012,
  "profit_loss": -1112.994,
  "profit_loss_ratio": -0.01113,
  "today_profit_loss": -392.25,
  "today_profit_loss_ratio": -0.0039509764255284,
  "margin": 17936,
  "available_funds": 80951.006
}
```

### Field Mapping

| Futu API Field | Our Field Name | Description |
|----------------|----------------|-------------|
| `net_asset` | `total_assets` | Total account value |
| `cash` | `cash` | Available cash |
| `market_value` | `market_value` | Total position market value |
| `profit_loss` | `unrealized_pnl` | Total unrealized P&L |
| `today_profit_loss` | `realized_pnl` | Today's realized P&L |

## Solution

Updated `web/backend/services/snapshot_scheduler.py` to use the correct field names from the Futu API response.

### Before (Incorrect)

```python
# Extract account data - use correct field names from API response
total_assets = account_info.get("total_assets", 0.0)  # ❌ Wrong field name
cash = account_info.get("cash", 0.0)  # ✅ Correct
market_value = account_info.get("position_value", 0.0)  # ❌ Wrong field name

# Set P&L to 0 (not calculated from positions)
realized_pnl = 0.0  # ❌ Should use today_profit_loss
unrealized_pnl = 0.0  # ❌ Should use profit_loss
```

### After (Correct)

```python
# Extract account data - use correct field names from Futu API response
# API returns: net_asset, cash, market_value, profit_loss, today_profit_loss
total_assets = account_info.get("net_asset", 0.0)  # ✅ Correct
cash = account_info.get("cash", 0.0)  # ✅ Correct
market_value = account_info.get("market_value", 0.0)  # ✅ Correct

# Use profit_loss from API (total unrealized P&L)
# Use today_profit_loss as realized P&L for the day
unrealized_pnl = account_info.get("profit_loss", 0.0)  # ✅ Correct
realized_pnl = account_info.get("today_profit_loss", 0.0)  # ✅ Correct
```

## Why Frontend Works Correctly

The frontend components (AccountInfo, AccountTrendModal, etc.) work correctly because they call the backend API route `/api/intraday/account`, which already maps the Futu API fields to our standard field names:

```python
# In web/backend/routes/intraday_trading_routes.py
return {
    "total_assets": data.get("net_asset", 0.0),
    "cash": data.get("cash", 0.0),
    "position_value": data.get("market_value", 0.0),
    "market": market,
    "currency": currency,
    "configured": True,
}
```

So the frontend receives:
- `total_assets` (not `net_asset`)
- `cash` (same)
- `position_value` (not `market_value`)

## Impact

### Before Fix
- Snapshots had `total_assets = 0` (because `total_assets` field doesn't exist in Futu API)
- Snapshots had `market_value = 0` (because `position_value` field doesn't exist in Futu API)
- Snapshots had `unrealized_pnl = 0` and `realized_pnl = 0` (hardcoded to 0)
- Trend charts showed flat lines at zero

### After Fix
- Snapshots correctly capture `net_asset` as `total_assets`
- Snapshots correctly capture `market_value` as `market_value`
- Snapshots correctly capture `profit_loss` as `unrealized_pnl`
- Snapshots correctly capture `today_profit_loss` as `realized_pnl`
- Trend charts show actual account value changes over time

## Testing

### Verify Snapshot Creation

1. Wait for the next scheduled snapshot (at market close time)
2. Check the database:
```sql
SELECT 
    snapshot_date,
    market_type,
    total_assets,
    cash,
    market_value,
    unrealized_pnl,
    realized_pnl
FROM account_snapshots
ORDER BY snapshot_date DESC
LIMIT 5;
```

3. Verify values are non-zero and match your Futu account

### Verify Trend Charts

1. Open intraday trading page (智能盯盘)
2. Select a market (US/HK/CN)
3. Click the chart icon on any metric card (Total Assets, Cash, or Market Value)
4. Verify the trend chart shows actual data (not flat at zero)
5. Verify currency symbols are correct

## Related Files

- `web/backend/services/snapshot_scheduler.py` - Fixed field mapping
- `web/backend/routes/intraday_trading_routes.py` - Already has correct mapping
- `web/frontend/src/components/intraday/AccountInfo.tsx` - Uses mapped fields
- `web/frontend/src/components/intraday/AccountTrendModal.tsx` - Uses mapped fields

## Additional Notes

### P&L Interpretation

- `profit_loss`: Total unrealized P&L across all positions
- `today_profit_loss`: Today's realized P&L (from closed positions)
- `profit_loss_ratio`: Unrealized P&L as percentage of total assets
- `today_profit_loss_ratio`: Today's realized P&L as percentage

We store:
- `unrealized_pnl` = `profit_loss` (total unrealized)
- `realized_pnl` = `today_profit_loss` (today's realized)

This gives us a snapshot of both unrealized gains/losses and daily realized gains/losses.

### Future Improvements

Consider adding more fields to snapshots:
- `buying_power`: Available buying power
- `margin`: Margin used
- `available_funds`: Available funds for withdrawal
- `profit_loss_ratio`: P&L percentage

These could be stored in the `account_data` JSON field for historical tracking without schema changes.
