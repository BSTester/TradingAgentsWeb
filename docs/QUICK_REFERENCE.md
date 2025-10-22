# 快速参考指南 - 方法名称对照表

## 📌 修改前后对照

### Stock 模块
| 修改前 | 修改后 | 状态 |
|--------|--------|------|
| `get_stock_data(symbol, start_date, end_date)` | `get_stock(symbol, start_date, end_date)` | ✅ 已修改 |

### Fundamentals 模块
| 修改前 | 修改后 | 状态 |
|--------|--------|------|
| `get_fundamentals(symbol, curr_date)` | `get_fundamentals(ticker, curr_date)` | ✅ 已修改 |
| `get_balance_sheet(symbol, freq, curr_date)` | `get_balance_sheet(ticker, freq, curr_date)` | ✅ 已修改 |
| `get_income_statement(symbol, freq, curr_date)` | `get_income_statement(ticker, freq, curr_date)` | ✅ 已修改 |
| `get_cashflow(symbol, freq, curr_date)` | `get_cashflow(ticker, freq, curr_date)` | ✅ 已修改 |

**BaoStock 特殊说明：**
| 修改前 | 修改后 | 说明 |
|--------|--------|------|
| `get_balance_sheet(symbol, year, quarter)` | `get_balance_sheet(ticker, freq, curr_date)` | 内部自动转换 |
| `get_income_statement(symbol, year, quarter)` | `get_income_statement(ticker, freq, curr_date)` | 内部自动转换 |
| `get_cashflow(symbol, year, quarter)` | `get_cashflow(ticker, freq, curr_date)` | 内部自动转换 |

### News 模块
| 修改前 | 修改后 | 状态 |
|--------|--------|------|
| `get_stock_news(query, start_date, end_date)` | `get_news(ticker, start_date, end_date)` | ✅ 已修改 |
| N/A | `get_insider_transactions(symbol)` | ✅ 新增 |

**保留的内部方法（可选使用）：**
- `_get_global_news_internal(curr_date, look_back_days, limit)`
- `_get_aggregated_news_internal(category, limit, sources)`
- `_get_market_sentiment_internal()`

### Indicators 模块
| 修改前 | 修改后 | 状态 |
|--------|--------|------|
| `get_akshare_indicators(symbol, indicator, curr_date, look_back_days)` | `get_indicator(symbol, indicator, curr_date, look_back_days, interval, time_period, series_type)` | ✅ 已修改 |

---

## 🔄 迁移示例

### 1. Stock 数据获取

**旧代码：**
```python
from tradingagents.dataflows.akshare_stock import get_stock_data
data = get_stock_data("600000", "2024-01-01", "2024-12-31")
```

**新代码：**
```python
from tradingagents.dataflows.akshare_stock import get_stock
data = get_stock("600000", "2024-01-01", "2024-12-31")
```

---

### 2. Fundamentals 数据获取

**旧代码（AKShare）：**
```python
from tradingagents.dataflows.akshare_fundamentals import get_balance_sheet
data = get_balance_sheet("600000", freq="quarterly", curr_date="2024-12-31")
```

**新代码（参数名变化）：**
```python
from tradingagents.dataflows.akshare_fundamentals import get_balance_sheet
data = get_balance_sheet("600000", freq="quarterly", curr_date="2024-12-31")  # symbol → ticker
```

**旧代码（BaoStock）：**
```python
from tradingagents.dataflows.baostock_fundamentals import get_balance_sheet
data = get_balance_sheet("sh.600000", year=2024, quarter=4)
```

**新代码（参数变化）：**
```python
from tradingagents.dataflows.baostock_fundamentals import get_balance_sheet
data = get_balance_sheet("sh.600000", freq="quarterly", curr_date="2024-12-31")
# 内部会自动转换为 year=2024, quarter=4
```

---

### 3. News 数据获取

**旧代码：**
```python
from tradingagents.dataflows.akshare_news import get_stock_news
news = get_stock_news("600000", "2024-01-01", "2024-12-31")
```

**新代码：**
```python
from tradingagents.dataflows.akshare_news import get_news
news = get_news("600000", "2024-01-01", "2024-12-31")
```

**使用内部方法（可选）：**
```python
from tradingagents.dataflows.akshare_news import (
    _get_global_news_internal,
    _get_aggregated_news_internal,
    _get_market_sentiment_internal
)

# 获取全球新闻
global_news = _get_global_news_internal("2024-12-31", look_back_days=7, limit=20)

# 获取聚合新闻
aggregated = _get_aggregated_news_internal(category="finance", limit=20, sources=3)

# 获取市场情绪
sentiment = _get_market_sentiment_internal()
```

---

### 4. Indicators 数据获取

**旧代码：**
```python
from tradingagents.dataflows.akshare_indicators import get_akshare_indicators
data = get_akshare_indicators("600000", "rsi", "2024-12-31", 30)
```

**新代码：**
```python
from tradingagents.dataflows.akshare_indicators import get_indicator
data = get_indicator("600000", "rsi", "2024-12-31", 30, "daily", 14, "close")
# 新增了 interval, time_period, series_type 参数（有默认值）
```

---

## 📦 主入口导出变化

### AKShare 主入口

**旧导出：**
```python
from tradingagents.dataflows.akshare import (
    get_akshare_stock_data,
    get_akshare_realtime_data,
    get_akshare_stock_news,
    get_akshare_global_news,
    get_akshare_market_sentiment,
    get_akshare_indicators
)
```

**新导出：**
```python
from tradingagents.dataflows.akshare import (
    get_akshare_stock,                    # 原 get_akshare_stock_data
    get_akshare_news,                     # 原 get_akshare_stock_news
    get_akshare_insider_transactions,     # 新增
    get_akshare_indicator                 # 原 get_akshare_indicators
)
```

### BaoStock 主入口

**旧导出：**
```python
from tradingagents.dataflows.baostock import (
    get_baostock_stock_data,
    get_baostock_company_info,
    get_baostock_dividend_data,
    get_baostock_financial_data
)
```

**新导出：**
```python
from tradingagents.dataflows.baostock import (
    get_baostock_stock,                   # 原 get_baostock_stock_data
    get_baostock_news,                    # 新增（返回不支持）
    get_baostock_insider_transactions,    # 新增（返回不支持）
    get_baostock_indicator                # 新增（返回不支持）
)
```

---

## ⚡ 快速查找

### 我想获取...

| 需求 | Alpha Vantage | AKShare | BaoStock |
|------|---------------|---------|----------|
| 股票历史数据 | `get_stock()` | `get_stock()` | `get_stock()` |
| 公司基本面 | `get_fundamentals()` | `get_fundamentals()` | `get_fundamentals()` |
| 资产负债表 | `get_balance_sheet()` | `get_balance_sheet()` | `get_balance_sheet()` |
| 利润表 | `get_income_statement()` | `get_income_statement()` | `get_income_statement()` |
| 现金流量表 | `get_cashflow()` | `get_cashflow()` | `get_cashflow()` |
| 新闻数据 | `get_news()` | `get_news()` | `get_news()` ⚠️ |
| 内部交易 | `get_insider_transactions()` | `get_insider_transactions()` ⚠️ | `get_insider_transactions()` ⚠️ |
| 技术指标 | `get_indicator()` | `get_indicator()` | `get_indicator()` ⚠️ |

⚠️ = 返回不支持提示

---

## 💡 提示

1. **所有方法名称现在统一**：三个数据源使用相同的方法名
2. **参数签名统一**：便于在不同数据源之间切换
3. **内部实现保留**：AKShare 的所有原有功能都保留了
4. **内部方法可用**：以 `_` 开头的方法仍然可以直接调用
5. **优雅降级**：不支持的功能返回友好提示而不是报错

---

## 📞 需要帮助？

如果遇到问题，请检查：
1. 方法名称是否正确（参考上面的对照表）
2. 参数名称是否正确（`symbol` vs `ticker`）
3. 是否需要使用内部方法（以 `_` 开头）
4. 查看 `ALIGNMENT_SUMMARY_FINAL.md` 获取详细信息
