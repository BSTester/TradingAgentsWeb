# AKShare 和 BaoStock 与 Alpha Vantage 对齐总结（最终版）

## 修改原则

✅ **只修改方法名称和参数签名**  
✅ **保留所有内部实现逻辑**  
✅ **保留所有辅助方法和工具函数**  
❌ **不改变数据获取方式和业务逻辑**

---

## 📋 修改详情

### 1. **Stock 模块**

#### 修改内容：
- ✅ 方法名：`get_stock_data()` → `get_stock()`
- ✅ 参数签名统一为：`(symbol: str, start_date: str, end_date: str)`
- ✅ 文档字符串改为 Alpha Vantage 风格

#### 保留内容：
- ✅ 所有内部实现逻辑（AKShare 的 `stock_zh_a_hist`、`stock_hk_hist`、`stock_us_daily` 等）
- ✅ 市场识别和代码格式化逻辑
- ✅ 数据处理和标准化逻辑
- ✅ 错误处理和日志记录

**文件：**
- `tradingagents/dataflows/akshare_stock.py`
- `tradingagents/dataflows/baostock_stock.py`

---

### 2. **Fundamentals 模块**

#### 修改内容：
- ✅ 参数名：`symbol` → `ticker`
- ✅ BaoStock 参数：`year`/`quarter` → `freq`/`curr_date`（内部转换）
- ✅ 文档字符串改为 Alpha Vantage 风格

#### 保留内容：
- ✅ 所有内部实现逻辑
- ✅ AKShare 的财务报表获取方法（`stock_balance_sheet_by_yearly_em` 等）
- ✅ BaoStock 的财务数据查询方法（`query_balance_data` 等）
- ✅ 年份和季度的解析逻辑（`_parse_year_parameter`）
- ✅ 数据处理和格式化逻辑

**统一后的方法签名：**
```python
def get_fundamentals(ticker: str, curr_date: str = None) -> str
def get_balance_sheet(ticker: str, freq: str = "quarterly", curr_date: str = None) -> str
def get_income_statement(ticker: str, freq: str = "quarterly", curr_date: str = None) -> str
def get_cashflow(ticker: str, freq: str = "quarterly", curr_date: str = None) -> str
```

**文件：**
- `tradingagents/dataflows/akshare_fundamentals.py`
- `tradingagents/dataflows/baostock_fundamentals.py`

---

### 3. **News 模块**

#### 修改内容：
- ✅ 方法名：`get_stock_news()` → `get_news()`
- ✅ 参数名：`query` → `ticker`
- ✅ 新增方法：`get_insider_transactions()`（返回不支持提示）
- ✅ 文档字符串改为 Alpha Vantage 风格

#### 保留内容：
- ✅ **所有内部辅助方法**：
  - `_get_enhanced_fallback_news()` - 增强的兜底新闻获取
  - `_get_fallback_news()` - 兜底新闻获取
  - `_get_stock_specific_news()` - 个股新闻获取
  - `_get_global_news_internal()` - 全球新闻获取（内部方法）
  - `_get_aggregated_news_internal()` - 聚合新闻获取（内部方法）
  - `_get_market_sentiment_internal()` - 市场情绪获取（内部方法）

- ✅ **所有新闻源集成**：
  - 财联社电报、同花顺全球资讯、新浪全球资讯、富途全球资讯
  - 央视新闻、百度经济新闻
  - 东方财富全球资讯、创新层股票新闻
  - 上海金属期货新闻

- ✅ **所有数据获取逻辑**：
  - 个股新闻优先，全球新闻兜底
  - 多源新闻聚合
  - 市场情绪分析

**统一后的方法签名：**
```python
def get_news(ticker, start_date, end_date) -> dict[str, str] | str
def get_insider_transactions(symbol: str) -> dict[str, str] | str
```

**文件：**
- `tradingagents/dataflows/akshare_news.py` - **保留所有原有功能**
- `tradingagents/dataflows/baostock_news.py` - 新建（返回不支持提示）

---

### 4. **Indicators 模块**

#### 修改内容：
- ✅ 方法名：`get_akshare_indicators()` → `get_indicator()`
- ✅ 参数签名统一，添加占位参数：`interval`、`time_period`、`series_type`
- ✅ 文档字符串改为 Alpha Vantage 风格

#### 保留内容：
- ✅ 所有技术指标计算逻辑
- ✅ 所有指标参数配置（`indicator_params`）
- ✅ 所有计算函数：
  - `calculate_sma()` - 简单移动平均
  - `calculate_ema()` - 指数移动平均
  - `calculate_macd()` - MACD
  - `calculate_rsi()` - RSI
  - `calculate_bollinger_bands()` - 布林带
  - `calculate_atr()` - ATR
  - `calculate_vwma()` - 成交量加权移动平均
  - `calculate_mfi()` - 资金流量指数

- ✅ 股票数据获取和处理逻辑
- ✅ 日期范围计算和筛选逻辑

**统一后的方法签名：**
```python
def get_indicator(
    symbol: str,
    indicator: str,
    curr_date: str,
    look_back_days: int,
    interval: str = "daily",
    time_period: int = 14,
    series_type: str = "close"
) -> str
```

**文件：**
- `tradingagents/dataflows/akshare_indicators.py` - **保留所有计算逻辑**
- `tradingagents/dataflows/baostock_indicators.py` - 新建（返回不支持提示）

---

### 5. **主入口文件**

#### 修改内容：
- ✅ 更新导出的方法名称
- ✅ 移除已删除方法的导出

#### 保留内容：
- ✅ 所有模块导入结构
- ✅ 所有别名定义

**文件：**
- `tradingagents/dataflows/akshare.py`
- `tradingagents/dataflows/baostock.py`

---

## 📊 对齐结果对比表

### Stock 模块
| 方法 | Alpha Vantage | AKShare | BaoStock | 内部实现 |
|------|---------------|---------|----------|---------|
| get_stock | ✅ | ✅ | ✅ | ✅ 完全保留 |

### Fundamentals 模块
| 方法 | Alpha Vantage | AKShare | BaoStock | 内部实现 |
|------|---------------|---------|----------|---------|
| get_fundamentals | ✅ | ✅ | ✅ | ✅ 完全保留 |
| get_balance_sheet | ✅ | ✅ | ✅ | ✅ 完全保留 |
| get_income_statement | ✅ | ✅ | ✅ | ✅ 完全保留 |
| get_cashflow | ✅ | ✅ | ✅ | ✅ 完全保留 |

### News 模块
| 方法 | Alpha Vantage | AKShare | BaoStock | 内部实现 |
|------|---------------|---------|----------|---------|
| get_news | ✅ | ✅ | ✅ (不支持) | ✅ 完全保留 + 增强 |
| get_insider_transactions | ✅ | ✅ (不支持) | ✅ (不支持) | N/A |

### Indicators 模块
| 方法 | Alpha Vantage | AKShare | BaoStock | 内部实现 |
|------|---------------|---------|----------|---------|
| get_indicator | ✅ | ✅ | ✅ (不支持) | ✅ 完全保留 |

---

## 🎯 关键特性

### 1. **接口统一**
所有三个数据源现在使用相同的方法名称和参数签名，便于切换和维护。

### 2. **功能完整**
AKShare 的所有原有功能都被保留：
- ✅ 多市场支持（A股、港股、美股）
- ✅ 多新闻源集成
- ✅ 市场情绪分析
- ✅ 技术指标计算
- ✅ 财务数据获取

### 3. **内部方法保留**
所有内部辅助方法都被保留，可供其他模块或未来扩展使用：
- `_get_enhanced_fallback_news()`
- `_get_stock_specific_news()`
- `_get_global_news_internal()`
- `_get_aggregated_news_internal()`
- `_get_market_sentiment_internal()`
- `_parse_year_parameter()`
- `calculate_*()` 系列技术指标计算函数

### 4. **优雅降级**
对于不支持的功能，返回友好的提示信息而不是抛出错误。

---

## 📝 使用示例

### 统一的调用方式：

```python
# Stock 数据 - 三个数据源使用相同的接口
from tradingagents.dataflows.alpha_vantage_stock import get_stock as av_get_stock
from tradingagents.dataflows.akshare_stock import get_stock as ak_get_stock
from tradingagents.dataflows.baostock_stock import get_stock as bs_get_stock

data = av_get_stock("AAPL", "2024-01-01", "2024-12-31")
data = ak_get_stock("600000", "2024-01-01", "2024-12-31")
data = bs_get_stock("sh.600000", "2024-01-01", "2024-12-31")

# News 数据 - AKShare 保留了所有原有功能
from tradingagents.dataflows.akshare_news import get_news

# 获取个股新闻（内部会尝试多个新闻源）
news = get_news("600000", "2024-01-01", "2024-12-31")

# 内部方法仍然可用（如果需要）
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

## ⚠️ 破坏性变更

### 方法名称变更：
- `get_stock_data()` → `get_stock()`
- `get_stock_news()` → `get_news()`
- `get_akshare_indicators()` → `get_indicator()`

### 参数名称变更：
- Fundamentals 模块：`symbol` → `ticker`
- News 模块：`query` → `ticker`
- BaoStock Fundamentals：`year`/`quarter` → `freq`/`curr_date`

### 注意事项：
1. **旧代码需要更新方法名称**
2. **参数名称需要对应修改**
3. **内部方法仍然可用**（以 `_` 开头的方法）
4. **所有业务逻辑保持不变**

---

## ✅ 验证状态

所有修改的文件已通过语法检查，无诊断错误：
- ✅ akshare_stock.py - 内部实现完全保留
- ✅ baostock_stock.py - 内部实现完全保留
- ✅ akshare_fundamentals.py - 内部实现完全保留
- ✅ baostock_fundamentals.py - 内部实现完全保留
- ✅ akshare_news.py - **所有功能完全保留**
- ✅ baostock_news.py - 新建
- ✅ akshare_indicators.py - **所有计算逻辑完全保留**
- ✅ baostock_indicators.py - 新建

---

## 🎉 总结

此次对齐工作：
- ✅ **统一了接口**：所有数据源使用相同的方法名称和参数
- ✅ **保留了功能**：AKShare 和 BaoStock 的所有原有功能都被保留
- ✅ **保持了灵活性**：内部方法仍然可用，支持高级用法
- ✅ **提高了可维护性**：代码结构更清晰，更易于理解和维护

**重要提示**：虽然对外接口统一了，但 AKShare 的强大功能（如多新闻源、市场情绪分析等）都通过内部方法保留下来，可以在需要时直接调用！
