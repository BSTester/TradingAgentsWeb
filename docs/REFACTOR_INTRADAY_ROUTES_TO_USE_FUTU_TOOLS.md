# 重构智能盯盘路由使用 Futu 工具方法

## 当前状态

✅ **已完成**：
- `tradingagents/dataflows/futu_trading.py` - 提供同步的 Futu API 工具方法
- `web/backend/services/futu_async_wrapper.py` - 提供异步封装
- `get_positions` 工具方法已包含数据库查询和持仓天数计算

⏳ **待完成**：
- 路由层还在直接使用 `httpx` 调用 API
- 需要改为使用 `futu_async_wrapper` 中的方法

## 目标

将 `web/backend/routes/intraday_trading_routes.py` 中直接调用 Futu API 的代码改为使用 `futu_async_wrapper` 中的异步方法。

## 需要修改的端点

### 1. `/api/intraday/positions` - 获取持仓信息

**当前实现**：
- 直接使用 `httpx` 调用 Futu API
- 在路由层计算持仓天数
- 手动处理响应格式

**重构后**：
```python
from tradingagents.dataflows.futu_trading import get_positions

@router.get("/positions")
async def get_positions_endpoint(
    market: str = "US",
    current_user: User = Depends(require_intraday_access),
):
    """获取持仓信息"""
    try:
        # 使用工具方法，传入 user_id
        positions = get_positions(
            market_type=market,
            user_id=current_user.id
        )
        
        # 工具方法已经包含了持仓天数计算
        return positions
    except Exception as e:
        logger.error(f"Error fetching positions: {e}")
        return []
```

### 2. `/api/intraday/account` - 获取账户信息

**当前实现**：
- 直接使用 `httpx` 调用 Futu API
- 手动处理货币符号映射

**重构后**：
```python
from tradingagents.dataflows.futu_trading import get_account_info

@router.get("/account")
async def get_account_info_endpoint(
    market: str = "US",
    current_user: User = Depends(require_intraday_access),
):
    """获取账户信息"""
    try:
        # 使用工具方法
        account_data = get_account_info(
            market_type=market,
            user_id=current_user.id
        )
        
        # 添加货币符号
        currency_map = {"US": "$", "HK": "HK$", "CN": "¥"}
        account_data["currency"] = currency_map.get(market, "$")
        account_data["market"] = market
        account_data["configured"] = True
        
        return account_data
    except Exception as e:
        logger.error(f"Error fetching account: {e}")
        return {
            "total_assets": 0.0,
            "cash": 0.0,
            "position_value": 0.0,
            "market": market,
            "currency": currency_map.get(market, "$"),
            "configured": False,
            "error": str(e)
        }
```

### 3. `/api/intraday/orders` - 获取订单列表

**当前实现**：
- 使用 `futu_async_wrapper.get_orders_async`

**重构后**：
```python
from tradingagents.dataflows.futu_trading import get_orders

@router.get("/orders")
async def get_orders_endpoint(
    market: str = "US",
    filter_status: int = 0,
    current_user: User = Depends(require_intraday_access),
):
    """获取订单列表"""
    try:
        # 使用工具方法（同步调用，在线程池中执行）
        import asyncio
        loop = asyncio.get_event_loop()
        orders = await loop.run_in_executor(
            None,
            get_orders,
            market,
            filter_status,
            current_user.id
        )
        
        return orders if orders is not None else []
    except Exception as e:
        logger.error(f"Error fetching orders: {e}")
        return []
```

### 4. `/api/intraday/cancel-order` - 撤销订单

**当前实现**：
- 使用 `futu_async_wrapper.cancel_order_async`

**重构后**：
```python
from tradingagents.dataflows.futu_trading import cancel_order

@router.post("/cancel-order")
async def cancel_order_endpoint(
    request: CancelOrderRequest,
    current_user: User = Depends(require_intraday_access),
):
    """撤销订单"""
    try:
        # 使用工具方法（同步调用，在线程池中执行）
        import asyncio
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            cancel_order,
            request.order_id,
            request.stock_code,
            current_user.id
        )
        
        if result is None:
            raise HTTPException(status_code=500, detail="撤单失败")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling order: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

### 5. `/api/intraday/scheduler/validate-config` - 验证配置

**当前实现**：
- 直接使用 `httpx` 测试连接

**重构后**：
```python
from tradingagents.dataflows.futu_trading import get_hot_news

@router.post("/scheduler/validate-config")
async def validate_futu_config(
    config: IntradayConfigRequest,
    current_user: User = Depends(require_intraday_access),
):
    """验证 Futu API 配置"""
    try:
        if not config.futu_api_url:
            raise HTTPException(status_code=400, detail="请提供富途API地址")
        
        # 临时保存配置到用户配置缓存
        # 然后使用工具方法测试连接
        import asyncio
        loop = asyncio.get_event_loop()
        
        # 使用 get_hot_news 测试连接
        news = await loop.run_in_executor(
            None,
            get_hot_news,
            "en-us",
            current_user.id
        )
        
        if news is not None:
            return {"valid": True, "message": "富途API配置验证成功"}
        else:
            return {"valid": False, "message": "富途API验证失败"}
    except Exception as e:
        return {"valid": False, "message": f"验证失败: {str(e)}"}
```

## `get_positions` 工具方法增强

### 当前问题
- 持仓天数计算在路由层
- 数据库查询在工具方法中（已实现）
- 缺少货币符号和持仓比例

### 增强内容

在 `futu_trading.py` 的 `get_positions` 方法中添加：

1. **持仓比例计算**：
   - 需要先调用 `get_account_info` 获取总资产
   - 计算每个持仓的占比

2. **货币符号**：
   - 根据市场类型添加货币符号

3. **返回格式统一**：
```python
{
    "stock_code": "AAPL",
    "stock_name": "Apple Inc.",
    "market_type": "US",
    "quantity": 100,
    "cost_price": 180.50,
    "current_price": 185.20,
    "pnl": 470.00,
    "pnl_percent": 2.60,
    "position_value": 18520.00,
    "position_ratio": 15.2,  # 占总资产的百分比
    "holding_days": 8,
    "first_open_time": "2024-11-10T14:30:00+00:00",
    "currency": "$"
}
```

## 优势

### 1. 代码复用
- 所有 Futu API 调用统一在一个地方
- 减少重复代码

### 2. 配置统一
- 统一使用 `user_config_cache` 获取配置
- 自动处理 API Key 和 URL

### 3. 错误处理统一
- 统一的异常类型 `FutuAPIError`
- 统一的重试逻辑

### 4. 易于测试
- 工具方法可以独立测试
- Mock 更容易

### 5. 易于维护
- API 变更只需修改一个地方
- 日志记录统一

## 实施步骤

1. ✅ 确认 `get_positions` 已包含数据库查询逻辑
2. ⏳ 增强 `get_positions` 添加持仓比例和货币符号
3. ⏳ 重构 `/api/intraday/positions` 端点
4. ⏳ 重构 `/api/intraday/account` 端点
5. ⏳ 重构 `/api/intraday/orders` 端点
6. ⏳ 重构 `/api/intraday/cancel-order` 端点
7. ⏳ 重构 `/api/intraday/scheduler/validate-config` 端点
8. ⏳ 删除 `futu_async_wrapper.py`（如果不再需要）
9. ⏳ 测试所有端点
10. ⏳ 更新文档

## 注意事项

### 异步转同步
由于 `futu_trading.py` 中的方法是同步的，而路由是异步的，需要使用 `loop.run_in_executor` 在线程池中执行：

```python
import asyncio

loop = asyncio.get_event_loop()
result = await loop.run_in_executor(
    None,  # 使用默认线程池
    sync_function,  # 同步函数
    arg1, arg2  # 参数
)
```

### 错误处理
捕获 `FutuAPIError` 并转换为 HTTP 异常：

```python
from tradingagents.dataflows.futu_trading import FutuAPIError

try:
    result = await loop.run_in_executor(None, get_positions, market, user_id)
except FutuAPIError as e:
    if e.error_type == "auth":
        raise HTTPException(status_code=401, detail=str(e))
    elif e.error_type == "network":
        raise HTTPException(status_code=503, detail=str(e))
    else:
        raise HTTPException(status_code=500, detail=str(e))
```

### 配置传递
确保在调用工具方法前，用户配置已经加载到缓存中。工具方法会自动从缓存读取配置。

## 相关文件

- `tradingagents/dataflows/futu_trading.py` - Futu API 工具方法
- `web/backend/routes/intraday_trading_routes.py` - 智能盯盘路由
- `web/backend/services/user_config_cache.py` - 用户配置缓存
- `web/backend/services/futu_async_wrapper.py` - 可能需要删除
