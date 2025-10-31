# 实时行情接口配置说明

## 更新日期
2025-11-01

## 更新概述
将实时行情工具 `get_realtime_quote` 添加到数据流接口配置系统中，支持通过统一的路由机制调用，并为未来添加其他数据源预留扩展空间。

## 配置更新

### 1. 导入实时行情函数

**文件**: `tradingagents/dataflows/interface.py`

```python
from .akshare_stock import get_stock_realtime_quote as get_akshare_realtime_quote
```

### 2. 添加到工具分类

在 `TOOLS_CATEGORIES` 中添加到 `core_stock_apis` 类别：

```python
TOOLS_CATEGORIES = {
    "core_stock_apis": {
        "description": "OHLCV stock price data",
        "tools": [
            "get_stock_data",
            "get_realtime_quote"  # 新增
        ]
    },
    # ... 其他类别
}
```

### 3. 添加到供应商映射

在 `VENDOR_METHODS` 中添加实时行情的供应商配置：

```python
VENDOR_METHODS = {
    # core_stock_apis
    "get_stock_data": {
        "akshare": get_akshare_stock,
        "alpha_vantage": get_alpha_vantage_stock,
        "yfinance": get_YFin_data_online,
        "local": get_YFin_data,
    },
    "get_realtime_quote": {
        "akshare": get_akshare_realtime_quote,
        # Future: Add other vendors as they become available
        # "yfinance": get_yfinance_realtime_quote,
        # "alpha_vantage": get_alpha_vantage_realtime_quote,
    },
    # ... 其他方法
}
```

### 4. 更新工具实现

**文件**: `tradingagents/agents/utils/realtime_quote_tools.py`

从直接调用改为通过接口路由：

**之前**：
```python
from tradingagents.dataflows.akshare_stock import get_stock_realtime_quote

@tool
def get_realtime_quote(symbol: str) -> str:
    return get_stock_realtime_quote(symbol)
```

**之后**：
```python
from tradingagents.dataflows.interface import route_to_vendor

@tool
def get_realtime_quote(symbol: str) -> str:
    return route_to_vendor("get_realtime_quote", symbol)
```

## 配置系统工作原理

### 1. 工具分类

实时行情工具属于 `core_stock_apis` 类别，与 `get_stock_data` 同类。

### 2. 供应商路由

调用流程：
```
Agent调用 get_realtime_quote
    ↓
route_to_vendor("get_realtime_quote", symbol)
    ↓
识别市场类型（A股/美股/港股）
    ↓
选择供应商（当前：akshare）
    ↓
调用 get_akshare_realtime_quote(symbol)
    ↓
返回实时行情数据
```

### 3. 市场识别

系统会自动识别股票代码所属市场：
- **A股**: 600000, 000001, SH600000 等
- **美股**: AAPL, TSLA 等
- **港股**: 00700, 9988 等

### 4. 供应商优先级

当前配置：
- **主要供应商**: akshare（雪球接口）
- **备用供应商**: 暂无（预留扩展）

未来可添加：
- yfinance
- alpha_vantage
- 其他实时数据源

## 配置选项

### 默认配置

在 `default_config.py` 中可以配置：

```python
# 工具级别配置（优先级最高）
tool_vendors = {
    "get_realtime_quote": "akshare",  # 指定实时行情使用akshare
}

# 类别级别配置
data_vendors = {
    "core_stock_apis": "akshare",  # 所有核心股票API使用akshare
}
```

### 市场级别配置

```python
# 按市场配置供应商
market_vendors = {
    "A_STOCK": {
        "primary": "akshare",
        "fallback": ["yfinance"]
    },
    "US_STOCK": {
        "primary": "yfinance",
        "fallback": ["akshare", "alpha_vantage"]
    },
    "HK_STOCK": {
        "primary": "yfinance",
        "fallback": ["akshare"]
    }
}
```

## 扩展性设计

### 添加新的数据源

未来如果要添加其他实时行情数据源，只需：

1. **实现数据源函数**
```python
# tradingagents/dataflows/yfinance_realtime.py
def get_yfinance_realtime_quote(symbol: str) -> str:
    """Get realtime quote from yfinance"""
    # 实现代码
    pass
```

2. **导入到interface.py**
```python
from .yfinance_realtime import get_yfinance_realtime_quote
```

3. **添加到VENDOR_METHODS**
```python
"get_realtime_quote": {
    "akshare": get_akshare_realtime_quote,
    "yfinance": get_yfinance_realtime_quote,  # 新增
},
```

4. **配置供应商优先级**
```python
tool_vendors = {
    "get_realtime_quote": "yfinance,akshare",  # yfinance优先，akshare备用
}
```

### 自动回退机制

系统支持自动回退：
```python
# 如果yfinance失败，自动尝试akshare
"get_realtime_quote": {
    "yfinance": get_yfinance_realtime_quote,
    "akshare": get_akshare_realtime_quote,
}
```

调用时会按顺序尝试：
1. 尝试 yfinance
2. 如果失败，尝试 akshare
3. 如果都失败，抛出异常

## 使用示例

### 通过Agent使用

```python
# Agent会自动通过路由系统调用
from tradingagents.agents.utils.agent_utils import get_realtime_quote

# LLM会调用这个工具
result = get_realtime_quote.invoke({"symbol": "600000"})
```

### 直接调用

```python
from tradingagents.dataflows.interface import route_to_vendor

# 通过路由系统调用
quote = route_to_vendor("get_realtime_quote", "600000")
```

### 指定供应商

```python
from tradingagents.dataflows.akshare_stock import get_stock_realtime_quote

# 直接调用特定供应商
quote = get_stock_realtime_quote("600000")
```

## 调试信息

系统会输出详细的调试信息：

```
DEBUG: Symbol '600000' identified as A_STOCK market
DEBUG: get_realtime_quote for A_STOCK market ('600000') - Vendor order: [akshare]
DEBUG: Attempting PRIMARY vendor 'akshare' for get_realtime_quote (A_STOCK) (attempt #1)
DEBUG: Calling get_stock_realtime_quote from vendor 'akshare'...
SUCCESS: get_stock_realtime_quote from vendor 'akshare' completed successfully
FINAL: Method 'get_realtime_quote' completed with 1 result(s) from 1 vendor attempt(s)
```

## 配置优先级

系统按以下优先级选择供应商：

1. **工具级别配置** (`tool_vendors`)
   ```python
   tool_vendors = {
       "get_realtime_quote": "akshare"
   }
   ```

2. **类别级别配置** (`data_vendors`)
   ```python
   data_vendors = {
       "core_stock_apis": "akshare"
   }
   ```

3. **市场级别配置** (`market_vendors`)
   ```python
   market_vendors = {
       "A_STOCK": {"primary": "akshare"}
   }
   ```

4. **默认配置**
   - 使用 `VENDOR_METHODS` 中定义的第一个供应商

## 环境要求

### AkShare供应商
- 需要设置 `XUEQIU_TOKEN` 环境变量
- 参见：[docs/XUEQIU_TOKEN_SETUP.md](XUEQIU_TOKEN_SETUP.md)

### 未来供应商
- yfinance: 无需特殊配置
- alpha_vantage: 需要 `ALPHA_VANTAGE_API_KEY`

## 优势

### 1. 统一接口
- ✅ 所有数据源通过统一的路由系统访问
- ✅ Agent无需关心具体使用哪个数据源
- ✅ 配置集中管理

### 2. 灵活配置
- ✅ 支持多级配置（工具/类别/市场）
- ✅ 可按需切换数据源
- ✅ 支持供应商优先级

### 3. 自动回退
- ✅ 主供应商失败自动尝试备用
- ✅ 提高系统可靠性
- ✅ 详细的调试日志

### 4. 易于扩展
- ✅ 添加新数据源只需3步
- ✅ 无需修改Agent代码
- ✅ 向后兼容

## 测试验证

### 1. 测试路由系统
```python
from tradingagents.dataflows.interface import route_to_vendor

# 测试A股
result = route_to_vendor("get_realtime_quote", "600000")
assert "Current_Price" in result

# 测试美股
result = route_to_vendor("get_realtime_quote", "AAPL")
assert "Current_Price" in result
```

### 2. 测试Agent集成
```python
from tradingagents.agents.utils.realtime_quote_tools import get_realtime_quote

# 测试工具调用
result = get_realtime_quote.invoke({"symbol": "600000"})
assert result is not None
```

### 3. 测试配置切换
```python
# 在default_config.py中修改配置
tool_vendors = {
    "get_realtime_quote": "yfinance"  # 切换到yfinance
}

# 重新运行测试
result = route_to_vendor("get_realtime_quote", "AAPL")
```

## 相关文档

- [实时行情快速开始](REALTIME_QUOTES_QUICKSTART.md)
- [雪球Token配置](XUEQIU_TOKEN_SETUP.md)
- [实时行情实现详解](REALTIME_QUOTES_IMPLEMENTATION.md)
- [Agent集成说明](REALTIME_QUOTE_AGENT_INTEGRATION.md)

## 总结

本次更新将实时行情工具完整集成到数据流接口配置系统中：

1. ✅ 添加到工具分类 (`TOOLS_CATEGORIES`)
2. ✅ 配置供应商映射 (`VENDOR_METHODS`)
3. ✅ 更新工具实现使用路由系统
4. ✅ 预留扩展空间支持未来添加其他数据源

系统现在具有：
- 统一的接口调用方式
- 灵活的配置选项
- 自动的回退机制
- 良好的扩展性

为未来添加更多实时数据源奠定了基础。

---

**更新执行者**：Kiro AI Assistant  
**更新日期**：2025-11-01  
**文档版本**：1.0
