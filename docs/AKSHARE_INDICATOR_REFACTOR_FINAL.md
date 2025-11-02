# AkShare指标模块最终重构

**日期**: 2025-11-02  
**文件**: `tradingagents/dataflows/akshare_indicator.py`

## 📋 重构内容

### 1. 指标映射格式更新

**之前的格式**:
```python
supported_indicators = {
    "close_50_sma": ("SMA", 50),
    "close_200_sma": ("SMA", 200),
    # ...
}
```

**现在的格式**:
```python
supported_indicators = {
    "close_50_sma": ("50 SMA", "close"),
    "close_200_sma": ("200 SMA", "close"),
    "close_10_ema": ("10 EMA", "close"),
    "macd": ("MACD", "close"),
    "macds": ("MACD Signal", "close"),
    "macdh": ("MACD Histogram", "close"),
    "rsi": ("RSI", "close"),
    "boll": ("Bollinger Middle", "close"),
    "boll_ub": ("Bollinger Upper Band", "close"),
    "boll_lb": ("Bollinger Lower Band", "close"),
    "atr": ("ATR", None),  # ATR使用High, Low, Close
    "vwma": ("VWMA", "close")
}
```

### 2. 映射格式说明

每个指标映射为一个元组：`(indicator_name, series_type)`

- **indicator_name**: 指标的显示名称（如 "50 SMA", "MACD"）
- **series_type**: 需要的价格序列类型
  - `"close"`: 使用收盘价
  - `"open"`: 使用开盘价
  - `"high"`: 使用最高价
  - `"low"`: 使用最低价
  - `None`: 不需要单一价格序列（如ATR需要High, Low, Close）

### 3. 周期计算逻辑

根据指标名称自动确定周期：

```python
if "50" in indicator_name:
    period = 50
elif "200" in indicator_name:
    period = 200
elif "10" in indicator_name:
    period = 10
elif "RSI" in indicator_name:
    period = time_period  # 使用参数指定
elif "Bollinger" in indicator_name:
    period = 20
elif "ATR" in indicator_name:
    period = time_period
elif "VWMA" in indicator_name:
    period = time_period
else:
    period = 26  # MACD默认
```

### 4. 函数签名更新

**_calculate_indicator函数**:

```python
def _calculate_indicator(
    df: pd.DataFrame, 
    indicator_key: str,      # 指标键（如 'close_50_sma'）
    indicator_name: str,     # 指标名称（如 '50 SMA'）
    period: int,             # 计算周期
    price_col: str,          # 价格列名
    time_period: int         # 时间周期参数
) -> pd.DataFrame:
```

### 5. 指标计算逻辑

使用指标名称而不是类型来判断：

```python
# 之前
if indicator_type == 'SMA':
    # ...

# 现在
if "SMA" in indicator_name:
    # ...
```

这样更直观，也更容易维护。

## ✅ 支持的指标

| 指标键 | 指标名称 | 价格序列 | 默认周期 |
|--------|----------|----------|----------|
| close_50_sma | 50 SMA | close | 50 |
| close_200_sma | 200 SMA | close | 200 |
| close_10_ema | 10 EMA | close | 10 |
| macd | MACD | close | 26 |
| macds | MACD Signal | close | 26 |
| macdh | MACD Histogram | close | 26 |
| rsi | RSI | close | time_period |
| boll | Bollinger Middle | close | 20 |
| boll_ub | Bollinger Upper Band | close | 20 |
| boll_lb | Bollinger Lower Band | close | 20 |
| atr | ATR | None | time_period |
| vwma | VWMA | close | time_period |

## 📊 返回格式

函数返回CSV格式的文本字符串，包含：

```csv
time,indicator_value
2025-01-01,150.25
2025-01-02,151.30
2025-01-03,152.15
```

列名根据指标类型不同：
- SMA: `50 SMA`, `200 SMA`
- EMA: `10 EMA`
- MACD: `MACD`, `MACD Signal`, `MACD Histogram`
- RSI: `RSI`
- Bollinger: `Real Middle Band`, `Real Upper Band`, `Real Lower Band`
- ATR: `ATR`
- VWMA: `VWMA`

## 🔧 使用示例

```python
from tradingagents.dataflows.akshare_indicator import get_indicator

# 获取50日均线
result = get_indicator(
    symbol="AAPL",
    indicator="close_50_sma",
    curr_date="2025-11-02",
    look_back_days=30,
    interval="daily"
)

# 获取RSI指标
result = get_indicator(
    symbol="600519",
    indicator="rsi",
    curr_date="2025-11-02",
    look_back_days=30,
    interval="daily",
    time_period=14  # RSI-14
)

# 获取MACD
result = get_indicator(
    symbol="00700",
    indicator="macd",
    curr_date="2025-11-02",
    look_back_days=60,
    interval="daily"
)
```

## 🎯 关键改进

### 1. 更清晰的映射结构
- 使用 `(indicator_name, series_type)` 格式
- 指标名称更直观（"50 SMA" vs "SMA"）
- 明确指定所需的价格序列

### 2. 自动周期推断
- 从指标名称中提取周期信息
- 减少硬编码
- 更灵活的配置

### 3. 简化的计算逻辑
- 使用指标名称而不是类型判断
- 代码更易读
- 更容易添加新指标

### 4. 保持兼容性
- 仍然返回CSV格式文本
- 仍然使用get_stock获取K线数据
- API接口保持不变

## 📝 注意事项

1. **ATR特殊处理**: ATR不使用单一价格序列，而是使用High, Low, Close三个价格
2. **周期参数**: RSI, ATR, VWMA使用`time_period`参数指定周期
3. **CSV格式**: 返回的是CSV格式的文本字符串，不是文件
4. **数据源**: 使用`akshare_stock.get_stock`方法获取K线数据

## ✅ 验证结果

```bash
# 诊断检查
tradingagents/dataflows/akshare_indicator.py: No diagnostics found
```

所有代码通过验证，无错误或警告。

## 📚 相关文档

- [AKSHARE_INDICATOR_INTERVAL_SUPPORT.md](./AKSHARE_INDICATOR_INTERVAL_SUPPORT.md) - 时间间隔支持
- [AKSHARE_INDICATOR_REFACTOR_2025_11_02.md](./AKSHARE_INDICATOR_REFACTOR_2025_11_02.md) - 之前的重构记录
- [KLINE_INTERVALS_REFERENCE.md](./KLINE_INTERVALS_REFERENCE.md) - K线间隔参考

---

**重构完成时间**: 2025-11-02  
**状态**: ✅ 完成并验证
