# 今日订单功能实现

## 概述

在智能盯盘页面新增"今日订单"模块，显示当日的下单记录列表，并支持手动撤单功能。

## 功能特性

### 1. 今日订单列表
- 显示当日所有订单记录
- 支持按状态筛选：全部、已成交、待成交、已撤销
- 跟随市场切换自动刷新
- 根据市场类型自动显示对应货币符号（$、HK$、¥）

### 2. 订单信息展示
每条订单显示以下信息：
- 买入/卖出标识（红色买入、绿色卖出）
- 股票代码
- 订单类型（限价/市价）
- 订单状态（已成交/待成交/已撤销/已拒绝）
- 数量
- 价格（限价单）
- 已成交数量
- 下单时间
- 订单号

### 3. 撤单功能
- 待成交订单显示"撤单"按钮
- 点击撤单需要确认
- 撤单过程中显示加载状态
- 撤单成功/失败显示提示信息

## 技术实现

### 前端组件

#### 1. TodayOrders 组件
**文件**: `web/frontend/src/components/intraday/TodayOrders.tsx`

主要功能：
- 使用 `useOrders` hook 获取订单数据
- 使用 `useCancelOrder` hook 处理撤单操作
- 根据 `selectedMarket` 显示对应市场的订单
- 自动过滤今日订单（比较日期部分）
- 支持状态筛选（全部/已成交/待成交/已撤销）

#### 2. React Query Hooks
**文件**: `web/frontend/src/hooks/useIntradayTrading.ts`

新增 hooks：
```typescript
// 获取订单列表
export function useOrders(market: string, filterStatus: number)

// 撤销订单
export function useCancelOrder()
```

特性：
- `useOrders`: 禁用自动刷新，仅在切换市场或手动触发时刷新
- `useCancelOrder`: 成功后自动刷新订单列表

#### 3. API Client
**文件**: `web/frontend/src/lib/apiClient.ts`

新增 API 方法：
```typescript
// 获取订单列表
getOrders: async (market: string, filterStatus: number)

// 撤销订单
cancelOrder: async (orderId: string, stockCode: string)
```

### 后端 API

#### 1. 获取订单列表
**端点**: `GET /api/intraday/orders`

参数：
- `market`: 市场类型（US/HK/CN）
- `filter_status`: 状态筛选（0=全部, 1=已成交, 2=待成交, 3=已撤销）

返回：订单列表数组

#### 2. 撤销订单
**端点**: `POST /api/intraday/cancel-order`

请求体：
```json
{
  "order_id": "订单ID",
  "stock_code": "股票代码"
}
```

返回：撤单结果

### 富途 API 集成

后端使用 `web/backend/services/futu_async_wrapper.py` 中的异步封装接口：

1. **get_orders_async()**: 获取订单列表（异步）
   - 参数：market_type, filter_status, user_id
   - 内部调用 `tradingagents.dataflows.futu_trading.get_orders()`
   - 使用 `asyncio.to_thread()` 避免阻塞
   - 支持状态筛选
   - 自动处理富途 API 响应格式（`{"list": [...]}`）
   - 自动映射字段名称（id→order_id, side→BUY/SELL, status→filled/pending/cancelled等）

2. **cancel_order_async()**: 撤销订单（异步）
   - 参数：order_id, stock_code, user_id
   - 内部调用 `tradingagents.dataflows.futu_trading.cancel_order()`
   - 使用 `asyncio.to_thread()` 避免阻塞
   - 返回撤单结果

#### 富途 API 字段映射

富途 API 返回的字段会自动映射为标准格式：

| 富途 API 字段 | 标准字段 | 说明 |
|--------------|---------|------|
| `id` | `order_id` | 订单ID |
| `side` ("A"/"S") | `side` ("BUY"/"SELL") | 买卖方向 |
| `status` ("2"/"3"/"4") | `status` ("pending"/"filled"/"cancelled") | 订单状态 |
| `order_type` (1/2) | `order_type` ("LIMIT"/"MARKET") | 订单类型 |
| `matched_qty` | `filled_quantity` | 已成交数量 |
| `created_at` | `create_time` | 创建时间 |

## 页面布局

智能盯盘页面模块顺序：
1. 控制面板（ControlPanel）
2. 账户信息（AccountInfo）
3. 持仓概览（PositionOverview）
4. **今日订单（TodayOrders）** ← 新增
5. 决策历史（DecisionHistory）

## 货币符号适配

根据市场类型自动显示对应货币符号：
- **美股 (US)**: $
- **港股 (HK)**: HK$
- **A股 (CN)**: ¥

使用 `getCurrencySymbol()` 工具函数（来自 `@/utils/marketCurrency`）

## 数据刷新策略

订单数据在以下情况下刷新：
1. **切换市场**: 切换市场类型时自动刷新对应市场的订单
2. **手动刷新**: 点击账户信息区域的"刷新"按钮，同时刷新账户、持仓和订单信息
3. **决策完成**: 智能决策会话完成后刷新订单（可能有新的交易）
4. **交易操作**: 通过 WebSocket 监听到下单或撤单操作时刷新
5. **手动撤单**: 用户手动撤单成功后刷新订单列表

这种策略与账户信息、持仓信息保持一致，避免不必要的 API 调用。

## 用户体验优化

1. **智能刷新**: 跟随市场切换和交易操作自动刷新，无需手动刷新
2. **状态筛选**: 快速切换查看不同状态的订单
3. **确认机制**: 撤单前需要用户确认
4. **加载状态**: 撤单过程中显示加载动画
5. **错误处理**: 失败时显示友好的错误提示
6. **空状态**: 无订单时显示友好的空状态提示
7. **响应式设计**: 适配移动端和桌面端

## 权限控制

- 需要登录认证
- 需要短线交易权限（`can_access_intraday_trading` 或管理员）
- 需要配置富途 API

## 文件清单

### 新增文件
- `web/frontend/src/components/intraday/TodayOrders.tsx` - 今日订单组件

### 修改文件
- `web/frontend/src/hooks/useIntradayTrading.ts` - 新增订单相关 hooks
- `web/frontend/src/lib/apiClient.ts` - 新增订单 API 方法
- `web/frontend/src/app/intraday-trading/page.tsx` - 集成今日订单组件
- `web/backend/routes/intraday_trading_routes.py` - 新增订单相关端点

## 测试建议

1. **功能测试**
   - 验证订单列表正确显示
   - 验证状态筛选功能
   - 验证撤单功能
   - 验证货币符号显示

2. **边界测试**
   - 无订单时的显示
   - 网络错误时的处理
   - 撤单失败时的处理

3. **性能测试**
   - 大量订单时的渲染性能
   - 切换市场时的响应速度

## 后续优化建议

1. 支持订单详情查看
2. 支持订单搜索和排序
3. 支持导出订单记录
4. 添加订单统计信息（今日成交笔数、成交金额等）
5. 支持修改订单（改价、改量）
6. 添加订单历史记录（不限今日）
