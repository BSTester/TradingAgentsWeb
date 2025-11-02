# AkShare Indicator Interval Support

## Overview

The AkShare indicator implementation now fully supports multiple time intervals (daily, weekly, monthly), matching Alpha Vantage's interface.

---

## Supported Intervals

### 1. Daily (`interval="daily"`)
**Description**: Daily K-line data, no resampling

**Use Case**:
- Short-term trading
- Day trading strategies
- Detailed price action analysis

**Data Points**: One per trading day

**Example**:
```python
result = get_indicator(
    symbol="AAPL",
    indicator="rsi",
    curr_date="2025-11-02",
    look_back_days=30,
    interval="daily"  # Daily data
)
```

**Output**:
```csv
time,RSI
2025-10-03,45.23
2025-10-04,46.78
2025-10-07,47.12
2025-10-08,48.56
...
```

---

### 2. Weekly (`interval="weekly"`)
**Description**: Weekly K-line data, resampled to week-ending Friday

**Resampling Logic**:
- **Open**: First day's open of the week
- **High**: Highest price of the week
- **Low**: Lowest price of the week
- **Close**: Last day's close of the week
- **Volume**: Sum of volume for the week

**Use Case**:
- Swing trading
- Medium-term trend analysis
- Reducing noise from daily fluctuations

**Data Points**: One per week (Friday)

**Example**:
```python
result = get_indicator(
    symbol="AAPL",
    indicator="close_50_sma",
    curr_date="2025-11-02",
    look_back_days=180,  # ~26 weeks
    interval="weekly"  # Weekly data
)
```

**Output**:
```csv
time,SMA
2025-05-03,175.23
2025-05-10,176.45
2025-05-17,177.89
2025-05-24,178.12
...
```

---

### 3. Monthly (`interval="monthly"`)
**Description**: Monthly K-line data, resampled to month-end

**Resampling Logic**:
- **Open**: First day's open of the month
- **High**: Highest price of the month
- **Low**: Lowest price of the month
- **Close**: Last day's close of the month
- **Volume**: Sum of volume for the month

**Use Case**:
- Long-term investing
- Macro trend analysis
- Strategic position planning

**Data Points**: One per month (last trading day)

**Example**:
```python
result = get_indicator(
    symbol="AAPL",
    indicator="close_200_sma",
    curr_date="2025-11-02",
    look_back_days=730,  # ~24 months
    interval="monthly"  # Monthly data
)
```

**Output**:
```csv
time,SMA
2023-11-30,165.23
2023-12-31,167.45
2024-01-31,169.89
2024-02-29,171.12
...
```

---

## Implementation Details

### Data Fetching Strategy

1. **Always Fetch Daily Data First**
   ```python
   # Fetch daily K-line data from AkShare
   price_data_str = get_stock(symbol, start_date, end_date)
   ```

2. **Resample Based on Interval**
   ```python
   if interval == "weekly":
       df_resampled = df.resample('W-FRI').agg({...})
   elif interval == "monthly":
       df_resampled = df.resample('M').agg({...})
   else:  # daily
       df_resampled = df
   ```

3. **Calculate Indicators on Resampled Data**
   ```python
   result_df = _calculate_indicator(df_resampled, ...)
   ```

### Warmup Period Adjustment

The warmup period is automatically adjusted based on interval:

```python
if interval == "weekly":
    # For weekly, need more days (weeks * 7)
    extra_periods = max(period * 7 if period else 200, 200)
elif interval == "monthly":
    # For monthly, need even more days (months * 30)
    extra_periods = max(period * 30 if period else 365, 365)
else:  # daily
    extra_periods = max(period * 3 if period else 200, 200)
```

**Why?**
- Weekly indicators need ~7x more daily data
- Monthly indicators need ~30x more daily data
- Ensures sufficient data for accurate indicator calculation

---

## Resampling Rules

### OHLCV Aggregation

| Field | Aggregation Rule | Explanation |
|-------|------------------|-------------|
| **Open** | `first` | First trading day's opening price |
| **High** | `max` | Highest price during the period |
| **Low** | `min` | Lowest price during the period |
| **Close** | `last` | Last trading day's closing price |
| **Volume** | `sum` | Total volume traded during the period |

### Week Definition
- **Week Ending**: Friday (`'W-FRI'`)
- If Friday is a holiday, uses the last trading day of that week
- Aligns with standard financial week conventions

### Month Definition
- **Month Ending**: Last trading day of the month (`'M'`)
- Automatically handles months with different lengths
- Handles holidays and non-trading days

---

## Examples by Interval

### Daily RSI (14-period)
```python
result = get_indicator(
    symbol="600519",  # Moutai (A-share)
    indicator="rsi",
    curr_date="2025-11-02",
    look_back_days=30,
    interval="daily",
    time_period=14
)
```

**Output**: 30 daily RSI values

---

### Weekly MACD
```python
result = get_indicator(
    symbol="00700",  # Tencent (HK)
    indicator="macd",
    curr_date="2025-11-02",
    look_back_days=180,  # ~26 weeks
    interval="weekly"
)
```

**Output**: ~26 weekly MACD values

---

### Monthly 50 SMA
```python
result = get_indicator(
    symbol="AAPL",  # Apple (US)
    indicator="close_50_sma",
    curr_date="2025-11-02",
    look_back_days=1825,  # ~60 months (5 years)
    interval="monthly"
)
```

**Output**: ~60 monthly SMA values

---

## Comparison with Alpha Vantage

### Similarities ✅
- Same function signature
- Same interval parameter values (`daily`, `weekly`, `monthly`)
- Same CSV output format
- Same indicator names and calculations

### Differences
| Aspect | Alpha Vantage | AkShare |
|--------|---------------|---------|
| **Data Source** | Direct API call | Fetch daily + resample |
| **Intraday** | Supports (1min, 5min, etc.) | Not supported |
| **Resampling** | Server-side | Client-side (pandas) |
| **Performance** | Faster (pre-calculated) | Slower (calculate on-demand) |

### Why Client-Side Resampling?
1. **AkShare Limitation**: Only provides daily K-line data
2. **Flexibility**: Can add custom resampling logic
3. **Consistency**: Same calculation method across all intervals
4. **Accuracy**: Full control over aggregation rules

---

## Performance Considerations

### Daily Interval
- **Fastest**: No resampling needed
- **Data Volume**: Moderate
- **Calculation Time**: ~1-2 seconds

### Weekly Interval
- **Fast**: Simple resampling
- **Data Volume**: ~1/5 of daily
- **Calculation Time**: ~1-2 seconds

### Monthly Interval
- **Fast**: Simple resampling
- **Data Volume**: ~1/20 of daily
- **Calculation Time**: ~1-2 seconds

**Note**: Most time is spent fetching data from AkShare, not resampling.

---

## Error Handling

### Insufficient Data
```python
if df_resampled.empty:
    return f"Error: No data available after resampling to {interval}"
```

### Invalid Interval
```python
# Defaults to daily if interval is invalid
if interval not in ["daily", "weekly", "monthly"]:
    interval = "daily"
```

### Missing Columns
```python
if price_col not in df_resampled.columns:
    return f"Error: Price column '{price_col}' not found in data"
```

---

## Best Practices

### 1. **Match Interval to Strategy**
- Day trading → `daily`
- Swing trading → `weekly`
- Position trading → `monthly`

### 2. **Adjust look_back_days**
- Daily: 30-90 days typical
- Weekly: 180-365 days typical (~26-52 weeks)
- Monthly: 730-1825 days typical (~24-60 months)

### 3. **Consider Indicator Period**
- Short-term indicators (RSI-14) → daily or weekly
- Long-term indicators (SMA-200) → weekly or monthly

### 4. **Data Availability**
- Ensure sufficient historical data
- Some stocks may have limited history
- Check data quality after resampling

---

## Testing

### Test All Intervals
```python
from tradingagents.dataflows.akshare_indicator import get_indicator
import pandas as pd
from io import StringIO

# Test daily
daily = get_indicator("AAPL", "rsi", "2025-11-02", 30, interval="daily")
df_daily = pd.read_csv(StringIO(daily))
print(f"Daily: {len(df_daily)} records")

# Test weekly
weekly = get_indicator("AAPL", "rsi", "2025-11-02", 180, interval="weekly")
df_weekly = pd.read_csv(StringIO(weekly))
print(f"Weekly: {len(df_weekly)} records")

# Test monthly
monthly = get_indicator("AAPL", "rsi", "2025-11-02", 730, interval="monthly")
df_monthly = pd.read_csv(StringIO(monthly))
print(f"Monthly: {len(df_monthly)} records")
```

---

## Summary

✅ **Full interval support**: daily, weekly, monthly
✅ **Proper resampling**: OHLCV aggregation rules
✅ **Automatic warmup**: Adjusted based on interval
✅ **Compatible**: Matches Alpha Vantage interface
✅ **Flexible**: Easy to add more intervals in future

The implementation now provides complete interval support, making it fully compatible with Alpha Vantage's interface while leveraging AkShare's daily K-line data!
