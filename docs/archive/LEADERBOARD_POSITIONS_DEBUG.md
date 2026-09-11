# 排行榜持仓价格调试

## 问题描述

用户反馈排行榜中的"当前价格"显示与"成本价"相同，没有显示实时市场价格。

## 问题分析

1. **后端数据源**：排行榜和智能盯盘都从Futu API获取实时持仓数据
2. **数据字段**：
   - `cost_price` - 成本价（开仓价）
   - `current_price` - 当前市场价格
   - `profit_loss` - 盈亏金额
   - `profit_loss_ratio` - 盈亏比例

3. **前端显示**：
   - 开仓价格：`position.first_open_price`（映射自 `cost_price`）
   - 当前价格：`position.current_price`

## 修改内容

### 1. 后端返回数据结构对齐

**文件**：`web/backend/routes/public_leaderboard_routes.py`

**修改**：
- 添加 `stock_name` 字段
- 同时返回 `cost_price` 和 `first_open_price`（保持兼容性）
- 添加详细的调试日志，输出Futu API返回的原始数据

```python
all_positions.append({
    "stock_code": stock_code,
    "stock_name": stock_name,
    "market_type": market,
    "quantity": int(quantity),
    "cost_price": round(cost_price, 2),           # 成本价
    "current_price": round(current_price, 2),     # 当前价格（实时）
    "market_value": round(market_value, 2),
    "unrealized_pnl": round(profit_loss, 2),
    "pnl_percentage": round(profit_loss_ratio * 100, 2),
    "first_open_price": round(cost_price, 2),     # 别名，兼容前端
    "first_open_time": first_open_time.isoformat() if first_open_time else None,
})
```

### 2. 调试日志

添加了详细的日志输出，用于诊断Futu API返回的数据：

```python
print(f"[Leaderboard] {stock_code} ({market}) - Raw API data:")
print(f"  cost_price: {cost_price}, current_price: {current_price}")
print(f"  market_value: {market_value}, profit_loss: {profit_loss}")
print(f"  Full position data: {pos}")
```

## 可能的原因

如果 `current_price` 仍然等于 `cost_price`，可能的原因：

1. **Futu API返回的数据问题**：
   - API本身返回的 `current_price` 就等于 `cost_price`
   - 需要检查Futu API的实现

2. **市场休市**：
   - 如果市场未开盘，`current_price` 可能显示为上一个收盘价
   - 这可能恰好等于成本价

3. **数据缓存**：
   - Futu API可能缓存了旧数据
   - 需要等待数据刷新

## 验证步骤

1. **重启后端服务**：
   ```bash
   # 停止当前服务
   # 重新启动
   python web/backend/app_v2.py
   ```

2. **查看后端日志**：
   - 检查 `[Leaderboard]` 开头的日志
   - 确认Futu API返回的原始数据

3. **对比智能盯盘**：
   - 在智能盯盘页面查看相同股票的持仓
   - 对比"当前价格"是否一致

4. **检查市场状态**：
   - 确认市场是否开盘
   - 开盘时间内价格应该实时变化

## 下一步

如果问题仍然存在：

1. **检查Futu API实现**：
   - 查看 `futu-api` 服务的代码
   - 确认 `/api/positions` 接口返回的 `current_price` 是否正确

2. **对比智能盯盘的数据**：
   - 如果智能盯盘显示正确，说明Futu API没问题
   - 问题可能在排行榜的数据处理逻辑

3. **前端缓存**：
   - 清除浏览器缓存
   - 强制刷新页面（Ctrl+F5）

## 相关文件

- `web/backend/routes/public_leaderboard_routes.py` - 排行榜持仓API
- `web/backend/routes/intraday_trading_routes.py` - 智能盯盘持仓API（参考）
- `web/frontend/src/components/leaderboard/UserDetailPanel.tsx` - 前端显示组件
