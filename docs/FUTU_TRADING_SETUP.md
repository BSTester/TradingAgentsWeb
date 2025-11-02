# Futu Mock Trading API Setup Guide

本文档说明如何配置和使用 Futu 模拟交易 API 集成功能。

## 概述

TradingAgents 集成了富途（Futu）模拟交易 API，支持在美股、港股、A股市场进行模拟交易。该功能允许交易执行代理（Trading Executor Agent）根据分析结果自动执行买卖操作。

## 功能特性

- **多市场支持**: 美股（US）、港股（HK）、A股（CN）
- **账户管理**: 查询账户余额、持仓信息
- **实时行情**: 获取股票实时报价和K线数据
- **交易执行**: 下单（限价单/市价单）、撤单、查询订单
- **资讯获取**: 热门股票、热门新闻

## 环境变量配置

在项目根目录的 `.env` 文件中添加以下配置：

```bash
# Futu API 基础地址（必填）
# 指向你的 Futu 模拟交易 API 服务地址
FUTU_API_BASE_URL=http://localhost:8000

# API 请求超时时间（可选，默认30秒）
FUTU_API_TIMEOUT=30
```

### 配置说明

1. **FUTU_API_BASE_URL**
   - 必填项
   - 指向 Futu 模拟交易 API 服务的基础地址
   - 示例：
     - 本地服务：`http://localhost:8000`
     - 内网服务：`http://192.168.1.100:8000`
     - 域名服务：`https://futu-api.example.com`

2. **FUTU_API_TIMEOUT**
   - 可选项，默认值为 30 秒
   - 设置 API 请求的超时时间
   - 建议根据网络状况调整（10-60秒）

## API 端点说明

### 账户管理

#### 获取账户信息
```
GET /api/account?market_type={US|HK|CN}
```
返回账户净值、现金、持仓市值、盈亏等信息。

#### 获取持仓列表
```
GET /api/positions?market_type={US|HK|CN}
```
返回所有股票持仓信息。

### 市场数据

#### 获取股票行情
```
GET /api/quote?stock_code={symbol}&market_type={US|HK|CN}
```
返回实时行情数据。

#### 获取K线数据
```
GET /api/kline?stock_code={symbol}&market_type={US|HK|CN}&kline_type={1-11}
```
K线类型：1=分时, 2=日K, 3=周K, 4=月K, 5=年K, 11=季K

#### 获取热门股票
```
GET /api/hot-stocks?market_type={US|HK|CN}&count={number}
```

### 交易操作

#### 下单
```
POST /api/trade
Content-Type: application/json

{
  "stock_code": "AAPL",
  "market_type": "US",
  "side": "BUY",
  "quantity": 10,
  "price": 180.50,
  "order_type": "LIMIT"
}
```

#### 撤单
```
POST /api/cancel
Content-Type: application/json

{
  "order_id": "123456789",
  "market_type": "US"
}
```

#### 查询订单
```
GET /api/orders?market_type={US|HK|CN}&filter_status={0-3}
```
状态过滤：0=全部, 1=已成交, 2=等待成交, 3=已撤单

### 资讯信息

#### 获取热门新闻
```
GET /api/hot-news?lang={zh-cn|zh-hk|en-us}
```

## 使用示例

### Python 代码示例

```python
from tradingagents.dataflows.futu_trading import (
    get_account_info,
    get_positions,
    get_quote,
    place_order,
    get_orders
)

# 1. 查询账户信息
account = get_account_info("US")
print(f"可用资金: {account['cash']}")

# 2. 查询当前持仓
positions = get_positions("US")
for pos in positions:
    print(f"{pos['stock_code']}: {pos['quantity']} 股")

# 3. 获取实时行情
quote = get_quote("AAPL", "US")
print(f"当前价格: {quote['current_price']}")

# 4. 下限价买单
result = place_order(
    stock_code="AAPL",
    market_type="US",
    side="BUY",
    quantity=10,
    price=180.50,
    order_type="LIMIT"
)
if result['success']:
    print(f"订单已提交: {result['order_id']}")

# 5. 查询订单状态
orders = get_orders("US", filter_status=2)  # 查询等待成交的订单
for order in orders:
    print(f"订单 {order['order_id']}: {order['status']}")
```

### 在 Agent 中使用

Trading Executor Agent 会自动使用这些工具：

```python
from tradingagents.agents.trader.trading_executor import create_trading_executor

# 创建交易执行代理
executor = create_trading_executor(llm, memory)

# 代理会自动：
# 1. 解析交易建议（BUY/SELL/HOLD）
# 2. 验证账户余额和持仓
# 3. 获取当前市场价格
# 4. 执行交易订单
# 5. 验证订单状态
```

## 市场类型识别

系统会根据股票代码自动识别市场类型：

- **美股 (US)**: 字母代码，如 AAPL, TSLA, NVDA
- **港股 (HK)**: 5位数字或带.HK后缀，如 00700, 09988, 00700.HK
- **A股 (CN)**: 6位数字，如 600519, 000001, 300750

## 错误处理

### 常见错误及解决方案

1. **连接错误**
   ```
   Error: Failed to connect to Futu API
   ```
   - 检查 `FUTU_API_BASE_URL` 是否正确
   - 确认 Futu API 服务是否运行
   - 检查网络连接

2. **认证错误**
   ```
   Error: Authentication failed - Cookie may have expired
   ```
   - Cookie 已过期，需要重新获取
   - 联系 API 服务管理员

3. **参数错误**
   ```
   Error: Invalid market_type
   ```
   - 检查市场类型是否为 US/HK/CN
   - 检查股票代码格式是否正确

4. **业务错误**
   ```
   Error: Insufficient funds
   ```
   - 账户余额不足，无法买入
   - 调整订单数量或充值

## 安全注意事项

1. **环境变量保护**
   - 不要将 `.env` 文件提交到版本控制系统
   - 使用 `.gitignore` 排除敏感配置文件

2. **API 访问控制**
   - 仅在内网环境使用
   - 配置防火墙规则限制访问
   - 使用 HTTPS 加密传输（生产环境）

3. **模拟交易限制**
   - 这是模拟交易账户，不涉及真实资金
   - 用于测试和学习目的
   - 不要用于生产环境的真实交易

## 故障排查

### 检查 API 连接

```bash
# 测试 API 是否可访问
curl http://localhost:8000/health

# 测试账户接口
curl "http://localhost:8000/api/account?market_type=US"
```

### 查看日志

```python
import logging

# 启用详细日志
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("tradingagents.futu_trading")
```

### 验证配置

```python
from tradingagents.dataflows.futu_trading import _get_base_url, _get_timeout

print(f"Base URL: {_get_base_url()}")
print(f"Timeout: {_get_timeout()}")
```

## 相关文档

- [API 完整文档](http://localhost:8000/api-docs) - 访问 Futu API 服务查看完整 API 文档
- [TradingAgents 架构](../README.md) - 了解整体系统架构
- [环境配置指南](./ENV_SETUP.md) - 完整的环境变量配置说明

## 技术支持

如遇到问题，请：

1. 查看本文档的故障排查部分
2. 检查 API 服务日志
3. 查看 TradingAgents 日志输出
4. 联系技术支持团队

## 更新日志

- **2025-11-02**: 初始版本，支持基础交易功能
