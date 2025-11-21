# Futu Trading DataFlow Module

富途模拟交易 API 数据流模块，提供账户管理、市场数据、交易执行等功能。

## 模块概述

`futu_trading.py` 模块提供了与富途模拟交易 API 交互的 Python 接口，支持：

- **账户管理**: 查询账户信息、持仓列表
- **市场数据**: 实时行情、K线数据、热门股票
- **交易执行**: 下单、撤单、查询订单
- **资讯信息**: 热门新闻

## 快速开始

### 1. 配置环境变量

在 `.env` 文件中添加：

```bash
FUTU_API_BASE_URL=http://localhost:8000
FUTU_API_TIMEOUT=30
```

### 2. 导入模块

```python
from tradingagents.dataflows.futu_trading import (
    get_account_info,
    get_positions,
    get_quote,
    place_order,
    FutuAPIError
)
```

### 3. 使用示例

```python
# 查询账户
account = get_account_info("US")
print(f"可用资金: {account['cash']}")

# 获取行情
quote = get_quote("AAPL", "US")
print(f"当前价格: {quote['current_price']}")

# 下单
result = place_order(
    stock_code="AAPL",
    market_type="US",
    side="BUY",
    quantity=10,
    price=180.50
)
```

## API 函数列表

### 账户管理

#### `get_account_info(market_type: str) -> Dict`

获取账户信息。

**参数:**
- `market_type`: 市场类型 (US/HK/CN)

**返回:**
```python
{
    "net_asset_value": 100000.0,  # 账户净值
    "cash": 50000.0,               # 可用资金
    "position_value": 50000.0,     # 持仓市值
    "profit_loss": 5000.0,         # 总盈亏
    "profit_loss_pct": 5.0         # 盈亏百分比
}
```

#### `get_positions(market_type: str) -> List[Dict]`

获取持仓列表。

**参数:**
- `market_type`: 市场类型 (US/HK/CN)

**返回:**
```python
[
    {
        "stock_code": "AAPL",
        "stock_name": "Apple Inc.",
        "quantity": 100,
        "available_quantity": 100,
        "cost_price": 150.0,
        "current_price": 180.0,
        "market_value": 18000.0,
        "profit_loss": 3000.0,
        "profit_loss_pct": 20.0
    }
]
```

### 市场数据

#### `get_quote(stock_code: str, market_type: str) -> Dict`

获取实时行情。

**参数:**
- `stock_code`: 股票代码 (如 AAPL, 00700, 600519)
- `market_type`: 市场类型 (US/HK/CN)

**返回:**
```python
{
    "stock_code": "AAPL",
    "stock_name": "Apple Inc.",
    "current_price": 180.50,
    "open_price": 179.00,
    "high_price": 181.00,
    "low_price": 178.50,
    "previous_close": 179.50,
    "volume": 50000000,
    "change": 1.00,
    "change_pct": 0.56,
    "timestamp": "2025-11-02 15:30:00"
}
```

#### `get_kline_data(stock_code: str, market_type: str, kline_type: int = 1) -> List[Dict]`

获取K线数据。

**参数:**
- `stock_code`: 股票代码
- `market_type`: 市场类型 (US/HK/CN)
- `kline_type`: K线类型
  - 1: 分时
  - 2: 日K
  - 3: 周K
  - 4: 月K
  - 5: 年K
  - 11: 季K

**返回:**
```python
[
    {
        "timestamp": "2025-11-02 09:30:00",
        "open": 179.00,
        "high": 181.00,
        "low": 178.50,
        "close": 180.50,
        "volume": 50000000
    }
]
```

#### `get_hot_stocks(market_type: str = "US", count: int = 10) -> List[Dict]`

获取热门股票。

**参数:**
- `market_type`: 市场类型，默认 US
- `count`: 返回数量，默认 10

**返回:**
```python
[
    {
        "stock_code": "AAPL",
        "stock_name": "Apple Inc.",
        "current_price": 180.50,
        "change_pct": 2.5,
        "volume": 50000000
    }
]
```

### 交易操作

#### `place_order(...) -> Dict`

下单（买入/卖出）。

**参数:**
- `stock_code`: 股票代码
- `market_type`: 市场类型 (US/HK/CN)
- `side`: 交易方向 (BUY/SELL)
- `quantity`: 数量
- `price`: 价格（限价单必填）
- `order_type`: 订单类型 (LIMIT/MARKET)，默认 LIMIT
- `security_type`: 证券类型 (STOCK/ETF/OPTION)，默认 STOCK

**返回:**
```python
{
    "success": True,
    "message": "订单已提交",
    "order_id": "123456789",
    "data": {...}
}
```

**示例:**
```python
# 限价买单
result = place_order(
    stock_code="AAPL",
    market_type="US",
    side="BUY",
    quantity=10,
    price=180.50,
    order_type="LIMIT"
)

# 市价卖单
result = place_order(
    stock_code="AAPL",
    market_type="US",
    side="SELL",
    quantity=10,
    order_type="MARKET"
)
```

#### `cancel_order(order_id: str, market_type: str) -> Dict`

撤销订单。

**参数:**
- `order_id`: 订单ID
- `market_type`: 市场类型 (US/HK/CN)

**返回:**
```python
{
    "success": True,
    "message": "订单已撤销",
    "order_id": "123456789",
    "data": {...}
}
```

#### `get_orders(market_type: str, filter_status: int = 0) -> List[Dict]`

查询订单。

**参数:**
- `market_type`: 市场类型 (US/HK/CN)
- `filter_status`: 状态过滤
  - 0: 全部订单
  - 1: 已成交
  - 2: 等待成交
  - 3: 已撤单

**返回:**
```python
[
    {
        "order_id": "123456789",
        "stock_code": "AAPL",
        "side": "BUY",
        "quantity": 10,
        "price": 180.50,
        "order_type": "LIMIT",
        "status": "pending",
        "filled_quantity": 0,
        "create_time": "2025-11-02 10:00:00",
        "update_time": "2025-11-02 10:00:00"
    }
]
```

### 资讯信息

#### `get_hot_news(lang: str = "zh-cn") -> List[Dict]`

获取热门新闻。

**参数:**
- `lang`: 语言代码 (zh-cn/zh-hk/en-us)，默认 zh-cn

**返回:**
```python
[
    {
        "title": "新闻标题",
        "url": "https://...",
        "source": "新闻来源",
        "publish_time": "2025-11-02 10:00:00",
        "summary": "新闻摘要",
        "related_stocks": ["AAPL", "TSLA"]
    }
]
```

## 错误处理

### FutuAPIError 异常

所有 API 调用失败时会抛出 `FutuAPIError` 异常。

**异常属性:**
- `error_type`: 错误类型 (network/auth/validation/business/api)
- `error_code`: 错误代码
- `details`: 错误详情
- `retry_able`: 是否可重试

**示例:**
```python
try:
    account = get_account_info("US")
except FutuAPIError as e:
    print(f"错误类型: {e.error_type}")
    print(f"错误信息: {e}")
    if e.retry_able:
        print("可以重试")
```

### 错误类型

1. **network**: 网络错误（连接超时、连接失败）
2. **auth**: 认证错误（Cookie过期）
3. **validation**: 参数验证错误
4. **business**: 业务逻辑错误（余额不足、持仓不足）
5. **api**: API 错误（服务器错误、请求错误）

## 配置说明

### 环境变量

- `FUTU_API_BASE_URL`: API 基础地址（必填）
- `FUTU_API_TIMEOUT`: 请求超时时间（可选，默认30秒）

### 获取配置

```python
from tradingagents.dataflows.futu_trading import _get_base_url, _get_timeout

base_url = _get_base_url()
timeout = _get_timeout()
```

## 日志记录

模块使用 Python logging 记录操作日志。

**启用日志:**
```python
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("tradingagents.futu_trading")
```

**日志级别:**
- DEBUG: 请求/响应详情
- INFO: 成功操作
- WARNING: 可重试错误
- ERROR: 不可重试错误
- CRITICAL: 系统级故障

## 性能优化

### 连接池

模块使用 requests Session 实现连接池，自动复用 HTTP 连接。

### 重试机制

自动重试以下错误：
- 429: 请求过多
- 500-504: 服务器错误

重试策略：
- 最多重试 3 次
- 指数退避（1秒、2秒、4秒）

### 超时设置

默认超时 30 秒，可通过环境变量调整：
```bash
FUTU_API_TIMEOUT=60  # 60秒超时
```

## 完整示例

查看 `examples/futu_trading_example.py` 获取完整使用示例。

## 相关文档

- [Futu Trading Setup Guide](../../docs/FUTU_TRADING_SETUP.md) - 配置指南
- [API Documentation](http://localhost:8000/api-docs) - API 完整文档
- [Trading Executor Agent](../agents/trader/trading_executor.py) - 交易执行代理

## 技术支持

如有问题，请查看：
1. [故障排查指南](../../docs/FUTU_TRADING_SETUP.md#故障排查)
2. API 服务日志
3. TradingAgents 日志输出
