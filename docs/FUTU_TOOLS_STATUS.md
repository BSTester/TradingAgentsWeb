# Futu 工具方法状态总结

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI 路由层                            │
│         (web/backend/routes/intraday_trading_routes.py)     │
│                         ↓                                    │
│                  异步封装层                                   │
│         (web/backend/services/futu_async_wrapper.py)        │
│                         ↓                                    │
│                  同步工具方法                                 │
│         (tradingagents/dataflows/futu_trading.py)           │
│                         ↓                                    │
│                    Futu API                                  │
└─────────────────────────────────────────────────────────────┘
```

## 当前实现状态

### ✅ 已完成

#### 1. 同步工具方法 (`futu_trading.py`)
- `get_account_info()` - 获取账户信息
- `get_positions()` - 获取持仓（包含数据库查询和持仓天数计算）
- `get_orders()` - 获取订单列表
- `cancel_order()` - 撤销订单
- `place_order()` - 下单
- `get_quote()` - 获取行情
- `get_kline_data()` - 获取K线数据
- `get_hot_stocks()` - 获取热门股票
- `get_technical_analysis()` - 获取技术分析
- `get_hot_news()` - 获取热门新闻

**特性**：
- ✅ 自动从用户配置缓存读取 API URL 和 Key
- ✅ 统一的错误处理 (`FutuAPIError`)
- ✅ 连接池和重试逻辑
- ✅ 详细的日志记录

#### 2. 异步封装层 (`futu_async_wrapper.py`)
- `get_account_info_async()`
- `get_positions_async()`
- `get_orders_async()`
- `cancel_order_async()`
- `place_order_async()`
- `get_quote_async()`
- `get_kline_data_async()`
- `get_hot_stocks_async()`
- `get_technical_analysis_async()`
- `get_hot_news_async()`

**特性**：
- ✅ 使用 `asyncio.to_thread()` 在线程池中执行同步方法
- ✅ 统一的错误处理（返回 None）
- ✅ 日志记录

### ⏳ 待优化

#### 路由层 (`intraday_trading_routes.py`)

**当前问题**：
- ❌ 部分端点还在直接使用 `httpx` 调用 Futu API
- ❌ 配置读取逻辑重复
- ❌ 错误处理不统一

**需要修改的端点**：
1. `/api/intraday/positions` - 目前直接使用 `httpx`
2. `/api/intraday/account` - 目前直接使用 `httpx`
3. `/api/intraday/scheduler/validate-config` - 目前直接使用 `httpx`

**已使用 wrapper 的端点**：
- ✅ `/api/intraday/orders` - 使用 `get_orders_async()`
- ✅ `/api/intraday/cancel-order` - 使用 `cancel_order_async()`

## `get_positions` 工具方法详解

### 当前实现

```python
def get_positions(market_type: str, user_id: Optional[int] = None):
    """
    获取持仓信息
    
    功能：
    1. 调用 Futu API 获取持仓数据
    2. 从数据库查询首次开仓时间
    3. 计算持仓天数
    4. 返回enriched数据
    """
```

### 包含的功能

✅ **API 调用**：
- 使用 `_make_request()` 调用 Futu API
- 自动从用户配置读取 URL 和 Key

✅ **数据库查询**：
- 查询 `IntradayPosition` 表
- 获取 `first_open_time`

✅ **持仓天数计算**：
```python
now = datetime.now(timezone.utc)
first_open = db_position.first_open_time
holding_duration = now - first_open
pos['holding_days'] = holding_duration.days
```

✅ **返回字段**：
- `stock_code` - 股票代码
- `stock_name` - 股票名称
- `quantity` - 持仓数量
- `cost_price` - 成本价
- `current_price` - 当前价
- `market_value` - 市值
- `profit_loss` - 盈亏金额
- `profit_loss_pct` - 盈亏百分比
- `first_open_time` - 首次开仓时间（ISO格式）
- `holding_days` - 持仓天数

### 路由层需要添加的字段

路由层还需要添加以下字段（这些不应该在工具方法中）：

1. **持仓比例** (`position_ratio`)：
   - 需要先获取账户总资产
   - 计算：`(market_value / total_assets) * 100`

2. **货币符号** (`currency`)：
   - 根据市场类型映射：US→$, HK→HK$, CN→¥

3. **数据库同步**：
   - 调用 `sync_positions_to_db()` 同步到数据库

## 建议的重构方案

### 方案：保持当前架构，优化路由层

**优点**：
- 工具方法保持纯粹（只负责 API 调用和基础数据处理）
- 路由层负责业务逻辑（持仓比例、货币符号等）
- 清晰的职责分离

**实施步骤**：

1. **修改 `/api/intraday/positions` 端点**：
```python
from web.backend.services.futu_async_wrapper import get_positions_async, get_account_info_async

@router.get("/positions")
async def get_positions_endpoint(
    market: str = "US",
    current_user: User = Depends(require_intraday_access),
    db: AsyncSession = Depends(get_db),
):
    try:
        # 使用异步wrapper获取持仓
        positions = await get_positions_async(market, current_user.id)
        if not positions:
            return []
        
        # 同步到数据库
        await sync_positions_to_db(db, current_user.id, positions, market)
        
        # 获取账户信息计算持仓比例
        account_info = await get_account_info_async(market, current_user.id)
        total_assets = account_info.get("net_asset", 0.0) if account_info else 0.0
        
        # 添加额外字段
        currency_map = {"US": "$", "HK": "HK$", "CN": "¥"}
        currency = currency_map.get(market, "$")
        
        result = []
        for pos in positions:
            market_value = pos.get('market_value', 0.0)
            position_ratio = (market_value / total_assets * 100) if total_assets > 0 else 0
            
            result.append({
                **pos,  # 包含所有原有字段
                "position_ratio": round(position_ratio, 2),
                "currency": currency,
                "pnl": pos.get('profit_loss', 0),
                "pnl_percent": pos.get('profit_loss_pct', 0) * 100,
            })
        
        return result
    except Exception as e:
        logger.error(f"Error fetching positions: {e}")
        return []
```

2. **修改 `/api/intraday/account` 端点**：
```python
from web.backend.services.futu_async_wrapper import get_account_info_async

@router.get("/account")
async def get_account_endpoint(
    market: str = "US",
    current_user: User = Depends(require_intraday_access),
):
    try:
        # 使用异步wrapper
        account_info = await get_account_info_async(market, current_user.id)
        
        if not account_info:
            return {
                "total_assets": 0.0,
                "cash": 0.0,
                "position_value": 0.0,
                "market": market,
                "currency": {"US": "$", "HK": "HK$", "CN": "¥"}.get(market, "$"),
                "configured": False,
            }
        
        # 添加额外字段
        currency_map = {"US": "$", "HK": "HK$", "CN": "¥"}
        return {
            "total_assets": account_info.get("net_asset", 0.0),
            "cash": account_info.get("cash", 0.0),
            "position_value": account_info.get("market_value", 0.0),
            "today_profit_loss": account_info.get("today_profit_loss", 0.0),
            "today_profit_loss_ratio": account_info.get("today_profit_loss_ratio", 0.0),
            "market": market,
            "currency": currency_map.get(market, "$"),
            "configured": True,
        }
    except Exception as e:
        logger.error(f"Error fetching account: {e}")
        return {"error": str(e), "configured": False}
```

3. **修改 `/api/intraday/scheduler/validate-config` 端点**：
```python
from web.backend.services.futu_async_wrapper import get_hot_news_async

@router.post("/scheduler/validate-config")
async def validate_futu_config(
    config: IntradayConfigRequest,
    current_user: User = Depends(require_intraday_access),
):
    try:
        if not config.futu_api_url:
            raise HTTPException(status_code=400, detail="请提供富途API地址")
        
        # 使用异步wrapper测试连接
        news = await get_hot_news_async("en-us", current_user.id)
        
        if news is not None:
            return {"valid": True, "message": "富途API配置验证成功"}
        else:
            return {"valid": False, "message": "富途API验证失败"}
    except Exception as e:
        return {"valid": False, "message": f"验证失败: {str(e)}"}
```

## 总结

### 当前架构优势

1. **清晰的分层**：
   - 工具方法：纯粹的 API 调用和基础数据处理
   - 异步封装：线程池执行，不阻塞事件循环
   - 路由层：业务逻辑和数据组装

2. **易于维护**：
   - API 变更只需修改工具方法
   - 业务逻辑变更只需修改路由层
   - 测试更容易

3. **性能优化**：
   - 连接池复用
   - 自动重试
   - 配置缓存

### 下一步行动

1. ✅ 确认 `get_positions` 工具方法已包含持仓天数计算
2. ⏳ 修改 `/api/intraday/positions` 使用 `futu_async_wrapper`
3. ⏳ 修改 `/api/intraday/account` 使用 `futu_async_wrapper`
4. ⏳ 修改 `/api/intraday/scheduler/validate-config` 使用 `futu_async_wrapper`
5. ⏳ 测试所有端点
6. ⏳ 删除路由中的 `httpx` 直接调用代码
