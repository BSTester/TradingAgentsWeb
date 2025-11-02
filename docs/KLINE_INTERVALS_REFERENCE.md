# K-Line Intervals Reference

## Overview

Both `get_futu_kline` and `get_futu_technical_analysis` support the same set of time intervals for consistency.

## Available Intervals

### Intraday (分时)
For day trading and short-term analysis.

| Interval | Description | Use Case |
|----------|-------------|----------|
| `1min` | 1-minute candles | Ultra-short-term scalping |
| `5min` | 5-minute candles | Short-term day trading |
| `15min` | 15-minute candles | Intraday swing trading |
| `30min` | 30-minute candles | Intraday position trading |
| `60min` | 1-hour candles | Intraday to daily transition |

**Best for:**
- Day trading strategies
- Precise entry/exit timing
- Intraday momentum analysis
- Scalping opportunities

**Note:** Intraday data may have limited history (typically last few days to weeks).

---

### Daily+ (日线及以上)
For swing trading and medium-term analysis.

| Interval | Description | Use Case |
|----------|-------------|----------|
| `daily` | Daily candles | Swing trading, trend following |
| `weekly` | Weekly candles | Medium-term position trading |
| `monthly` | Monthly candles | Long-term trend analysis |

**Best for:**
- Swing trading (days to weeks)
- Trend identification
- Support/resistance levels
- Volume analysis

**Note:** Daily+ data typically has extensive history (years of data).

---

### Long-term (长期)
For position trading and macro analysis.

| Interval | Description | Use Case |
|----------|-------------|----------|
| `quarterly` | Quarterly candles | Seasonal pattern analysis |
| `yearly` | Yearly candles | Long-term investment analysis |

**Best for:**
- Long-term investment decisions
- Macro trend analysis
- Seasonal patterns
- Multi-year cycles
- Fundamental-driven strategies

**Note:** Useful for understanding long-term trends and cycles, but less relevant for short-term trading execution.

---

## Interval Selection Strategy

### For Trading Executor

The trading executor should prioritize intervals based on the trading strategy:

#### 1. Day Trading Strategy
```python
# Primary: 5-minute or 15-minute
get_futu_kline(symbol="AAPL", interval="5min")
get_futu_technical_analysis(symbol="AAPL", interval="5min", indicator="rsi")

# Fallback: 1-hour or daily
get_futu_kline(symbol="AAPL", interval="60min")
```

#### 2. Swing Trading Strategy
```python
# Primary: Daily
get_futu_kline(symbol="AAPL", interval="daily")
get_futu_technical_analysis(symbol="AAPL", interval="daily", indicator="macd")

# Context: Weekly for trend
get_futu_kline(symbol="AAPL", interval="weekly")
```

#### 3. Position Trading Strategy
```python
# Primary: Daily or weekly
get_futu_kline(symbol="AAPL", interval="daily")
get_futu_kline(symbol="AAPL", interval="weekly")

# Context: Monthly for long-term trend
get_futu_kline(symbol="AAPL", interval="monthly")
```

#### 4. Long-term Investment Analysis
```python
# Primary: Monthly
get_futu_kline(symbol="AAPL", interval="monthly")

# Context: Quarterly and yearly for macro trends
get_futu_kline(symbol="AAPL", interval="quarterly")
get_futu_kline(symbol="AAPL", interval="yearly")
```

---

## Interval Matching Rule

**CRITICAL:** K-line interval and technical indicator interval MUST match.

✅ **Correct:**
```python
# Both use 5min interval
get_futu_kline(symbol="AAPL", interval="5min")
get_futu_technical_analysis(symbol="AAPL", interval="5min", indicator="rsi")
```

❌ **Incorrect:**
```python
# Mismatched intervals (5min vs daily)
get_futu_kline(symbol="AAPL", interval="5min")
get_futu_technical_analysis(symbol="AAPL", interval="daily", indicator="rsi")
```

---

## Data Availability

### Intraday Data
- **Availability**: Limited history (typically last few days to weeks)
- **Update frequency**: Real-time or near real-time
- **Data points**: High volume of data points
- **Best for**: Recent price action analysis

### Daily+ Data
- **Availability**: Extensive history (years of data)
- **Update frequency**: End of day or end of period
- **Data points**: Moderate volume of data points
- **Best for**: Historical trend analysis

### Long-term Data
- **Availability**: Very extensive history (decades for some stocks)
- **Update frequency**: End of quarter or end of year
- **Data points**: Low volume of data points
- **Best for**: Macro trend and cycle analysis

---

## Fallback Strategy

If intraday data is unavailable or returns errors:

```
1. Try 5min → 2. Try 15min → 3. Try 60min → 4. Use daily
```

Example implementation:
```python
intervals_to_try = ["5min", "15min", "60min", "daily"]

for interval in intervals_to_try:
    result = get_futu_kline(symbol="AAPL", interval=interval)
    if result is successful:
        # Use this interval for technical indicators too
        get_futu_technical_analysis(symbol="AAPL", interval=interval, indicator="macd")
        break
```

---

## Timezone Considerations

All timestamps are in market local time:

| Market | Timezone | UTC Offset |
|--------|----------|------------|
| US | Eastern Time (EST/EDT) | UTC-5/-4 (auto-handles DST) |
| HK | Hong Kong Time (HKT) | UTC+8 |
| CN | China Standard Time (CST) | UTC+8 |

**Note:** The system automatically handles timezone conversions and daylight saving time adjustments.

---

## Examples by Trading Style

### Scalper (Ultra-short-term)
```python
# 1-minute for entry/exit
get_futu_kline(symbol="AAPL", interval="1min")
get_futu_technical_analysis(symbol="AAPL", interval="1min", indicator="rsi")
```

### Day Trader
```python
# 5-minute for primary analysis
get_futu_kline(symbol="AAPL", interval="5min")
get_futu_technical_analysis(symbol="AAPL", interval="5min", indicator="macd")

# 15-minute for context
get_futu_kline(symbol="AAPL", interval="15min")
```

### Swing Trader
```python
# Daily for primary analysis
get_futu_kline(symbol="AAPL", interval="daily")
get_futu_technical_analysis(symbol="AAPL", interval="daily", indicator="boll")

# Weekly for trend context
get_futu_kline(symbol="AAPL", interval="weekly")
```

### Position Trader
```python
# Daily and weekly for analysis
get_futu_kline(symbol="AAPL", interval="daily")
get_futu_kline(symbol="AAPL", interval="weekly")
get_futu_technical_analysis(symbol="AAPL", interval="weekly", indicator="close_50_sma")

# Monthly for long-term trend
get_futu_kline(symbol="AAPL", interval="monthly")
```

### Long-term Investor
```python
# Monthly for primary analysis
get_futu_kline(symbol="AAPL", interval="monthly")
get_futu_technical_analysis(symbol="AAPL", interval="monthly", indicator="macd")

# Quarterly and yearly for macro trends
get_futu_kline(symbol="AAPL", interval="quarterly")
get_futu_kline(symbol="AAPL", interval="yearly")
```

---

## Summary

- **11 intervals total**: 1min, 5min, 15min, 30min, 60min, daily, weekly, monthly, quarterly, yearly
- **3 categories**: Intraday (5), Daily+ (3), Long-term (2), plus 1min
- **Match intervals**: K-line and indicator intervals must match
- **Fallback strategy**: Intraday → Daily+ → Long-term
- **Timezone aware**: Automatic handling of market local time
